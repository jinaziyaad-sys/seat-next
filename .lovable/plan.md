
# Filter Messenger to Only Show Conversations with Messages

## Problem

The MessengerHub currently shows every active order, reservation, and waitlist entry - even if no messages have been exchanged. This creates a cluttered, messy view where most items are empty conversations that never had any communication.

## Solution

Filter out items that have no messages. Only show conversations where at least one message exists.

## Technical Change

Update `src/hooks/useConversations.ts` to filter out conversations with no messages.

### Current Behavior (line 93-113 for orders, similar for waitlist):

```typescript
orders.forEach(order => {
  const messages = orderMessages?.filter(m => m.order_id === order.id) || [];
  // ... creates conversation even if messages.length === 0
  allConversations.push({...});
});
```

### New Behavior:

```typescript
orders.forEach(order => {
  const messages = orderMessages?.filter(m => m.order_id === order.id) || [];
  
  // Skip items with no messages
  if (messages.length === 0) return;
  
  // ... rest of processing
  allConversations.push({...});
});
```

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useConversations.ts` | Add `if (messages.length === 0) return;` check in 6 places - for orders, waitlist, and inquiries in both patron and venue sections |

## Changes Summary

Add early return in these locations:
1. **Patron orders** (around line 93): Skip orders with no messages
2. **Patron waitlist** (around line 126): Skip waitlist entries with no messages  
3. **Patron inquiries** (around line 161): Skip inquiries with no messages
4. **Venue orders** (around line 234): Skip orders with no messages
5. **Venue waitlist** (around line 273): Skip waitlist entries with no messages
6. **Venue inquiries** (around line 313): Skip inquiries with no messages

## Result

After this change:
- MessengerHub only shows customers/venues where actual messages have been exchanged
- Clean, focused view of real conversations
- No more empty placeholder conversations cluttering the list
- Patrons can still initiate new conversations via the message icons on their active cards in Index.tsx

## Edge Case Consideration

What about inquiries that were just created but no message sent yet? The current flow for pre-booking inquiries creates the inquiry record, then the Messenger component opens allowing the patron to type their first message. If they close without sending, the empty inquiry would be filtered out - which is the correct behavior.
