

# Auto-Cancel Overdue Reservations

## Problem Summary

Reservations that pass their scheduled `reservation_time` without the patron arriving currently remain in the system indefinitely with `status = 'waiting'`. This creates several issues:

- **Table blocking**: The assigned table stays blocked for a no-show patron
- **No merchant awareness**: Staff don't know when to release the table
- **No patron notification**: Patron isn't informed their reservation was released
- **Analytics gaps**: No tracking of reservation no-shows vs walk-in no-shows

## Current Behavior vs Expected

| Scenario | Current Behavior | Expected Behavior |
|----------|-----------------|-------------------|
| Walk-in `ready` status expires | Auto-cancelled via cron after `ready_deadline` passes | ✅ Working |
| Reservation time passes | Stays in `waiting` status forever | Should auto-cancel after grace period |

## Solution Overview

Extend the existing `auto-cancel-expired-waitlist` edge function to also handle overdue reservations using the venue's `auto_no_show_time` setting (default 15 minutes).

```text
Reservation at 7:00 PM
       ↓
7:00 PM arrives (reservation_time passes)
       ↓
Grace period starts (auto_no_show_time = 15 min)
       ↓
7:15 PM - No check-in → Mark as no_show
       ↓
Patron gets notification, table is released
```

## Changes Summary

| File | Changes |
|------|---------|
| `supabase/functions/auto-cancel-expired-waitlist/index.ts` | Add second query to find and cancel overdue reservations |

## Technical Implementation

### Modified Edge Function Logic

The `auto-cancel-expired-waitlist` function will be updated with an additional step:

1. **Existing**: Cancel `ready` entries with expired `ready_deadline`
2. **New**: Cancel `waiting` reservations where `reservation_time + auto_no_show_time` has passed

**New query to add:**

```typescript
// Step 2: Cancel overdue reservations
// Find reservations where reservation_time + grace period has passed
const now = new Date();

// Get all venues with their auto_no_show_time settings
const { data: venues } = await supabaseAdmin
  .from('venues')
  .select('id, settings');

// For each venue, cancel overdue reservations based on their settings
for (const venue of venues || []) {
  const autoNoShowMinutes = venue.settings?.auto_no_show_time || 15;
  const cutoffTime = new Date(now.getTime() - autoNoShowMinutes * 60000);
  
  const { error } = await supabaseAdmin
    .from('waitlist_entries')
    .update({
      status: 'no_show',
      cancellation_reason: `No-show - patron did not arrive within ${autoNoShowMinutes} minutes of reservation time`,
      cancelled_by: 'system',
      updated_at: now.toISOString()
    })
    .eq('venue_id', venue.id)
    .eq('reservation_type', 'reservation')
    .eq('status', 'waiting')
    .lt('reservation_time', cutoffTime.toISOString());
}
```

### Notification Message

When a reservation is auto-cancelled, the patron receives:

> **"Reservation Released"**  
> Your reservation was released because you didn't arrive within the grace period. Please make a new reservation if you still wish to dine.

### Merchant Dashboard Visibility

Overdue reservations will:
1. Show in the "Upcoming Reservations" section until cancelled (already shows entries within -60m to +60m window)
2. After cancellation, appear in the waitlist as `no_show` entries requiring acknowledgment
3. Display a toast notification: "⏰ Reservation No-Show: {customer_name} didn't arrive"

## Edge Cases Handled

| Edge Case | Handling |
|-----------|----------|
| Patron marks "I'm here" before grace period ends | Entry becomes `ready` status, no longer matches reservation auto-cancel query |
| Merchant manually seats patron | Entry becomes `seated`, excluded from auto-cancel |
| Different venues have different grace periods | Each venue's `auto_no_show_time` is respected |
| Multi-table reservations | All linked entries share same reservation_time and will be cancelled together |

## Testing Checklist

- Create a reservation for a time in the past (e.g., 20 minutes ago)
- Wait for cron job to run (every 2 minutes)
- Verify reservation status changes to `no_show`
- Verify merchant sees the no-show entry with acknowledgment option
- Verify patron receives push notification
- Test with different `auto_no_show_time` values (5, 15, 30 minutes)
- Test that active reservations (future time) are not affected

