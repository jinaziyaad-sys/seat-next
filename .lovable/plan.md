
# Fix Reservation Button Text and Merchant Notifications

## Problem Summary

Two issues identified:

1. **Button text always says "Join Waitlist"**: When a user selects "Reservations" from the entry screen and proceeds to the party details step, the submit button still says "Join Waitlist" instead of "Make Reservation"

2. **Generic merchant notification**: When a new reservation is created, the merchant sees "👥 New waitlist entry!" instead of a more specific "📅 New reservation!" notification

## Root Cause Analysis

### Issue 1: Button Text
In `src/components/TableReadyFlow.tsx` at lines 2046-2059, the party-details step has hardcoded button text:

```typescript
<Button onClick={handleJoinWaitlist} ...>
  {isSubmitting ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Joining...           // ← Always says "Joining..."
    </>
  ) : (
    "Join Waitlist"        // ← Always says "Join Waitlist"
  )}
</Button>
```

This should be conditional based on `activeTableTab`.

### Issue 2: Generic Notification
In `src/pages/MerchantDashboard.tsx` at lines 239-262, the global INSERT subscription shows a generic message:

```typescript
.on('postgres_changes', {
  event: 'INSERT',
  schema: 'public',
  table: 'waitlist_entries',
  ...
}, (payload) => {
  // No check for reservation_type
  playNewWaitlistSound();
  sonnerToast.success("👥 New waitlist entry!");  // ← Always same message
});
```

## Solution

### Fix 1: Dynamic Button Text in TableReadyFlow.tsx

Update the button in the party-details step to display context-aware text:

| State | Waitlist Tab | Reservations Tab |
|-------|--------------|------------------|
| Default | "Join Waitlist" | "Make Reservation" |
| Loading | "Joining..." | "Booking..." |

### Fix 2: Contextual Merchant Notification

Update the global INSERT subscription to check `reservation_type` and show appropriate notifications:

| reservation_type | Icon | Message |
|-----------------|------|---------|
| `reservation` | 📅 | "New reservation!" |
| `walk_in` (or null) | 👥 | "New waitlist entry!" |

## Changes Summary

| File | Changes |
|------|---------|
| `src/components/TableReadyFlow.tsx` | Update button text in party-details step to be conditional on `activeTableTab` |
| `src/pages/MerchantDashboard.tsx` | Check `reservation_type` in INSERT handler and show contextual notification |

## Implementation Details

### TableReadyFlow.tsx (party-details button)

```typescript
// Lines 2046-2059: Update button content
<Button 
  onClick={handleJoinWaitlist} 
  disabled={!partyName.trim() || isSubmitting}
  className="w-full h-12"
>
  {isSubmitting ? (
    <>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {activeTableTab === "reservations" ? "Booking..." : "Joining..."}
    </>
  ) : (
    activeTableTab === "reservations" ? "Make Reservation" : "Join Waitlist"
  )}
</Button>
```

### MerchantDashboard.tsx (global INSERT handler)

```typescript
// Lines 246-256: Add reservation_type check
.on('postgres_changes', {
  event: 'INSERT',
  schema: 'public',
  table: 'waitlist_entries',
  filter: `venue_id=eq.${userRole.venue_id}`
}, (payload) => {
  const id = (payload.new as any)?.id as string | undefined;
  const reservationType = (payload.new as any)?.reservation_type as string | undefined;
  if (!id) return;

  if (soundStartedForWaitlist.current.has(id)) return;
  soundStartedForWaitlist.current.add(id);

  // Show contextual notification based on type
  if (reservationType === 'reservation') {
    console.log('📅 New reservation (global) - playing sound');
    playNewWaitlistSound();
    sonnerToast.success("📅 New reservation!");
  } else {
    console.log('👥 New waitlist entry (global) - playing sound');
    playNewWaitlistSound();
    sonnerToast.success("👥 New waitlist entry!");
  }

  setTimeout(() => {
    soundStartedForWaitlist.current.delete(id);
  }, 30000);
})
```

## Testing Checklist

- Test the "Reservations" flow: verify button shows "Make Reservation" and loading shows "Booking..."
- Test the "Waitlist" flow: verify button still shows "Join Waitlist" and loading shows "Joining..."
- Create a new reservation and verify merchant sees "📅 New reservation!" toast
- Create a new waitlist entry and verify merchant sees "👥 New waitlist entry!" toast
- Verify sounds still play correctly for both types
