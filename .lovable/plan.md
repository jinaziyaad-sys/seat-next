
# Fix: Overnight Time Slots Stored on Wrong Day

## Root Cause

When a venue has overnight business hours (e.g., Monday 4 PM → Tuesday 2 AM with `is_overnight: true`), the time slot picker correctly shows slots like `00:00`, `00:15`, `01:00`, `01:30` as valid Monday booking options.

However, when the patron selects one of these early-morning overnight slots, the reservation is stored with the **wrong date**:

```
Patron selects: Monday + 01:00
Code does:
  const reservationDateTime = new Date(reservationDate); // Monday midnight
  reservationDateTime.setHours(1, 0, 0, 0);             // → Monday 1:00 AM  ← WRONG!
  
Should be:                                               // → Tuesday 1:00 AM ← CORRECT
```

`01:00` in an overnight context means 1 AM on **Tuesday** (the next calendar day), but the code puts it at 1 AM on **Monday** — which is 15 hours in the past relative to a 4 PM opening. The reservation is immediately "passed" the moment it's created.

## Proof from the Database

Looking at actual reservation data: reservations with `06:15:00+00` UTC correspond to 8:15 AM SAST morning slots — these are regular morning bookings. But for overnight venues, slots like `00:15`, `01:00` must add one day to be correct.

## Two Places to Fix

### Fix 1 — `src/components/TableReadyFlow.tsx` (handleJoinWaitlist)

The `reservationDateTime` construction at lines 778-784 needs to detect if the selected time is an overnight slot (time < opening time of that day) and add one calendar day.

**Current code:**
```typescript
if (bookingType === "later" && reservationDate && reservationTime) {
  const [hours, minutes] = reservationTime.split(':').map(Number);
  const reservationDateTime = new Date(reservationDate);
  reservationDateTime.setHours(hours, minutes, 0, 0);
```

**Fixed code:**
```typescript
if (bookingType === "later" && reservationDate && reservationTime) {
  const [hours, minutes] = reservationTime.split(':').map(Number);
  const reservationDateTime = new Date(reservationDate);
  reservationDateTime.setHours(hours, minutes, 0, 0);

  // Fix for overnight hours: if the venue has overnight hours and the selected
  // time is in the "early morning" portion (i.e., time < opening time), 
  // it actually belongs to the NEXT calendar day.
  const businessHours = selectedVenueData?.settings?.business_hours;
  const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const dayKey = dayNames[reservationDate.getDay()];
  const dayHours = businessHours?.[dayKey];
  
  if (dayHours?.is_overnight && dayHours.open) {
    const [openH, openM] = dayHours.open.split(':').map(Number);
    const slotTotalMinutes = hours * 60 + minutes;
    const openTotalMinutes = openH * 60 + openM;
    // If slot time is before the opening time, it's an overnight slot (next calendar day)
    if (slotTotalMinutes < openTotalMinutes) {
      reservationDateTime.setDate(reservationDateTime.getDate() + 1);
    }
  }
```

### Fix 2 — `src/components/TableReadyFlow.tsx` (checkAvailability effect)

The same overnight correction must be applied when constructing the ISO timestamps for the `check-time-slot-availability` edge function (lines 576-584). Currently:

```typescript
const timeSlotsWithISO = timeSlots.map(time => {
  const [hours, minutes] = time.split(':').map(Number);
  const slotDate = new Date(reservationDate);
  slotDate.setHours(hours, minutes, 0, 0);
  return { time, iso: slotDate.toISOString() };
});
```

This has the same bug — overnight slots get the wrong date. Fix:

```typescript
const businessHours = selectedVenueData?.settings?.business_hours;
const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const dayKey = dayNames[reservationDate.getDay()];
const dayHours = businessHours?.[dayKey];
const openingHour = dayHours?.is_overnight && dayHours.open
  ? parseInt(dayHours.open.split(':')[0], 10) * 60 + parseInt(dayHours.open.split(':')[1], 10)
  : null;

const timeSlotsWithISO = timeSlots.map(time => {
  const [hours, minutes] = time.split(':').map(Number);
  const slotDate = new Date(reservationDate);
  slotDate.setHours(hours, minutes, 0, 0);
  // Overnight correction: early-morning slots belong to next calendar day
  if (openingHour !== null && (hours * 60 + minutes) < openingHour) {
    slotDate.setDate(slotDate.getDate() + 1);
  }
  return { time, iso: slotDate.toISOString() };
});
```

### Fix 3 — `src/utils/businessHours.ts` (getAvailableReservationTimes display)

The `isToday` check on line 1855 in `TableReadyFlow.tsx` uses `reservationDate?.toDateString()`. For an overnight venue, early-morning slots shown on "today's" date selection actually fire at "tomorrow" midnight — this is a display-only edge case that is acceptable and does not need a fix (the UI shows the correct date; only the submitted time needs correction).

However, the `getAvailableReservationTimes` function needs to stop generating overnight early-morning slots on the "today" date picker when those overnight slots are actually in the past. Currently, if a venue's overnight hours go until 2 AM and it is currently 11 PM, the function correctly prunes past slots via `minimumLeadTimeMinutes`. But if it's 1 PM and the venue opens at 4 PM with overnight close at 2 AM, the overnight slots (00:00–01:30) for "today" should be shown but labelled as belonging to the next morning — which is already handled by the fix in Fix 1 and Fix 2 (the date is corrected before submission).

## Flow After Fix

```
Patron selects:  Monday + 01:00 (overnight venue, closes Tue 2 AM)
                  ↓
reservationDateTime = new Date(Monday)   // Monday midnight
.setHours(1, 0, 0, 0)                   // → Monday 1:00 AM (local)
dayHours.is_overnight = true
slotMinutes (60) < openMinutes (16*60)  // TRUE → overnight slot
.setDate(date + 1)                      // → Tuesday 1:00 AM (local) ✓
.toISOString()                          // → "2026-02-17T23:00:00Z" (UTC) ✓
```

## Files to Modify

| File | Lines | Change |
|------|-------|--------|
| `src/components/TableReadyFlow.tsx` | ~778–784 | Add overnight day-correction when building `reservationDateTime` in `handleJoinWaitlist` |
| `src/components/TableReadyFlow.tsx` | ~576–584 | Add same overnight day-correction in the `checkAvailability` effect's ISO timestamp construction |

## No Database or Edge Function Changes Needed

The storage format is correct (UTC ISO strings). The query in `Index.tsx` line 254 is also correct — the `status.in.(waiting,...)` condition ensures all active reservations show regardless of time, so filtering is not the issue. The sole bug is in how the local time string `"01:00"` gets converted to a JavaScript `Date` without accounting for which calendar day that time belongs to in an overnight schedule.
