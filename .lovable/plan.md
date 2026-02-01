
# Add Entry Buttons Before Venue Selection in Table Ready Flow

## Overview

Currently when users tap "Table Ready" on the home page, they immediately see tabs with the venue search dropdown. The user wants an intermediate screen with two prominent buttons - similar to the home page's "Food Ready" / "Table Ready" cards - for choosing between **Waitlist** and **Reservations** before showing the venue search.

## Current vs New Flow

```text
CURRENT FLOW:
Home → "Table Ready" button → [Tabs: Waitlist | Reservations] with search dropdown

NEW FLOW:
Home → "Table Ready" button → [Two big buttons: Waitlist | Reservations] 
                                    ↓                    ↓
                           Search dropdown        Search dropdown + Explore Venues
```

## Visual Design

The new entry screen will match the home page card style:

```text
┌─────────────────────────────────────────────────────┐
│ ← Table Ready                                       │
│                                                     │
│  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │       [👥]          │  │      [📅]           │  │
│  │                     │  │                      │  │
│  │     Waitlist        │  │   Reservations       │  │
│  │  Get seated today   │  │  Book in advance     │  │
│  └─────────────────────┘  └─────────────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

After clicking one of the buttons, the user sees the current search/venue selection interface.

## Changes Summary

| File | Changes |
|------|---------|
| `src/components/TableReadyFlow.tsx` | Add new "entry-select" step with two card buttons; modify step flow to start at entry-select instead of venue-select |

## Technical Implementation

### 1. Add New Step Type

Update the step type to include a new entry selection step:

```typescript
// Change from:
const [step, setStep] = useState<"venue-select" | "booking-type" | ...>("venue-select");

// To:
const [step, setStep] = useState<"entry-select" | "venue-select" | "booking-type" | ...>("entry-select");
```

### 2. Render Entry Selection Screen

Add a new conditional render before `step === "venue-select"`:

```typescript
if (step === "entry-select") {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold">Table Ready</h1>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Waitlist Card */}
        <Card 
          className="cursor-pointer shadow-card transition-all hover:scale-105 hover:shadow-floating active:scale-95"
          onClick={() => {
            setActiveTableTab("waitlist");
            setStep("venue-select");
          }}
        >
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Users size={28} />
            </div>
            <div>
              <h3 className="font-semibold">Waitlist</h3>
              <p className="text-sm text-muted-foreground">Get seated today</p>
            </div>
          </CardContent>
        </Card>

        {/* Reservations Card */}
        <Card 
          className="cursor-pointer shadow-card transition-all hover:scale-105 hover:shadow-floating active:scale-95"
          onClick={() => {
            setActiveTableTab("reservations");
            setStep("venue-select");
          }}
        >
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <CalendarIcon size={28} />
            </div>
            <div>
              <h3 className="font-semibold">Reservations</h3>
              <p className="text-sm text-muted-foreground">Book in advance</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

### 3. Update Venue Select Back Button

When on `venue-select`, the back button should return to `entry-select` instead of calling `onBack()`:

```typescript
// In step === "venue-select" render:
<Button variant="ghost" size="sm" onClick={() => setStep("entry-select")}>
  <ArrowLeft size={20} />
</Button>
```

### 4. Handle Initial Entry with Existing Waitlist

If `TableReadyFlow` is opened with an `initialEntry` (clicking on an active tracking card), skip directly to the appropriate step:

```typescript
// In useEffect for initialEntry handling, keep existing logic:
if (initialEntry) {
  // ... existing logic to set step based on status
} else {
  setStep("entry-select"); // Start at entry selection for new bookings
}
```

### 5. Remove Tabs from Venue Select

Since the user already chose Waitlist vs Reservations on the entry screen, the venue-select step can show a simpler interface without tabs - just the venue search for the chosen type:

```typescript
if (step === "venue-select") {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setStep("entry-select")}>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold">
          {activeTableTab === "waitlist" ? "Join Waitlist" : "Make a Reservation"}
        </h1>
      </div>

      {/* Show Explore Venues button only for reservations */}
      {activeTableTab === "reservations" && (
        <Button
          variant="outline"
          className="w-full h-14 border-dashed border-2"
          onClick={() => setShowExploreView(true)}
        >
          <Compass className="mr-2 h-5 w-5" />
          Explore Venues
        </Button>
      )}

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Select Restaurant</CardTitle>
          <p className="text-muted-foreground">
            {activeTableTab === "waitlist" 
              ? "Get seated today - no reservation needed" 
              : "Book a table in advance"}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <VenueList />
        </CardContent>
      </Card>
    </div>
  );
}
```

## Edge Cases

| Scenario | Handling |
|----------|----------|
| User clicks active tracking card | Skips entry-select, goes directly to waiting/ready/etc. step |
| User clicks back from venue-select | Returns to entry-select (not home) |
| User clicks back from entry-select | Returns to home page |
| User navigates from Explore Venues | Already handled - returns to venue-select |

## Testing Checklist

- Tap "Table Ready" on home page and verify two card buttons appear
- Tap "Waitlist" button and verify venue search appears with correct header
- Tap back from venue search and verify return to entry-select screen
- Tap "Reservations" button and verify Explore Venues button appears
- Tap Explore Venues and verify the explore screen loads
- Click an active waitlist tracking card and verify it skips entry-select
- Verify the flow works correctly on mobile screen sizes
