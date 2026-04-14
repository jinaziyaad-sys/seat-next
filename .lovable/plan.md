

## Fix Billing, Loyalty Tab & Post-Payment Experience

### Three Issues to Address

**Issue 1: Multi-venue billing correctness**
The `useMerchantSubscription` hook already accepts `venueId` and the `check-subscription` edge function scopes by `venueId`. The `MerchantBilling.tsx` correctly passes `userRole?.venue_id`. This appears correct. However, when switching venues via `VenueSwitcher`, the billing page doesn't re-scope because `userRole` updates but the billing page might not re-render cleanly. Will verify the hook re-fires on venue change — this should work since `venueId` is a dependency of `checkSubscription`. No code change expected unless testing reveals an issue.

**Issue 2: Loyalty tab hidden on non-Enterprise plans**
Current code at line 377: `const loyaltyLocked = !subscription.hasFeature('loyalty') && subscription.subscribed;`
This means loyalty tab only shows if `subscription.subscribed` is true. If `subscription.subscribed` is false (no subscription at all), the tab is completely hidden. The fix: always show the Loyalty tab (with lock icon) as long as the user is an admin, regardless of subscription status. Same pattern as Reports/Analytics.

**Issue 3: Stripe checkout opens in new tab, dashboard still shows old state**
Current code at `MerchantSignup.tsx` line 437: `window.open(data.url, '_blank')` — this opens Stripe in a new tab. After payment, Stripe redirects to `/merchant/dashboard?checkout=success`, but that lands in the new tab while the old tab stays on the signup page.

Fix: Use `window.location.href` instead of `window.open` to redirect in the same tab. The success URL already points to `/merchant/dashboard?checkout=success`. Then add a success toast/banner in MerchantDashboard when `checkout=success` query param is detected.

### Changes

#### 1. `src/pages/MerchantDashboard.tsx`
- Change loyalty visibility: always show the Loyalty tab (with lock icon) for admins, even if not subscribed
- `loyaltyLocked` should be `!subscription.hasFeature('loyalty')` (remove `&& subscription.subscribed`)
- Add `checkout=success` query param detection: show a welcome toast ("Payment confirmed! Welcome to [Plan]") and clear the param from the URL
- The `useMerchantSubscription` hook polls every 60s, so after redirect back from Stripe it will pick up the new subscription quickly. Add a manual re-check trigger on mount when `checkout=success` is detected.

#### 2. `src/pages/MerchantSignup.tsx`
- Line 437: Change `window.open(data.url, '_blank')` to `window.location.href = data.url` so Stripe checkout happens in the same tab

#### 3. `src/hooks/useMerchantSubscription.ts`
- No changes needed — it already scopes by `venueId` and re-fires when it changes

### Files Affected

| File | Change |
|------|--------|
| `src/pages/MerchantDashboard.tsx` | Always show Loyalty tab; add checkout success detection |
| `src/pages/MerchantSignup.tsx` | Redirect in same tab instead of new tab |

