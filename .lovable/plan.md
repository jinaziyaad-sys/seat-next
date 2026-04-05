

# Monetization Architecture: Full Plan

## Overview

Three revenue streams: (A) Merchant SaaS subscriptions with tiered features, (B) Self-service sponsored promotions, (C) Patron monetization. Plus a Dev billing dashboard for full control.

---

## Phase 1: Merchant Subscription & Billing

### Database (new tables via migration)

**`subscription_plans`** — Dev-configurable pricing tiers
- `id`, `name` (e.g. "Starter", "Pro", "Enterprise"), `description`
- `monthly_price`, `annual_price` (annual = bundled discount)
- `included_features` (jsonb array, e.g. `["food_ordering", "waitlist", "reservations"]`)
- `is_active`, `sort_order`, `created_at`, `updated_at`

**`subscription_addons`** — Optional add-on features
- `id`, `name` (e.g. "Loyalty", "Analytics"), `feature_key`, `monthly_price`, `annual_price`, `is_active`

**`merchant_subscriptions`** — Per-venue subscription state
- `id`, `venue_id` (FK venues), `plan_id` (FK subscription_plans), `billing_cycle` ("monthly"/"annual")
- `status` ("trial"/"active"/"past_due"/"cancelled"/"locked")
- `current_period_start`, `current_period_end`, `trial_ends_at`
- `stripe_customer_id`, `stripe_subscription_id`, `payfast_subscription_id`
- `created_at`, `updated_at`, `cancelled_at`

**`subscription_addon_assignments`** — Which add-ons a venue has
- `id`, `subscription_id` (FK merchant_subscriptions), `addon_id` (FK subscription_addons)
- `created_at`

**`billing_invoices`** — Invoice records for dev dashboard
- `id`, `venue_id`, `subscription_id`, `amount`, `currency`, `status` ("draft"/"sent"/"paid"/"overdue"/"void")
- `invoice_number`, `period_start`, `period_end`, `due_date`, `paid_at`
- `stripe_invoice_id`, `payfast_reference`
- `line_items` (jsonb), `notes`, `created_at`, `sent_at`

**`dev_pricing_overrides`** — Dev can give free subs or custom pricing per venue
- `id`, `venue_id`, `override_type` ("free"/"custom_price"/"discount_percent")
- `custom_monthly_price`, `custom_annual_price`, `discount_percent`
- `reason`, `created_by`, `expires_at`, `created_at`

### Stripe + PayFast Integration

- Enable Stripe via the Lovable Stripe tool for international payments
- PayFast integration via edge function for SA-based merchants (webhook-based)
- Edge functions: `create-checkout-session`, `handle-stripe-webhook`, `handle-payfast-webhook`, `generate-invoice`

### Feature Gating (enforce subscriptions)

- New hook `useMerchantSubscription()` — fetches the venue's active subscription + addons
- Modify `usePlatformConfig` to combine platform-level feature flags with subscription-level entitlements
- If subscription status = "locked" or "cancelled", show a paywall overlay on `MerchantDashboard` instead of the dashboard
- Individual features (loyalty tab, analytics tab) check both platform config AND subscription addons

### Merchant Self-Service Onboarding

- New page `/merchant/signup` — pricing page showing plans, add-ons, monthly vs annual toggle
- Checkout flow: select plan + add-ons -> create account -> Stripe/PayFast checkout -> auto-provision venue
- New page `/merchant/billing` — manage subscription, switch plans, add/remove add-ons, view invoices, update payment method
- Monthly flexibility: merchants can upgrade/downgrade add-ons mid-cycle (prorated via Stripe)

### Lockout on Non-Payment

- Cron edge function `check-subscription-status` runs daily
  - Marks subscriptions as `past_due` when payment fails
  - After grace period (e.g. 7 days), sets status to `locked`
- When locked: MerchantDashboard shows "Your subscription is inactive" with a "Reactivate" button linking to billing page
- Dev can manually unlock or override from Dev Dashboard

---

## Phase 2: Dev Billing Dashboard

New tab "Billing" in Dev Dashboard with sub-tabs:

### Subscription Management
- View all venues with their plan, status, next billing date
- Override pricing per venue (free subs, discounts)
- Manually activate/deactivate subscriptions
- Quick filters: active, past_due, locked, trial

### Invoice Management
- Auto-generated invoices from subscription events
- One-click "Generate & Send Invoice" per venue (sends email via Resend or similar)
- Review invoice before sending
- Track payment status: paid, overdue, void
- Bulk invoice generation

### Revenue Analytics
- MRR (Monthly Recurring Revenue), ARR
- Churn rate, new subscriptions over time
- Revenue by plan tier, add-on adoption rates

### Merchant-Specific Announcements
- Extend existing `AnnouncementsPanel` to support audience targeting: "all", "merchants_only", "patrons_only"
- Add announcement types for billing: price increase notices, promo offers

---

## Phase 3: Self-Service Promotions (Sponsored Ads)

### Current State
Promotions are managed entirely by the dev (super_admin) via `PromotionsManager`. The `promo_campaigns` table already has `payment_status`, `amount_charged`, `payment_notes`.

### Changes

**New: Promo Pricing Calculator**
- `promo_pricing_rules` table: `base_price_per_day`, `placement_multipliers` (jsonb), `reach_tiers` (jsonb)
- Dev configures pricing rules; merchants see calculated prices

**Merchant-Facing Promo Flow**
- New component in Merchant Dashboard: "Promote Your Venue"
- Merchant selects: duration, placements, target audience
- Price auto-calculated from rules
- Merchant pays via Stripe/PayFast checkout
- Campaign created with `status: 'pending_review'`

**Dev Review Queue**
- In PromotionsManager, add "Pending Review" section
- Dev approves or rejects with notes
- On approval, campaign goes live; on rejection, refund is triggered

---

## Phase 4: Patron Monetization

Based on your platform's nature (venue discovery + ordering + waitlist), here are recommendations:

### Recommended: Sponsored Content (merchant-funded, patrons stay free)
- Already partially built via promo_campaigns
- Expand with "Explore" page featured listings that merchants pay for
- This keeps the patron experience free and frictionless — critical for adoption

### Optional: Freemium Patron Tier
- "VIP" patron subscription ($X/month) for perks like:
  - Priority waitlist positioning
  - Exclusive venue deals/vouchers
  - No promotional banners
  - Early access to new venues
- Requires a `patron_subscriptions` table and Stripe checkout for patrons
- Risk: friction for a consumer app — only recommended once you have significant patron volume

### Optional: Transaction Fee on Orders
- Small % fee on food orders placed through the app
- Requires payment processing integration on the order flow itself (significant build)
- Better suited for a later phase when order volume justifies it

**My recommendation**: Start with sponsored content only (Phase 3 covers this). Keep the patron app completely free to maximize adoption. Revisit patron subscriptions once you have 10k+ active patrons.

---

## Files to Create/Modify

| Area | Files |
|---|---|
| DB Migration | New migration for all billing tables |
| Edge Functions | `create-checkout-session`, `handle-stripe-webhook`, `handle-payfast-webhook`, `generate-invoice`, `check-subscription-status` |
| Hooks | `useMerchantSubscription.ts` |
| Merchant Pages | `/merchant/signup` (pricing), `/merchant/billing` (manage) |
| Merchant Dashboard | Feature gating + lockout overlay |
| Dev Dashboard | New "Billing" tab with sub-panels |
| Promotions | Self-service merchant promo creation + dev review queue |

## Build Order
1. Database schema (subscription tables)
2. Stripe integration (enable Stripe, create checkout edge functions)
3. PayFast edge functions
4. `useMerchantSubscription` hook + feature gating
5. Merchant signup/pricing page
6. Merchant billing management page
7. Dev billing dashboard
8. Subscription lockout enforcement
9. Invoice generation
10. Self-service promotions (merchant-facing)
11. Dev promo review queue

This is a large build. I recommend we start with steps 1-4 (foundation) and iterate from there.

