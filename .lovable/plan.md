

# Add New Reservations Alert Panel to Merchant Dashboard

## Overview

Add a dismissible "New Reservations" alert section at the top of the ReservationCalendar component. When new reservations arrive, they appear in this prominent section allowing merchants to review and acknowledge them before they blend into the regular calendar view.

## Current vs New UI

```text
CURRENT:
┌─────────────────────────────────────────────────┐
│ [Calendar]              │ [Daily Reservations]  │
│                         │                       │
│  Feb 2026               │  February 1, 2026     │
│  ┌──────────────────┐   │  • John - Party of 4  │
│  │     Calendar     │   │  • Jane - Party of 2  │
│  └──────────────────┘   │                       │
└─────────────────────────────────────────────────┘

NEW - With Alert Panel:
┌─────────────────────────────────────────────────┐
│ ⚡ NEW RESERVATIONS (2)                    [✓]  │ ← Acknowledge All
│ ┌───────────────────────────────────────────┐   │
│ │ 📅 Jane Smith - Party of 4 @ 19:00 Today  │ ← Click to dismiss
│ │ 📅 Bob Jones - Party of 2 @ 20:30 Feb 3   │   │
│ └───────────────────────────────────────────┘   │
├─────────────────────────────────────────────────┤
│ [Calendar]              │ [Daily Reservations]  │
│                         │                       │
│  Feb 2026               │  February 1, 2026     │
│  ┌──────────────────┐   │  • John - Party of 4  │
│  │     Calendar     │   │  • Jane - Party of 2  │
│  └──────────────────┘   │                       │
└─────────────────────────────────────────────────┘
```

## Implementation Approach

### Database Change

Add a `merchant_seen` column to track which reservations have been seen/acknowledged by the merchant:

```sql
ALTER TABLE waitlist_entries 
ADD COLUMN merchant_seen BOOLEAN DEFAULT false;
```

This is separate from `merchant_acknowledged` which is used for completed/cancelled entries.

### ReservationCalendar Component Updates

1. **Track new (unseen) reservations** - Query for reservations where `merchant_seen = false`
2. **Real-time subscription** - Listen for new reservation INSERTs to update the alert panel
3. **Acknowledge function** - Mark reservations as `merchant_seen = true` when dismissed
4. **Render alert panel** - Show above the calendar grid when there are unseen reservations

## Changes Summary

| File | Changes |
|------|---------|
| `supabase/migrations/` | Add `merchant_seen` column to `waitlist_entries` table |
| `src/components/merchant/ReservationCalendar.tsx` | Add new reservations alert panel with dismiss functionality |
| `src/integrations/supabase/types.ts` | Update types to include `merchant_seen` field |

## Technical Implementation

### 1. Database Migration

```sql
-- Add merchant_seen column for tracking new reservations
ALTER TABLE waitlist_entries 
ADD COLUMN IF NOT EXISTS merchant_seen BOOLEAN DEFAULT false;

-- Set existing reservations as already seen
UPDATE waitlist_entries 
SET merchant_seen = true 
WHERE reservation_type = 'reservation';
```

### 2. ReservationCalendar State Updates

```typescript
// Add state for new reservations
const [newReservations, setNewReservations] = useState<Reservation[]>([]);

// Fetch unseen reservations
const fetchNewReservations = async () => {
  const { data } = await supabase
    .from('waitlist_entries')
    .select('*')
    .eq('venue_id', venueId)
    .eq('reservation_type', 'reservation')
    .eq('merchant_seen', false)
    .in('status', ['waiting', 'ready'])
    .order('created_at', { ascending: false });

  setNewReservations(data || []);
};
```

### 3. Acknowledge Functions

```typescript
// Acknowledge single reservation
const acknowledgeReservation = async (id: string) => {
  await supabase
    .from('waitlist_entries')
    .update({ merchant_seen: true })
    .eq('id', id);
  
  setNewReservations(prev => prev.filter(r => r.id !== id));
};

// Acknowledge all new reservations
const acknowledgeAllReservations = async () => {
  const ids = newReservations.map(r => r.id);
  await supabase
    .from('waitlist_entries')
    .update({ merchant_seen: true })
    .in('id', ids);
  
  setNewReservations([]);
};
```

### 4. Real-time Subscription

```typescript
// Subscribe to new reservation inserts
useEffect(() => {
  const channel = supabase
    .channel('new-reservations')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'waitlist_entries',
      filter: `venue_id=eq.${venueId}`
    }, (payload) => {
      if ((payload.new as any).reservation_type === 'reservation') {
        setNewReservations(prev => [payload.new as Reservation, ...prev]);
      }
    })
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [venueId]);
```

### 5. Alert Panel UI

```typescript
{/* New Reservations Alert Panel */}
{newReservations.length > 0 && (
  <Card className="shadow-card border-2 border-primary bg-primary/5 mb-6">
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-primary">
          <Bell className="h-5 w-5 animate-pulse" />
          New Reservations ({newReservations.length})
        </CardTitle>
        <Button 
          variant="outline" 
          size="sm"
          onClick={acknowledgeAllReservations}
        >
          <Check className="h-4 w-4 mr-1" />
          Acknowledge All
        </Button>
      </div>
    </CardHeader>
    <CardContent className="space-y-2">
      {newReservations.map((reservation) => (
        <div 
          key={reservation.id}
          className="flex items-center justify-between p-3 bg-background rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => acknowledgeReservation(reservation.id)}
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">📅</span>
            <div>
              <p className="font-medium">{reservation.customer_name}</p>
              <p className="text-sm text-muted-foreground">
                Party of {reservation.party_size} • {format(new Date(reservation.reservation_time), 'MMM d @ HH:mm')}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </CardContent>
  </Card>
)}
```

## Visual Design

| Element | Style |
|---------|-------|
| Alert Card | Primary border + subtle primary background tint |
| Header | Bell icon (animated pulse) + "New Reservations (N)" |
| Action Button | "Acknowledge All" in top right |
| Reservation Items | Click anywhere to dismiss, shows name/party/datetime |
| Animation | Items fade out when acknowledged |

## Tab Badge Behavior (Already Working)

The Reservations tab already has the red badge functionality:
- `reservationHasNew` state turns badge red when count increases
- Badge becomes grey when tab is clicked
- This continues to work with the new alert panel

## Testing Checklist

- Create a new reservation and verify it appears in the alert panel
- Verify tab badge turns red when new reservation arrives
- Click individual reservation to dismiss it
- Click "Acknowledge All" to clear all new reservations
- Verify dismissed reservations don't reappear after refresh
- Verify real-time updates work (reservation appears instantly)
- Test that the calendar and daily view still work correctly below the alert

