# ✅ COMPLETED: Hybrid Messaging System with Quick-Access Message Icons

**Status**: Implemented

## Overview

Complete the messaging system with two key additions:
1. **Pre-booking inquiries** - Allow patrons to message any venue directly from the Explore page
2. **Quick-access message icons** - Add message buttons directly on active tracking cards (orders and waitlist/reservations) so patrons can jump straight to chat without opening the MessengerHub

## Architecture

```text
                       ┌─────────────────────────────────────┐
                       │         messages table              │
                       │  (universal for all booking types)  │
                       └─────────────────────────────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        │                               │                               │
   waitlist_entry_id                order_id                  venue_inquiry_id (NEW)
        │                               │                               │
┌───────▼───────┐              ┌───────▼───────┐              ┌────────▼────────┐
│  Reservations │              │  Food Orders  │              │ Venue Inquiries │
│  & Waitlist   │              │               │              │   (NEW)         │
└───────────────┘              └───────────────┘              └─────────────────┘
```

## User Experience

### Patron Home Page (Active Tracking Cards)

Each active order and waitlist/reservation card will show a message icon:

```text
┌─────────────────────────────────────────────────────────────┐
│ 🍽️  Demo Restaurant                                        │
│ Order                                                       │
│ Order #42                                                   │
│ 🕐 15 min • ETA 14:30               [💬] [Preparing]       │
│                                      ↑                      │
│                             Message icon with badge         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 👥  Demo Restaurant                                         │
│ Reservation                                                 │
│ Reservation for 4                                           │
│ 📅 Today at 19:00                   [💬●2] [Reserved]      │
│                                       ↑                     │
│                              2 unread messages              │
└─────────────────────────────────────────────────────────────┘
```

### Explore Venues Page

Each venue card will have a message button for pre-booking inquiries:

```text
┌─────────────────────────────────────────────────────────────┐
│ Demo Restaurant                              [💬] [92% Match]│
├─────────────────────────────────────────────────────────────┤
│ 📍 123 Main St • 2.5 km                                     │
│ ✨ "Great match for your preferences!"                      │
│ ⭐ 4.5  👥 Moderate  ⏱️ ~10 min                             │
│ 🏷️ Italian  🥬 Veg-friendly                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Details

### 1. Database Changes

**New table: `venue_inquiries`**

Tracks patron-venue inquiry threads (one per user-venue pair):

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| venue_id | UUID | Reference to venues |
| user_id | UUID | Reference to auth.users |
| status | TEXT | 'open' or 'closed' |
| created_at | TIMESTAMP | When inquiry started |
| updated_at | TIMESTAMP | Last activity |

**Modify `messages` table:**

Add `venue_inquiry_id` column and update the constraint to allow one of three references:
- `waitlist_entry_id` (for reservations/waitlist)
- `order_id` (for food orders)
- `venue_inquiry_id` (for pre-booking inquiries)

**Row-Level Security:**
- Patrons can create/read their own inquiries and messages
- Venue staff can read/respond to inquiries for their venue

### 2. Index.tsx Changes

Add message icons to active tracking cards:

**New state:**
- `messengerOpen` - controls messenger sheet visibility
- `messengerContext` - tracks which conversation to show (type, id, venue name)

**Order cards (lines ~797):**
Add a message icon button in the action buttons area (before the status badge):
```text
<Button variant="ghost" size="icon" className="h-8 w-8 relative">
  <MessageSquare className="h-4 w-4" />
  {unreadCount > 0 && <badge>...</badge>}
</Button>
```

**Waitlist/Reservation cards (lines ~1019):**
Same pattern - add message icon before the status badge.

**Unread tracking:**
Use `useMultipleUnreadMessages` hook to efficiently track unread counts for all active cards:
```text
const orderIds = activeOrders.map(o => ({ orderId: o.id }));
const waitlistIds = activeWaitlist.map(e => ({ waitlistEntryId: e.id }));
const unreadCounts = useMultipleUnreadMessages([...orderIds, ...waitlistIds], 'patron');
```

### 3. ExploreVenues.tsx Changes

Add message functionality to venue cards:

**New state:**
- `messengerOpen` / `selectedVenueForChat` - track which venue chat is open
- `creatingInquiry` - loading state while creating inquiry record

**Logic flow:**
1. User clicks message icon on venue card
2. Check if `venue_inquiry` exists for this user-venue pair
3. If not, create one
4. Open Messenger with `venueInquiryId`

**UI addition:**
Add `MessageSquare` button in the venue card header (next to match score badge).

### 4. Messenger.tsx Updates

Support the new `venueInquiryId` prop:

| Current Props | New Prop |
|---------------|----------|
| `waitlistEntryId` | - |
| `orderId` | - |
| - | `venueInquiryId` |

Update the query logic:
```text
if (waitlistEntryId) {
  query = query.eq('waitlist_entry_id', waitlistEntryId);
} else if (orderId) {
  query = query.eq('order_id', orderId);
} else if (venueInquiryId) {
  query = query.eq('venue_inquiry_id', venueInquiryId);
}
```

Update message sending to include `venue_inquiry_id` when applicable.

### 5. useConversations.ts Updates

Include inquiry conversations in the list:

**Updated Conversation type:**
```text
type: 'order' | 'waitlist' | 'reservation' | 'inquiry'
```

**New query:**
Fetch from `venue_inquiries` table joining with `venues` for name, and aggregate unread messages.

### 6. MessengerHub.tsx Updates

Show inquiry conversations with a distinct icon (`HelpCircle` or `MessageCircle`).

**Conversation card subtitle:**
```text
inquiry → "Inquiry • Started Jan 15"
```

### 7. MerchantMessengerHub.tsx Updates

Show patron inquiries so merchants can respond to pre-booking questions.

**Display:**
- Customer name from profiles join
- "Pre-booking inquiry" label
- Unread badge

### 8. useUnreadMessages.ts Updates

Support `venueInquiryId` in both hooks:

```text
function useUnreadMessages(
  waitlistEntryId?: string, 
  orderId?: string, 
  venueInquiryId?: string,  // NEW
  userType?: 'patron' | 'venue'
)
```

---

## Files to Modify

| File | Changes |
|------|---------|
| New migration | Create `venue_inquiries` table, modify `messages` constraint, add RLS |
| `src/pages/Index.tsx` | Add message icons to order and waitlist cards, messenger state |
| `src/components/ExploreVenues.tsx` | Add message button to venue cards, inquiry creation logic |
| `src/components/Messenger.tsx` | Support `venueInquiryId` prop |
| `src/hooks/useConversations.ts` | Include inquiry conversations |
| `src/hooks/useUnreadMessages.ts` | Support `venueInquiryId` |
| `src/components/MessengerHub.tsx` | Show inquiry conversations |
| `src/components/merchant/MerchantMessengerHub.tsx` | Show patron inquiries |
| `src/integrations/supabase/types.ts` | Add venue_inquiries and updated messages types |

## Testing Checklist

- Patron can tap message icon on order card → opens chat with venue
- Patron can tap message icon on reservation card → opens chat with venue
- Unread badges show correctly on active tracking cards
- Patron can message venue from Explore page before booking
- Inquiry appears in MessengerHub conversation list
- Merchant sees inquiry in their messenger hub
- Real-time updates work for all conversation types
- Existing order/waitlist messaging still works
- Empty states display correctly

