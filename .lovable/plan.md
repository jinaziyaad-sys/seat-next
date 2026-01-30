

# Show Overdue Reservation Status on Home Page

## Overview

Add visual indicators for overdue reservations on the patron's home page Active Tracking cards. When a reservation has passed its scheduled time, the card will show:
1. **Warning indicator**: Orange/yellow styling with "Overdue - X min late" badge
2. **Auto-cancel countdown**: Time remaining until the reservation is released as a no-show

## Current vs New Behavior

```text
CURRENT:
+----------------------------------+
| [RESERVATION]                    |
| Demo Restaurant                  |
| Today at 19:00 • 45 min to go    |
| [Reserved]                       |
+----------------------------------+
(After 19:00, still shows "Reserved" badge)

NEW - OVERDUE STATE:
+----------------------------------+  ← Orange/amber border + bg
| [RESERVATION]                    |
| Demo Restaurant                  |
| Today at 19:00 • 10 min late     |  ← Shows how late
| ⚠️ Arriving within 5 min?        |  ← Countdown to release
| [Overdue]                        |  ← Orange badge
+----------------------------------+
```

## Changes Summary

| File | Changes |
|------|---------|
| `src/pages/Index.tsx` | Add venue settings to waitlist query; add overdue detection logic; update card styling and badge for overdue reservations |

## Technical Implementation

### 1. Update Waitlist Query

Modify the `select` statement to include venue settings so we can access `auto_no_show_time`:

```typescript
// Line ~210, change from:
.select('*, venues(name)')

// To:
.select('*, venues(name, settings)')
```

### 2. Overdue Detection Logic

For each reservation entry, determine:
- **Is it overdue?** `reservation_time < now()` AND `status === 'waiting'`
- **How late?** `now() - reservation_time` in minutes
- **Time until release?** `auto_no_show_time - minutesLate`

```typescript
const isReservation = entry.reservation_type === 'reservation';
const reservationTime = entry.reservation_time ? new Date(entry.reservation_time) : null;
const now = new Date();

// Only for waiting reservations
const isOverdue = isReservation && 
  entry.status === 'waiting' && 
  reservationTime && 
  reservationTime < now;

// Calculate how late (in minutes)
const minutesLate = isOverdue 
  ? Math.floor((now.getTime() - reservationTime.getTime()) / 60000) 
  : 0;

// Get venue's auto_no_show_time setting (default 15)
const autoNoShowMinutes = (entry.venues?.settings as any)?.auto_no_show_time || 15;

// Time remaining before auto-cancel
const minutesUntilRelease = isOverdue ? Math.max(0, autoNoShowMinutes - minutesLate) : null;
```

### 3. Card Styling Updates

Add conditional styling for overdue reservations in the card component (lines ~848-856):

```typescript
<Card 
  key={entry.id} 
  className={cn(
    "group shadow-card transition-all cursor-pointer hover:shadow-floating hover:scale-[1.01]",
    entry.status === 'ready' && "bg-success/10 border-success animate-pulse-success",
    (entry.status === 'cancelled' || entry.status === 'no_show') && "bg-destructive/10 border-destructive",
    entry.status === 'seated' && "bg-success/10 border-success",
    // NEW: Overdue reservation styling
    isOverdue && "bg-amber-500/10 border-amber-500 dark:bg-amber-900/20"
  )}
>
```

### 4. Update Display Content

Replace the countdown-to-reservation text with overdue info when applicable (lines ~895-918):

```typescript
{isReservation && entry.reservation_time ? (
  <>
    <p className="text-sm text-muted-foreground">
      Reservation for {entry.party_size}
    </p>
    <div className="flex items-center gap-1 text-xs mt-1">
      <CalendarIcon size={12} />
      <span>
        {isToday ? 'Today' : isTomorrow(...) ? 'Tomorrow' : format(...)} 
        at {format(reservationTime, 'HH:mm')}
        {isOverdue ? (
          // OVERDUE: Show how late
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            {' • '}{minutesLate} min late
          </span>
        ) : isUpcomingTime ? (
          // UPCOMING: Show countdown
          <> {' • '}{formatTimeUntil(reservationTime)}</>
        ) : null}
      </span>
    </div>
    {/* NEW: Auto-cancel warning */}
    {isOverdue && minutesUntilRelease !== null && minutesUntilRelease > 0 && (
      <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 mt-1">
        <AlertTriangle size={12} />
        <span>
          Arriving within {minutesUntilRelease} min? Check in now!
        </span>
      </div>
    )}
    {isOverdue && minutesUntilRelease === 0 && (
      <div className="flex items-center gap-1 text-xs text-destructive mt-1">
        <AlertTriangle size={12} />
        <span>Reservation may be released any moment</span>
      </div>
    )}
  </>
) : ( ... )}
```

### 5. Update Badge Display

Change the badge from "Reserved" to "Overdue" with warning styling (lines ~961-973):

```typescript
<Badge variant={
  isOverdue ? 'outline' :  // Use outline for amber styling
  isReservation ? 'outline' : 
  entry.status === 'ready' ? 'default' : 
  entry.status === 'cancelled' ? 'destructive' :
  entry.status === 'seated' ? 'default' :
  'secondary'
} className={cn(
  isOverdue && "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10"
)}>
  {isOverdue ? 'Overdue' : 
   isReservation ? 'Reserved' : 
   entry.status === 'ready' ? 'Ready' : 
   entry.status === 'cancelled' ? 'Cancelled' :
   entry.status === 'seated' ? 'Seated' :
   'Waiting'}
</Badge>
```

### 6. Timer for Live Updates

Since the overdue status depends on current time, we need to re-render periodically to update the countdown. Add a 30-second interval when there are active reservations:

```typescript
// Inside the component
useEffect(() => {
  // Check if any reservation is potentially overdue or approaching
  const hasActiveReservations = activeWaitlist.some(
    entry => entry.reservation_type === 'reservation' && entry.status === 'waiting'
  );
  
  if (!hasActiveReservations) return;
  
  // Force re-render every 30 seconds to update overdue countdowns
  const interval = setInterval(() => {
    setActiveWaitlist(prev => [...prev]); // Trigger re-render
  }, 30000);
  
  return () => clearInterval(interval);
}, [activeWaitlist]);
```

## Visual Design Summary

| State | Border | Background | Badge | Text |
|-------|--------|------------|-------|------|
| Upcoming | Default | Default | "Reserved" (outline) | "Today at 19:00 • 45 min to go" |
| Overdue (5 min) | Amber | Amber/10 | "Overdue" (amber) | "Today at 19:00 • 5 min late" + "Arriving within 10 min? Check in now!" |
| Overdue (15+ min) | Amber | Amber/10 | "Overdue" (amber) | "Today at 19:00 • 15 min late" + "Reservation may be released any moment" |
| No-show | Red | Red/10 | "Released" | "Table released - didn't arrive in time" |

## Testing Checklist

- Create a reservation for a time in the past (e.g., 10 minutes ago)
- Verify the card shows amber styling with "Overdue" badge
- Verify "X min late" text displays correctly
- Verify countdown to auto-cancel appears ("Arriving within Y min?")
- Verify countdown updates every 30 seconds
- Test when countdown reaches 0 (shows "may be released any moment")
- Test different venue auto_no_show_time settings (5, 15, 30 min)
- Test that upcoming reservations still show normal "X min to go" countdown

