import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Conversation {
  id: string;
  type: 'order' | 'waitlist' | 'reservation' | 'inquiry';
  referenceId: string;
  venueName: string;
  venueId: string;
  customerName?: string;
  customerId?: string;
  status: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  metadata: {
    orderNumber?: string;
    partySize?: number;
    reservationTime?: string;
    createdAt?: string;
  };
}

export interface ConversationGroup {
  id: string;
  name: string;
  conversations: Conversation[];
  totalUnread: number;
  lastMessageTime?: string;
  activeCount: number;
}

interface UseConversationsResult {
  conversations: Conversation[];
  groupedConversations: ConversationGroup[];
  totalUnread: number;
  loading: boolean;
  refetch: () => void;
}

export function useConversations(
  userType: 'patron' | 'venue',
  userId?: string,
  venueId?: string
): UseConversationsResult {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    if (userType === 'patron' && !userId) return;
    if (userType === 'venue' && !venueId) return;

    setLoading(true);

    try {
      const allConversations: Conversation[] = [];
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      if (userType === 'patron') {
        // Fetch active orders + recently completed (last 24h) for patron
        const { data: orders } = await supabase
          .from('orders')
          .select('id, order_number, status, venue_id, user_id, updated_at, venues(name)')
          .eq('user_id', userId!)
          .eq('patron_dismissed', false)
          .or(`status.in.(awaiting_verification,placed,in_prep,ready),and(status.in.(collected,cancelled),updated_at.gte.${yesterday})`);

        // Fetch active waitlist entries + recently completed for patron
        const { data: waitlist } = await supabase
          .from('waitlist_entries')
          .select('id, customer_name, party_size, status, reservation_type, reservation_time, venue_id, user_id, updated_at, venues(name)')
          .eq('user_id', userId!)
          .eq('patron_dismissed', false)
          .or(`status.in.(waiting,ready),and(status.in.(seated,cancelled),updated_at.gte.${yesterday})`);

        // Fetch venue inquiries for patron
        const { data: inquiries } = await (supabase
          .from('venue_inquiries') as any)
          .select('id, venue_id, user_id, status, created_at, venues(name)')
          .eq('user_id', userId!)
          .eq('status', 'open');

        // Get unread counts and last messages for orders
        if (orders && orders.length > 0) {
          const orderIds = orders.map(o => o.id);
          
          const { data: orderMessages } = await supabase
            .from('messages')
            .select('order_id, message, created_at, read_at, sender_type')
            .in('order_id', orderIds)
            .order('created_at', { ascending: false });

          orders.forEach(order => {
            const messages = orderMessages?.filter(m => m.order_id === order.id) || [];
            
            // Skip items with no messages
            if (messages.length === 0) return;
            
            const unreadCount = messages.filter(m => !m.read_at && m.sender_type !== 'patron').length;
            const lastMsg = messages[0];

            allConversations.push({
              id: `order-${order.id}`,
              type: 'order',
              referenceId: order.id,
              venueName: (order.venues as any)?.name || 'Unknown Venue',
              venueId: order.venue_id,
              customerId: order.user_id || undefined,
              status: order.status,
              lastMessage: lastMsg?.message,
              lastMessageTime: lastMsg?.created_at,
              unreadCount,
              metadata: {
                orderNumber: order.order_number,
              },
            });
          });
        }

        // Get unread counts and last messages for waitlist
        if (waitlist && waitlist.length > 0) {
          const waitlistIds = waitlist.map(w => w.id);
          
          const { data: waitlistMessages } = await supabase
            .from('messages')
            .select('waitlist_entry_id, message, created_at, read_at, sender_type')
            .in('waitlist_entry_id', waitlistIds)
            .order('created_at', { ascending: false });

          waitlist.forEach(entry => {
            const messages = waitlistMessages?.filter(m => m.waitlist_entry_id === entry.id) || [];
            
            // Skip items with no messages
            if (messages.length === 0) return;
            
            const unreadCount = messages.filter(m => !m.read_at && m.sender_type !== 'patron').length;
            const lastMsg = messages[0];

            allConversations.push({
              id: `waitlist-${entry.id}`,
              type: entry.reservation_type === 'reservation' ? 'reservation' : 'waitlist',
              referenceId: entry.id,
              venueName: (entry.venues as any)?.name || 'Unknown Venue',
              venueId: entry.venue_id,
              customerName: entry.customer_name,
              customerId: entry.user_id || undefined,
              status: entry.status,
              lastMessage: lastMsg?.message,
              lastMessageTime: lastMsg?.created_at,
              unreadCount,
              metadata: {
                partySize: entry.party_size,
                reservationTime: entry.reservation_time || undefined,
              },
            });
          });
        }

        // Get unread counts and last messages for inquiries
        if (inquiries && inquiries.length > 0) {
          const inquiryIds = inquiries.map((i: any) => i.id);
          
          const { data: inquiryMessages } = await (supabase
            .from('messages') as any)
            .select('venue_inquiry_id, message, created_at, read_at, sender_type')
            .in('venue_inquiry_id', inquiryIds)
            .order('created_at', { ascending: false });

          inquiries.forEach((inquiry: any) => {
            const messages = inquiryMessages?.filter((m: any) => m.venue_inquiry_id === inquiry.id) || [];
            
            // Skip items with no messages
            if (messages.length === 0) return;
            
            const unreadCount = messages.filter((m: any) => !m.read_at && m.sender_type !== 'patron').length;
            const lastMsg = messages[0];

            allConversations.push({
              id: `inquiry-${inquiry.id}`,
              type: 'inquiry',
              referenceId: inquiry.id,
              venueName: inquiry.venues?.name || 'Unknown Venue',
              venueId: inquiry.venue_id,
              customerId: inquiry.user_id,
              status: inquiry.status,
              lastMessage: lastMsg?.message,
              lastMessageTime: lastMsg?.created_at,
              unreadCount,
              metadata: {
                createdAt: inquiry.created_at,
              },
            });
          });
        }
      } else {
        // Venue perspective - fetch all active + recently completed orders/waitlist for venue
        const { data: orders } = await supabase
          .from('orders')
          .select('id, order_number, status, customer_name, user_id, updated_at')
          .eq('venue_id', venueId!)
          .eq('merchant_dismissed', false)
          .or(`status.in.(awaiting_verification,placed,in_prep,ready),and(status.in.(collected,cancelled),updated_at.gte.${yesterday})`);

        const { data: waitlist } = await supabase
          .from('waitlist_entries')
          .select('id, customer_name, party_size, status, reservation_type, reservation_time, user_id, updated_at')
          .eq('venue_id', venueId!)
          .or(`status.in.(waiting,ready),and(status.in.(seated,cancelled),updated_at.gte.${yesterday})`);

        // Fetch venue inquiries for this venue
        const { data: inquiries } = await (supabase
          .from('venue_inquiries') as any)
          .select('id, user_id, status, created_at')
          .eq('venue_id', venueId!)
          .eq('status', 'open');

        // Get profile names for all users (orders, waitlist, inquiries)
        const userIds = new Set<string>();
        orders?.forEach(o => o.user_id && userIds.add(o.user_id));
        waitlist?.forEach(w => w.user_id && userIds.add(w.user_id));
        inquiries?.forEach((i: any) => i.user_id && userIds.add(i.user_id));
        
        let profileMap: Record<string, string> = {};
        if (userIds.size > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', Array.from(userIds));
          if (profiles) {
            profiles.forEach(p => {
              profileMap[p.id] = p.full_name;
            });
          }
        }

        // Get unread counts for orders
        if (orders && orders.length > 0) {
          const orderIds = orders.map(o => o.id);
          
          const { data: orderMessages } = await supabase
            .from('messages')
            .select('order_id, message, created_at, read_at, sender_type')
            .in('order_id', orderIds)
            .order('created_at', { ascending: false });

          orders.forEach(order => {
            const messages = orderMessages?.filter(m => m.order_id === order.id) || [];
            
            // Skip items with no messages
            if (messages.length === 0) return;
            
            const unreadCount = messages.filter(m => !m.read_at && m.sender_type !== 'venue').length;
            const lastMsg = messages[0];

            // Get customer name from profile or fallback to order customer_name
            const customerName = order.user_id 
              ? profileMap[order.user_id] || order.customer_name || 'Guest'
              : order.customer_name || 'Guest';

            allConversations.push({
              id: `order-${order.id}`,
              type: 'order',
              referenceId: order.id,
              venueName: '',
              venueId: venueId!,
              customerName,
              customerId: order.user_id || undefined,
              status: order.status,
              lastMessage: lastMsg?.message,
              lastMessageTime: lastMsg?.created_at,
              unreadCount,
              metadata: {
                orderNumber: order.order_number,
              },
            });
          });
        }

        // Get unread counts for waitlist
        if (waitlist && waitlist.length > 0) {
          const waitlistIds = waitlist.map(w => w.id);
          
          const { data: waitlistMessages } = await supabase
            .from('messages')
            .select('waitlist_entry_id, message, created_at, read_at, sender_type')
            .in('waitlist_entry_id', waitlistIds)
            .order('created_at', { ascending: false });

          waitlist.forEach(entry => {
            const messages = waitlistMessages?.filter(m => m.waitlist_entry_id === entry.id) || [];
            
            // Skip items with no messages
            if (messages.length === 0) return;
            
            const unreadCount = messages.filter(m => !m.read_at && m.sender_type !== 'venue').length;
            const lastMsg = messages[0];

            // Get customer name from profile or fallback
            const customerName = entry.user_id 
              ? profileMap[entry.user_id] || entry.customer_name || 'Guest'
              : entry.customer_name || 'Guest';

            allConversations.push({
              id: `waitlist-${entry.id}`,
              type: entry.reservation_type === 'reservation' ? 'reservation' : 'waitlist',
              referenceId: entry.id,
              venueName: '',
              venueId: venueId!,
              customerName,
              customerId: entry.user_id || undefined,
              status: entry.status,
              lastMessage: lastMsg?.message,
              lastMessageTime: lastMsg?.created_at,
              unreadCount,
              metadata: {
                partySize: entry.party_size,
                reservationTime: entry.reservation_time || undefined,
              },
            });
          });
        }

        // Get unread counts for inquiries
        if (inquiries && inquiries.length > 0) {
          const inquiryIds = inquiries.map((i: any) => i.id);
          
          const { data: inquiryMessages } = await (supabase
            .from('messages') as any)
            .select('venue_inquiry_id, message, created_at, read_at, sender_type')
            .in('venue_inquiry_id', inquiryIds)
            .order('created_at', { ascending: false });

          inquiries.forEach((inquiry: any) => {
            const messages = inquiryMessages?.filter((m: any) => m.venue_inquiry_id === inquiry.id) || [];
            
            // Skip items with no messages
            if (messages.length === 0) return;
            
            const unreadCount = messages.filter((m: any) => !m.read_at && m.sender_type !== 'venue').length;
            const lastMsg = messages[0];

            allConversations.push({
              id: `inquiry-${inquiry.id}`,
              type: 'inquiry',
              referenceId: inquiry.id,
              venueName: '',
              venueId: venueId!,
              customerName: profileMap[inquiry.user_id] || 'Guest',
              customerId: inquiry.user_id,
              status: inquiry.status,
              lastMessage: lastMsg?.message,
              lastMessageTime: lastMsg?.created_at,
              unreadCount,
              metadata: {
                createdAt: inquiry.created_at,
              },
            });
          });
        }
      }

      // Sort by unread first, then by last message time
      allConversations.sort((a, b) => {
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
        if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
        if (a.lastMessageTime && b.lastMessageTime) {
          return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
        }
        return 0;
      });

      setConversations(allConversations);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();

    // Set up real-time subscriptions
    const channels: ReturnType<typeof supabase.channel>[] = [];

    // Listen for message changes
    const messagesChannel = supabase
      .channel(`conversations-messages-${userId || venueId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages'
      }, () => {
        fetchConversations();
      })
      .subscribe();
    channels.push(messagesChannel);

    // Listen for order changes
    const ordersChannel = supabase
      .channel(`conversations-orders-${userId || venueId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders'
      }, () => {
        fetchConversations();
      })
      .subscribe();
    channels.push(ordersChannel);

    // Listen for waitlist changes
    const waitlistChannel = supabase
      .channel(`conversations-waitlist-${userId || venueId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'waitlist_entries'
      }, () => {
        fetchConversations();
      })
      .subscribe();
    channels.push(waitlistChannel);

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [userType, userId, venueId]);

  // Group conversations by customer (for venue) or venue (for patron)
  const groupedConversations = useMemo(() => {
    const groups: Map<string, ConversationGroup> = new Map();

    conversations.forEach(conv => {
      const groupKey = userType === 'patron' ? conv.venueId : (conv.customerId || 'guest');
      const groupName = userType === 'patron' ? conv.venueName : (conv.customerName || 'Guest');
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          id: groupKey,
          name: groupName,
          conversations: [],
          totalUnread: 0,
          lastMessageTime: undefined,
          activeCount: 0,
        });
      }
      
      const group = groups.get(groupKey)!;
      group.conversations.push(conv);
      group.totalUnread += conv.unreadCount;
      
      // Check if conversation is active (not completed)
      const isActive = ['waiting', 'ready', 'awaiting_verification', 'placed', 'in_prep', 'open'].includes(conv.status);
      if (isActive) {
        group.activeCount++;
      }
      
      // Update last message time
      if (conv.lastMessageTime) {
        if (!group.lastMessageTime || new Date(conv.lastMessageTime) > new Date(group.lastMessageTime)) {
          group.lastMessageTime = conv.lastMessageTime;
        }
      }
    });

    // Convert to array and sort by unread then last message time
    return Array.from(groups.values()).sort((a, b) => {
      if (a.totalUnread > 0 && b.totalUnread === 0) return -1;
      if (a.totalUnread === 0 && b.totalUnread > 0) return 1;
      if (a.lastMessageTime && b.lastMessageTime) {
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
      }
      return 0;
    });
  }, [conversations, userType]);

  const totalUnread = useMemo(() => 
    conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations]
  );

  return {
    conversations,
    groupedConversations,
    totalUnread,
    loading,
    refetch: fetchConversations,
  };
}
