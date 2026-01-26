

# Fix Reservation Cancellation Flow UX

## Overview
The current cancellation flow has two UX issues that need to be fixed:

1. **No confirmation before cancellation**: When the patron clicks "Cancel Booking", the cancellation happens immediately and the card auto-closes after 1.5 seconds without requiring any confirmation from the user.

2. **Poor button labels on cancelled view**: After cancellation, the "cancelled-details" screen shows a "Close" button which is unclear - it should provide clearer actions.

---

## Current Behavior (The Problem)

When a patron clicks "Cancel Booking":
1. `handleCancelBooking()` immediately updates the database to cancel the reservation
2. After 1.5 seconds, `onBack()` is called automatically, returning the user to home
3. The user never sees a confirmation dialog or has a chance to undo

```text
Current Flow:
[Cancel Booking] --> Immediate DB Update --> 1.5s delay --> Auto-close
```

---

## Proposed Solution

### Add a Confirmation Dialog Before Cancellation

Introduce an AlertDialog that appears when the patron clicks "Cancel Booking" with two clear options:
- **"Confirm Cancellation"**: Proceeds with cancellation and returns home
- **"Don't Cancel"**: Closes the dialog and keeps the reservation active

```text
New Flow:
[Cancel Booking] --> Confirmation Dialog
                      |
                      |--> [Confirm Cancellation] --> DB Update --> Return Home
                      |
                      |--> [Don't Cancel] --> Close Dialog (stay on page)
```

---

## Technical Changes

### 1. Add Confirmation State
Add a new state variable to control the cancellation confirmation dialog:
```typescript
const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
```

### 2. Modify "Cancel Booking" Button Behavior
Instead of calling `handleCancelBooking()` directly, show the confirmation dialog:
```typescript
onClick={() => setShowCancelConfirmation(true)}
```

### 3. Create Confirmation Dialog Component
Add an AlertDialog with proper labeling:
- Title: "Cancel Reservation?"
- Description: "Are you sure you want to cancel your reservation at {venue}? This action cannot be undone."
- Cancel button: "Don't Cancel" (closes dialog, stays on page)
- Action button: "Confirm Cancellation" (calls handleCancelBooking and returns home)

### 4. Update handleCancelBooking
Remove the 1.5s timeout auto-close. Instead, call `onBack()` immediately after successful cancellation (user already confirmed).

### 5. Update the "cancelled-details" View
Change the "Close" button to "Back to Home" to be consistent with the other cancelled view (lines 2143-2184).

---

## Implementation Details

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/TableReadyFlow.tsx` | Add confirmation dialog, update button handlers, fix button labels |

### Specific Code Changes

**1. Add new state variable (around line 98):**
```typescript
const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
```

**2. Add AlertDialog import (line 1):**
```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
```

**3. Update handleCancelBooking (lines 1077-1098):**
Remove the setTimeout and call onBack() immediately after successful cancellation:
```typescript
const handleCancelBooking = async () => {
  if (!waitlistEntry) return;

  const { error } = await supabase
    .from("waitlist_entries")
    .update({ 
      status: "cancelled",
      cancelled_by: "patron"
    })
    .eq("id", waitlistEntry.id);

  if (!error) {
    setShowCancelConfirmation(false);
    toast({
      title: "Reservation Cancelled",
      description: "Your reservation has been cancelled.",
    });
    onBack(); // Immediate return to home after confirmed cancellation
  }
};
```

**4. Update all "Cancel Booking" buttons (3 locations):**
- Line 2100-2106 (waiting view)
- Line 2235-2241 (ready view) 
- Line 2330-2336 (awaiting-confirmation view)

Change from:
```typescript
onClick={handleCancelBooking}
```
To:
```typescript
onClick={() => setShowCancelConfirmation(true)}
```

**5. Add Confirmation Dialog (before final return null):**
```typescript
{/* Cancel Booking Confirmation Dialog */}
<AlertDialog open={showCancelConfirmation} onOpenChange={setShowCancelConfirmation}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Cancel Reservation?</AlertDialogTitle>
      <AlertDialogDescription>
        Are you sure you want to cancel your reservation at {waitlistEntry?.venue}? 
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Don't Cancel</AlertDialogCancel>
      <AlertDialogAction 
        onClick={handleCancelBooking}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        Confirm Cancellation
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**6. Fix "cancelled-details" view button (line 1071):**
Change from:
```typescript
<Button onClick={onBack} className="w-full">Close</Button>
```
To:
```typescript
<Button onClick={onBack} className="w-full">Back to Home</Button>
```

---

## User Experience After Fix

### Cancellation Flow
1. Patron clicks "Cancel Booking"
2. Confirmation dialog appears with venue name
3. Two clear options:
   - **"Don't Cancel"** - Dismisses dialog, reservation stays active
   - **"Confirm Cancellation"** - Cancels reservation and returns to home immediately

### Post-Cancellation View
If a patron views a cancelled reservation later, they see a "Back to Home" button (consistent across both cancelled views).

---

## Benefits
- Prevents accidental cancellations
- Clear, unambiguous button labels
- Consistent UX across cancelled reservation views
- Aligns with the memory context about cancellation attribution ("patron cancels" is now explicitly confirmed)

