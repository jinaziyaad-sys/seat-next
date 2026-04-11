

## Plan: Group Multi-Table Reservations in New Reservations Alert

### Problem

A multi-table booking (e.g., party of 21 across 4 tables) creates 4 rows in `waitlist_entries`, all sharing the same `linked_reservation_id`. The "New Reservations" alert panel and the tab badge count treat each row as a separate reservation, showing "4" instead of "1".

The calendar day view already groups by `linked_reservation_id` correctly -- this fix applies the same grouping to the alert panel, the acknowledge logic, and the badge count.

### Changes

**`src/components/merchant/ReservationCalendar.tsx`**

1. **Group `newReservations` before rendering**: After fetching, group entries by `linked_reservation_id` (standalone entries use their own `id` as key). Display one card per group, showing the first entry's name/party/time. The count in the header reflects grouped count, not raw row count.

2. **Acknowledge by group**: When acknowledging a single reservation, if it has a `linked_reservation_id`, mark all entries with that same linked ID as `merchant_seen = true` and remove the whole group from state.

**`src/pages/MerchantDashboard.tsx`** (badge count, ~line 151)

3. **Deduplicate the badge count**: Change the count query to count distinct `COALESCE(linked_reservation_id, id)` instead of raw rows. This can be done by fetching the relevant columns and deduplicating client-side (since Supabase JS doesn't support `COUNT(DISTINCT ...)`):
   ```ts
   const { data } = await supabase
     .from("waitlist_entries")
     .select("id, linked_reservation_id")
     .eq("venue_id", userRole.venue_id)
     .eq("reservation_type", "reservation")
     .eq("merchant_seen", false)
     .in("status", ["waiting", "ready"]);
   
   const uniqueCount = new Set(
     (data || []).map(r => r.linked_reservation_id || r.id)
   ).size;
   ```

### Files

| File | Action |
|---|---|
| `src/components/merchant/ReservationCalendar.tsx` | Group new reservations by linked ID; acknowledge all linked entries together |
| `src/pages/MerchantDashboard.tsx` | Deduplicate badge count |

