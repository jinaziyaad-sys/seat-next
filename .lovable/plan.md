

## Plan: Remove Table Occupancy Grid from Reservation Calendar

### Problem
The "Table Occupancy" section in the Reservations tab (showing time-slot rows with FREE/FULL table cards) duplicates the Floor Plan tab's functionality. It should be removed.

### Changes

**`src/components/merchant/ReservationCalendar.tsx`**

1. Delete the entire "Table Occupancy Grid" block (lines 720-796) -- the `<Card>` containing the time-slot grid with FREE/FULL badges.
2. Remove the `getTimeSlots` helper function if it's only used by that block.
3. Remove the `tableConfiguration` state and its fetch logic if no longer used elsewhere in the component (will verify during implementation).
4. Clean up any unused imports (`Utensils` icon if only used there).

No other files affected.

