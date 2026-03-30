

# Add 4 New Loyalty Program Types

## Overview
Extend the existing stamp/points loyalty system with four new program types: **Tiered/VIP**, **Cashback/Credit**, **Referral**, and **Challenge/Mission**. Each venue can enable multiple loyalty features simultaneously.

## Architecture Decision
Rather than replacing the current `loyalty_programs.type` column (which drives stamp/points), we add **separate tables** for each new program type. This keeps the existing stamp/points system untouched and lets venues mix-and-match features.

```text
Existing:                    New:
loyalty_programs ───────►  loyalty_tiers (VIP levels per program)
patron_loyalty              patron_tier_status
                            
                            venue_cashback_config
                            patron_cashback_balance
                            
                            referral_codes
                            referral_completions
                            
                            loyalty_challenges
                            patron_challenge_progress
```

## Plan

### 1. Database Migration — New Tables

**Tiered/VIP**
- `loyalty_tiers`: venue_id, tier_name, min_lifetime_stamps (or points), perks (jsonb), color, sort_order
- `patron_tier_status`: user_id, venue_id, current_tier_id (computed from lifetime_stamps/points vs tier thresholds)
- No separate earning — tiers are computed from existing `patron_loyalty.lifetime_stamps` / `lifetime_points`

**Cashback/Credit**
- `venue_cashback_config`: venue_id, percentage (e.g. 5%), is_active, min_order_value, max_credit_per_order
- `patron_cashback_balance`: user_id, venue_id, balance, lifetime_earned
- Trigger on orders reaching `collected` to credit `balance += order_total * percentage`

**Referral**
- `referral_codes`: user_id, venue_id, code (unique 6-char), uses_count
- `referral_completions`: referrer_id, referee_id, venue_id, completed_at, referrer_rewarded, referee_rewarded
- Edge function to validate referral on first order/visit and credit both parties

**Challenge/Mission**
- `loyalty_challenges`: venue_id, title, description, goal_type (visit_count, order_count, specific_item), goal_value, reward_name, reward_description, start_date, end_date, is_active
- `patron_challenge_progress`: user_id, challenge_id, current_progress, completed, completed_at, reward_claimed

RLS policies for all tables following existing patterns (users see own, staff see venue, super_admin sees all).

### 2. Merchant Settings UI — New Tabs
**File**: `src/components/merchant/LoyaltySettings.tsx`

Add a tabbed interface within the loyalty settings:
- **Stamps/Points** tab (existing UI, unchanged)
- **VIP Tiers** tab — configure tier names, thresholds, perks (e.g. "Gold: 50+ stamps → Priority Seating")
- **Cashback** tab — toggle on/off, set percentage, min order value
- **Referral** tab — toggle on/off, set reward for referrer and referee
- **Challenges** tab — create/manage time-limited challenges with goals and rewards

### 3. Patron-Facing UI
**File**: `src/components/PatronLoyaltyCard.tsx`

Extend the existing loyalty card to show:
- **VIP Badge**: Show current tier name + color badge on the card (e.g. "Gold Member")
- **Cashback Balance**: Small line showing "R12.50 credit available" if cashback is enabled
- **Referral Code**: "Share your code: ABC123" with copy button in expanded view
- **Active Challenges**: Progress bars for any in-progress challenges in expanded view

### 4. Edge Functions
- **`process-referral`**: Validates a referral code on first visit, credits both parties
- Update existing `credit_loyalty_on_order` and `credit_loyalty_on_waitlist` triggers to also:
  - Update cashback balance
  - Increment challenge progress
  - Recalculate tier status

### 5. Dev Dashboard Toggle
**File**: `src/pages/DevDashboard.tsx`

The existing loyalty enable/disable badge will continue to control the master switch (`admin_enabled`). The individual feature toggles (tiers, cashback, referral, challenges) are managed by the merchant within their settings.

## Files Changed

| File | Change |
|------|--------|
| New migration | Create 8 new tables + RLS + triggers for cashback/challenge progress |
| `src/components/merchant/LoyaltySettings.tsx` | Add tabbed UI for VIP Tiers, Cashback, Referral, Challenges config |
| `src/components/PatronLoyaltyCard.tsx` | Show tier badge, cashback balance, referral code, challenge progress |
| `supabase/functions/process-referral/index.ts` | New — validate and credit referral completions |
| Update `credit_loyalty_on_order` trigger function | Add cashback crediting + challenge progress tracking |
| Update `credit_loyalty_on_waitlist` trigger function | Add challenge progress tracking for visit-based challenges |

## Technical Notes
- Tier calculation is derived from existing `lifetime_stamps`/`lifetime_points` — no new earning mechanism needed
- Cashback requires an `order_total` field; if orders don't currently store totals, we'll need to add that column or compute from items
- Referral codes are generated once per user-venue pair and reusable
- Challenges are time-boxed and auto-expire based on `end_date`

