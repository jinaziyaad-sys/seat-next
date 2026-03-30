

# Fix Loyalty Reward Redemption

## Root Cause

The trigger functions `credit_loyalty_on_order()` and `credit_loyalty_on_waitlist()` exist as functions but the `CREATE TRIGGER` statements didn't persist — the schema dump shows **"no triggers in the database"**. This means:

1. Stamps may have been manually inserted or credited by an earlier migration, but the reward threshold check (which generates the discount code) never ran
2. The patron now has 1/1 stamps but no discount code exists in `discount_codes`

## Plan

### 1. Re-attach all loyalty and analytics triggers via new migration

Re-create every trigger with `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` to ensure they're properly attached:

- `trg_credit_loyalty_on_order` on `orders` (AFTER UPDATE)
- `trg_credit_loyalty_on_waitlist` on `waitlist_entries` (AFTER UPDATE)
- `trg_notify_waitlist_ready` on `waitlist_entries` (AFTER UPDATE)
- `trg_notify_order_ready` on `orders` (AFTER UPDATE)
- `trg_track_order_analytics` on `orders` (AFTER INSERT OR UPDATE)
- `trg_track_waitlist_analytics` on `waitlist_entries` (AFTER INSERT OR UPDATE)
- `trg_update_customer_analytics_on_order` on `orders` (AFTER UPDATE)
- `trg_update_customer_analytics_on_waitlist` on `waitlist_entries` (AFTER UPDATE)
- `trg_update_waitlist_positions` on `waitlist_entries` (AFTER INSERT, UPDATE, DELETE)

Also include a one-time fix: for any `patron_loyalty` rows where `stamps_count >= stamp_threshold` and no active discount code exists, generate the reward code now.

### 2. Add a "Claim Reward" fallback button in PatronLoyaltyCard

As a safety net (in case triggers fail again), when `stamps_count >= stamp_threshold` and `active_codes` is empty, show a "Claim Reward" button that calls an edge function to generate the discount code server-side.

**File**: `src/components/PatronLoyaltyCard.tsx`
- Detect when stamps are at/above threshold but no codes exist
- Show a "Claim Reward" button
- On click, invoke `claim-loyalty-reward` edge function

### 3. Create `claim-loyalty-reward` edge function

**File**: `supabase/functions/claim-loyalty-reward/index.ts`
- Validates the user has enough stamps/points for a reward at that venue
- Generates the discount code
- Resets stamps to 0
- Returns the new code

## Files Changed

| File | Change |
|------|--------|
| New migration | Re-attach all triggers + backfill missing reward codes |
| `src/components/PatronLoyaltyCard.tsx` | Add "Claim Reward" fallback button |
| `supabase/functions/claim-loyalty-reward/index.ts` | New edge function for manual reward claiming |

