

# Fix Table Ready Waitlist Issues

## Problem Summary

The user has reported four interconnected issues with the "table ready" functionality for waitlist entries:

1. **Timer not starting when already viewing the card** - If the user is viewing the waitlist entry card when their table becomes ready, the 5-minute countdown timer doesn't start. However, if they exit and re-enter the card, the timer works correctly.

2. **Notification bubble flickering** - When a cancellation occurs (especially system-initiated), the notification bubble flickers.

3. **Cannot rejoin waitlist** - After the timer expires and the entry is auto-cancelled, the user cannot rejoin the waitlist.

4. **Entry disappears from Active Tracking without dismissal** - The entry disappears from the "Active Tracking" section without the user explicitly dismissing it.

---

## Root Cause Analysis

### Issue 1: Timer not starting

**Location**: `src/components/TableReadyFlow.tsx` (lines 190-254, 306-360)

When the user is viewing the card in "waiting" state and the table becomes ready via real-time update:
- The real-time subscription updates `waitlistEntry.ready_deadline`
- The subscription also sets `step` to "ready"
- BUT the countdown `useEffect` depends on both `step === "ready"` AND `waitlistEntry.ready_deadline` being truthy
- Due to React's batching, the countdown effect may evaluate before both state updates are complete, causing the timer to not initialize properly

The real-time payload updates `ready_deadline` in state, but the countdown effect may have already fired with a stale `ready_deadline` value.

### Issue 2: Notification bubble flickering

**Location**: `src/pages/Index.tsx` (lines 357-367)

The real-time subscription filters entries by status:
```typescript
const activeFiltered = updatedEntries.filter(entry => 
  ['waiting', 'ready', 'cancelled', 'seated'].includes(entry.status)
);
```

The `no_show` status is NOT included, so when an entry transitions to `no_show`:
1. It gets filtered out immediately
2. Then re-appears briefly if the state re-renders
3. Causing the flickering effect

### Issue 3: Cannot rejoin waitlist

**Location**: `src/pages/Index.tsx` and `src/components/TableReadyFlow.tsx`

After auto-cancellation (status = `no_show`):
- The entry is filtered out of `activeWaitlist` (doesn't include `no_show`)
- The entry is not `patron_dismissed: true`, so subsequent fetches would include it
- But the real-time filter removes it immediately, causing confusion
- The patron needs to see the "cancelled" screen to dismiss it, but it disappears too quickly

### Issue 4: Entry disappears without dismissal

**Location**: `src/pages/Index.tsx` line 363-366

Same root cause as Issue 2 and 3 - the `no_show` status isn't included in the active filter, so entries auto-cancelled by the system are removed from view before the user can dismiss them.

---

## Technical Solution

### Fix 1: Ensure countdown timer starts correctly when table becomes ready

In `TableReadyFlow.tsx`, when the real-time subscription receives a "ready" status, we need to ensure the countdown timer re-evaluates properly:

**Changes needed**:
- Add `ready_deadline` as a separate state trigger to force re-evaluation
- Use a ref to track when we've already processed the "ready" transition
- Ensure the countdown effect dependencies include all necessary values and handle the transition correctly

```text
src/components/TableReadyFlow.tsx:
- Lines 190-254: Modify countdown useEffect to not depend on `step` but on `waitlistEntry.status === 'ready'` instead
- This ensures the countdown starts based on the actual status, not the step which may be set asynchronously
```

### Fix 2: Include `no_show` status in active tracking filter

In `Index.tsx`, include `no_show` in the filter so entries don't disappear prematurely:

**Changes needed**:
```text
src/pages/Index.tsx:
- Line 363-366: Add 'no_show' to the status filter array
- Line 214: Add 'no_show' to the database query status filter
- This ensures entries remain visible until patron dismisses them
```

### Fix 3: Map `no_show` to display as "cancelled" for patron

The patron doesn't need to see "no_show" - they should see "Cancelled" with an appropriate message:

**Changes needed**:
```text
src/pages/Index.tsx:
- In the waitlist card rendering (around lines 915-920), treat 'no_show' same as 'cancelled' for display
- Show appropriate cancellation message
- Include "Dismiss" button for no_show entries
```

### Fix 4: Prevent flickering by stabilizing state updates

**Changes needed**:
```text
src/pages/Index.tsx:
- Use functional state updates with proper deduplication
- Add a check to prevent processing the same status transition multiple times
```

---

## Files to Modify

| File | Change Description |
|------|-------------------|
| `src/components/TableReadyFlow.tsx` | Fix countdown timer to use status-based triggering instead of step-based |
| `src/pages/Index.tsx` | Include `no_show` in real-time filter; fix query to include `no_show`; stabilize state updates |

---

## Detailed Implementation Steps

### Step 1: Fix Countdown Timer in TableReadyFlow.tsx

1. Modify the countdown `useEffect` (lines 190-254) to:
   - Check `waitlistEntry?.status === 'ready'` instead of `step === "ready"`
   - This decouples the timer from the UI step, ensuring it starts as soon as status changes
   - Keep the `step !== "awaiting-confirmation"` check to stop timer after confirmation

2. Ensure the real-time subscription (lines 306-360) properly updates all necessary fields atomically

### Step 2: Fix Active Tracking Filter in Index.tsx

1. Update the database query (line 214) to include `no_show`:
   ```typescript
   .or('status.in.(waiting,ready,seated,cancelled,no_show),and(...)')
   ```

2. Update the real-time filter (lines 363-366):
   ```typescript
   const activeFiltered = updatedEntries.filter(entry => 
     ['waiting', 'ready', 'cancelled', 'seated', 'no_show'].includes(entry.status)
   );
   ```

### Step 3: Add Dismiss Button for no_show Entries

1. Update the `shouldClear` condition (line 835) to include `no_show`:
   ```typescript
   const shouldClear = entry.status === 'cancelled' || entry.status === 'no_show';
   ```

2. The existing display logic already treats `no_show` as cancelled via `mapDatabaseStatus`, so no additional UI changes needed

### Step 4: Stabilize Real-time Updates

1. Add deduplication logic to prevent processing the same update multiple times
2. Use refs to track processed state transitions

---

## Testing Checklist

After implementation, verify:

- [ ] Join waitlist and stay on the waiting card - when table becomes ready, timer should start immediately
- [ ] Timer shows 5 minutes (or correct time from `ready_deadline`)
- [ ] "Need 5 More Minutes" extends the timer by 5 minutes
- [ ] Letting timer expire shows cancellation message, doesn't flicker
- [ ] Cancelled entry stays in Active Tracking until user dismisses
- [ ] User can dismiss the cancelled entry
- [ ] After dismissal, user can successfully rejoin the waitlist
- [ ] "Cancel Booking" button works correctly from the ready screen

