

# Grey Out Unavailable Time Slots in Reservation Flow

## Problem

Currently, patrons can select any time slot within business hours, but they only discover a slot is fully booked when they try to submit the reservation. This creates a frustrating experience where users go through the entire flow only to learn "No tables available."

**Current flow:**
```
User selects date → Sees ALL time slots → Picks a time → Enters party details → 
Submits → ERROR: "No tables available" → Has to go back and try again
```

**Desired flow:**
```
User selects date + party size → Sees time slots with availability status → 
Greyed-out slots show "Fully booked" → User picks available slot → Success
```

## Solution Overview

Fetch table availability for each time slot when the user selects a date, then display slots with availability status. Fully booked slots will be greyed out and disabled.

## Technical Approach

### Key Insight: Party Size Matters

Table availability depends on party size:
- A party of 2 might find a slot available (2-seat table free)
- A party of 8 at the same time might be blocked (no large tables available)

Therefore, we need to either:
1. **Option A**: Ask for party size BEFORE date/time selection
2. **Option B**: Default to checking if ANY table is available, then re-check at submission for specific party size

**Recommended: Option A** - Move party size input to reservation-details step so we can show accurate availability.

## Implementation Plan

### Phase 1: Move Party Size Selection Earlier

Move the party size selector from "party-details" step to "reservation-details" step so we know the party size when fetching availability.

**File:** `src/components/TableReadyFlow.tsx`

#### Changes to reservation-details step:

```tsx
if (step === "reservation-details") {
  // NEW: Party size needed for availability check
  const [localPartySize, setLocalPartySize] = useState(partySize);
  
  return (
    <div className="space-y-6 p-6">
      {/* ... header ... */}
      
      <Card className="shadow-card">
        <CardContent className="space-y-6">
          {/* NEW: Party size selector FIRST */}
          <div className="space-y-3">
            <Label>Party Size</Label>
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => setLocalPartySize(s => Math.max(1, s - 1))}>-</Button>
              <span className="font-semibold">{localPartySize}</span>
              <Button variant="outline" onClick={() => setLocalPartySize(s => Math.min(20, s + 1))}>+</Button>
            </div>
          </div>
          
          {/* Date selector */}
          {/* Time selector with availability */}
        </CardContent>
      </Card>
    </div>
  );
}
```

### Phase 2: Create Edge Function to Check Slot Availability

Create a new edge function that returns availability for multiple time slots at once (batch request to avoid N+1 calls).

**New File:** `supabase/functions/check-time-slot-availability/index.ts`

```typescript
// Request: { venue_id, date, party_size, time_slots: string[] }
// Response: { [timeSlot]: { available: boolean, reason?: string } }

Deno.serve(async (req) => {
  const { venue_id, date, party_size, time_slots } = await req.json();
  
  // Get venue table configuration
  const { data: venue } = await supabase
    .from('venues')
    .select('settings')
    .eq('id', venue_id)
    .single();
  
  const tableConfiguration = venue.settings?.table_configuration || [];
  const results: Record<string, { available: boolean; reason?: string }> = {};
  
  // For each time slot, check availability
  for (const time of time_slots) {
    const reservationTime = new Date(`${date}T${time}:00`).toISOString();
    
    // Get occupied tables for this slot
    const { data: occupiedTables } = await supabase.rpc('get_occupied_tables', {
      p_venue_id: venue_id,
      p_time_slot: reservationTime,
      p_buffer_minutes: 30
    });
    
    const occupiedIds = new Set((occupiedTables || []).map(t => t.table_id));
    
    // Check if any table or combination can fit the party
    const availableTables = tableConfiguration.filter(t => !occupiedIds.has(t.id));
    const canFit = checkCanFitParty(party_size, availableTables);
    
    results[time] = {
      available: canFit,
      reason: canFit ? undefined : 'Fully booked'
    };
  }
  
  return new Response(JSON.stringify(results), { headers: corsHeaders });
});
```

### Phase 3: Fetch Availability When Date Changes

In `TableReadyFlow.tsx`, add state and effect to fetch availability when date/party size changes.

```tsx
// State for slot availability
const [slotAvailability, setSlotAvailability] = useState<Record<string, { available: boolean; reason?: string }>>({});
const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

// Effect to check availability when date or party size changes
useEffect(() => {
  if (!reservationDate || !selectedVenueData?.id) return;
  
  const checkAvailability = async () => {
    setIsCheckingAvailability(true);
    
    const dateStr = format(reservationDate, 'yyyy-MM-dd');
    const { data, error } = await supabase.functions.invoke('check-time-slot-availability', {
      body: {
        venue_id: selectedVenueData.id,
        date: dateStr,
        party_size: partySize,
        time_slots: timeSlots
      }
    });
    
    if (!error && data) {
      setSlotAvailability(data);
    }
    setIsCheckingAvailability(false);
  };
  
  checkAvailability();
}, [reservationDate, partySize, selectedVenueData?.id]);
```

### Phase 4: Update Time Slot UI to Show Availability

Update the `SelectItem` rendering to show availability status:

```tsx
<SelectContent className="max-h-[300px]">
  {isCheckingAvailability ? (
    <div className="flex items-center justify-center p-4">
      <Loader2 className="h-4 w-4 animate-spin mr-2" />
      Checking availability...
    </div>
  ) : (
    timeSlots.map((time) => {
      const availability = slotAvailability[time];
      const isAvailable = availability?.available !== false;
      
      return (
        <SelectItem 
          key={time} 
          value={time}
          disabled={!isAvailable}
          className={cn(
            !isAvailable && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="flex items-center justify-between w-full">
            <span>{formatTime(time)}</span>
            {!isAvailable && (
              <Badge variant="secondary" className="ml-2 text-xs">
                Fully booked
              </Badge>
            )}
          </div>
        </SelectItem>
      );
    })
  )}
</SelectContent>
```

### Visual Result

```
┌─────────────────────────────────────────┐
│  Choose Date & Time                     │
├─────────────────────────────────────────┤
│  Party Size: [−] 4 [+]                  │
│                                         │
│  Select Date: [February 7, 2026    ▼]   │
│                                         │
│  Select Time:                           │
│  ┌─────────────────────────────────┐    │
│  │ 12:00 PM                        │    │
│  │ 12:15 PM                        │    │
│  │ 12:30 PM       Fully booked  ░░ │ ← Greyed out   │
│  │ 12:45 PM       Fully booked  ░░ │ ← Greyed out   │
│  │ 1:00 PM                         │    │
│  │ 1:15 PM                         │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [Continue to Party Details]            │
└─────────────────────────────────────────┘
```

## Files to Create/Modify

| File | Action | Changes |
|------|--------|---------|
| `supabase/functions/check-time-slot-availability/index.ts` | **Create** | New edge function to batch-check availability for multiple time slots |
| `src/components/TableReadyFlow.tsx` | **Modify** | Add party size to reservation-details step, add availability state/effect, update time slot rendering |
| `src/utils/businessHours.ts` | **No change** | Already provides `getAvailableReservationTimes` |

## Performance Considerations

1. **Batch request**: Single API call checks all time slots instead of one per slot
2. **Caching**: Results cached in state until date/party size changes
3. **Loading state**: Show spinner while checking availability
4. **Debouncing**: Consider debouncing party size changes to reduce API calls

## Edge Cases

1. **Party size changes after time selected**: Re-fetch availability and clear selection if slot becomes unavailable
2. **Real-time updates**: For now, availability is checked on date selection; future enhancement could add real-time updates
3. **Large parties**: System already supports multi-table combinations via `findTableCombination` algorithm

## Testing Checklist

1. Select a date and verify availability check runs
2. Verify greyed-out slots cannot be selected
3. Change party size and verify availability updates
4. Confirm available slots can be booked successfully
5. Test with venue that has no tables configured - should show appropriate message
6. Test a fully-booked date - should show "No Availability" message

