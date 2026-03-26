

# Fix Open/Closed & Busyness Indicators on Merchant Dashboard

## Problems Found

### 1. Broken `is_open` Logic (Critical)
Line 120 in `VenueStatusIndicator.tsx`:
```typescript
setVenueStatus({ is_open: status.is_open || status.is_on_break === false, ... });
```
`status.is_on_break === false` is true whenever the venue is **not** on a break — including when it's simply **closed**. So a closed venue still shows "Open". The correct logic should be:
```typescript
is_open: status.is_open
```
If the intent was "show as open when on break" (since the venue is technically open, just paused), it should be `status.is_open || status.is_on_break`, but `checkVenueStatus` already returns `is_open: false` during breaks, so the indicator should just use `status.is_open` directly, and optionally show a separate "On Break" state.

### 2. Grace Period Skews Merchant View
The component calls `checkVenueStatus` with `checkType: 'waitlist'`, which applies a **30-minute** grace period. This means the merchant sees "Closed" 30 minutes before actual closing time, which is misleading for the operator. The merchant dashboard should show the raw open/closed status without grace period cutoffs — grace periods are for patron-facing logic only.

### 3. Busyness Counts Include Future Reservations
The waitlist query counts all entries with status `waiting` or `ready` — this includes future reservations that haven't arrived yet. A reservation for 8 PM shouldn't count toward "busyness" at 2 PM. The query should filter to only current activity (walk-ins + reservations whose `reservation_time` is within a reasonable window, e.g., now ± 30 min).

## Changes

### File: `src/components/merchant/VenueStatusIndicator.tsx`

**Fix 1 — Open/Closed logic (line 120)**:
Replace the broken boolean expression with just `status.is_open`. Add a separate "On Break" badge state when `status.is_on_break` is true.

**Fix 2 — Remove grace period from merchant view (line 119)**:
Pass zero grace periods so the merchant sees the actual operating status:
```typescript
const gracePeriods = { last_reservation: 0, last_order: 0, last_waitlist_join: 0 };
```

**Fix 3 — Filter busyness to current activity (lines 60-65)**:
Add a filter to exclude future reservations from the waitlist count. Only count entries where `reservation_time` is null (walk-ins) or `reservation_time` is within 30 minutes of now:
```typescript
// Active walk-ins
const { count: walkInCount } = await supabase
  .from('waitlist_entries')
  .select('*', { count: 'exact', head: true })
  .eq('venue_id', venueId)
  .in('status', ['waiting', 'ready'])
  .is('reservation_time', null);

// Active reservations (time is within ±30 min of now)
const windowStart = new Date(Date.now() - 30 * 60000).toISOString();
const windowEnd = new Date(Date.now() + 30 * 60000).toISOString();
const { count: activeResCount } = await supabase
  .from('waitlist_entries')
  .select('*', { count: 'exact', head: true })
  .eq('venue_id', venueId)
  .in('status', ['waiting', 'ready'])
  .not('reservation_time', 'is', null)
  .gte('reservation_time', windowStart)
  .lte('reservation_time', windowEnd);
```

**Fix 4 — Add "On Break" badge state**:
When `status.is_on_break` is true, show an amber "On Break" badge with the break reason and resume time in the tooltip, instead of "Closed".

## Summary of Visual Changes

| Current | Fixed |
|---------|-------|
| Shows "Open" when venue is closed | Shows "Closed" correctly |
| Shows "Closed" 30 min before actual close | Shows "Open" until actual close time |
| "Quiet" counts future reservations | Only counts current walk-ins + imminent reservations |
| No break indicator | Shows "On Break" with reason + resume time |

