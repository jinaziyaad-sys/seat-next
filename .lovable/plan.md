

## Plan: Redesign Floor Plan Tab

### Summary

Remove the "live" real-time occupancy tracking from the floor plan. Instead, the Floor Plan tab becomes the home for table configuration (moved out of Settings) plus a visual grid that only shows booking info for today's reservations at their scheduled times.

### Changes

**1. Rewrite `LiveFloorPlan.tsx` into a new `FloorPlan.tsx`**

This component will contain two sections:

- **Table Configuration** (inline, using the existing `TableConfigurationManager` component) -- merchants add/edit/delete tables directly from the Floor Plan tab. Changes save to `venues.settings.table_configuration` as before.
- **Visual Floor Grid** -- shows all configured tables as cards. Tables default to a neutral/empty style. A table only shows as "Booked" when there is a reservation (`waitlist_entries` with `reservation_type = 'reservation'`) assigned to that table for **today**, displaying the customer name, party size, and reservation time. No "free/occupied/ready" live statuses.

The component fetches venue settings directly and handles saving table config changes itself (no dependency on the Settings save flow).

**2. Remove table configuration from `MerchantSettings.tsx`**

Remove the "Table Configuration" accordion item and all related state (`tableConfiguration`, `initialTableConfigurationRef`, save/reset logic for it). The `table_configuration` field in venue settings remains -- it's just managed from the Floor Plan tab now.

**3. Update `MerchantDashboard.tsx`**

Replace `LiveFloorPlan` import with the new `FloorPlan` component.

**4. Booking allocation logic -- no changes**

The existing `find-available-table` edge function, `check-time-slot-availability`, and multi-table combination logic all remain exactly as they are. They read from `venues.settings.table_configuration` which is unchanged. The efficient party-size-to-table matching continues to work.

### Technical Details

**Floor Plan query** (replaces the current all-time waitlist query):
```ts
const todayStart = new Date(); todayStart.setHours(0,0,0,0);
const todayEnd = new Date(); todayEnd.setHours(23,59,59,999);

const { data: reservations } = await supabase
  .from("waitlist_entries")
  .select("customer_name, party_size, assigned_table_id, reservation_time")
  .eq("venue_id", venueId)
  .eq("reservation_type", "reservation")
  .not("assigned_table_id", "is", null)
  .gte("reservation_time", todayStart.toISOString())
  .lte("reservation_time", todayEnd.toISOString())
  .not("status", "eq", "cancelled");
```

**Table config saving** (self-contained in the Floor Plan component):
```ts
await supabase.from("venues").update({
  settings: { ...currentSettings, table_configuration: updatedTables }
}).eq("id", venueId);
```

### Files

| File | Action |
|---|---|
| `src/components/merchant/LiveFloorPlan.tsx` | Rewrite as `FloorPlan.tsx` -- table config + booking-only visual grid |
| `src/components/merchant/MerchantSettings.tsx` | Remove table configuration accordion and related state |
| `src/pages/MerchantDashboard.tsx` | Swap `LiveFloorPlan` for new `FloorPlan` |
| `src/components/merchant/TableConfigurationManager.tsx` | No changes (reused as-is) |
| Edge functions | No changes -- allocation logic preserved |

