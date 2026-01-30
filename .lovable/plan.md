
# Streamline Waitlist Arrival Flow - Clean State Transitions

## Problem Analysis

The current flow has **janky UI transitions** when a patron confirms their arrival:

1. **After clicking "I'm Here - Get Seated"**: The buttons "I'm Here - Get Seated" and "Need 5 More Minutes" remain visible momentarily instead of immediately showing the awaiting-confirmation screen
2. **When merchant seats the patron**: The cancel option briefly appears before transitioning to the feedback screen
3. **Root cause**: The state update happens via database mutation, but the UI relies on real-time subscription to update the `step` state. There's a lag between:
   - Patron clicking "I'm Here" → Database update completes
   - Real-time subscription receiving the update → Step transitioning

## Current Flow Issue

```text
User clicks "I'm Here"
       ↓
handleConfirmSeat() updates database
       ↓
setWaitlistEntry() updates local state  ← Good
       ↓
setStep("awaiting-confirmation")         ← Good, happens immediately
       ↓
BUT: Real-time subscription fires later
       ↓
Subscription logic checks status = "ready"
       ↓
If awaiting_merchant_confirmation → setStep("awaiting-confirmation")
Else → setStep("ready")  ← This can cause flicker!
```

The real issue is that after `handleConfirmSeat` sets the step, the real-time subscription can potentially reset it due to race conditions.

Additionally, the **"ready" step renders wrong UI** because it doesn't check `awaiting_merchant_confirmation` to hide buttons:

### Lines 2367-2386 in TableReadyFlow.tsx - The Problem:
```typescript
// These buttons always render when step === "ready"
// But they should NOT render if patron already clicked "I'm Here"
<Button onClick={handleConfirmSeat}>I'm Here - Get Seated</Button>
<Button onClick={handleWait5Minutes}>Need 5 More Minutes</Button>
<Button onClick={() => setShowCancelConfirmation(true)}>Cancel Booking</Button>
```

## Solution

### 1. Add State Guards to "ready" Step UI

The "ready" step should check `waitlistEntry.awaiting_merchant_confirmation` before rendering arrival buttons:

```typescript
// Inside step === "ready" block
{!waitlistEntry.awaiting_merchant_confirmation ? (
  <>
    <Button onClick={handleConfirmSeat}>I'm Here - Get Seated</Button>
    <Button onClick={handleWait5Minutes} disabled={waitlistEntry.patron_delayed}>
      {waitlistEntry.patron_delayed ? "Extension Already Used" : "Need 5 More Minutes"}
    </Button>
    <Button onClick={() => setShowCancelConfirmation(true)}>Cancel Booking</Button>
  </>
) : (
  // Show "waiting for host" message inline or immediately transition
  <div className="text-center text-muted-foreground">
    Notifying the host...
  </div>
)}
```

### 2. Force Immediate Refetch After Mutation

Following the stack overflow guidance, immediately refetch the entry after mutation to ensure UI is synchronized before real-time kicks in:

```typescript
const handleConfirmSeat = async () => {
  if (!waitlistEntry) return;
  
  const { error } = await supabase
    .from('waitlist_entries')
    .update({ 
      awaiting_merchant_confirmation: true,
      ready_deadline: null
    })
    .eq('id', waitlistEntry.id);

  if (!error) {
    // CRITICAL: Update local state immediately
    setWaitlistEntry(prev => prev ? { 
      ...prev, 
      awaiting_merchant_confirmation: true,
      ready_deadline: null
    } : null);
    
    // Transition step immediately
    setStep("awaiting-confirmation");
    
    toast({ title: "Notified Restaurant", ... });
    
    // REFETCH to confirm sync (optional but adds robustness)
    const { data: fresh } = await supabase
      .from('waitlist_entries')
      .select('*')
      .eq('id', waitlistEntry.id)
      .single();
    
    if (fresh) {
      setWaitlistEntry(prev => prev ? { ...prev, ...fresh } : null);
    }
  }
};
```

### 3. Prevent Real-Time Subscription from Overriding Manual Transitions

When the step is manually set (e.g., `setStep("awaiting-confirmation")`), the real-time subscription should not override it unless the actual status has changed:

```typescript
// In real-time subscription handler
if (payload.new) {
  const newStatus = payload.new.status;
  const newAwaitingConfirmation = payload.new.awaiting_merchant_confirmation;
  
  // Update entry data
  setWaitlistEntry(prev => prev ? { ...prev, ...mappedFields } : null);
  
  // Only change step if status actually changed, not just confirmation flag
  if (newStatus !== prevStatusRef.current) {
    if (newStatus === "ready") {
      if (newAwaitingConfirmation) {
        setStep("awaiting-confirmation");
      } else {
        setStep("ready");
      }
    } else if (newStatus === "seated") {
      setStep("feedback");
    } else if (newStatus === "cancelled" || newStatus === "no_show") {
      setStep("cancelled-details");
    }
    prevStatusRef.current = newStatus;
  }
}
```

### 4. Hide Cancel Button When Seated

After merchant confirms seating (status = "seated"), ensure the cancel button is never visible by checking status before rendering it:

```typescript
// Cancel button should not appear when:
// - awaiting_merchant_confirmation is true (patron is at host stand)
// - status is "seated" (already seated)
{waitlistEntry.status === 'ready' && !waitlistEntry.awaiting_merchant_confirmation && (
  <Button variant="outline" onClick={() => setShowCancelConfirmation(true)}>
    Cancel Booking
  </Button>
)}
```

---

## Changes Summary

| File | Changes |
|------|---------|
| `src/components/TableReadyFlow.tsx` | Add UI guards to hide buttons based on `awaiting_merchant_confirmation` and `status`; Add ref to track previous status and prevent redundant step changes; Force immediate state sync after mutations |

---

## Technical Details

### Modified `handleConfirmSeat` function:
- Keep the immediate `setStep("awaiting-confirmation")` 
- Add immediate `setWaitlistEntry` update before step change
- Optional: Add refetch for robustness

### Modified "ready" step UI (lines ~2367-2410):
- Wrap arrival buttons in a condition: `!waitlistEntry.awaiting_merchant_confirmation`
- Show a brief "Notifying host..." message while transitioning (or just hide buttons)

### Modified real-time subscription handlers:
- Add a ref to track previous status
- Only call `setStep()` when status actually changes, not on every update
- This prevents the subscription from "fighting" with manual step changes

### Modified "awaiting-confirmation" step (lines ~2467-2508):
- Ensure cancel button uses consistent condition
- Optionally allow cancellation with a warning that they're already at the host stand

---

## Testing Checklist

- Join waitlist and wait for table to become ready
- Click "I'm Here - Get Seated" and verify:
  - Buttons immediately disappear
  - "Host Notified" screen appears instantly
  - No flickering or janky transitions
- Have merchant seat the patron and verify:
  - No cancel button flashes before feedback screen
  - Smooth transition to rating screen
- Test the "Need 5 More Minutes" extension and verify it stays on the same screen with updated timer
