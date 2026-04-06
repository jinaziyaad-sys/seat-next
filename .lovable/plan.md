

# Fix: Wire Promo Campaigns to Stripe Payment

## Problem
The merchant `SponsoredAdsManager` creates campaigns directly in the database with `payment_status: 'pending'` but **never calls the `create-promo-checkout` edge function**. No Stripe checkout happens — merchants get ads without paying.

The edge function and webhook handler both exist and work. The only gap is the frontend flow.

## Solution
After inserting the campaign row, call `create-promo-checkout` with the new campaign ID, then redirect the merchant to Stripe Checkout. On return, the webhook marks `payment_status: 'paid'`.

## Changes

### `src/components/merchant/SponsoredAdsManager.tsx`
- After successful campaign insert, immediately invoke `create-promo-checkout` with the campaign ID
- Redirect merchant to the Stripe checkout URL in a new tab
- Update the "Pay & Submit" button text to indicate payment redirect
- On the campaign list, show a `payment_status` badge alongside the review status (unpaid / paid)
- Add a "Pay Now" button on unpaid campaigns so merchants can retry payment

### `supabase/functions/create-promo-checkout/index.ts`
- No changes needed — already creates a one-off Stripe checkout session using `amount_charged` from the campaign row

### `supabase/functions/stripe-webhook/index.ts`
- No changes needed — already handles `checkout.session.completed` for `type: "promo_campaign"` metadata

## Flow After Fix

```text
Merchant fills form → Insert campaign (payment_status: pending)
  → Call create-promo-checkout edge function
  → Redirect to Stripe Checkout
  → Merchant pays
  → Stripe webhook fires checkout.session.completed
  → webhook updates promo_campaigns.payment_status = 'paid'
  → Dev reviews & approves campaign
  → Campaign goes live
```

## Files Modified
- `src/components/merchant/SponsoredAdsManager.tsx` — add Stripe checkout call after insert, payment badges, retry button

