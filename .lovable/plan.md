

# Fix: Plan Change Shouldn't Require Re-Signup

## Problem
When an existing merchant clicks "Change Plan", "View Plans & Upgrade", or "Choose a Plan" from the billing page or dashboard, they're sent to `/merchant/signup` — the full 4-step onboarding wizard (Choose Plan → Create Account → Set Up Venue → Payment). This forces them through account creation and venue setup again, even though they already have both.

## Root Cause
`MerchantSignup.tsx` has no "upgrade mode" — it always starts at step 0 and runs through all 4 steps. Every navigation to `/merchant/signup` from the dashboard or billing page hits the same flow.

## Solution

### Option A: Add upgrade mode via URL parameter (recommended)
When navigating from an existing merchant context, pass a query param like `?upgrade=true`. The signup page detects this, skips steps 1-2 (account + venue), and shows only plan selection + payment.

### Changes

**1. `src/pages/MerchantSignup.tsx`**
- Read `?upgrade=true` and optional `?venueId=xxx` from URL search params
- If `upgrade=true` and user is authenticated:
  - Skip steps 1 (Create Account) and 2 (Set Up Venue)
  - Use the passed `venueId` (or load it from the user's existing role)
  - Show only 2 steps: "Choose Plan" → "Payment"
  - Pre-select their current plan (greyed out) so they can pick a different one
- Update the step labels and progress bar to reflect the shorter flow

**2. `src/pages/MerchantBilling.tsx` (line 143)**
- Change navigation from `/merchant/signup` to `/merchant/signup?upgrade=true&venueId=${userRole.venue_id}`

**3. `src/pages/MerchantDashboard.tsx` (lines 442, 472, 692, 713)**
- All 4 navigations to `/merchant/signup` that come from an existing merchant context should append `?upgrade=true&venueId=${venueId}`
- The "Continue Setup" button (line 442) for incomplete onboarding should stay as-is (full wizard)

**4. `src/pages/MerchantSignup.tsx` — plan selection UI tweak**
- In upgrade mode, if merchant already has an active subscription, show their current plan with a "Current" badge and disable its select button
- Only allow selecting plans that differ from the current one
- For Stripe subscribers, the portal already handles proration — checkout creates a new subscription (Stripe cancels the old one automatically if configured, or the webhook should handle the swap)

### Flow Summary
```text
Existing merchant clicks "Change Plan" or "Upgrade"
  → /merchant/signup?upgrade=true&venueId=xxx
  → Detects auth + venueId → skips account & venue steps
  → Shows plan cards (current plan badged, others selectable)
  → Stripe checkout with venueId in metadata
  → Redirect back to dashboard
```

## Files Modified
| File | Change |
|------|--------|
| `src/pages/MerchantSignup.tsx` | Add upgrade mode: detect URL params, skip steps 1-2, badge current plan |
| `src/pages/MerchantBilling.tsx` | Pass `?upgrade=true&venueId=` in navigation |
| `src/pages/MerchantDashboard.tsx` | Same for all 4 upgrade/subscribe navigations (keep onboarding nav as-is) |

