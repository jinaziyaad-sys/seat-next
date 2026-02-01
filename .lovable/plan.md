

# Universal Messaging System for ReadyUp

## Overview

Create a unified in-app messaging system that works across all patron-merchant interactions - reservations, waitlist entries, and food orders. This messenger-style system allows two-way communication without exchanging personal phone numbers.

## Current State Analysis

### Existing Infrastructure
- `profiles` table already has `phone` column for patrons
- `waitlist_entries` has `customer_phone` column (currently not populated from app flow)
- `orders` has `customer_phone` column (currently not populated from app flow)
- Real-time subscriptions already in place for all these tables

### What's Missing
1. **Phone collection** - The TableReadyFlow party-details form doesn't ask for phone
2. **No messaging table** - No way to store conversation history
3. **No chat UI** - Neither patron nor merchant can send messages

## Proposed Architecture

```text
                    ┌─────────────────────────────────────┐
                    │         messages table              │
                    │  (universal for all booking types)  │
                    └─────────────────────────────────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
    ┌─────────▼─────────┐  ┌─────────▼─────────┐  ┌─────────▼─────────┐
    │   Reservations    │  │     Waitlist      │  │   Food Orders     │
    │  (waitlist_entries│  │  (waitlist_entries│  │     (orders)      │
    │   type=reservation)│ │   type=walk_in)   │  │                   │
    └───────────────────┘  └───────────────────┘  └───────────────────┘
```

## Changes Summary

| File | Changes |
|------|---------|
| Database migration | Create `messages` table with polymorphic reference |
| `src/components/TableReadyFlow.tsx` | Add optional phone input to party-details step |
| `src/components/Messenger.tsx` (new) | Universal chat component |
| `src/components/merchant/ReservationCalendar.tsx` | Add message button to reservations |
| `src/components/merchant/WaitlistBoard.tsx` | Add message button to waitlist entries |
| `src/components/merchant/KitchenBoard.tsx` | Add message button to food orders |
| `src/pages/Index.tsx` | Add message button on active bookings |

## Technical Implementation

### 1. Database Schema

```sql
-- Universal messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Polymorphic reference (one of these will be set)
  waitlist_entry_id UUID REFERENCES waitlist_entries(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  
  -- Message details
  sender_type TEXT NOT NULL CHECK (sender_type IN ('patron', 'venue', 'system')),
  sender_id UUID NOT NULL,
  message TEXT NOT NULL,
  
  -- Read tracking
  read_at TIMESTAMP WITH TIME ZONE,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure exactly one reference is set
  CONSTRAINT one_reference CHECK (
    (waitlist_entry_id IS NOT NULL AND order_id IS NULL) OR
    (waitlist_entry_id IS NULL AND order_id IS NOT NULL)
  )
);

-- Indexes for fast lookups
CREATE INDEX idx_messages_waitlist ON messages(waitlist_entry_id) WHERE waitlist_entry_id IS NOT NULL;
CREATE INDEX idx_messages_order ON messages(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX idx_messages_unread ON messages(read_at) WHERE read_at IS NULL;

-- Enable RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Patrons can read/write messages for their own bookings
CREATE POLICY "Patrons can access their messages" ON messages
  FOR ALL USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM waitlist_entries 
      WHERE id = messages.waitlist_entry_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM orders 
      WHERE id = messages.order_id AND user_id = auth.uid()
    )
  );

-- Venue staff can access messages for their venue's bookings
CREATE POLICY "Venue staff can access venue messages" ON messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM merchant_users mu
      JOIN waitlist_entries we ON we.venue_id = mu.venue_id
      WHERE we.id = messages.waitlist_entry_id AND mu.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM merchant_users mu
      JOIN orders o ON o.venue_id = mu.venue_id
      WHERE o.id = messages.order_id AND mu.user_id = auth.uid()
    )
  );
```

### 2. Phone Collection in TableReadyFlow

Add optional phone input to the party-details step:

```typescript
// New state
const [customerPhone, setCustomerPhone] = useState("");

// Fetch from profile on mount
useEffect(() => {
  const fetchPhone = async () => {
    if (userId) {
      const { data } = await supabase
        .from('profiles')
        .select('phone')
        .eq('id', userId)
        .single();
      if (data?.phone) {
        setCustomerPhone(data.phone);
      }
    }
  };
  fetchPhone();
}, [userId]);

// Add to form (after Party Name input)
<div className="space-y-3">
  <label className="text-sm font-medium">Contact Number (optional)</label>
  <Input
    type="tel"
    placeholder="+1 (555) 123-4567"
    value={customerPhone}
    onChange={(e) => setCustomerPhone(e.target.value)}
    className="h-12"
  />
  <p className="text-xs text-muted-foreground">
    So the restaurant can call you if needed
  </p>
</div>

// Include in insertData
let insertData: any = {
  venue_id: venue.id,
  customer_name: partyName.trim(),
  customer_phone: customerPhone.trim() || null,  // Add this
  party_size: partySize,
  // ...
};
```

### 3. Universal Messenger Component

```typescript
interface MessengerProps {
  // One of these will be set
  waitlistEntryId?: string;
  orderId?: string;
  
  // Context
  userType: 'patron' | 'venue';
  userId: string;
  customerName?: string;
  venueName?: string;
  
  // UI control
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function Messenger({
  waitlistEntryId,
  orderId,
  userType,
  userId,
  customerName,
  venueName,
  open,
  onOpenChange
}: MessengerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  
  // Fetch messages
  useEffect(() => {
    if (!open) return;
    
    const fetchMessages = async () => {
      let query = supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (waitlistEntryId) {
        query = query.eq('waitlist_entry_id', waitlistEntryId);
      } else if (orderId) {
        query = query.eq('order_id', orderId);
      }
      
      const { data } = await query;
      setMessages(data || []);
      setIsLoading(false);
      
      // Mark as read
      if (data?.length) {
        const unreadIds = data
          .filter(m => !m.read_at && m.sender_type !== userType)
          .map(m => m.id);
        
        if (unreadIds.length > 0) {
          await supabase
            .from('messages')
            .update({ read_at: new Date().toISOString() })
            .in('id', unreadIds);
        }
      }
    };
    
    fetchMessages();
    
    // Real-time subscription
    const filter = waitlistEntryId 
      ? `waitlist_entry_id=eq.${waitlistEntryId}`
      : `order_id=eq.${orderId}`;
    
    const channel = supabase
      .channel(`messages-${waitlistEntryId || orderId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message]);
        // Auto-mark as read if chat is open
        if (payload.new.sender_type !== userType) {
          supabase
            .from('messages')
            .update({ read_at: new Date().toISOString() })
            .eq('id', payload.new.id);
        }
      })
      .subscribe();
    
    return () => supabase.removeChannel(channel);
  }, [waitlistEntryId, orderId, open, userType]);
  
  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    
    const messageData: any = {
      sender_type: userType,
      sender_id: userId,
      message: newMessage.trim()
    };
    
    if (waitlistEntryId) {
      messageData.waitlist_entry_id = waitlistEntryId;
    } else if (orderId) {
      messageData.order_id = orderId;
    }
    
    await supabase.from('messages').insert(messageData);
    setNewMessage("");
  };
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {userType === 'patron' ? `Chat with ${venueName}` : `Chat with ${customerName}`}
          </SheetTitle>
        </SheetHeader>
        
        <ScrollArea className="flex-1 py-4">
          {messages.length === 0 && !isLoading ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No messages yet</p>
              <p className="text-sm">Start a conversation!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map(msg => (
                <div 
                  key={msg.id}
                  className={cn(
                    "max-w-[80%] p-3 rounded-2xl",
                    msg.sender_type === userType 
                      ? "ml-auto bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted rounded-bl-sm"
                  )}
                >
                  <p className="text-sm">{msg.message}</p>
                  <p className="text-[10px] opacity-70 mt-1">
                    {format(new Date(msg.created_at), 'HH:mm')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        <div className="flex gap-2 pt-4 border-t">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            className="flex-1"
          />
          <Button onClick={sendMessage} size="icon" disabled={!newMessage.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

### 4. Integration Points

**Patron Side (Index.tsx / TableReadyFlow.tsx)**:
- Add "Message Restaurant" button on active booking cards
- Shows unread count badge
- Opens Messenger component

**Merchant Side (ReservationCalendar, WaitlistBoard, KitchenBoard)**:
- Add MessageSquare icon button on each entry
- Shows unread count badge  
- Opens Messenger component

### 5. Unread Message Tracking

Create a helper hook to track unread counts:

```typescript
function useUnreadMessages(
  waitlistEntryId?: string, 
  orderId?: string, 
  userType?: 'patron' | 'venue'
) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    if (!waitlistEntryId && !orderId) return;
    
    const fetchCount = async () => {
      let query = supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)
        .neq('sender_type', userType);
      
      if (waitlistEntryId) {
        query = query.eq('waitlist_entry_id', waitlistEntryId);
      } else if (orderId) {
        query = query.eq('order_id', orderId);
      }
      
      const { count } = await query;
      setCount(count || 0);
    };
    
    fetchCount();
    
    // Real-time updates would go here
  }, [waitlistEntryId, orderId, userType]);
  
  return count;
}
```

## Visual Design

| Context | Button Style | Badge |
|---------|--------------|-------|
| Active booking card (patron) | Outline button "Message Restaurant" | Red dot with count |
| Waitlist row (merchant) | Ghost icon button | Red dot overlay |
| Reservation card (merchant) | Ghost icon button | Red dot overlay |
| Kitchen order (merchant) | Ghost icon button | Red dot overlay |

## Phased Implementation

**Phase 1** (This implementation):
- Create messages table with RLS
- Add phone input to TableReadyFlow (optional, auto-fills from profile)
- Build Messenger component
- Add message buttons to merchant ReservationCalendar

**Phase 2** (Follow-up):
- Add to WaitlistBoard
- Add to KitchenBoard  
- Add to patron home page cards
- Push notification integration for new messages

## Testing Checklist

- Create a reservation and verify phone field appears (pre-filled if in profile)
- Send a message from patron side
- Verify message appears on merchant side in real-time
- Send a reply from merchant
- Verify patron receives reply in real-time
- Check unread badge updates correctly
- Verify messages persist after page refresh
- Test RLS policies (patron can't see other patrons' messages)

