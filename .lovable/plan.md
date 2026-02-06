

# Add Reservation Lead Time Setting & Separate Grace Periods

## Overview

Two changes to merchant settings:
1. **Add "Minimum Reservation Lead Time"** - Allow merchants to configure how far in advance a reservation must be made (currently hardcoded to 60 minutes)
2. **Move Grace Periods** - Extract grace periods from Business Hours into its own top-level accordion section for better visibility and logical separation

## Current vs. New Structure

```text
Current Layout:                            New Layout:
┌──────────────────────────────────────┐   ┌──────────────────────────────────────┐
│ ▶ Venue Discovery Profile            │   │ ▶ Venue Discovery Profile            │
│ ▶ Table Configuration                │   │ ▶ Table Configuration                │
│ ▶ Kitchen Settings                   │   │ ▶ Kitchen Settings                   │
│ ▶ Waitlist Preferences               │   │ ▶ Waitlist Preferences               │
│ ▶ Pickup Instructions                │   │ ▶ Pickup Instructions                │
│ ▶ Business Hours & Schedule          │   │ ▶ Business Hours & Schedule          │
│   ├─ Regular Business Hours          │   │   ├─ Regular Business Hours          │
│   ├─ Holiday Closures                │   │   ├─ Holiday Closures                │
│   ├─ Grace Periods  ← INSIDE         │   │   └─ Operations & Cleanup            │
│   └─ Operations & Cleanup            │   │ ▶ Booking & Timing Rules  ← NEW      │
│ ▶ Auto No-Show Settings              │   │   ├─ Minimum Reservation Lead Time   │
└──────────────────────────────────────┘   │   └─ Grace Periods (closing time)    │
                                           │ ▶ Auto No-Show Settings              │
                                           └──────────────────────────────────────┘
```

## Technical Changes

### File: `src/components/merchant/MerchantSettings.tsx`

#### 1. Add State for Minimum Reservation Lead Time

```typescript
const [settings, setSettings] = useState({
  venueCapacity: "40",
  defaultPrepTime: "10",
  maxExtensionTime: "45",
  pickupInstructions: "...",
  autoNoShowTime: "15",
  orderNumberRefreshMinutes: "15",
  cobTime: "23:00",
  autoCleanupCancelledWaitlist: true,
  prepTimeMode: "analytics",
  minimumReservationLeadTime: "60"  // NEW - in minutes
});
```

#### 2. Load Setting from Database

Update the fetch logic to read `minimum_reservation_lead_time` from venue settings.

#### 3. Save Setting to Database

Update `handleSaveAll` to include `minimum_reservation_lead_time` in the saved settings object.

#### 4. Remove Grace Periods Collapsible from Business Hours

Remove the Grace Periods `<Collapsible>` section from inside the Business Hours accordion.

#### 5. Add New "Booking & Timing Rules" Accordion

Create a new top-level accordion section with:
- **Minimum Reservation Lead Time**: Slider or input for minutes (0-180 minutes in 15-min increments)
- **Grace Periods**: The existing three sliders moved here

### New Accordion Section UI

```tsx
<AccordionItem value="booking-rules" className="border rounded-lg px-4 bg-card">
  <AccordionTrigger className="text-lg font-semibold hover:no-underline">
    <div className="flex items-center gap-2">
      <Timer className="h-5 w-5 text-primary" />
      Booking & Timing Rules
    </div>
  </AccordionTrigger>
  <AccordionContent className="pt-2 pb-4 space-y-6">
    {/* Minimum Reservation Lead Time */}
    <div className="space-y-3">
      <Label className="text-base font-medium">Minimum Reservation Lead Time</Label>
      <p className="text-sm text-muted-foreground">
        How far in advance must reservations be made?
      </p>
      <div className="flex items-center gap-4">
        <Slider
          min={0}
          max={180}
          step={15}
          value={[parseInt(settings.minimumReservationLeadTime)]}
          onValueChange={(value) => handleInputChange("minimumReservationLeadTime", value[0].toString())}
          className="flex-1"
        />
        <Badge variant="outline" className="min-w-[80px] justify-center">
          {settings.minimumReservationLeadTime === "0" 
            ? "No minimum" 
            : `${settings.minimumReservationLeadTime} min`}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Set to 0 to allow last-minute reservations. 60 min = 1 hour notice required.
      </p>
    </div>

    <Separator />

    {/* Grace Periods (moved from Business Hours) */}
    <div className="space-y-4">
      <Label className="text-base font-medium">Grace Periods (Before Closing)</Label>
      <div className="p-3 bg-secondary/50 rounded-lg flex items-start gap-2">
        <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Grace periods determine how long before closing time you stop accepting new reservations, orders, and waitlist joins.
        </p>
      </div>
      
      {/* Last Reservation slider */}
      {/* Last Order slider */}
      {/* Last Waitlist Join slider */}
    </div>
  </AccordionContent>
</AccordionItem>
```

### Patron-Side Impact

The `TableReadyFlow.tsx` already reads `minimum_reservation_lead_time` from venue settings:

```typescript
const minimumLeadTime = selectedVenueData?.settings?.minimum_reservation_lead_time ?? 60;
```

Once merchants save this setting, patrons will see the correct lead time enforced when booking.

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/merchant/MerchantSettings.tsx` | Add state, load/save logic, remove grace periods from Business Hours, add new "Booking & Timing Rules" accordion |

## User Experience

**For Merchants:**
- Clear separation between "when do we close" (Business Hours) and "what are the booking rules" (Booking & Timing Rules)
- New slider to set minimum reservation lead time from 0 to 180 minutes

**For Patrons:**
- Message changes from hardcoded "1 hour notice" to the configured time
- Example: If merchant sets 30 minutes, patron sees "Reservations require at least 30 minutes notice"

## Testing Checklist

1. Verify new "Booking & Timing Rules" accordion appears with both settings
2. Set minimum lead time to various values (0, 30, 60, 120) and verify saves correctly
3. Test patron-side: when booking for today, confirm time slots block correctly based on lead time
4. Verify grace periods still save/load correctly after being moved
5. Check that existing venues with no `minimum_reservation_lead_time` default to 60 minutes

