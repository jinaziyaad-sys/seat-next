

# Fix: Multiple Subscriptions + Pricing Sync + Cancellation

## Problems Identified

1. **3 concurrent active subscriptions** — `create-checkout` doesn't cancel existing subscriptions before creating new ones. Each plan selection creates a new subscription.
2. **Pricing is stored in two places** — Stripe has the actual billing prices, the `subscription_plans` DB table has display prices. Changing one doesn't update the other.
3. **No cancellation guard** — nothing prevents stacking subscriptions on the same customer.

## Immediate Fix: Cancel 2 Extra Subscriptions

Cancel the Starter and Pro subscriptions via Stripe tools, keeping only the Enterprise one (which is what La Tayy should have).

- Cancel `sub_1TIsJfRrnmiHUS0L9XPbPhVE` (Starter)
- Cancel `sub_1TIsMtRrnmiHUS0LmsDxGGOa` (Pro)

## Code Fix: Prevent Duplicate Subscriptions

**`supabase/functions/create-checkout/index.ts`** — Before creating a new checkout session, check if the customer already has an active subscription. If they do:
- Cancel the old subscription (or redirect to the Customer Portal for plan changes instead of creating a new checkout)
- Only allow new checkout if no active subscription exists

This ensures a merchant can only have one subscription at a time.

## Pricing Sync Answer

**How it works today:**
- Display prices on the signup page come from the `subscription_plans` database table (`monthly_price`, `annual_price` columns)
- Actual billing amounts come from the Stripe price objects (hardcoded price IDs in the code)
- If you change prices in Stripe Dashboard, the app UI won't reflect it (and vice versa)

**What we'll fix:**
- Update `create-checkout` to cancel existing subscriptions before creating new ones
- Add a note/section in the Dev BillingDashboard explaining that to change pricing, they need to: (1) update the Stripe price or create a new one, (2) update the `subscription_plans` table, and (3) update the price ID constants in code

**Dev pricing control flow:**
- Dev changes price in Stripe Dashboard → creates new price ID
- Dev updates `subscription_plans` table amounts (via Dev Dashboard or SQL)
- Dev updates price ID constants in code (requires a code deploy)
- Existing subscribers keep their old price until renewal (Stripe handles this)

## Files Modified

- `supabase/functions/create-checkout/index.ts` — add existing subscription check, cancel old sub before new checkout
- Stripe: cancel 2 duplicate subscriptions via Stripe tools

## No Database Changes Needed

