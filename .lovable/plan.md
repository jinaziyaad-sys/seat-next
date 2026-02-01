

# Fix Reservation Tab Badge and Add Merchant Actions

## Problems Identified

### Issue 1: Reservation Tab Badge Not Showing Notification Count
Looking at the code in `MerchantDashboard.tsx` (lines 139-161), the `fetchReservationCount` function only counts reservations **for today**:

```typescript
const fetchReservationCount = async (isInitial = false) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const { count } = await supabase
    .from("waitlist_entries")
    .eq("reservation_type", "reservation")
    .gte("reservation_time", startOfDay.toISOString())  // Only today
    .lte("reservation_time", endOfDay.toISOString());   // Only today
```

But new reservations may be for **future dates** (e.g., booking for next week). The badge logic needs to also consider `merchant_seen = false` for new reservation alerts.

### Issue 2: No Merchant Actions for Reservations
The `ReservationCalendar` currently shows reservations in a read-only view. Merchants need:
- **Edit** - Modify party size, time, preferences
- **Contact** - Call/text the patron (using `customer_phone`)
- **Cancel** - Cancel with reason (similar to WaitlistBoard pattern)

## Solution

### Fix 1: Update Badge Logic for New Reservations

Instead of showing today's reservation count, the badge should show the count of **unseen** reservations (`merchant_seen = false`). This aligns with the new alert panel we just added.

| Current | New |
|---------|-----|
| Badge shows today's reservation count | Badge shows unseen reservations count |
| Badge red when count increases | Badge red when unseen count > 0 |
| Badge grey when tab clicked | Badge clears when all acknowledged |

### Fix 2: Add Action Buttons to Reservation Cards

Each reservation card will get action buttons:
- **Phone icon** - Opens `tel:` link to call patron
- **Edit icon** - Opens edit dialog (similar to patron edit but for merchant)
- **Cancel button** - Opens cancellation dialog with reason input

## Changes Summary

| File | Changes |
|------|---------|
| `src/pages/MerchantDashboard.tsx` | Update `fetchReservationCount` to count unseen reservations; adjust badge logic |
| `src/components/merchant/ReservationCalendar.tsx` | Add action buttons (edit, contact, cancel); add cancel dialog; add phone to interface |

## Technical Implementation

### 1. MerchantDashboard - Update Badge Logic

Update `fetchReservationCount` to count unseen reservations:

```typescript
const fetchReservationCount = useCallback(async (isInitial = false) => {
  if (!userRole?.venue_id) return;

  // Count unseen reservations instead of today's reservations
  const { count } = await supabase
    .from("waitlist_entries")
    .select("*", { count: "exact", head: true })
    .eq("venue_id", userRole.venue_id)
    .eq("reservation_type", "reservation")
    .eq("merchant_seen", false)
    .in("status", ["waiting", "ready"]);

  const newCount = count || 0;
  setReservationCount(newCount);
  
  // Badge is red when there are unseen reservations
  if (!isInitial && newCount > 0) {
    setReservationHasNew(true);
  }
}, [userRole?.venue_id]);
```

Update `handleTabChange` to clear badge by acknowledging all when entering tab:

```typescript
// When clicking reservations tab, the ReservationCalendar component
// handles displaying and acknowledging - badge stays red until user acknowledges
if (newTab === "reservations") {
  setReservationHasNew(reservationCount > 0);
}
```

### 2. ReservationCalendar - Add Action Buttons

Update the Reservation interface to include `customer_phone`:

```typescript
interface Reservation {
  id: string;
  customer_name: string;
  customer_phone?: string;  // Add this
  party_size: number;
  reservation_time: string;
  status: string;
  preferences?: string[];
  notes?: string;  // Add this
  assigned_table_id?: string;
  linked_reservation_id?: string;
  last_edited_at?: string;
  edit_summary?: string;
}
```

Add cancel dialog state and handler:

```typescript
const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
const [cancelReservationId, setCancelReservationId] = useState<string>("");
const [cancelReason, setCancelReason] = useState("");

const handleCancelReservation = async () => {
  if (!cancelReservationId || !cancelReason.trim()) return;
  
  const reservation = reservations.find(r => r.id === cancelReservationId);
  const linkedId = reservation?.linked_reservation_id;
  
  const idsToCancel = linkedId 
    ? reservations.filter(r => r.linked_reservation_id === linkedId).map(r => r.id)
    : [cancelReservationId];
  
  await supabase
    .from('waitlist_entries')
    .update({
      status: 'cancelled',
      cancelled_by: 'venue',
      cancellation_reason: `Venue cancelled: ${cancelReason}`,
      updated_at: new Date().toISOString()
    })
    .in('id', idsToCancel);
  
  setCancelDialogOpen(false);
  setCancelReason("");
  fetchReservationsForDate(selectedDate!);
};
```

Add action buttons to reservation cards:

```typescript
<div className="flex items-center gap-1">
  {/* Contact button - phone call */}
  {reservation.customer_phone && (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      asChild
    >
      <a href={`tel:${reservation.customer_phone}`} title="Call patron">
        <Phone className="h-4 w-4" />
      </a>
    </Button>
  )}
  
  {/* Edit button */}
  <Button
    variant="ghost"
    size="icon"
    className="h-8 w-8"
    onClick={() => handleEditReservation(reservation)}
    title="Edit reservation"
  >
    <Pencil className="h-4 w-4" />
  </Button>
  
  {/* Cancel button */}
  {['waiting', 'ready'].includes(reservation.status) && (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-destructive hover:text-destructive"
      onClick={() => {
        setCancelReservationId(reservation.id);
        setCancelDialogOpen(true);
      }}
      title="Cancel reservation"
    >
      <XCircle className="h-4 w-4" />
    </Button>
  )}
  
  <Badge variant={getStatusColor(reservation.status)}>
    {reservation.status}
  </Badge>
</div>
```

Add the cancel dialog at the end of the component:

```typescript
{/* Cancel Reservation Dialog */}
<Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Cancel Reservation</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Please provide a reason for cancelling. The customer will see this reason.
      </p>
      <Textarea
        placeholder="Reason for cancellation..."
        value={cancelReason}
        onChange={(e) => setCancelReason(e.target.value)}
      />
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setCancelDialogOpen(false)} className="flex-1">
          Keep Reservation
        </Button>
        <Button 
          variant="destructive" 
          onClick={handleCancelReservation}
          disabled={!cancelReason.trim()}
          className="flex-1"
        >
          Cancel Reservation
        </Button>
      </div>
    </div>
  </DialogContent>
</Dialog>
```

### 3. Edit Reservation (Merchant Side)

For editing, we can reuse the existing `EditReservationDialog` component, but pass it from the merchant context. The merchant can edit:
- Party size
- Reservation time
- Preferences
- Notes

```typescript
const [editDialogOpen, setEditDialogOpen] = useState(false);
const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);

const handleEditReservation = (reservation: Reservation) => {
  setEditingReservation(reservation);
  setEditDialogOpen(true);
};

// In render:
{editingReservation && (
  <EditReservationDialog
    open={editDialogOpen}
    onOpenChange={setEditDialogOpen}
    entry={{
      id: editingReservation.id,
      venue: venueName,
      venue_id: venueId,
      party_size: editingReservation.party_size,
      reservation_time: editingReservation.reservation_time,
      preferences: editingReservation.preferences,
      notes: editingReservation.notes,
      customer_name: editingReservation.customer_name,
    }}
    onSuccess={() => {
      setEditDialogOpen(false);
      fetchReservationsForDate(selectedDate!);
    }}
  />
)}
```

## Visual Design

| Element | Icon | Action |
|---------|------|--------|
| Contact | Phone | Opens native phone dialer |
| Edit | Pencil | Opens edit dialog |
| Cancel | XCircle (red) | Opens cancel confirmation |

## Testing Checklist

- Create a new reservation for a future date (not today) and verify badge appears on Reservations tab
- Verify badge turns red when new reservation arrives
- Verify badge shows the unseen count
- Acknowledge reservations and verify badge count decreases
- Test phone contact button (should open dialer)
- Test edit button (should open edit dialog)
- Test cancel button with reason (should cancel and notify patron)
- Test cancelling a multi-table booking (should cancel all linked entries)

