
# Merchant Settings UI Improvements

## Overview

Transform the merchant settings page from a long scrolling list of cards into an organized accordion-style interface where each section is collapsible. Additionally, simplify the Operations & Cleanup section with a cleaner YES/NO toggle approach.

## Changes

### 1. Accordion Layout for All Setting Sections

Replace individual Cards with a unified Accordion component. Each setting section becomes a collapsible accordion item that can be opened/closed independently.

```text
Current Layout:                        New Layout:
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│ Venue Discovery Card            │   │ ▼ Venue Discovery               │
│   [always visible content]      │   │    [collapsed - click to open]  │
├─────────────────────────────────┤   ├─────────────────────────────────┤
│ Kitchen Settings Card           │   │ ▶ Kitchen Settings              │
│   [always visible content]      │   │    [expanded content...]        │
├─────────────────────────────────┤   ├─────────────────────────────────┤
│ Operations & Cleanup Card       │   │ ▶ Operations & Cleanup          │
│   [always visible content]      │   │    [expanded content...]        │
├─────────────────────────────────┤   ├─────────────────────────────────┤
│ ... more cards ...              │   │ ▶ ... more sections ...         │
└─────────────────────────────────┘   └─────────────────────────────────┘
```

**Accordion Sections (in order):**
1. Venue Discovery Profile
2. Table Configuration (if table_ready)
3. Kitchen Settings (if food_ready)
4. Operations & Cleanup
5. Waitlist Preferences (if table_ready)
6. Pickup Instructions (if food_ready)
7. Business Hours & Schedule
8. Auto No-Show Settings

### 2. Simplified Operations & Cleanup

Replace the current two-field interface with a cleaner toggle-based approach:

```text
Current:                              New:
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│ Close of Business Time          │   │ Operations & Cleanup at COB     │
│ [23:00     ]                    │   │                                 │
│                                 │   │   ○ Yes - Run at business       │
│ Auto-cleanup Cancelled          │   │         close time              │
│ Waitlist Entries    [toggle]    │   │                                 │
└─────────────────────────────────┘   │   ○ No - Run at custom time     │
                                      │         [22:30     ]            │
                                      │                                 │
                                      │ Auto-cleanup settings:          │
                                      │   ☑ Clear cancelled waitlist    │
                                      │   ☑ Clear rejected orders       │
                                      └─────────────────────────────────┘
```

**Logic:**
- "Yes" = Use the venue's regular closing time from business hours (no manual time picker)
- "No" = Show a time picker for custom cleanup time
- Cleanup toggles remain visible regardless of choice

---

## Technical Implementation

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/merchant/MerchantSettings.tsx` | Replace Card layout with Accordion, refactor Operations & Cleanup section |

### State Changes

Add new state variable:
```typescript
const [useClosingTimeForCleanup, setUseClosingTimeForCleanup] = useState(true);
```

The `cobTime` setting will only be editable when `useClosingTimeForCleanup` is `false`.

### Accordion Structure

```typescript
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

<Accordion type="multiple" defaultValue={["operations"]} className="space-y-4">
  <AccordionItem value="discovery" className="border rounded-lg px-4">
    <AccordionTrigger className="text-lg font-semibold">
      Venue Discovery Profile
    </AccordionTrigger>
    <AccordionContent>
      <VenueDiscoverySettings venueId={venueId} />
    </AccordionContent>
  </AccordionItem>
  
  {/* ... more items ... */}
</Accordion>
```

### Operations & Cleanup Refactor

```typescript
<AccordionItem value="operations" className="border rounded-lg px-4">
  <AccordionTrigger className="text-lg font-semibold">
    Operations & Cleanup
  </AccordionTrigger>
  <AccordionContent className="space-y-4 pt-2">
    <div className="space-y-3">
      <Label className="text-base font-medium">Run cleanup at Close of Business?</Label>
      <RadioGroup 
        value={useClosingTimeForCleanup ? "yes" : "no"}
        onValueChange={(val) => setUseClosingTimeForCleanup(val === "yes")}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="yes" id="cob-yes" />
          <Label htmlFor="cob-yes">Yes - Use business closing time</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="no" id="cob-no" />
          <Label htmlFor="cob-no">No - Use custom time</Label>
        </div>
      </RadioGroup>
      
      {!useClosingTimeForCleanup && (
        <div className="ml-6 mt-2">
          <Label htmlFor="cob-time">Cleanup Time</Label>
          <Input
            id="cob-time"
            type="time"
            value={settings.cobTime}
            onChange={(e) => handleInputChange('cobTime', e.target.value)}
            className="w-32 mt-1"
          />
        </div>
      )}
    </div>
    
    <Separator />
    
    <div className="space-y-3">
      <Label className="text-sm font-medium text-muted-foreground">
        Cleanup Actions
      </Label>
      <div className="flex items-center justify-between">
        <Label>Auto-cleanup cancelled waitlist entries</Label>
        <Switch checked={settings.autoCleanupCancelledWaitlist} ... />
      </div>
      <div className="flex items-center justify-between">
        <Label>Auto-cleanup rejected orders</Label>
        <Switch checked={autoCleanupRejected} ... />
      </div>
    </div>
  </AccordionContent>
</AccordionItem>
```

### Data Persistence

Add `use_closing_time_for_cleanup` to the settings object saved to the database:
```typescript
const updatedSettings = {
  // ... existing fields ...
  use_closing_time_for_cleanup: useClosingTimeForCleanup,
  cob_time: useClosingTimeForCleanup ? null : settings.cobTime,
};
```

---

## Visual Result

After implementation, the settings page will have:
- Clean, organized accordion sections that hide complexity
- Only one section open at a time (optional) or multiple open
- A simple YES/NO choice for cleanup timing
- Less visual clutter with settings tucked away until needed
- Consistent styling with rounded borders on each accordion item

---

## Dependencies

Uses existing components already in the project:
- `@/components/ui/accordion` - Already imported in project
- `@/components/ui/radio-group` - Already available

No new dependencies required.
