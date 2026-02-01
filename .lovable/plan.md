

# Messaging System Cleanup and Streamlining

## Issues Identified

### 1. Separate Chats per Order/Reservation (UX Issue)
The current system shows a separate conversation thread for each individual order or reservation. This creates a fragmented experience:
- If a patron places 3 orders at the same restaurant, they see 3 separate chats
- Merchants see many individual threads instead of grouped by customer

### 2. Messages Not Syncing to Merchant Side (Bug)
Looking at the database, patron messages exist but may not be visible to merchants because:
- The conversation list only shows orders with specific statuses (`awaiting_verification`, `placed`, `in_prep`, `ready`)
- Once an order moves to `collected` or other statuses, the conversation disappears from the list
- The RLS policies are correct, but the query filtering excludes completed orders that have messages

### 3. No Unified View (Missing Feature)
There's no way to see all communication with a specific customer/venue in one place.

---

## Proposed Solution

Create a **grouped conversation view** that consolidates threads by customer/venue relationship, while still allowing context-specific messaging.

### Architecture Change

```text
CURRENT STRUCTURE:
┌─────────────────────────────────────────────────────────────────┐
│  MessengerHub                                                   │
│  ├── Order #42 Chat                                             │
│  ├── Order #43 Chat                                             │
│  ├── Reservation Chat                                           │
│  └── Inquiry Chat                                               │
└─────────────────────────────────────────────────────────────────┘

PROPOSED STRUCTURE:
┌─────────────────────────────────────────────────────────────────┐
│  MessengerHub                                                   │
│  ├── Demo Restaurant (3 active items)  ← Grouped by venue       │
│  │   ├── All Messages (unified timeline)                        │
│  │   ├── Order #42                                              │
│  │   ├── Order #43                                              │
│  │   └── Reservation                                            │
│  └── Cafe Bistro (1 active item)                                │
│      └── Pre-booking inquiry                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Implementation

### 1. Fix Message Visibility Bug (Priority 1)

**Problem:** Conversations disappear when status changes

**Solution:** Include messages from recently completed orders/reservations (last 24 hours) so conversations don't vanish mid-chat.

| File | Change |
|------|--------|
| `src/hooks/useConversations.ts` | Expand status filters to include recently completed items |

Updated query logic:
```text
// For orders - include active + recently completed (last 24h)
.or('status.in.(awaiting_verification,placed,in_prep,ready),and(status.in.(collected,cancelled),updated_at.gte.yesterday)')
```

### 2. Group Conversations by Customer/Venue (Priority 2)

**For Merchants:** Group all threads from the same customer together
**For Patrons:** Group all threads with the same venue together

| File | Change |
|------|--------|
| `src/hooks/useConversations.ts` | Add grouping logic to aggregate by customer/venue |
| `src/components/MessengerHub.tsx` | Update UI to show grouped view |
| `src/components/merchant/MerchantMessengerHub.tsx` | Update UI to show grouped view |

New data structure:
```text
interface ConversationGroup {
  id: string;                    // customer_id or venue_id
  name: string;                  // Customer name or Venue name
  conversations: Conversation[]; // All threads with this entity
  totalUnread: number;           // Sum of unread across all threads
  lastMessageTime?: string;      // Most recent message timestamp
}
```

### 3. Unified Message Timeline View (Priority 3)

Add an option to view all messages with a customer/venue in chronological order, with context labels showing which order/reservation each message relates to.

| File | Change |
|------|--------|
| `src/components/Messenger.tsx` | Add optional `groupedMode` prop for unified view |
| `src/components/MessengerHub.tsx` | Add toggle between grouped and individual view |

Unified view UI:
```text
┌─────────────────────────────────────────────────────────────────┐
│  All Messages with Demo Restaurant                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ [Reservation] Your table is ready!              12:30     │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Thanks, on my way!                              12:32     │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ [Order #42] Your order is being prepared        12:45     │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Can I add extra sauce?                          12:47     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Improve Real-time Sync (Priority 4)

Add polling fallback as suggested in the lovable-stack-overflow context to ensure message delivery:

| File | Change |
|------|--------|
| `src/components/Messenger.tsx` | Add polling fallback with exponential backoff |
| `src/hooks/useConversations.ts` | Add deduplication for real-time events |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useConversations.ts` | 1. Expand status filters to include recently completed items 2. Add grouping logic by customer/venue 3. Return both grouped and flat conversation lists 4. Add deduplication for real-time |
| `src/components/MessengerHub.tsx` | 1. Show grouped conversation view 2. Click group to expand individual threads 3. Add "View all" option for unified timeline |
| `src/components/merchant/MerchantMessengerHub.tsx` | 1. Show grouped by customer view 2. Click customer to see all their threads 3. Unified timeline option |
| `src/components/Messenger.tsx` | 1. Add grouped mode for unified timeline 2. Show context labels (which order/reservation) 3. Add polling fallback for reliability |

---

## UI Flow

### Merchant View (After Changes)

```text
Step 1: See customer-grouped list
┌─────────────────────────────────────────────────────────────────┐
│ Customer Messages                                               │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 👤 John Smith                                    ● 2 new   │ │
│ │ 2 orders + 1 reservation                                   │ │
│ │ "Can I add extra sauce?"                                   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 👤 Guest                                                    │ │
│ │ 1 order                                                    │ │
│ │ "Where is my order?"                                       │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

Step 2: Click customer to see all threads
┌─────────────────────────────────────────────────────────────────┐
│ ← John Smith                           [All Messages] [Threads] │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🍽️ Order #42 (In Prep)                          ● 1 new   │ │
│ │ "Can I add extra sauce?"                                   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🍽️ Order #41 (Collected)                                   │ │
│ │ "Thanks for the food!"                                     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📅 Reservation 19:00                            ● 1 new   │ │
│ │ "Running 5 mins late"                                      │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Patron View (After Changes)

```text
Step 1: See venue-grouped list
┌─────────────────────────────────────────────────────────────────┐
│ Messages                                                        │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🏪 Demo Restaurant                               ● 1 new   │ │
│ │ 1 order + 1 reservation                                    │ │
│ │ "Your table will be ready soon"                            │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🏪 Cafe Bistro                                              │ │
│ │ Pre-booking inquiry                                        │ │
│ │ "Yes, we have vegan options!"                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Testing Checklist

- Verify messages from patrons appear on merchant side immediately
- Verify conversations don't disappear when order status changes
- Verify grouped view shows correct unread counts
- Verify unified timeline shows messages in correct order
- Verify context labels show which order/reservation each message belongs to
- Verify real-time updates work reliably
- Verify polling fallback activates when real-time fails
- Test on mobile viewport

