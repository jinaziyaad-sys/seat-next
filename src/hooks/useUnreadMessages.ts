import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUnreadMessages(
  waitlistEntryId?: string, 
  orderId?: string, 
  venueInquiryId?: string,
  userType?: 'patron' | 'venue'
) {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    if ((!waitlistEntryId && !orderId && !venueInquiryId) || !userType) return;
    
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
      } else if (venueInquiryId) {
        query = query.eq('venue_inquiry_id', venueInquiryId);
      }
      
      const { count: unreadCount } = await query;
      setCount(unreadCount || 0);
    };
    
    fetchCount();
    
    // Real-time subscription for new messages
    const filter = waitlistEntryId 
      ? `waitlist_entry_id=eq.${waitlistEntryId}`
      : orderId
        ? `order_id=eq.${orderId}`
        : `venue_inquiry_id=eq.${venueInquiryId}`;
    
    const channel = supabase
      .channel(`unread-messages-${waitlistEntryId || orderId || venueInquiryId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter
      }, () => {
        // Refetch count on any change
        fetchCount();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [waitlistEntryId, orderId, venueInquiryId, userType]);
  
  return count;
}

// Hook to get unread counts for multiple entries at once
export function useMultipleUnreadMessages(
  entries: Array<{ waitlistEntryId?: string; orderId?: string; venueInquiryId?: string }>,
  userType: 'patron' | 'venue'
) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  
  useEffect(() => {
    if (entries.length === 0 || !userType) return;
    
    const fetchCounts = async () => {
      const waitlistIds = entries.filter(e => e.waitlistEntryId).map(e => e.waitlistEntryId!);
      const orderIds = entries.filter(e => e.orderId).map(e => e.orderId!);
      const inquiryIds = entries.filter(e => e.venueInquiryId).map(e => e.venueInquiryId!);
      
      const newCounts: Record<string, number> = {};
      
      // Fetch counts for waitlist entries
      if (waitlistIds.length > 0) {
        const { data } = await supabase
          .from('messages')
          .select('waitlist_entry_id')
          .is('read_at', null)
          .neq('sender_type', userType)
          .in('waitlist_entry_id', waitlistIds);
        
        if (data) {
          data.forEach(m => {
            const id = m.waitlist_entry_id;
            if (id) {
              newCounts[id] = (newCounts[id] || 0) + 1;
            }
          });
        }
      }
      
      // Fetch counts for orders
      if (orderIds.length > 0) {
        const { data } = await supabase
          .from('messages')
          .select('order_id')
          .is('read_at', null)
          .neq('sender_type', userType)
          .in('order_id', orderIds);
        
        if (data) {
          data.forEach(m => {
            const id = m.order_id;
            if (id) {
              newCounts[id] = (newCounts[id] || 0) + 1;
            }
          });
        }
      }
      
      // Fetch counts for venue inquiries
      if (inquiryIds.length > 0) {
        const { data } = await supabase
          .from('messages')
          .select('venue_inquiry_id')
          .is('read_at', null)
          .neq('sender_type', userType)
          .in('venue_inquiry_id', inquiryIds);
        
        if (data) {
          data.forEach(m => {
            const id = (m as any).venue_inquiry_id;
            if (id) {
              newCounts[id] = (newCounts[id] || 0) + 1;
            }
          });
        }
      }
      
      setCounts(newCounts);
    };
    
    fetchCounts();
    
    // Set up real-time subscriptions
    const channels: ReturnType<typeof supabase.channel>[] = [];
    
    // Single subscription for the messages table
    const channel = supabase
      .channel('unread-messages-multi')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages'
      }, () => {
        fetchCounts();
      })
      .subscribe();
    
    channels.push(channel);
    
    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [entries, userType]);
  
  return counts;
}
