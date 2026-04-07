

# Fix Loyalty Tab Visibility & La-tayy Plan Sync

## Issues Found

### Issue 1: Zii's Place — Loyalty tab invisible despite Enterprise plan
- **Root cause**: The loyalty tab visibility depends on `loyaltyAdminEnabled`, which requires a `loyalty_programs` row to exist for the venue (line 195: `!!loyaltyData`). Zii's Place has no loyalty_programs row yet, so `loyaltyAdminEnabled = false`, making both `hasLoyalty` and `loyaltyLocked` false — the tab is completely hidden.
- **Expected behavior**: Enterprise venues should see the Loyalty tab even without a pre-existing loyalty program, so they can set one up.

### Issue 2: La-tayy — Still showing Pro instead of Enterprise
- **Root cause**: The `merchant_subscriptions` table still has the old Pro Stripe subscription ID (`sub_1TJGJJRrnmiHUS0Lkgw2BZV3`). When `check-subscription` retrieves this from Stripe, it's still active/trialing, so the recovery path (which searches for newer subs) never triggers. The newer Enterprise subscription exists but is unclaimed.
- **Fix**: The old Pro subscription needs to be cancelled in Stripe, and the DB record updated to point to the Enterprise subscription.

## Plan

### 1. Fix loyalty tab visibility logic (`src/pages/MerchantDashboard.tsx`)
- Change `loyaltyAdminEnabled` to be true when the venue has the `loyalty` feature entitled, regardless of whether a `loyalty_programs` row exists
- Current logic: `hasLoyalty = loyaltyAdminEnabled && subscription.hasFeature('loyalty')`
- New logic: `hasLoyalty = subscription.hasFeature('loyalty')` — if the plan includes loyalty, show the tab. The `loyaltyAdminEnabled` check (which requires a DB row) should only gate whether the program is *active for patrons*, not whether the merchant can access the management UI.
- Also update `loyaltyLocked` to show the locked tab for non-Enterprise plans even without a loyalty_programs row: `loyaltyLocked = !subscription.hasFeature('loyalty') && subscription.subscribed`

### 2. Fix La-tayy's stale subscription
- Cancel the old Pro subscription (`sub_1TJGJJRrnmiHUS0Lkgw2BZV3`) in Stripe
- The next `check-subscription` call will then trigger the recovery path, find the active Enterprise subscription, and sync it to the DB automatically

### 3. Prevent future duplicate subscriptions (`supabase/functions/create-checkout/index.ts`)
- Before creating a new checkout session for an upgrade, cancel any existing active Stripe subscription for the same venue
- This prevents the accumulation of multiple active subscriptions when merchants change plans

## Files Modified
| File | Change |
|------|--------|
| `src/pages/MerchantDashboard.tsx` | Decouple loyalty tab visibility from loyalty_programs row existence |
| `supabase/functions/create-checkout/index.ts` | Cancel existing venue subscription before creating new checkout |
| Stripe (manual) | Cancel stale Pro sub for La-tayy |

