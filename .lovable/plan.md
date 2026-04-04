

# Loyalty System Improvements

## 1. Remove Duplicate "Stamps Required" on Merchant Side

**Problem**: The merchant loyalty settings has both a top-level "Stamps needed for reward" (stamp_threshold on the program) AND a per-reward "Stamps required" field. Since we're using only stamp cards, the threshold is the single source of truth.

**Fix**: Remove the per-reward `stamps_required` input from `LoyaltySettings.tsx` (lines 519-523). The reward automatically uses the program's `stamp_threshold`. Keep only the voucher validity days and active toggle in the reward detail row.

## 2. Balance Home Page Quick Action Buttons

**Problem**: 2-column grid with 3 cards (Food Ready, Table Ready, Loyalty) creates an unbalanced layout — 2 cards on top, 1 orphaned below.

**Fix**: Change the grid to `grid-cols-3` so all three cards sit in one row. Reduce padding/icon sizes slightly to fit. If only 2 features are enabled (e.g., no food ordering), fall back to `grid-cols-2`.

## 3. Voucher Count Badge on Loyalty Hub Venue Logos

**Problem**: When viewing the loyalty hub, venue logos don't show how many vouchers the patron has for each restaurant.

**Fix**: In `LoyaltyReadyFlow.tsx`, add a small ticket/voucher badge (distinct from the gift icon) on each venue logo showing `active_codes.length` when > 0. Use a ticket icon with a count number, positioned at the bottom-right of the logo circle.

## 4. Auto-Award Stamps on Order Collected / Patron Seated

**Problem**: Stamps are not automatically awarded when an order is marked "collected" or a patron is marked "seated."

**Fix**: Create a database trigger (or extend existing triggers) that fires:
- On `orders` table when `status` changes to `'collected'` — increment `patron_loyalty.stamps_count` for matching user_id + venue_id (if a stamp_card program exists with `order` in earning_sources)
- On `waitlist_entries` table when `status` changes to `'seated'` — same logic with `waitlist` earning source

This will be a migration with two trigger functions. The triggers check if the venue has an active stamp_card program with the relevant earning source before awarding.

## 5. Merchant-Side Voucher Count Next to Patron Name

**Problem**: Merchants have no visibility into how many active vouchers a patron holds.

**Fix**: 
- In `WaitlistBoard.tsx`: When rendering patron rows, query `discount_codes` for the patron's `user_id` + `venue_id` where `status = 'active'`. Show a small ticket icon with count next to the patron name.
- In `KitchenBoard.tsx`: Same treatment for order cards that have a `user_id`.
- To avoid N+1 queries, batch-fetch all active voucher counts for the venue's patrons in a single query when loading the board data.

## Files Changed

| File | Change |
|---|---|
| `src/components/merchant/LoyaltySettings.tsx` | Remove per-reward stamps_required field |
| `src/pages/Index.tsx` | Change quick-action grid to 3 columns |
| `src/components/LoyaltyReadyFlow.tsx` | Add voucher count badge on venue logos |
| `supabase/migrations/` | Add trigger functions for auto-awarding stamps |
| `src/components/merchant/WaitlistBoard.tsx` | Add voucher count badge next to patron names |
| `src/components/merchant/KitchenBoard.tsx` | Add voucher count badge next to patron names |

## Build Order
1. Remove duplicate stamps_required field (quick fix)
2. Balance home page grid layout (quick fix)
3. Add voucher count badges to loyalty hub logos
4. Create DB triggers for auto-stamping on collected/seated
5. Add merchant-side voucher indicators on boards

