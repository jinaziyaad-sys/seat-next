

## Fix Billing System End-to-End

### Root Cause Analysis

I've identified several critical bugs and UX issues by examining Stripe data, edge function logs, and the frontend code:

**Bug 1: Plan got changed for "zii" — Subscription cross-contamination**
The `check-subscription` function, when the stored subscription is canceled, calls `findVenueScopedStripeSubscription` which iterates ALL customers for the user's email. Your user has one Stripe customer (`cus_UHR5zV0JvZkHCi`) with subscriptions for multiple venues. The trialing Enterprise sub (`sub_1TLnD7RrnmiHUS0Ly6IVhUuc`) has `venue_id` metadata for one venue, but if the venue_id metadata doesn't match exactly, the recovery logic falls through and returns `status: none`. Meanwhile, the same sub might get incorrectly claimed by a different venue's check. This is why "zii's" plan appears to change.

**Bug 2: Same plan re-purchase allowed**
The current plan card has `opacity-60 cursor-not-allowed` and `onClick` is guarded by `!isCurrent`, but `currentPlanId` is loaded from the `merchant_subscriptions` table. When `check-subscription` syncs `status: none`, the `plan_id` in the DB becomes stale or null, so `currentPlanId` doesn't match — allowing the user to re-purchase the same plan.

**Bug 3: Billing page is slow**
The `check-subscription` edge function makes 5+ Stripe API calls per invocation (list customers, list subscriptions for each customer, retrieve subscription). It's called on every page load AND every 60 seconds. For a user with 11 canceled subscriptions across a single customer, this is very slow.

**Bug 4: Currency not auto-detecting to ZAR**
`detectCurrency()` uses `navigator.language` to extract region. For South Africa, the locale should be `en-ZA`, which correctly maps to ZAR. However, some browsers return `en` without a region suffix, defaulting to USD. The function needs a more robust fallback.

**Bug 5: Stripe webhook has `payment_provider: 'stripe'` reference**
Line 138 in `stripe-webhook/index.ts` still sets `payment_provider: 'stripe'` — but we dropped that column in the PayFast removal migration. This will cause webhook upserts to fail silently.

### Changes

#### 1. Fix webhook — remove `payment_provider` reference
**File:** `supabase/functions/stripe-webhook/index.ts`
- Remove `payment_provider: 'stripe'` from line 138 in the `subData` object (column was dropped)

#### 2. Fix check-subscription performance and correctness
**File:** `supabase/functions/check-subscription/index.ts`
- **Performance:** Cache the Stripe customer list at the top of the function and reuse it, instead of calling `stripe.customers.list` in both the main flow and `findVenueScopedStripeSubscription`
- **Correctness:** When the stored subscription is canceled and recovery finds a new active sub for a *different* venue, it should NOT claim it. Add stricter venue_id metadata matching — only claim subs where `metadata.venue_id === venueId` (score 3), not just DB-claimed ones (score 2)
- **Performance:** Reduce the polling interval from 60s to 120s in the hook, since the webhook handles real-time updates

#### 3. Prevent same-plan re-purchase
**File:** `src/pages/MerchantSignup.tsx`
- The `currentPlanId` lookup queries `merchant_subscriptions` which may be stale. Also query the active Stripe subscription's product to determine the real current plan
- Alternatively, on the upgrade page, call `check-subscription` first to get the current `product_ids`, then match against plans to determine the truly active plan and disable it
- Add a server-side guard in `create-checkout` to reject checkout if the venue already has an active subscription on the same plan

#### 4. Fix currency auto-detection
**File:** `src/utils/currency.ts`
- Enhance `detectCurrency()` to also check `Intl.DateTimeFormat().resolvedOptions().timeZone` as a fallback. If timezone is `Africa/Johannesburg`, default to ZAR
- Add timezone-to-currency mapping as secondary detection

#### 5. Fix create-checkout server-side guard for same plan
**File:** `supabase/functions/create-checkout/index.ts`
- Before creating the checkout session, check if the venue already has an active subscription on the same plan/product. If so, return an error "You are already on this plan"

#### 6. Reduce polling frequency
**File:** `src/hooks/useMerchantSubscription.ts`
- Change interval from 60000ms to 120000ms
- The webhook already handles real-time updates; polling is just a fallback

### Files Affected

| File | Change |
|------|--------|
| `supabase/functions/stripe-webhook/index.ts` | Remove `payment_provider` column reference |
| `supabase/functions/check-subscription/index.ts` | Performance: reuse customer list, stricter venue matching |
| `supabase/functions/create-checkout/index.ts` | Add same-plan guard |
| `src/pages/MerchantSignup.tsx` | Fetch current plan from subscription hook, not stale DB |
| `src/utils/currency.ts` | Add timezone-based fallback for ZAR detection |
| `src/hooks/useMerchantSubscription.ts` | Reduce polling to 120s |

### Stripe Data Cleanup
The user's Stripe customer `cus_UHR5zV0JvZkHCi` has the trialing Enterprise sub `sub_1TLnD7RrnmiHUS0Ly6IVhUuc`. The DB for venue `7e80a653...` still points to the canceled `sub_1TM60iRrnmiHUS0LiMA7Vu3B`. After deploying the fixed `check-subscription`, the next poll will discover and sync the correct trialing subscription.

