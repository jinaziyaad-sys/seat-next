
# Fix Table Ready Countdown Timer Issues

## Problems Identified

After analyzing the code, I found **three interconnected issues**:

### Problem 1: Timer Not Starting When Already Viewing the Card

**Root Cause**: When the patron is viewing the "waiting" card and the real-time subscription receives a status update to "ready", the countdown `useEffect` (line 193-263) uses values from the closure that may be stale during the initial evaluation after the status change.

The `updateCountdown` function inside the effect captures `waitlistEntry.ready_deadline` from the closure scope. When the real-time update arrives:
1. State updates trigger re-render
2. useEffect re-runs, but `waitlistEntry.ready_deadline` might still be the old value during the first tick
3. Timer interval starts but may be working with stale data

**Why exiting and re-entering works**: When you navigate away and back, a fresh component mount occurs with the correct `ready_deadline` already in the initial state.

### Problem 2: UI Changes When Extending Time

**Root Cause**: The `handleWait5Minutes` function (line 1183) deliberately changes the step to `"delayed-countdown"`:
```typescript
setStep("delayed-countdown");
```

This renders a completely different UI (lines 2328-2377) with:
- Different layout and styling
- Orange color scheme instead of green/primary
- Large text timer instead of CountdownRing

### Problem 3: Maximum of 5 Minutes Initially (Only Shows 5 Even With More Time)

**Root Cause**: The countdown state variables `countdownMinutes` and `countdownSeconds` are initialized to:
```typescript
const [countdownMinutes, setCountdownMinutes] = useState(5);
const [countdownSeconds, setCountdownSeconds] = useState(0);
```

When the user is already viewing the card, these values are shown as-is until the countdown effect runs and calculates the actual time. Due to the stale closure issue, the first render after "ready" status shows 5:00.

---

## Technical Solution

### Fix 1: Use Refs for Stable Deadline Access

Store `ready_deadline` in a ref that gets updated synchronously when the real-time update arrives. The countdown effect can then read from the ref to get the latest value.

```typescript
const readyDeadlineRef = useRef<string | null>(null);

// Update ref when waitlistEntry changes
useEffect(() => {
  readyDeadlineRef.current = waitlistEntry?.ready_deadline || null;
}, [waitlistEntry?.ready_deadline]);

// In countdown effect, use ref for stable access
const updateCountdown = () => {
  const deadline = readyDeadlineRef.current;
  if (!deadline) return;
  // ... rest of logic
};
```

### Fix 2: Unified "Ready" UI (No Separate Delayed-Countdown Screen)

Keep the user on the same "ready" screen when they request 5 more minutes, just update the deadline and show visual feedback that extension was granted. This maintains UI consistency.

**Changes**:
- Remove `setStep("delayed-countdown")` from `handleWait5Minutes`
- Stay on `step === "ready"` but show "Extension used" indicator
- The CountdownRing will automatically update to show the new extended time

### Fix 3: Initialize Countdown from Deadline Immediately

Add a one-time sync of countdown values when `ready_deadline` changes, not just rely on the interval:

```typescript
// Immediately sync countdown when deadline changes
useEffect(() => {
  if (waitlistEntry?.status === 'ready' && waitlistEntry?.ready_deadline) {
    const deadline = new Date(waitlistEntry.ready_deadline).getTime();
    const timeLeft = deadline - Date.now();
    if (timeLeft > 0) {
      setCountdownMinutes(Math.floor(timeLeft / 60000));
      setCountdownSeconds(Math.floor((timeLeft % 60000) / 1000));
    }
  }
}, [waitlistEntry?.ready_deadline, waitlistEntry?.status]);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/TableReadyFlow.tsx` | Add deadline ref, immediate countdown sync, remove delayed-countdown step transition |

---

## Implementation Details

### Step 1: Add a ref to track the latest ready_deadline

Add a `useRef` to hold the deadline value that can be read synchronously:
```typescript
const readyDeadlineRef = useRef<string | null>(null);
```

### Step 2: Sync ref whenever ready_deadline changes

Add a useEffect to keep the ref updated:
```typescript
useEffect(() => {
  readyDeadlineRef.current = waitlistEntry?.ready_deadline || null;
}, [waitlistEntry?.ready_deadline]);
```

### Step 3: Immediately calculate countdown when deadline arrives

Add a separate effect to instantly set the countdown values when a new deadline is received:
```typescript
useEffect(() => {
  if (waitlistEntry?.status === 'ready' && waitlistEntry?.ready_deadline) {
    const deadline = new Date(waitlistEntry.ready_deadline).getTime();
    const timeLeft = deadline - Date.now();
    if (timeLeft > 0) {
      setCountdownMinutes(Math.floor(timeLeft / 60000));
      setCountdownSeconds(Math.floor((timeLeft % 60000) / 1000));
    }
  }
}, [waitlistEntry?.ready_deadline, waitlistEntry?.status]);
```

### Step 4: Modify handleWait5Minutes to stay on ready screen

Remove the `setStep("delayed-countdown")` call - the user should stay on the ready screen with an updated timer:
```typescript
const handleWait5Minutes = async () => {
  // ... existing logic ...
  
  if (!error) {
    setWaitlistEntry(prev => prev ? { 
      ...prev, 
      patron_delayed: true,
      ready_deadline: newDeadline.toISOString()
    } : null);
    
    // REMOVE: setStep("delayed-countdown");
    
    toast({
      title: "5 More Minutes Granted",
      description: "The restaurant has been notified. This is your final extension.",
    });
  }
};
```

### Step 5: Update countdown interval to use ref

Modify the main countdown interval to read from the ref for the most current value:
```typescript
const updateCountdown = () => {
  const deadline = readyDeadlineRef.current;
  if (!deadline) return;
  
  const now = Date.now();
  const timeLeft = new Date(deadline).getTime() - now;
  // ... rest
};
```

### Step 6: Remove or repurpose delayed-countdown step

The `delayed-countdown` step (lines 2328-2377) can be removed or kept as a fallback, but won't be triggered from the main flow.

---

## Expected Behavior After Fix

1. **Join waitlist, stay on waiting card** → when table becomes ready, timer immediately shows correct time (e.g., 5:00)
2. **Click "Need 5 More Minutes"** → timer extends by 5 minutes (e.g., to 10:00), UI stays the same with "final extension" label
3. **Timer expires** → Entry auto-cancels, shows cancellation screen, stays in Active Tracking until dismissed
4. **After dismissal** → User can rejoin waitlist

---

## Testing Checklist

- [ ] Timer starts immediately when table becomes ready (even if viewing card)
- [ ] Timer shows correct time from `ready_deadline` (not always 5:00)
- [ ] "Need 5 More Minutes" extends timer and stays on same screen
- [ ] Extension button disabled after first use
- [ ] Timer continues counting down correctly after extension
- [ ] Auto-cancellation works when timer reaches 0
