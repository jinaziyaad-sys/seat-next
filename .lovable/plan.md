

# Payment Flow Audit & Fix Plan

## Issues Found

### 1. Feature Gating Uses Hardcoded Plan Names, Not DB `included_features`
**File**: `src/hooks/useMerchantSubscription.ts` lines 51-78
- `getEntitledFeatures()` hardcodes which features belong to which plan ("starter gets food_ordering, waitlist...", "pro adds analytics", "enterprise adds loyalty")
- The DB already has `included_features` on `subscription_plans` -- this should be the source of truth
- If the dev changes plan features in the DB, the frontend ignores them

### 2. `create-checkout` Doesn't Pass `venueId` in Stripe Metadata
**File**: `supabase/functions/create-checkout/index.ts` line 72
- Only passes `user_id` in metadata -- `venue_id` is missing
- `check-subscription` needs venue_id to claim the subscription for the right venue
- After checkout, `stripe-webhook` can't link the subscription to the venue

### 3. `stripe-webhook` Doesn't Handle `checkout.session.completed` for Subscriptions
**File**: `supabase/functions/stripe-webhook/index.ts` lines 139-174
- The `checkout.session.completed` handler only processes promo campaigns
- No code creates the initial `merchant_subscriptions` row with `stripe_customer_id` and `stripe_subscription_id` when a new subscription is created
- The system relies on `check-subscription` polling to eventually discover and claim the subscription -- fragile

### 4. `customer-portal` Creates a New Configuration Every Call
**File**: `supabase/functions/customer-portal/index.ts` line 92
- Every portal open creates a new `billingPortal.configurations.create()` -- Stripe limits these
- Should use a cached/stored configuration ID or catch the limit error

### 5. `update-subscription` Function Exists But Is Never Called
**File**: `supabase/functions/update-subscription/index.ts`
- This function does plan switching via API, but the billing page only uses customer-portal
- It doesn't check for trialing subscriptions (only looks at `status: "active"`)
- Orphaned code that adds confusion

### 6. PayFast vs Stripe: No Intelligent Auto-Selection
- The signup page (line 797) shows a manual toggle between Stripe and PayFast
- No guidance or auto-detection (e.g. by currency, locale, or country)
- PayFast doesn't support trial periods natively -- the ITN handler activates immediately as "active" with no trial

### 7. PayFast `check-subscription` Path Is Missing
**File**: `supabase/functions/check-subscription/index.ts`
- Only checks Stripe -- if a venue paid via PayFast, the function falls through to "no Stripe customer found" and returns `subscribed: false`
- PayFast venues rely entirely on the `merchant_subscriptions` DB row set by ITN, but `check-subscription` ignores it after line 135 if there's no `stripe_subscription_id`

### 8. Checkout Doesn't Pass `venueId` -- Subscription Can't Be Linked
**File**: `src/pages/MerchantSignup.tsx` line 355
- `handleCheckout` calls `create-checkout` without passing `venueId`
- The venue was just created in step 3 (`venueId` state is set), but it's not sent to checkout
- After payment completes, there's no way to associate the Stripe subscription with this venue except via email lookup

### 9. Plan Change Portal Shows All Plans Including Current (the "3 plans" issue)
- The portal configuration includes all active products with all prices
- Stripe portal shows them all, including the current plan, with no visual distinction
- Proration calculation is correct (Stripe handles it), but the UX is confusing

### 10. `determinePlanIdFromDb` Returns Plan Name, Not UUID
**File**: `supabase/functions/check-subscription/index.ts` line 465
- Returns `plan.name.toLowerCase()` (e.g. "starter") not the UUID
- `syncSubscriptionToDb` tries to match this via `ilike` (line 404) which is fragile
- Can fail to find the plan, falling back to any random plan

---

## Fix Plan

### A. Fix Feature Gating to Use DB `included_features` (useMerchantSubscription.ts)
- Load `included_features` alongside plans in `loadSubscriptionPlans()`
- Replace hardcoded `getEntitledFeatures()` with a lookup: find matching plan by product ID, return its `included_features` as the entitled set
- This makes dev DB changes propagate automatically

### B. Fix Checkout to Include `venueId` in Metadata (create-checkout + MerchantSignup)
- `MerchantSignup.tsx`: pass `venueId` in the checkout request body
- `create-checkout/index.ts`: read `venueId` from body, add to `subscription_data.metadata`
- `stripe-webhook/index.ts`: on `checkout.session.completed` for subscription mode, create/update `merchant_subscriptions` row using metadata `venue_id`

### C. Fix `stripe-webhook` to Handle New Subscriptions
- Add handler for `checkout.session.completed` when `session.mode === 'subscription'`
- Extract `venue_id` from metadata, create `merchant_subscriptions` row with customer_id and subscription_id
- This eliminates the reliance on polling to discover subscriptions

### D. Fix `check-subscription` to Support PayFast
- Before checking Stripe, check if `merchant_subscriptions` has a record with `payment_provider = 'payfast'` and `status` in ('active', 'trial')
- If found, load the plan from DB and return product IDs/features directly
- Skip Stripe API calls entirely for PayFast venues

### E. Fix `determinePlanIdFromDb` to Return UUID
- Return `plan.id` (UUID) instead of `plan.name.toLowerCase()`
- Remove the fragile `ilike` fallback in `syncSubscriptionToDb`

### F. Fix Customer Portal Configuration Caching
- Use `stripe.billingPortal.configurations.list()` first to find an existing config
- Only create a new one if none exists or the products have changed
- Filter out the customer's current price from the products list to avoid showing 3 identical-looking options

### G. Auto-Detect Payment Provider
- On the signup payment step, detect South African merchants by:
  1. Check if venue address contains "South Africa" or country code "ZA"  
  2. Check currency from plan (ZAR = default PayFast)
- Auto-select PayFast for SA merchants, Stripe for international
- Still allow manual override via toggle

### H. Remove Unused `update-subscription` Function
- Delete `supabase/functions/update-subscription/index.ts`
- Remove its config entry from `supabase/config.toml`
- Plan switching is handled through the portal

### I. PayFast Trial Support
- PayFast doesn't support native trials -- when a PayFast merchant starts, set `status: 'trial'` and `trial_ends_at` to 7 days from now in `merchant_subscriptions`
- First ITN payment should check if trial is still active and extend appropriately
- Or: defer first PayFast charge by using the `billing_date` field (already set but not offset)

---

## Files Modified

| File | Change |
|------|--------|
| `src/hooks/useMerchantSubscription.ts` | Use DB `included_features` instead of hardcoded feature sets |
| `src/pages/MerchantSignup.tsx` | Pass `venueId` to checkout; auto-detect payment provider |
| `supabase/functions/create-checkout/index.ts` | Accept and store `venueId` in Stripe metadata |
| `supabase/functions/stripe-webhook/index.ts` | Handle `checkout.session.completed` for subscriptions |
| `supabase/functions/check-subscription/index.ts` | Support PayFast path; fix `determinePlanIdFromDb` to return UUID |
| `supabase/functions/customer-portal/index.ts` | Cache portal config; exclude current plan |
| `supabase/functions/payfast-checkout/index.ts` | Set `billing_date` 7 days out for trial |
| `supabase/functions/payfast-itn/index.ts` | Handle trial-to-active transition |
| `supabase/functions/update-subscription/index.ts` | Delete (unused) |
| `supabase/config.toml` | Remove `update-subscription` entry |
| `src/pages/MerchantBilling.tsx` | No changes needed (already delegates to portal) |

## Implementation Order
1. Fix `determinePlanIdFromDb` to return UUIDs (quick, high-impact)
2. Fix `create-checkout` + `MerchantSignup` to pass venueId
3. Fix `stripe-webhook` to handle new subscription creation
4. Fix `check-subscription` for PayFast path
5. Fix `useMerchantSubscription` feature gating
6. Fix customer portal config caching
7. Auto-detect payment provider
8. PayFast trial support
9. Remove `update-subscription`

