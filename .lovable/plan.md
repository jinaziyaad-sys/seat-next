

# Multi-Currency Pricing: Auto-Convert with Manual Overrides

## Overview
Currently all prices are hardcoded to ZAR ("R") everywhere — DB, Stripe checkout, frontend display, and invoices. This plan adds multi-currency support with auto-conversion from ZAR base prices, plus the ability for the dev to set fixed overrides per currency.

## Architecture

```text
subscription_plans (base prices in ZAR, unchanged)
  ↓
plan_currency_overrides (new table)
  → dev sets fixed USD/EUR/GBP prices per plan
  ↓
Frontend (MerchantSignup, BillingDashboard)
  → detect merchant currency from venue country or browser locale
  → if override exists for that currency → use it
  → else → fetch live rate from exchangerate API → convert from ZAR
  → display with correct symbol ($, €, £, R)
  ↓
Checkout (create-checkout, payfast-checkout)
  → pass detected currency to Stripe (Stripe handles multi-currency natively)
  → PayFast stays ZAR-only (PayFast only supports ZAR)
```

## Database Changes

### New table: `plan_currency_overrides`
```sql
CREATE TABLE public.plan_currency_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
  currency TEXT NOT NULL,  -- 'USD', 'EUR', 'GBP', etc.
  monthly_price NUMERIC NOT NULL,
  annual_price NUMERIC NOT NULL,
  stripe_monthly_price_id TEXT,
  stripe_annual_price_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plan_id, currency)
);
ALTER TABLE plan_currency_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Super admins manage overrides" ON plan_currency_overrides
  FOR ALL TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "Authenticated users can read overrides" ON plan_currency_overrides
  FOR SELECT TO authenticated USING (true);
```

### New edge function: `get-exchange-rates`
- Fetches live ZAR-based rates from a free API (e.g. `exchangerate-api.com` or `open.er-api.com`)
- Caches rates in a `exchange_rate_cache` table (refreshed every 6 hours)
- Returns rates for requested currencies
- Fallback hardcoded rates if API is down

## Frontend Changes

### 1. `src/pages/MerchantSignup.tsx`
- Add a currency selector dropdown (USD, EUR, GBP, ZAR, etc.) defaulting based on venue country or browser locale
- Load `plan_currency_overrides` for the selected currency
- If override exists: display override prices with correct symbol
- If no override: call `get-exchange-rates` and convert ZAR base prices
- Pass selected currency to checkout functions
- Replace all hardcoded `R{price}` with `{currencySymbol}{price}`

### 2. `src/components/dev/BillingDashboard.tsx`
- Add a "Currency Overrides" section per plan
- Dev can add/edit fixed prices for specific currencies (USD, EUR, GBP, etc.)
- When saving an override, optionally create corresponding Stripe prices via `update-plan-pricing`
- Show which currencies have manual overrides vs auto-conversion

### 3. `src/pages/MerchantBilling.tsx`
- Display amounts in the merchant's stored currency (from `merchant_subscriptions` or venue settings)
- Invoice amounts already have a `currency` column — use it for display

### 4. `src/components/merchant/SponsoredAdsManager.tsx`
- Convert promo pricing display to use venue's currency

## Edge Function Changes

### `supabase/functions/create-checkout/index.ts`
- Accept `currency` param from frontend
- Look up `plan_currency_overrides` for the selected currency
- If override with Stripe price ID exists: use that price ID
- If no override: use `price_data` with converted amount in the target currency
- Stripe natively supports multi-currency checkout

### `supabase/functions/update-plan-pricing/index.ts`
- Extend to also create/update Stripe prices for currency overrides
- Accept optional `currency` param; when provided, update `plan_currency_overrides` instead of base plan

### `supabase/functions/create-invoice/index.ts`
- Accept currency param; default to venue's currency instead of hardcoded "zar"

### `supabase/functions/payfast-checkout/index.ts`
- No currency change needed — PayFast is ZAR-only
- Add a check: if merchant selected non-ZAR currency, return error suggesting Stripe instead

### `supabase/functions/get-exchange-rates/index.ts` (new)
- Fetch rates from free API, cache in DB
- Return `{ base: "ZAR", rates: { USD: 0.055, EUR: 0.051, GBP: 0.044, ... } }`

## Currency Utility
Add `src/utils/currency.ts`:
- `SUPPORTED_CURRENCIES` map with symbol, name, code
- `formatPrice(amount, currencyCode)` → "$49", "€45", "R899"
- `detectCurrency(venueAddress, browserLocale)` → currency code

## Files Modified

| File | Change |
|------|--------|
| Migration | Create `plan_currency_overrides` table |
| `supabase/functions/get-exchange-rates/index.ts` | New: fetch and cache forex rates |
| `src/utils/currency.ts` | New: currency formatting and detection |
| `src/pages/MerchantSignup.tsx` | Currency selector, dynamic price display |
| `src/components/dev/BillingDashboard.tsx` | Currency override editor per plan |
| `src/pages/MerchantBilling.tsx` | Display in merchant's currency |
| `src/components/merchant/SponsoredAdsManager.tsx` | Currency-aware promo pricing |
| `supabase/functions/create-checkout/index.ts` | Multi-currency Stripe checkout |
| `supabase/functions/create-invoice/index.ts` | Dynamic currency |
| `supabase/functions/update-plan-pricing/index.ts` | Support currency overrides |
| `supabase/functions/payfast-checkout/index.ts` | ZAR-only guard |

## Implementation Order
1. Migration + currency utility
2. `get-exchange-rates` edge function
3. MerchantSignup currency selector + display
4. BillingDashboard override editor
5. Update checkout + invoice edge functions
6. PayFast guard + SponsoredAds currency display

