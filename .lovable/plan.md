

# Fix Plan Change Flow

## Root Cause
From the edge function logs, three issues are clear:

1. **Stale portal config reused**: The function finds an old config `bpc_1TIv4tRrnmiHUS0LDJ2isSoG` created before products were properly set up. This config likely only has cancellation enabled — no subscription_update with products.
2. **`excludedPrice: null`**: The customer is found by email (not from `merchant_subscriptions`), so there's no `stripe_subscription_id` to look up the current price. Without knowing the current price, the products config is malformed.
3. **Portal configs are limited**: Stripe limits how many portal configurations you can create. Constantly creating new ones isn't viable.

## Solution: Don't Use Stripe Portal for Plan Changes

The Stripe customer portal is the wrong tool for plan switching in this app. It's designed for simple setups with pre-configured products — our app has dynamic plans, multi-currency, and custom pricing. Instead:

- **"Change Plan"** → Navigate to `/merchant/signup?upgrade=true&venueId=xxx` (the existing upgrade flow with our own plan cards, currency selector, and checkout)
- **"Manage Billing"** → Opens Stripe portal for payment method updates, invoice history, and cancellation only

### Changes

**1. `src/pages/MerchantBilling.tsx`**
- Split the current single "Change Plan" button into two:
  - "Change Plan" → `navigate(/merchant/signup?upgrade=true&venueId=...)`
  - "Manage Billing" → opens portal (for payment/cancel only)
- This gives merchants a clear, familiar plan selection UI instead of the sparse Stripe portal

**2. `supabase/functions/customer-portal/index.ts`**
- Remove all `subscription_update` configuration — the portal should only handle payment methods, cancellation, and invoice history
- Remove the products lookup entirely (no longer needed)
- Simplify the config: just enable `payment_method_update`, `subscription_cancel`, and `invoice_history`
- Always create a simple config (or reuse one) without products

## Files Modified
| File | Change |
|------|--------|
| `src/pages/MerchantBilling.tsx` | Split "Change Plan" into navigate-to-upgrade + manage-billing buttons |
| `supabase/functions/customer-portal/index.ts` | Remove subscription_update; keep only payment/cancel/invoices |

