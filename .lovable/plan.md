

# Unified Pricing Management from Dev Dashboard

## Problem

Pricing is currently stored in three disconnected places:
1. **`subscription_plans` DB table** — `monthly_price`, `annual_price` (used for display on signup page)
2. **Stripe products/prices** — actual billing amounts (price IDs hardcoded in `useMerchantSubscription.ts`)
3. **Code constants** — `SUBSCRIPTION_TIERS` in `useMerchantSubscription.ts` with hardcoded Stripe price/product IDs

Changing a price requires manual updates in all three places. We can fix this.

## Solution: Single Source of Truth in `subscription_plans` Table

Add `stripe_monthly_price_id` and `stripe_annual_price_id` columns to the `subscription_plans` table. The dev dashboard gets a pricing editor. When the dev changes a price:

1. An edge function creates a **new Stripe price** via the API (Stripe prices are immutable — you archive the old one and create a new one)
2. The edge function updates the `subscription_plans` row with the new display price AND the new Stripe price ID
3. The frontend reads price IDs from the DB at runtime instead of from hardcoded constants

This means: change the price in one place (dev dashboard), and it flows everywhere automatically.

## Architecture

```text
Dev Dashboard (pricing form)
        │
        ▼
Edge Function: update-plan-pricing
        │
        ├──► Stripe API: create new price, archive old price
        │
        └──► subscription_plans table: update monthly_price,
             annual_price, stripe_monthly_price_id,
             stripe_annual_price_id
        
Frontend (signup page + checkout)
        │
        └──► Reads price IDs from subscription_plans at runtime
             (no more hardcoded constants)
```

## Implementation Steps

### 1. Database Migration
Add Stripe price ID columns to `subscription_plans`:
- `stripe_monthly_price_id text` — e.g. `price_1TIs3WRrnmiHUS0LBQ9DkJlO`
- `stripe_annual_price_id text` — e.g. `price_1TIscARrnmiHUS0LYvmnYFDl`
- `stripe_product_id text` — monthly product ID
- `stripe_annual_product_id text` — annual product ID

Seed the existing Stripe IDs into the rows so nothing breaks.

### 2. New Edge Function: `update-plan-pricing`
- Accepts: `planId`, `newMonthlyPrice`, `newAnnualPrice`
- Creates new Stripe prices on the existing products (Stripe prices are immutable, so we create new ones)
- Archives old Stripe prices
- Updates the `subscription_plans` row with new amounts and new price IDs
- Returns success/failure

### 3. Update Dev Dashboard (`BillingDashboard.tsx`)
Add a "Manage Pricing" section with:
- Editable monthly and annual price fields per plan
- A "Save & Sync" button that calls `update-plan-pricing`
- Shows current Stripe price IDs for reference
- Confirmation dialog before changing live pricing

### 4. Remove Hardcoded Constants
- **`useMerchantSubscription.ts`**: Remove `SUBSCRIPTION_TIERS` and `TIER_PRODUCT_IDS` constants. Instead, load them from the `subscription_plans` table at runtime (or keep a lightweight cache).
- **`MerchantSignup.tsx`**: Already reads from `subscription_plans` for display prices. Update checkout to use the Stripe price IDs from the DB rows instead of from the hardcoded `tierMap`.
- **`create-checkout`**: Accept price IDs from the client (already does via `priceIds` param) — no change needed.
- **`check-subscription`**: Match product IDs from the DB instead of hardcoded arrays.

### 5. Keep Existing Subscribers Safe
Stripe handles this automatically — existing subscriptions keep their original price. Only new subscriptions or renewals use the new price.

## Files Modified
- `subscription_plans` table — add 4 new columns + seed data (migration)
- `supabase/functions/update-plan-pricing/index.ts` — new edge function
- `src/components/dev/BillingDashboard.tsx` — pricing editor UI
- `src/hooks/useMerchantSubscription.ts` — load tier config from DB instead of constants
- `src/pages/MerchantSignup.tsx` — use DB-sourced price IDs for checkout

## Technical Notes
- Stripe prices are immutable. To "change" a price, you create a new price on the same product and archive the old one.
- Existing subscribers are unaffected — their subscription references the old price ID until renewal.
- The edge function needs `STRIPE_SECRET_KEY` (already configured).

