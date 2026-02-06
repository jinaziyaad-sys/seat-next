
# Fix: Time Slot Availability Check Timezone Mismatch

## Problem Identified

The `check-time-slot-availability` edge function is checking the **wrong time slots** due to a timezone mismatch:

| Component | Time Format | Example |
|-----------|-------------|---------|
| Frontend sends | Local time string | `"16:15"` (4:15 PM local) |
| Edge function parses | As UTC | `2026-02-06T16:15:00Z` |
| Actual reservations stored | Correct UTC | `2026-02-06T14:00:00Z` |

**Result:** When checking 4:15 PM local (which is 2:15 PM UTC for a user in UTC+2), the edge function checks 4:15 PM **UTC** instead, missing all the reservations that are stored at the correct UTC time.

This is why all slots appear "available" even when they're fully booked!

## Solution

Convert time slots to ISO timestamps on the **frontend** before sending to the edge function, matching how `find-available-table` receives times.

## Technical Changes

### File 1: `src/components/TableReadyFlow.tsx`

Change the availability check to send ISO timestamps instead of local time strings:

**Current code:**
```typescript
const { data, error } = await supabase.functions.invoke('check-time-slot-availability', {
  body: {
    venue_id: selectedVenueData.id,
    date: dateStr,
    party_size: partySize,
    time_slots: timeSlots  // ["16:15", "16:30", ...]
  }
});
```

**Fixed code:**
```typescript
// Convert time slots to ISO timestamps
const timeSlotsWithISO = timeSlots.map(time => {
  const [hours, minutes] = time.split(':').map(Number);
  const slotDate = new Date(reservationDate);
  slotDate.setHours(hours, minutes, 0, 0);
  return {
    time: time,  // Keep original for display
    iso: slotDate.toISOString()  // Correct UTC time
  };
});

const { data, error } = await supabase.functions.invoke('check-time-slot-availability', {
  body: {
    venue_id: selectedVenueData.id,
    date: dateStr,
    party_size: partySize,
    time_slots: timeSlotsWithISO  // [{time: "16:15", iso: "2026-02-06T14:15:00Z"}, ...]
  }
});
```

### File 2: `supabase/functions/check-time-slot-availability/index.ts`

Update the edge function to use the ISO timestamps:

**Current code:**
```typescript
for (const time of time_slots) {
  // Parse time and create ISO timestamp (WRONG - timezone issue)
  const reservationTime = new Date(`${date}T${time}:00`).toISOString();
  // ...
}
```

**Fixed code:**
```typescript
for (const slot of time_slots) {
  // Handle both old format (string) and new format ({time, iso})
  const timeKey = typeof slot === 'string' ? slot : slot.time;
  const reservationTime = typeof slot === 'string' 
    ? new Date(`${date}T${slot}:00`).toISOString()  // Fallback
    : slot.iso;  // Use correct ISO timestamp

  // Get occupied tables for this slot
  const { data: occupiedTables } = await supabaseClient.rpc('get_occupied_tables', {
    p_venue_id: venue_id,
    p_time_slot: reservationTime,  // Now correct UTC
    p_buffer_minutes: 30
  });

  // ... rest of logic
  
  results[timeKey] = {
    available: canFit,
    reason: canFit ? undefined : 'Fully booked'
  };
}
```

## Data Flow After Fix

```
User selects 4:15 PM (UTC+2 timezone)
    ↓
Frontend converts: 4:15 PM local → "2026-02-06T14:15:00Z" (UTC)
    ↓
Edge function receives ISO timestamp
    ↓
Queries get_occupied_tables with correct UTC time
    ↓
Finds all 3 tables are occupied at 14:00-14:30 UTC
    ↓
Returns: {"16:15": {available: false, reason: "Fully booked"}}
    ↓
UI greys out 4:15 PM slot ✓
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/TableReadyFlow.tsx` | Convert time slots to ISO before sending |
| `supabase/functions/check-time-slot-availability/index.ts` | Use ISO timestamps from request, return keyed by original time string |

## Testing Checklist

1. Create several reservations at a venue to fill time slots
2. Open reservation flow and select the same date
3. Verify those time slots now show as greyed out / "Fully booked"
4. Confirm available slots can still be selected and booked
5. Test in different browser timezones to ensure consistency
