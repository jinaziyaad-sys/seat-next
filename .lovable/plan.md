

## Remove PayFast Entirely — Stripe Only

### Rationale
Stripe works globally (including South Africa with ZAR), so PayFast adds unnecessary complexity. Removing it simplifies the payment flow, reduces code surface, and eliminates provider-selection UI.

### Changes

#### 1. Delete Edge Functions
- Delete `supabase/functions/payfast-checkout/index.ts`
- Delete `supabase/functions/payfast-itn/index.ts`

#### 2. Remove from `supabase/config.toml`
- Remove the `[functions.payfast-checkout]` and `[functions.payfast-itn]` sections

#### 3. Database Migration
- Drop columns: `merchant_subscriptions.payfast_subscription_id`, `merchant_subscriptions.payment_provider`, `billing_invoices.payfast_reference`
- These columns are PayFast-specific and no longer needed (Stripe uses its own ID columns already present)

#### 4. Frontend — `src/pages/MerchantSignup.tsx`
- Remove `paymentProvider` state and the Stripe/PayFast toggle switch
- Remove the South Africa geo-detection logic that auto-selects PayFast
- Remove the PayFast checkout branch in `handleCheckout` — always use Stripe
- Remove ZAR-only validation for PayFast

#### 5. Frontend — `src/pages/MerchantBilling.tsx`
- Remove PayFast conditional in the Payment Method card — always show Stripe portal button
- Remove PayFast badge and description text

#### 6. Hook — `src/hooks/useMerchantSubscription.ts`
- Remove `paymentProvider` state and all references to it
- The hook already defaults to Stripe; just remove the PayFast-related code

#### 7. Edge Function — `supabase/functions/check-subscription/index.ts`
- Remove any `payment_provider` or `payfast_subscription_id` references from the subscription check logic

### No Impact Areas
- Promo/sponsored ad payments already use Stripe only (confirmed in previous changes)
- Stripe webhook handler is unaffected
- No PayFast secrets need removal (they were environment variables, not used anywhere else)

