

# Fix Sponsored Ads: Payment-Gated Activation + Rejection Refunds

## Problems

1. **Dev approve sets `is_active: true` without checking payment** — Line 359 of `PromotionsManager.tsx` blindly activates on approval, even if `payment_status` is still `pending`.
2. **No refund on rejection** — If a merchant has paid (via Stripe) and the dev rejects their campaign, there's no mechanism to refund the payment.
3. **Merchant-side badge logic shows "Live" for unpaid approved campaigns** — `getStatusBadge` in `SponsoredAdsManager.tsx` doesn't factor in payment status.

## Solution

### 1. Gate activation on payment (Dev side)
In `src/components/dev/PromotionsManager.tsx`:
- The "Approve" button should only set `is_active: true` if `payment_status === 'paid'`
- If payment is still pending, set `review_status: 'approved'` but keep `is_active: false`
- Show a visual indicator: "Approved — awaiting payment" vs "Live"

### 2. Auto-refund on rejection
Create a new edge function `refund-promo-campaign/index.ts`:
- Accepts a `campaignId`
- Looks up the campaign's Stripe payment (via `checkout.session.completed` metadata or a stored `stripe_payment_intent_id`)
- Issues a full Stripe refund
- Updates `payment_status` to `'refunded'`

This requires storing the Stripe Payment Intent ID on the campaign row — add a `stripe_payment_intent_id` column to `promo_campaigns`.

Update the dev "Reject" button to:
- If `payment_status === 'paid'`, call the refund function before marking as rejected
- Show a confirmation dialog: "This merchant has paid. Rejecting will issue a full refund."
- Add a text input for rejection reason (`review_notes`)

### 3. Fix merchant-side status display
In `src/components/merchant/SponsoredAdsManager.tsx`:
- Update `getStatusBadge` to show "Approved (Awaiting Payment)" when `review_status === 'approved'` and `payment_status !== 'paid'`
- Show "Refunded" badge when `payment_status === 'refunded'`

### 4. Store Payment Intent on webhook
In `supabase/functions/stripe-webhook/index.ts`:
- When handling `checkout.session.completed` for promo campaigns, also store `payment_intent` on the campaign row

## Database Migration
```sql
ALTER TABLE promo_campaigns 
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;
```

## Files

| File | Change |
|------|--------|
| `supabase/migrations/...` | Add `stripe_payment_intent_id` column |
| `supabase/functions/stripe-webhook/index.ts` | Store `payment_intent` on promo checkout completion |
| `supabase/functions/refund-promo-campaign/index.ts` | New — issues Stripe refund, updates status |
| `src/components/dev/PromotionsManager.tsx` | Gate activation on payment; add reject-with-refund flow with reason dialog |
| `src/components/merchant/SponsoredAdsManager.tsx` | Fix status badges; add "Refunded" state |

## Corrected Flow
```text
Merchant creates campaign → Pays via Stripe → payment_status = 'paid'
  → Dev reviews:
    ├─ Approve + paid → is_active = true (Live)
    ├─ Approve + unpaid → is_active = false (Approved, awaiting payment)
    └─ Reject + paid → Stripe refund issued → payment_status = 'refunded'
         Reject + unpaid → No refund needed
```

