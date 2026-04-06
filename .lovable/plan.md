

# Future Phases: PayFast + Sponsored Ads Self-Checkout + Dev-to-Merchant Announcements

## What Already Exists

- **PayFast**: DB columns exist (`payfast_subscription_id` on `merchant_subscriptions`, `payfast_reference` on `billing_invoices`) but no edge functions or frontend integration
- **Sponsored Ads**: Full dev-side `PromotionsManager` exists with `promo_campaigns`, `promo_impressions`, `promo_pricing_rules` tables. Merchants have NO self-service UI to purchase promotions
- **Dev-to-Merchant Announcements**: `platform_config` has a global `announcement.active` shown on merchant dashboard via `usePlatformConfig`. No targeted, persistent announcement system for merchant-specific or batch messaging

---

## Phase 1: PayFast Integration

### Overview
Add PayFast as an alternative payment gateway for South African merchants. Merchants choose Stripe or PayFast at checkout. PayFast uses server-side ITN (Instant Transaction Notification) webhooks, not client-side redirects for confirmation.

### Database Migration
- Add `payfast_subscription_token` column to `subscription_plans` (for recurring billing setup)
- Add `payment_provider` column to `merchant_subscriptions` (default `'stripe'`, enum `stripe | payfast`)

### New Edge Functions
1. **`payfast-checkout`** — generates a PayFast payment form with subscription parameters (merchant_id, merchant_key, amount, item_name, subscription_type, return/cancel/notify URLs). Returns form data for client-side POST to PayFast.
2. **`payfast-itn`** — PayFast ITN webhook handler. Validates signature, verifies source IP, updates `merchant_subscriptions` status, writes to `billing_invoices`. Handles `COMPLETE`, `CANCELLED`, `FAILED` statuses.

### Frontend Changes
- **`MerchantSignup.tsx`** — Add payment provider toggle (Stripe / PayFast). When PayFast is selected, call `payfast-checkout` and redirect via form POST instead of Stripe checkout session.
- **`MerchantBilling.tsx`** — Show payment provider badge. If PayFast, link to PayFast dashboard for management instead of Stripe portal.
- **`useMerchantSubscription.ts`** — Read `payment_provider` from `merchant_subscriptions` to display correct provider info.

### Secrets Required
- `PAYFAST_MERCHANT_ID` — PayFast merchant ID
- `PAYFAST_MERCHANT_KEY` — PayFast merchant key
- `PAYFAST_PASSPHRASE` — PayFast passphrase for signature validation

### Files
- New: `supabase/functions/payfast-checkout/index.ts`, `supabase/functions/payfast-itn/index.ts`
- Modified: `MerchantSignup.tsx`, `MerchantBilling.tsx`, `useMerchantSubscription.ts`, `supabase/config.toml`
- Migration: add `payment_provider` to `merchant_subscriptions`

---

## Phase 2: Sponsored Ads Self-Checkout

### Overview
Merchants can purchase promoted placement directly from their dashboard. Pricing is auto-calculated from `promo_pricing_rules`. Campaigns go into a `pending_review` state until the dev approves them.

### Database Migration
- Add `submitted_by` (uuid, nullable) to `promo_campaigns` — tracks merchant who submitted
- Add `review_status` column to `promo_campaigns` (default `'pending'`, values: `pending`, `approved`, `rejected`)
- Add `review_notes` text column to `promo_campaigns`

### New Edge Function
- **`create-promo-checkout`** — Calculates price from `promo_pricing_rules` (base_price_per_day * duration * placement_multiplier * reach_tier), creates a Stripe one-off checkout session, creates a `promo_campaigns` row with `payment_status: 'pending'` and `review_status: 'pending'`.

### Frontend Changes
- **New: `src/components/merchant/SponsoredAdsManager.tsx`** — Merchant-facing UI:
  - Campaign creation form (title, description, banner upload, placements, date range)
  - Live price calculator based on selected options
  - "Pay & Submit for Review" button
  - List of merchant's campaigns with status badges (pending review, approved, live, ended, rejected)
- **`MerchantDashboard.tsx`** — Add "Promotions" tab (gated to Pro+ tier)
- **`PromotionsManager.tsx`** (dev side) — Add review queue: approve/reject buttons, review notes field. When approved, set `is_active: true` + `review_status: 'approved'`
- **`stripe-webhook`** — Handle `checkout.session.completed` for promo payments: update `promo_campaigns.payment_status` to `'paid'`

### Files
- New: `src/components/merchant/SponsoredAdsManager.tsx`, `supabase/functions/create-promo-checkout/index.ts`
- Modified: `MerchantDashboard.tsx`, `PromotionsManager.tsx`, `stripe-webhook/index.ts`, `supabase/config.toml`
- Migration: add columns to `promo_campaigns`

---

## Phase 3: Dev-to-Merchant Announcements

### Overview
Replace the single global `platform_config` announcement with a persistent, targeted messaging system. The dev can send announcements to all merchants, specific venues, or by subscription tier.

### Database Migration
New table: `merchant_announcements`
- `id` uuid PK
- `title` text not null
- `message` text not null
- `type` text default `'info'` (info, warning, error, maintenance)
- `audience` text default `'all'` (all, specific_venues, tier_starter, tier_pro, tier_enterprise)
- `target_venue_ids` uuid[] nullable
- `is_active` boolean default true
- `dismissible` boolean default true
- `priority` integer default 0
- `expires_at` timestamptz nullable
- `created_by` uuid references auth.users
- `created_at` timestamptz default now()

New table: `merchant_announcement_dismissals`
- `id` uuid PK
- `announcement_id` uuid references merchant_announcements on delete cascade
- `user_id` uuid references auth.users on delete cascade
- `dismissed_at` timestamptz default now()
- Unique constraint on (announcement_id, user_id)

RLS: merchants can SELECT announcements (filtered by audience in code), INSERT dismissals for themselves. Super admins can INSERT/UPDATE/DELETE announcements.

### Frontend Changes
- **New: `src/components/dev/MerchantAnnouncementsPanel.tsx`** — Dev UI for creating/managing announcements with audience targeting, priority, expiry, and active/archive toggle
- **`AIControlCenter.tsx`** — Add "Merchant Announcements" tab
- **New: `src/components/merchant/MerchantAnnouncementBanner.tsx`** — Renders active announcements on merchant dashboard, filtered by venue and tier. Supports dismiss with DB persistence.
- **`MerchantDashboard.tsx`** — Replace/augment the existing `announcement` banner with the new component that reads from `merchant_announcements` table

### Files
- New: `src/components/dev/MerchantAnnouncementsPanel.tsx`, `src/components/merchant/MerchantAnnouncementBanner.tsx`
- Modified: `MerchantDashboard.tsx`, `AIControlCenter.tsx`
- Migration: create `merchant_announcements` and `merchant_announcement_dismissals` tables with RLS

---

## Implementation Order

1. Phase 3 (Announcements) — smallest scope, no external dependencies
2. Phase 2 (Sponsored Ads) — builds on existing promo infrastructure
3. Phase 1 (PayFast) — requires external API keys, most complex

## Total New Files: 6
## Total Modified Files: ~10
## Migrations: 3

