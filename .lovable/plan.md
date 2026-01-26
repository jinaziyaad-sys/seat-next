

# Duplicate Booking Confirmation Dialog

## Overview
Replace the hard block on duplicate reservations with a warning dialog that shows existing booking details and lets patrons confirm if they still want to proceed with the new booking.

## Current Behavior
When a patron tries to make a reservation within ±30 minutes of an existing booking at the same venue:
- A toast error appears: "You already have a reservation at [time] for [X] people"
- The booking is blocked entirely

## New Behavior
- Show a confirmation dialog with the existing booking details
- Allow patron to choose: "Go Back" or "Book Anyway"
- If confirmed, proceed with the new reservation

---

## Technical Implementation

### 1. Add New State Variables

Add two new state variables to track the duplicate warning state:

```typescript
const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
const [existingBooking, setExistingBooking] = useState<{
  time: string;
  partySize: number;
} | null>(null);
```

### 2. Modify Duplicate Check Logic

Change the duplicate detection code (lines 598-621) from blocking to warning:

**Before:**
```typescript
if (existingReservations && existingReservations.length > 0) {
  toast({ title: "Duplicate Booking Detected", ... });
  return; // Hard block
}
```

**After:**
```typescript
if (existingReservations && existingReservations.length > 0) {
  const existingTime = format(new Date(existingReservations[0].reservation_time), 'h:mm a');
  setExistingBooking({
    time: existingTime,
    partySize: existingReservations[0].party_size
  });
  setPendingReservationData({
    venue,
    reservationDateTime,
    finalPreferences,
    partyName: partyName.trim(),
    partySize
  });
  setShowDuplicateWarning(true);
  return; // Stop and show confirmation
}
```

### 3. Add Confirmation Handler

Create a new function to proceed after confirmation:

```typescript
const handleConfirmDuplicateBooking = async () => {
  if (!pendingReservationData) return;
  
  setShowDuplicateWarning(false);
  setExistingBooking(null);
  
  // Continue with the booking flow using pendingReservationData
  // Call availability check and insert reservation
  await proceedWithBooking(pendingReservationData);
};

const handleCancelDuplicateBooking = () => {
  setShowDuplicateWarning(false);
  setExistingBooking(null);
  setPendingReservationData(null);
};
```

### 4. Add Confirmation Dialog UI

Add a conditional render block (similar to multi-table confirmation) that shows when `showDuplicateWarning` is true:

```
+------------------------------------------+
|  ← Back                                  |
|                                          |
|  ⚠️ Existing Booking Found               |
|                                          |
|  You already have a reservation at       |
|  this venue:                             |
|                                          |
|  ┌────────────────────────────────────┐  |
|  │  📅 Today at 7:30 PM               │  |
|  │     Party of 4                     │  |
|  └────────────────────────────────────┘  |
|                                          |
|  You're about to book another table:     |
|                                          |
|  ┌────────────────────────────────────┐  |
|  │  📅 Today at 7:45 PM               │  |
|  │     Party of 2                     │  |
|  └────────────────────────────────────┘  |
|                                          |
|  ℹ️ Both bookings will be active. You   |
|     can manage them from your profile.   |
|                                          |
|  [ Book Anyway ]  (primary button)       |
|  [ Go Back ]      (outline button)       |
+------------------------------------------+
```

### 5. Extract Booking Logic

Refactor the booking insertion logic into a reusable `proceedWithBooking()` function that:
- Checks table availability
- Handles multi-table scenarios (if triggered)
- Inserts the reservation
- Updates state and shows success toast

This allows both the normal flow and the duplicate-confirmed flow to share the same code.

---

## File Changes

### Modified File: `src/components/TableReadyFlow.tsx`

1. **Lines ~94-97**: Add `showDuplicateWarning` and `existingBooking` state variables

2. **Lines ~598-621**: Modify duplicate check to set warning state instead of blocking

3. **Lines ~806**: Add `handleConfirmDuplicateBooking` and `handleCancelDuplicateBooking` functions

4. **Lines ~1142**: Add conditional render for duplicate warning dialog (before multi-table check)

5. **Refactor**: Extract booking creation logic into a shared `proceedWithBooking()` function

---

## Edge Cases Handled

- If patron confirms duplicate, normal availability check still runs
- Multi-table scenarios still work after duplicate confirmation
- Pending data is properly cleaned up on cancel
- Both bookings remain independent (no linking)

