# Remaining Monetization Work — Status & Next Steps

## What's Done

- Stripe checkout (create-checkout, check-subscription, customer-portal edge functions)
- Merchant signup page with registration + plan selection (Starter/Pro/Enterprise)
- Feature gating on MerchantDashboard via `hasFeature()`
- Merchant billing page (view plan, manage payment, cancel)
- Dev billing dashboard (venue list, pricing overrides)
- Database tables: `merchant_subscriptions`, `dev_pricing_overrides`, `billing_invoices`, `subscription_plans`, `promo_pricing_rules`

## What's Still Missing



### 2. Monthly vs Annual pricing toggle

- The signup page has an `isAnnual` toggle but it doesn't actually change the Stripe price ID sent to checkout
- Need annual price IDs created in Stripe for each tier
- Update `handleSelectPlan` to pass the correct monthly/annual price ID

### 3. Self-service plan changes (upgrade/downgrade)

- Merchants can't currently switch plans from the billing page without going through a new checkout
- Add upgrade/downgrade flow via Stripe's subscription update API (new edge function `update-subscription`)
- Show available plans on the billing page with "Upgrade" / "Downgrade" buttons

### 4. Invoice management (Dev side)

- `billing_invoices` table exists but has no UI
- Dev dashboard needs: generate invoice for a venue, review before sending, mark paid/void
- Merchant billing page needs: invoice history list

### 5. PayFast integration (South African merchants)

- Database columns exist (`payfast_reference`, `payfast_subscription_id`) but no code
- Need: PayFast checkout edge function, PayFast webhook handler, payment provider selector on signup page

### 6. Sponsored ads self-checkout

- `promo_pricing_rules` table exists, `PromotionsManager` exists for dev review
- Missing: merchant-facing "Promote My Venue" page where they see pricing, select duration/reach, pay via Stripe, submit for dev approval

### 7. Stripe webhook for real-time sync

- Currently subscription status only updates when merchant loads the dashboard (polling every 60s)
- Need `stripe-webhook` edge function to handle: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`

---

## Proposed Build Order (this session)

### Phase 1: Clean up tiers + annual pricing

&nbsp;

1. **Create annual Stripe prices** for Starter and Pro (using Stripe tools)
2. **Wire annual toggle** — `MerchantSignup.tsx` sends correct price ID based on toggle

### Phase 2: Invoice management

4. **Dev invoice UI** — add invoice generation/review/send section to `BillingDashboard.tsx`
5. **Merchant invoice history** — show past invoices on `MerchantBilling.tsx`

### Phase 3: Self-service plan changes

6. `**update-subscription` edge function** — calls Stripe to swap price on existing subscription
7. **Upgrade/downgrade UI** on merchant billing page

### Phase 4: Stripe webhook

8. `**stripe-webhook` edge function** — processes payment events, syncs `merchant_subscriptions`

### Phase 5: PayFast (future)

9. PayFast checkout + webhook edge functions
10. Provider selector on signup page

### Phase 6: Sponsored ads self-checkout (future)

11. Merchant-facing promotion purchase flow

---

## Technical Details

**Files modified:**

- &nbsp;
- `src/pages/MerchantBilling.tsx` — invoice history, upgrade/downgrade buttons
- `src/components/dev/BillingDashboard.tsx` — invoice generation UI

**New files:**

- `supabase/functions/update-subscription/index.ts` — plan swap via Stripe API
- `supabase/functions/stripe-webhook/index.ts` — webhook event processor

**Stripe products needed:**

- Annual prices for Starter and Pro (created via Stripe tools)

**Database updates:**

- &nbsp;
- No new tables needed (invoice table already exists)