
# Fix Live Updates Timestamps on Waitlist Cards

## Problem

The "Live Updates" section on the patron's waitlist/reservation card shows hardcoded static text:
- "You joined the waitlist" - always shows "Just now"
- "Moved up in line" - always shows "2 min ago"

These values never change because they're static strings, not calculated from actual data.

## Solution

Replace the hardcoded timestamps with dynamic calculations using `formatDistanceToNow` from date-fns (already imported in the project). Track actual events using available database fields.

## Technical Changes

### File: `src/components/TableReadyFlow.tsx`

#### 1. Update WaitlistEntry Interface

Add `created_at` field to track when the entry was created:

```typescript
interface WaitlistEntry {
  id: string;
  venue: string;
  venue_id: string;
  // ... existing fields ...
  created_at: string;  // ADD THIS
  updated_at: string;
}
```

#### 2. Add created_at When Mapping Entry Data

Update all locations where `WaitlistEntry` is constructed to include `created_at`:

| Location | Change |
|----------|--------|
| Line ~316-337 (initialEntry mapping) | Add `created_at: initialEntry.created_at` |
| Line ~847-862 (new walk-in entry) | Add `created_at: newEntry.created_at` |
| Line ~995-1002 (reservation entry) | Add `created_at: newEntry.created_at` |
| Line ~1127-1134 (future reservation entry) | Add `created_at: newEntry.created_at` |

#### 3. Add Import for formatDistanceToNow

```typescript
import { format, addDays, differenceInHours, parseISO, formatDistanceToNow } from "date-fns";
```

#### 4. Replace Hardcoded Live Updates Section

Current (hardcoded):
```tsx
<div className="flex items-center gap-3">
  <div className="w-2 h-2 rounded-full bg-primary"></div>
  <span>You joined the waitlist</span>
  <span className="text-muted-foreground ml-auto">Just now</span>
</div>
```

New (dynamic):
```tsx
<div className="flex items-center gap-3">
  <div className="w-2 h-2 rounded-full bg-primary"></div>
  <span>
    {waitlistEntry.reservation_type === 'reservation' 
      ? 'Reservation confirmed' 
      : 'You joined the waitlist'}
  </span>
  <span className="text-muted-foreground ml-auto">
    {formatDistanceToNow(new Date(waitlistEntry.created_at), { addSuffix: true })}
  </span>
</div>
```

#### 5. Fix "Moved up in line" Logic

The current logic shows this message when `position <= 2` with a static "2 min ago". This should instead:
- Track actual position changes via `updated_at`
- Only show if the entry has been updated after creation

```tsx
{waitlistEntry.position !== null && 
 waitlistEntry.position <= 3 && 
 waitlistEntry.updated_at !== waitlistEntry.created_at && (
  <div className="flex items-center gap-3">
    <div className="w-2 h-2 rounded-full bg-success"></div>
    <span>Position updated to #{waitlistEntry.position}</span>
    <span className="text-muted-foreground ml-auto">
      {formatDistanceToNow(new Date(waitlistEntry.updated_at), { addSuffix: true })}
    </span>
  </div>
)}
```

#### 6. Add "Table Ready" Event with Timestamp

When `ready_at` exists, show when the table became ready:

```tsx
{waitlistEntry.ready_at && (
  <div className="flex items-center gap-3">
    <div className="w-2 h-2 rounded-full bg-warning"></div>
    <span>Your table is ready!</span>
    <span className="text-muted-foreground ml-auto">
      {formatDistanceToNow(new Date(waitlistEntry.ready_at), { addSuffix: true })}
    </span>
  </div>
)}
```

## Complete Live Updates Section

```tsx
<Card className="shadow-card">
  <CardHeader>
    <CardTitle>Live Updates</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-3 text-sm">
      {/* When entry was created */}
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-primary"></div>
        <span>
          {waitlistEntry.reservation_type === 'reservation' 
            ? 'Reservation confirmed' 
            : 'You joined the waitlist'}
        </span>
        <span className="text-muted-foreground ml-auto">
          {formatDistanceToNow(new Date(waitlistEntry.created_at), { addSuffix: true })}
        </span>
      </div>
      
      {/* Position update (if updated after creation) */}
      {waitlistEntry.position !== null && 
       waitlistEntry.position <= 3 && 
       waitlistEntry.updated_at !== waitlistEntry.created_at &&
       !waitlistEntry.ready_at && (
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-success"></div>
          <span>Position updated to #{waitlistEntry.position}</span>
          <span className="text-muted-foreground ml-auto">
            {formatDistanceToNow(new Date(waitlistEntry.updated_at), { addSuffix: true })}
          </span>
        </div>
      )}
      
      {/* Table ready notification */}
      {waitlistEntry.ready_at && (
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-warning"></div>
          <span>Your table is ready!</span>
          <span className="text-muted-foreground ml-auto">
            {formatDistanceToNow(new Date(waitlistEntry.ready_at), { addSuffix: true })}
          </span>
        </div>
      )}
      
      {/* Next in line indicator */}
      {waitlistEntry.position === 1 && !waitlistEntry.ready_at && (
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-warning animate-pulse"></div>
          <span className="font-medium">Get ready! You're next</span>
        </div>
      )}
    </div>
  </CardContent>
</Card>
```

## Visual Result

Before:
```
Live Updates
● You joined the waitlist      Just now    ← Always static
● Moved up in line             2 min ago   ← Always static
```

After:
```
Live Updates
● Reservation confirmed        3 hours ago  ← Dynamic from created_at
● Position updated to #2       45 minutes ago  ← Dynamic from updated_at
● Your table is ready!         2 minutes ago  ← Dynamic from ready_at
```

## Files Modified

| File | Changes |
|------|---------|
| `src/components/TableReadyFlow.tsx` | Add `created_at` to interface, add `formatDistanceToNow` import, update Live Updates section with dynamic timestamps |

## Testing Checklist

1. Create a new waitlist entry - verify "joined" shows correct relative time
2. Wait a few minutes - verify the timestamp updates (e.g., "1 minute ago" → "2 minutes ago")
3. When position changes, verify "Position updated" shows with correct timestamp
4. When table becomes ready, verify "Your table is ready!" shows with ready_at timestamp
5. For reservations, verify it says "Reservation confirmed" instead of "joined waitlist"
