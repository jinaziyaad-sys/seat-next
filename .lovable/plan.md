

# Fix Table Ready Countdown Timer - Missing ready_deadline in Real-Time Subscription

## Root Cause Identified

When the user joins the waitlist from within the TableReadyFlow component (not from the Home page), a real-time subscription is set up at line 819-854. When the table becomes "ready", this subscription updates the local state but **does NOT include `ready_deadline`** in the update:

```typescript
// Lines 828-837 - The BUG
setWaitlistEntry(prev => prev ? {
  ...prev,
  status: mapDatabaseStatus(payload.new.status),
  eta: payload.new.eta,
  position: payload.new.position,
  cancellation_reason: payload.new.cancellation_reason || undefined,
  cancelled_by: payload.new.cancelled_by,
  updated_at: payload.new.updated_at,
  notes: payload.new.notes,
  // MISSING: ready_deadline, ready_at, patron_delayed !!!
} : null);
```

The countdown timer effect (lines 214-290) depends on:
1. `waitlistEntry?.status === 'ready'` (this becomes true)
2. `readyDeadlineRef.current` being truthy (this remains null because `ready_deadline` is never set)

Since `ready_deadline` is never copied from the payload, the timer never starts.

---

## Why It Works When You Leave and Return

When you navigate away and come back by tapping the card from the Home page:
1. The entry is passed as `initialEntry` prop
2. The `initialEntry` handling code (lines 292-396) **DOES include `ready_deadline`**:
   ```typescript
   ready_deadline: initialEntry.ready_deadline,
   ```
3. So the timer works correctly on re-entry

---

## The Fix

Add the missing fields to **BOTH** real-time subscriptions in the file:

1. **Subscription at lines 828-837** (new entry flow)
2. There's already a similar subscription at lines 342-396 (initialEntry flow) that DOES include these fields - that one is correct

### File to Modify

| File | Changes |
|------|---------|
| `src/components/TableReadyFlow.tsx` | Add `ready_deadline`, `ready_at`, and `patron_delayed` to the real-time subscription state update at lines 828-837 |

---

## Implementation

Update lines 828-837 to include the missing fields:

```typescript
setWaitlistEntry(prev => prev ? {
  ...prev,
  status: mapDatabaseStatus(payload.new.status),
  eta: payload.new.eta,
  position: payload.new.position,
  cancellation_reason: payload.new.cancellation_reason || undefined,
  cancelled_by: payload.new.cancelled_by,
  updated_at: payload.new.updated_at,
  notes: payload.new.notes,
  // ADD THESE THREE MISSING FIELDS:
  ready_deadline: payload.new.ready_deadline,
  ready_at: payload.new.ready_at,
  patron_delayed: payload.new.patron_delayed,
  awaiting_merchant_confirmation: payload.new.awaiting_merchant_confirmation,
} : null);
```

---

## Why This Fixes It

1. When merchant marks table ready, the database updates `status` to `ready` and sets `ready_deadline` to 5 minutes from now
2. Real-time subscription receives this payload with BOTH `status: 'ready'` AND `ready_deadline: '2026-01-28T13:18:49.551+00:00'`
3. Now the state update includes `ready_deadline`
4. The `useEffect` that syncs `readyDeadlineRef` fires because `ready_deadline` changed
5. The immediate sync effect calculates the correct countdown values
6. The interval-based countdown effect now has a valid deadline to work with
7. Timer displays and counts down correctly

---

## Testing Checklist

- [ ] Join waitlist from Table Ready flow, stay on the waiting screen
- [ ] Have merchant mark table as ready
- [ ] Verify countdown timer starts immediately showing ~5:00 (or actual time left)
- [ ] Verify "Need 5 More Minutes" button extends the timer
- [ ] Verify timer continues working after extension

