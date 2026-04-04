
# Fix: Loyalty stamps still stay at 0 after collection

## What was confirmed
- The order was really updated to `collected`.
- The venue has an active stamp-card loyalty program with `earning_sources = ['order', 'waitlist']`.
- The patron already has a `patron_loyalty` row for that venue.
- No new `loyalty_transactions` row was created for the collected order.
- That means the problem is in the backend loyalty-award path, not the patron screen refresh.

## Plan
1. **Harden the loyalty award triggers**
   - Update `credit_loyalty_on_order()` and `credit_loyalty_on_waitlist()` in a new migration.
   - Use a more reliable upsert/credit flow so the patron row is definitely created/updated before the transaction record is written.
   - Keep per-order / per-waitlist dedup using `source_id` so one event can only award once.
   - Add lightweight trigger logging so failed award paths become visible in Postgres logs during testing.

2. **Repair already-missed stamps**
   - Add a reconciliation step in the migration that scans collected orders / seated waitlist entries with no matching loyalty transaction.
   - Award the missing stamp once for each missed source.
   - This will fix the order you just completed without double-crediting old records.

3. **Clean up the threshold mismatch**
   - The live data shows a reward row still carrying a different `stamps_required` value than the program threshold.
   - Make the program `stamp_threshold` the single source of truth for stamp-card progress in the patron UI.
   - Stop using per-reward `stamps_required` for stamp-card progress calculations so the loyalty screen cannot show broken values like `3/0`.

4. **Verify end to end**
   - Collect a fresh order.
   - Confirm a `stamp_earned` transaction is created for that exact order ID.
   - Confirm `patron_loyalty.stamps_count` increments immediately.
   - Confirm the patron loyalty screen updates in realtime.
   - Confirm re-updating the same order does not create a duplicate stamp.

## Files / areas to update
- `supabase/migrations/` — new migration for trigger hardening + reconciliation
- `src/components/PatronLoyaltyCard.tsx` — use program threshold consistently
- `src/components/LoyaltyReadyFlow.tsx` — use program threshold consistently

## Expected result
- New collected orders and seated visits reliably award stamps.
- Missed stamps get repaired once.
- Patron loyalty progress no longer shows inconsistent or broken stamp counts.
