

# Reorganize Table Ready Flow with Tabs

## Overview

This plan reorganizes the Table Ready screen to use a tabbed interface, separating Waitlist (walk-ins) from Reservations, and relocating the Explore feature from the Home page to the Reservations tab.

## Current vs New Structure

```text
CURRENT:
+----------------+
|     HOME       |
|  [Food Ready]  |
|  [Table Ready] |
|  [Explore]  <--+-- Remove from here
+----------------+
       |
       v
+----------------+
|  TABLE READY   |
|  Venue Select  |
|  Booking Type  |
|    (Now/Later) |
+----------------+

NEW:
+----------------+
|     HOME       |
|  [Food Ready]  |
|  [Table Ready] |
+----------------+
       |
       v
+----------------------------------+
|         TABLE READY              |
|  [Waitlist Tab] | [Reservations] |
+----------------------------------+
|                                  |
| Waitlist Tab:                    |
|   - Venue dropdown               |
|   - Join waitlist flow           |
|                                  |
| Reservations Tab:                |
|   - [Explore Venues] button      |
|   - Venue dropdown               |
|   - Book reservation flow        |
+----------------------------------+
```

## Changes Summary

| File | Changes |
|------|---------|
| `src/components/TableReadyFlow.tsx` | Add tabbed interface at the top level (before venue-select), with "Waitlist" and "Reservations" tabs. Move venue selection into each tab. |
| `src/pages/Index.tsx` | Remove the Explore card from the quick actions grid, remove the `explore` tab/view handling |

## Detailed Implementation

### 1. Modify TableReadyFlow.tsx

Add a new "mode" state that defaults to showing a tab selector:

**Add new state:**
```typescript
const [mode, setMode] = useState<"tab-select" | "waitlist" | "reservation">("tab-select");
```

**Modify step flow:**
- When `mode === "tab-select"` and no `initialEntry`: show tabs (Waitlist / Reservations)
- When Waitlist tab is clicked: set `mode = "waitlist"`, skip booking-type, go directly to venue-select with `bookingType = "now"`
- When Reservations tab is clicked: set `mode = "reservation"`, show Explore button + venue dropdown

**New Tab Selection UI (rendered when step === "venue-select" and no initialEntry):**

```text
+----------------------------------------+
|  <- Back          Table Ready          |
+----------------------------------------+
|                                        |
|   [  Waitlist  ]  [  Reservations  ]   |
|                                        |
+----------------------------------------+
|                                        |
| (If Waitlist selected):                |
|   Venue dropdown                       |
|   -> proceeds to party-details         |
|                                        |
| (If Reservations selected):            |
|   [Explore Venues] button              |
|   Venue dropdown                       |
|   -> proceeds to reservation-details   |
|                                        |
+----------------------------------------+
```

**Logic changes:**
- Remove the "booking-type" step (Now vs Later choice)
- Waitlist tab = walk-in flow (current "now" path)
- Reservations tab = reservation flow (current "later" path)
- Add Explore button inside Reservations tab that opens ExploreVenues

### 2. Modify Index.tsx

**Remove:**
- The Explore card from the quick actions grid (lines 1083-1098)
- The `explore` tab handling (lines 523-535)
- The `activeTab === "explore"` condition

### 3. Integrate ExploreVenues into TableReadyFlow

When user clicks "Explore Venues" button in the Reservations tab:
- Either navigate to a sub-view within TableReadyFlow
- Or set a state that renders ExploreVenues inline

**Option A (simpler):** Add a state `showExplore` that renders ExploreVenues with an `onBack` that returns to the reservation tab.

**Option B:** Pass the venue selection from ExploreVenues back to pre-fill the venue dropdown.

---

## Visual Design

The tab interface will use the existing `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` components from `@radix-ui/react-tabs`:

```typescript
<Tabs defaultValue="waitlist" className="w-full">
  <TabsList className="grid w-full grid-cols-2">
    <TabsTrigger value="waitlist">Waitlist</TabsTrigger>
    <TabsTrigger value="reservations">Reservations</TabsTrigger>
  </TabsList>
  <TabsContent value="waitlist">
    {/* Venue dropdown + waitlist flow */}
  </TabsContent>
  <TabsContent value="reservations">
    {/* Explore button + venue dropdown + reservation flow */}
  </TabsContent>
</Tabs>
```

---

## User Flow After Changes

**Waitlist Flow:**
1. User taps "Table Ready" on Home
2. Sees tabs: Waitlist (default) | Reservations
3. Waitlist tab shows venue dropdown
4. User selects venue -> goes to party details -> joins waitlist

**Reservation Flow:**
1. User taps "Table Ready" on Home
2. Sees tabs: Waitlist | Reservations
3. User taps Reservations tab
4. Sees "Explore Venues" button + venue dropdown
5. User can either explore or select venue directly
6. Selecting venue -> goes to date/time picker -> party details -> confirms reservation

**Explore Flow:**
1. User taps "Table Ready" -> Reservations tab -> "Explore Venues"
2. ExploreVenues component opens
3. User browses recommendations
4. User can select a venue which pre-fills the venue dropdown

---

## Technical Details

### State Management

```typescript
// New state for tab/mode tracking
const [activeTableTab, setActiveTableTab] = useState<"waitlist" | "reservations">("waitlist");
const [showExploreView, setShowExploreView] = useState(false);
```

### Step Flow Simplification

Current steps:
```
venue-select -> booking-type -> (reservation-details | party-details) -> waiting/ready
```

New steps:
```
venue-select -> (reservation-details | party-details) -> waiting/ready
```

The booking-type step is removed because the tab choice determines the flow type.

### Explore Integration

When a venue is selected from ExploreVenues:
```typescript
onSelectVenue={(venueId) => {
  setShowExploreView(false);
  // Pre-select the venue in dropdown
  const venue = venues.find(v => v.id === venueId);
  if (venue) {
    handleVenueSelect(venueId);
  }
}}
```

---

## Testing Checklist

- Waitlist tab shows venue dropdown and leads to walk-in waitlist flow
- Reservations tab shows Explore button and venue dropdown
- Explore button opens ExploreVenues component
- Selecting venue from Explore pre-fills and proceeds to reservation flow
- Home page no longer shows Explore card
- Back button from TableReadyFlow returns to Home
- Existing active tracking (initialEntry) still works correctly

