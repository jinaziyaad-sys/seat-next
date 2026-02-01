import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Conversation {
  id: string;
  type: 'order' | 'waitlist' | 'reservation';
  referenceId: string;
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

interface UseConversationsResult {
  conversations: Conversation[];
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

      if (userType === 'patron') {
        // Fetch active orders for patron
        const { data: orders } = await supabase
          .from('orders')
          .select('id, order_number, status, venue_id, venues(name)')
          .eq('user_id', userId!)
          .eq('patron_dismissed', false)
          .in('status', ['awaiting_verification', 'placed', 'in_prep', 'ready']);

        // Fetch active waitlist entries for patron
        const { data: waitlist } = await supabase
          .from('waitlist_entries')
          .select('id, customer_name, party_size, status, reservation_type, reservation_time, venue_id, venues(name)')
          .eq('user_id', userId!)
          .eq('patron_dismissed', false)
          .in('status', ['waiting', 'ready']);

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
            const unreadCount = messages.filter(m => !m.read_at && m.sender_type !== 'patron').length;
            const lastMsg = messages[0];

            allConversations.push({
              id: `order-${order.id}`,
              type: 'order',
              referenceId: order.id,
              venueName: (order.venues as any)?.name || 'Unknown Venue',
              venueId: order.venue_id,
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
            const unreadCount = messages.filter(m => !m.read_at && m.sender_type !== 'patron').length;
            const lastMsg = messages[0];

            allConversations.push({
              id: `waitlist-${entry.id}`,
              type: entry.reservation_type === 'reservation' ? 'reservation' : 'waitlist',
              referenceId: entry.id,
              venueName: (entry.venues as any)?.name || 'Unknown Venue',
              venueId: entry.venue_id,
              customerName: entry.customer_name,
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
      } else {
        // Venue perspective - fetch all active orders and waitlist for venue
        const { data: orders } = await supabase
          .from('orders')
          .select('id, order_number, status, customer_name, user_id')
          .eq('venue_id', venueId!)
          .eq('merchant_dismissed', false)
          .in('status', ['awaiting_verification', 'placed', 'in_prep', 'ready']);

        const { data: waitlist } = await supabase
          .from('waitlist_entries')
          .select('id, customer_name, party_size, status, reservation_type, reservation_time')
          .eq('venue_id', venueId!)
          .in('status', ['waiting', 'ready']);

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
            const unreadCount = messages.filter(m => !m.read_at && m.sender_type !== 'venue').length;
            const lastMsg = messages[0];

            allConversations.push({
              id: `order-${order.id}`,
              type: 'order',
              referenceId: order.id,
              venueName: '',
              venueId: venueId!,
              customerName: order.customer_name || 'Guest',
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
            const unreadCount = messages.filter(m => !m.read_at && m.sender_type !== 'venue').length;
            const lastMsg = messages[0];

            allConversations.push({
              id: `waitlist-${entry.id}`,
              type: entry.reservation_type === 'reservation' ? 'reservation' : 'waitlist',
              referenceId: entry.id,
              venueName: '',
              venueId: venueId!,
              customerName: entry.customer_name,
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

  const totalUnread = useMemo(() => 
    conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations]
  );

  return {
    conversations,
    totalUnread,
    loading,
    refetch: fetchConversations,
  };
}
