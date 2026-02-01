

# Persistent Global Messenger System

## Overview

Create a WhatsApp-style messaging experience with a **persistent floating message icon** that's always visible throughout the app. Users can access their conversations from anywhere, not just from specific booking cards.

## Current vs Proposed UX

```text
CURRENT STATE:
- Messenger component exists but is only accessible from specific cards
- No way to see all conversations at once
- No global entry point for messaging

PROPOSED STATE:
┌─────────────────────────────────────────┐
│                                         │
│         [Any page content]              │
│                                         │
│                                         │
│                                         │
│                                         │
│                           ┌───┐ ┌───┐   │
│                           │ ? │ │💬│   │  ← Two floating buttons
│                           └───┘ └───┘   │     Help + Messages
└─────────────────────────────────────────┘

When clicking the Messages button:
┌─────────────────────────────────────────┐
│ Messages                            [X] │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ Demo Restaurant          ● 2 new   │ │  ← Active conversations
│ │ Reservation • Today 19:00          │ │
│ │ "Your table will be ready soon"    │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ Cafe Bistro                        │ │
│ │ Order #42 • Ready                  │ │
│ │ "Thank you for ordering!"          │ │
│ └─────────────────────────────────────┘ │
│                                         │
│    No other active conversations        │
│                                         │
└─────────────────────────────────────────┘
```

## Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                    MessengerHub                          │
│  (Global floating button + conversation list drawer)     │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                 ConversationList                         │
│  (Lists all active bookings with unread indicators)      │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    Messenger                             │
│  (Individual chat view - already exists)                 │
└─────────────────────────────────────────────────────────┘
```

## New Components

### 1. MessengerHub (Patron Side)

A floating button + drawer that shows all active conversations:

| Property | Value |
|----------|-------|
| Position | Fixed bottom-right, above Help button |
| Badge | Total unread count across all conversations |
| Click action | Opens conversation list drawer |

### 2. MerchantMessengerHub (Merchant Side)

Same concept but for merchants - shows all conversations for the venue:

| Property | Value |
|----------|-------|
| Position | Fixed bottom-right, next to Help button |
| Badge | Total unread count for venue |
| Click action | Opens conversation list for venue |

### 3. ConversationList (Shared)

Lists all active conversations with:
- Booking type icon (order/waitlist/reservation)
- Venue/customer name
- Last message preview
- Unread badge
- Click to open specific conversation

## Changes Summary

| File | Changes |
|------|---------|
| `src/components/MessengerHub.tsx` (new) | Floating button + conversation list for patrons |
| `src/components/merchant/MerchantMessengerHub.tsx` (new) | Floating button + conversation list for merchants |
| `src/hooks/useConversations.ts` (new) | Hook to fetch all active conversations with unread counts |
| `src/pages/Index.tsx` | Add MessengerHub component |
| `src/pages/MerchantDashboard.tsx` | Add MerchantMessengerHub component |

## Technical Implementation

### 1. useConversations Hook

Fetches all active bookings that can have conversations:

```typescript
interface Conversation {
  id: string;
  type: 'order' | 'waitlist' | 'reservation';
  referenceId: string; // order_id or waitlist_entry_id
  venueName: string;
  venueId: string;
  customerName?: string;
  status: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  metadata: {
    orderNumber?: string;
    partySize?: number;
    reservationTime?: string;
  };
}

function useConversations(userType: 'patron' | 'venue', userId?: string, venueId?: string) {
  // For patrons: fetch their active orders + waitlist entries
  // For merchants: fetch venue's active orders + waitlist entries
  // Join with messages table to get last message + unread count
  // Real-time subscription for updates
}
```

### 2. MessengerHub Component (Patron)

```typescript
export function MessengerHub({ userId }: { userId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const { conversations, totalUnread, loading } = useConversations('patron', userId);

  return (
    <>
      {/* Floating button */}
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 z-50 h-14 w-14 rounded-full shadow-floating"
      >
        <MessageSquare className="h-6 w-6" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-xs text-white flex items-center justify-center">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </Button>

      {/* Conversation list sheet */}
      <Sheet open={isOpen && !selectedConversation} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Messages</SheetTitle>
          </SheetHeader>
          
          <ScrollArea className="h-full">
            {conversations.length === 0 ? (
              <EmptyState message="No active conversations" />
            ) : (
              conversations.map(conv => (
                <ConversationCard
                  key={conv.id}
                  conversation={conv}
                  onClick={() => setSelectedConversation(conv)}
                />
              ))
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Individual chat */}
      {selectedConversation && (
        <Messenger
          open={!!selectedConversation}
          onOpenChange={(open) => !open && setSelectedConversation(null)}
          waitlistEntryId={selectedConversation.type !== 'order' ? selectedConversation.referenceId : undefined}
          orderId={selectedConversation.type === 'order' ? selectedConversation.referenceId : undefined}
          userType="patron"
          userId={userId}
          venueName={selectedConversation.venueName}
        />
      )}
    </>
  );
}
```

### 3. MerchantMessengerHub Component

Same structure but for venue perspective:

```typescript
export function MerchantMessengerHub({ venueId, userId }: Props) {
  const { conversations, totalUnread } = useConversations('venue', undefined, venueId);
  
  // Shows all conversations for the venue
  // Click opens chat with customer name in title
}
```

### 4. ConversationCard Component

Displays a single conversation in the list:

```typescript
function ConversationCard({ conversation, onClick }: Props) {
  const Icon = conversation.type === 'order' ? ChefHat : Users;
  
  return (
    <button onClick={onClick} className="w-full p-4 hover:bg-muted border-b">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/10 rounded-full">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        
        <div className="flex-1 text-left">
          <div className="flex items-center justify-between">
            <span className="font-medium">{conversation.venueName || conversation.customerName}</span>
            {conversation.unreadCount > 0 && (
              <Badge variant="destructive" className="h-5 min-w-[20px]">
                {conversation.unreadCount}
              </Badge>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground">
            {conversation.type === 'order' 
              ? `Order #${conversation.metadata.orderNumber}`
              : conversation.type === 'reservation'
                ? `Reservation • ${format(new Date(conversation.metadata.reservationTime!), 'MMM d, HH:mm')}`
                : `Waitlist • Party of ${conversation.metadata.partySize}`
            }
          </p>
          
          {conversation.lastMessage && (
            <p className="text-sm text-muted-foreground truncate mt-1">
              {conversation.lastMessage}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
```

## Button Positioning

The floating buttons will be stacked vertically:

| Button | Position | Z-Index |
|--------|----------|---------|
| Messages | `bottom-24 right-6` | 50 |
| Help | `bottom-6 right-6` | 50 |

On merchant dashboard, adjust position to avoid tab bar:

```text
Desktop Layout:
┌────────────────────────────────────────────┐
│ Header                                     │
├────────────────────────────────────────────┤
│                                            │
│                                            │
│         Dashboard Content                  │
│                                            │
│                                   ┌──┐     │
│                                   │💬│     │
│                                   └──┘     │
│                                   ┌──┐     │
│                                   │ ?│     │
│                                   └──┘     │
└────────────────────────────────────────────┘
```

## Real-time Updates

The messaging system will have live updates:

1. **New message arrives** → Badge count increases, conversation moves to top
2. **User reads messages** → Badge count decreases
3. **New booking created** → Appears in conversation list automatically
4. **Booking completes** → Conversation remains accessible until dismissed

## Empty States

| Context | Message |
|---------|---------|
| Patron (no bookings) | "No active orders or reservations. When you make a booking, you'll be able to message the restaurant here." |
| Merchant (no bookings) | "No active customer conversations. Messages from customers will appear here." |

## Accessibility

- Floating button has aria-label "Open messages"
- Badge announces unread count to screen readers
- Keyboard navigation through conversation list
- Focus trap within open sheets

## Testing Checklist

- Verify floating message button appears on patron home page
- Verify floating message button appears on merchant dashboard
- Click button opens conversation list
- Conversations show correct booking type icons
- Unread badges display correctly
- Clicking a conversation opens the chat
- Real-time updates work when new messages arrive
- Empty state displays when no active bookings
- Button position doesn't overlap with Help button
- Works correctly on mobile viewport

