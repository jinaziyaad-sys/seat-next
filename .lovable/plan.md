

# Remaining Monetization Work - Status Assessment & Next Steps

## Current Status

| Item | Status |
|------|--------|
| Stripe checkout + subscription verification | Done |
| Monthly/Annual pricing toggle | Done (wired with correct price IDs) |
| Feature gating (Starter/Pro/Enterprise) | Done |
| Merchant billing page with portal link | Done |
| Invoice history (merchant-facing) | Done (reads from billing_invoices) |
| Dev billing dashboard + pricing overrides | Done |
| Per-venue subscription isolation | Done |
| Stripe webhook (real-time sync) | Done |
| update-subscription edge function | Done |
| Cancellation via Stripe portal | Done (button exists on billing page) |
| Multi-venue selector on login | Done |
| **7-day free trial** | **Missing** |
| **Dev invoice generation UI** | **Partially done** (UI exists but no Stripe invoice creation) |
| **PayFast integration** | **Not started** |
| **Sponsored ads self-checkout** | **Not started** |
| **Dev-to-merchant announcements** | **Not started** |

---

## What to Build Now

### 1. Add 7-Day Free Trial to Stripe Checkout

**What changes:**
- `create-checkout` edge function: add `subscription_data.trial_period_days: 7` to the Stripe checkout session
- `check-subscription` edge function: handle `trialing` status from Stripe (currently only checks `active`)
- `useMerchantSubscription.ts`: map `trialing` to the existing `trial` status
- `MerchantBilling.tsx`: show trial badge and days remaining
- `MerchantSignup.tsx`: update CTA text to "Start 7-Day Free Trial"
- `stripe-webhook`: handle `customer.subscription.trial_will_end` event (optional notification)

### 2. Dev Invoice Generation via Stripe

**What changes:**
- `BillingDashboard.tsx`: wire the existing "Generate Invoice" dialog to call Stripe's invoice API (create invoice item + finalize invoice) via a new edge function
- New edge function `create-invoice`: creates a Stripe invoice for a venue's customer, writes to `billing_invoices` table
- The merchant then sees it in their invoice history (already built)

### 3. Cancellation Confirmation (UX improvement)

Currently the "Manage Cancellation" button opens the Stripe portal which handles everything. This is already functional. No code change needed unless you want an in-app confirmation dialog before redirecting.

---

## Technical Details

**Files modified:**
- `supabase/functions/create-checkout/index.ts` — add `trial_period_days: 7`
- `supabase/functions/check-subscription/index.ts` — handle `trialing` status alongside `active`
- `supabase/functions/stripe-webhook/index.ts` — handle `trialing` status in subscription updates
- `src/hooks/useMerchantSubscription.ts` — map trialing to trial status
- `src/pages/MerchantBilling.tsx` — show trial info (days remaining, trial badge)
- `src/pages/MerchantSignup.tsx` — update button text to mention free trial

**New files:**
- `supabase/functions/create-invoice/index.ts` — Stripe invoice generation for dev dashboard

**No database changes needed.**

---

## Future Phases (not this session)

- **PayFast integration** — SA payment gateway alternative
- **Sponsored ads self-checkout** — merchant promotion purchase flow
- **Dev-to-merchant announcements** — in-app broadcast system

