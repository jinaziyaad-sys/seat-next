<final-text>You're right — the billing flow is not stable yet. I checked the code and logs, and there are a few concrete issues causing the slow loads, plan flipping, and repeated edge-function noise.

## What’s actually going wrong

1. **`check-subscription` is still too heavy and too destructive**
   - The billing page blocks on `useMerchantSubscription()`, which calls `check-subscription`.
   - That edge function still scans Stripe customers/subscriptions and, if recovery fails, it writes the venue back to `status: none`.
   - Your logs show this exact pattern repeatedly: stored subscription treated as inactive, then synced to `none`.

2. **Multi-restaurant Stripe scoping is still not safe enough**
   - `create-checkout` still chooses customers mainly by **email + currency**, not strictly by **venue**.
   - `stripe-webhook` and `customer-portal` still rely too much on `stripe_customer_id`.
   - For a user with multiple restaurants, that can cross-wire venues and make plans appear to “change”.

3. **Downgrade logic is wrong**
   - `change-plan` updates Stripe immediately and also updates `merchant_subscriptions.plan_id` immediately.
   - That means the UI can show the lower plan before the current billing cycle ends.
   - So even when the copy says “end of cycle”, the system state is already changing now.

4. **There are duplicate subscription checks**
   - The normal hook checks subscription status.
   - The checkout page also polls `check-subscription` every 3 seconds for up to 5 minutes.
   - That likely explains the “2x edge function” feeling and adds unnecessary load.

## Fix plan

### 1. Make Stripe venue-scoped properly
- Update `create-checkout` so Stripe customers are found/created by **exact venue context**, not just email reuse.
- Store and reuse the correct venue-scoped customer/subscription path consistently.
- Stop any fallback that can let one venue accidentally “claim” another venue’s subscription.

### 2. Make webhook updates authoritative and venue-safe
- Update `stripe-webhook` to resolve the venue from **subscription metadata / checkout metadata**, not customer ID alone.
- For invoice events, resolve the related subscription first, then map back to the correct venue.
- This becomes the main sync path so the app is not relying on slow Stripe scans on page load.

### 3. Make `check-subscription` fast and non-destructive
- Refactor it to be **DB-first** for normal page loads.
- Only reconcile with Stripe when necessary: missing row, explicit refresh, post-checkout sync, or stale data.
- If Stripe lookup fails, do **not** overwrite the venue to `none`.
- Return the last known good state instead and log the failure cleanly.

### 4. Fix upgrade vs downgrade behavior properly
- **Upgrades:** apply immediately with proration/difference only.
- **Downgrades:** keep the current plan active until period end, then switch.
- **Cancellations:** retain access until the end date.
- Add pending-change tracking so the UI can show:
  - current plan
  - scheduled next plan
  - effective date

### 5. Reduce billing-page wait time
- Stop making the whole billing page wait on a full Stripe reconciliation.
- Show the billing page immediately with cached/current DB state while background sync runs.
- Replace the aggressive 3-second checkout polling with a short bounded sync flow after return from Stripe.

### 6. Make the UI explicitly show billing state
- Billing page should clearly show:
  - current plan
  - renewal/end date
  - pending downgrade/cancel date
  - whether the state is from Stripe sync or a manual/dev override
- If a dev pricing override exists, surface it clearly instead of letting it silently look like a Stripe plan.

## Technical details

### Files to update
- `supabase/functions/check-subscription/index.ts`
- `supabase/functions/create-checkout/index.ts`
- `supabase/functions/change-plan/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/customer-portal/index.ts`
- `src/hooks/useMerchantSubscription.ts`
- `src/pages/MerchantBilling.tsx`
- `src/pages/MerchantSignup.tsx`

### Likely DB change
Add pending lifecycle fields to `merchant_subscriptions`, e.g.:
- `pending_plan_id`
- `pending_billing_cycle`
- `pending_change_at`

That lets the app keep the real current plan active while still showing a scheduled downgrade or cancellation correctly.

## What I’ll verify after implementing
- Billing page loads fast
- No plan flipping between restaurants
- Same-plan purchase is blocked
- Upgrade bills only the prorated difference
- Downgrade does not reduce access early
- Cancellation shows correct end date
- Stripe checkout + return flow updates the current app correctly
- Webhook and UI stay in sync
- No duplicate/looping `check-subscription` failures in logs

This is the right fix path for making billing stable instead of patching symptoms.</final-text>