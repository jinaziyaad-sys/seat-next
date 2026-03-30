

# Loyalty System & Promotional Banners

## Overview

Two major features: (1) a venue-specific loyalty program (stamp card or points, restaurant's choice) with automatic discount code rewards, and (2) a promotional banner system across the patron app, managed by super admins with future self-serve Stripe billing.

---

## Part 1: Loyalty System

### How it works

- Each venue chooses **stamp card** or **points** mode in their settings
- **Stamp card**: patron earns 1 stamp per visit (seated) or order (collected). After X stamps, they unlock a reward (e.g., "Free dessert"). Merchant sets the threshold and reward description.
- **Points**: patron earns N points per visit/order. Merchant defines reward tiers (e.g., 50pts = 10% off, 100pts = free meal). More flexible.
- When a reward is earned, the app generates a **unique discount code** visible to the patron
- Patron tells staff the code at the venue. Staff verifies/redeems it from their dashboard.
- Platform (dev) can see all loyalty programs and override settings if needed

### Who controls what

| Control | Merchant | Dev (Super Admin) |
|---------|----------|-------------------|
| Enable/disable loyalty | Yes | Yes (override) |
| Choose stamp vs points | Yes | Yes |
| Set thresholds/rewards | Yes | Yes (override) |
| Issue manual discount codes | Yes | Yes |
| View redemption analytics | Own venue | All venues |
| Suspend a loyalty program | No | Yes |

### Database tables (new migration)

```text
loyalty_programs
  id, venue_id, type (stamp_card | points), 
  stamp_threshold, points_per_visit, points_per_order,
  is_active, created_at, updated_at

loyalty_rewards  
  id, venue_id, program_id, name, description,
  stamps_required OR points_required, reward_type (discount_code | free_item | custom),
  is_active

patron_loyalty
  id, user_id, venue_id, program_id,
  stamps_count, points_balance, 
  lifetime_stamps, lifetime_points,
  created_at, updated_at

loyalty_transactions
  id, user_id, venue_id, program_id,
  type (stamp_earned | points_earned | reward_redeemed),
  stamps_delta, points_delta, 
  source_type (order | waitlist), source_id,
  created_at

discount_codes
  id, venue_id, user_id, code (unique 8-char),
  reward_id, status (active | redeemed | expired),
  expires_at, redeemed_at, redeemed_by_staff_id,
  created_at
```

### Automatic stamp/point earning

- Database triggers on `orders` (when status → `collected`) and `waitlist_entries` (when status → `seated`) automatically credit the patron's loyalty account
- When stamps/points cross a reward threshold, auto-generate a discount code

### Frontend changes

**Merchant dashboard** — new "Loyalty" tab or section in Settings:
- Toggle loyalty on/off, choose type
- Configure stamp threshold or point values
- Define rewards
- View active discount codes and redeem them
- Redemption history

**Patron app** — loyalty card visible in:
- Profile section (all venue loyalty cards)
- Active tracking screen (current venue's loyalty progress)
- After order/visit completion (stamp animation + progress update)

**Dev dashboard** — loyalty overview across all venues in analytics

### Files changed

| File | Change |
|------|--------|
| New migration | Create 5 tables + triggers for auto-earning |
| `src/components/merchant/MerchantSettings.tsx` | Add loyalty configuration accordion |
| `src/components/merchant/LoyaltyManagement.tsx` | New — redemption dashboard for staff |
| `src/components/PatronLoyaltyCard.tsx` | New — stamp/points card UI for patrons |
| `src/components/ProfileSection.tsx` | Add loyalty cards section |
| `src/pages/Index.tsx` | Show loyalty progress on active tracking cards |
| `src/pages/MerchantDashboard.tsx` | Add loyalty tab |

---

## Part 2: Promotional Banners

### How it works

- Super admin creates **ad campaigns** in the dev dashboard: selects a venue, writes copy, sets dates, chooses placements
- Banners appear across the patron app in 4 locations:
  1. **Home screen carousel** — rotating banner at top
  2. **Explore page** — "Featured" badge + promoted position
  3. **Active tracking screen** — subtle banner while waiting
  4. **Push notifications** — scheduled promo push to patrons in the area
- Campaigns have start/end dates and impression tracking

### Payment model (Phase 1: Admin-managed)

- Dev dashboard has a "Promotions" management section
- Super admin creates campaigns after receiving offline payment from the venue
- Campaign record includes `payment_status` (paid | pending | comp) and `amount_charged`
- No Stripe integration yet — just tracking fields for manual reconciliation
- Phase 2 (future): self-serve Stripe checkout for merchants to buy ad slots

### Database tables

```text
promo_campaigns
  id, venue_id, title, description, 
  banner_image_url, cta_text, cta_link,
  placements (array: home, explore, tracking, push),
  start_date, end_date, is_active,
  payment_status, amount_charged, payment_notes,
  impressions_count, clicks_count,
  created_by, created_at, updated_at

promo_impressions
  id, campaign_id, user_id, placement, 
  clicked, created_at
```

### Frontend changes

| File | Change |
|------|--------|
| New migration | Create promo tables |
| `src/components/PromoBanner.tsx` | New — reusable banner component |
| `src/pages/Index.tsx` | Add promo carousel at top of home screen |
| `src/components/ExploreVenues.tsx` | Add "Featured" badge and promoted venues |
| `src/pages/DevDashboard.tsx` | Add promotions management tab |
| `src/components/dev/PromotionsManager.tsx` | New — CRUD for campaigns |
| Edge function `send-promo-push` | New — sends push notifications for promo campaigns |

---

## Implementation Order

Given the scope, I recommend splitting into 3 phases:

1. **Phase 1 — Loyalty database + merchant config** (tables, triggers, merchant settings UI)
2. **Phase 2 — Patron loyalty UI + discount codes** (loyalty cards, code generation, staff redemption)
3. **Phase 3 — Promo banners** (campaign management, patron-facing banners, impression tracking)

Shall I start with Phase 1?

