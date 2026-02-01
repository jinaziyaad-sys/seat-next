import { useState, useEffect, useRef, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, Loader2, ChefHat, Calendar, Users, HelpCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Conversation } from "@/hooks/useConversations";

interface GroupedMessage {
  id: string;
  sender_type: 'patron' | 'venue' | 'system';
  sender_id: string;
  message: string;
  read_at: string | null;
  created_at: string;
  // Context info
  contextType: 'order' | 'waitlist' | 'reservation' | 'inquiry';
  contextLabel: string;
  contextId: string;
}

interface GroupedMessengerProps {
  conversations: Conversation[];
  userType: 'patron' | 'venue';
  userId: string;
  entityName: string; // Venue name (for patron) or Customer name (for merchant)
  onSelectConversation?: (conv: Conversation) => void;
}

export function GroupedMessenger({
  conversations,
  userType,
  userId,
  entityName,
  onSelectConversation,
}: GroupedMessengerProps) {
  const [messages, setMessages] = useState<GroupedMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [selectedContext, setSelectedContext] = useState<Conversation | null>(
    conversations.length > 0 ? conversations[0] : null
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Update selected context when conversations change
  useEffect(() => {
    if (conversations.length > 0 && !selectedContext) {
      setSelectedContext(conversations[0]);
    }
  }, [conversations, selectedContext]);

  const getContextLabel = (conv: Conversation): string => {
    switch (conv.type) {
      case 'order':
        return `Order #${conv.metadata.orderNumber}`;
      case 'reservation':
        return conv.metadata.reservationTime 
          ? `Reservation ${format(new Date(conv.metadata.reservationTime), 'MMM d')}`
          : 'Reservation';
      case 'inquiry':
        return 'Inquiry';
      default:
        return `Waitlist (${conv.metadata.partySize})`;
    }
  };

  const getContextIcon = (type: string) => {
    switch (type) {
      case 'order': return ChefHat;
      case 'reservation': return Calendar;
      case 'inquiry': return HelpCircle;
      default: return Users;
    }
  };

  // Fetch all messages from all conversations in this group
  const fetchMessages = useCallback(async () => {
    if (conversations.length === 0) {
      setIsLoading(false);
      return;
    }

    const allMessages: GroupedMessage[] = [];

    // Collect IDs by type
    const orderIds = conversations.filter(c => c.type === 'order').map(c => c.referenceId);
    const waitlistIds = conversations.filter(c => c.type === 'waitlist' || c.type === 'reservation').map(c => c.referenceId);
    const inquiryIds = conversations.filter(c => c.type === 'inquiry').map(c => c.referenceId);

    // Fetch messages for each type
    if (orderIds.length > 0) {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .in('order_id', orderIds)
        .order('created_at', { ascending: true });
      
      data?.forEach(msg => {
        const conv = conversations.find(c => c.type === 'order' && c.referenceId === msg.order_id);
        if (conv) {
          allMessages.push({
            ...msg,
            sender_type: msg.sender_type as 'patron' | 'venue' | 'system',
            contextType: 'order',
            contextLabel: getContextLabel(conv),
            contextId: conv.referenceId,
          });
        }
      });
    }

    if (waitlistIds.length > 0) {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .in('waitlist_entry_id', waitlistIds)
        .order('created_at', { ascending: true });
      
      data?.forEach(msg => {
        const conv = conversations.find(c => 
          (c.type === 'waitlist' || c.type === 'reservation') && 
          c.referenceId === msg.waitlist_entry_id
        );
        if (conv) {
          allMessages.push({
            ...msg,
            sender_type: msg.sender_type as 'patron' | 'venue' | 'system',
            contextType: conv.type as 'waitlist' | 'reservation',
            contextLabel: getContextLabel(conv),
            contextId: conv.referenceId,
          });
        }
      });
    }

    if (inquiryIds.length > 0) {
      const { data } = await (supabase.from('messages') as any)
        .select('*')
        .in('venue_inquiry_id', inquiryIds)
        .order('created_at', { ascending: true });
      
      data?.forEach((msg: any) => {
        const conv = conversations.find(c => c.type === 'inquiry' && c.referenceId === msg.venue_inquiry_id);
        if (conv) {
          allMessages.push({
            ...msg,
            sender_type: msg.sender_type as 'patron' | 'venue' | 'system',
            contextType: 'inquiry',
            contextLabel: getContextLabel(conv),
            contextId: conv.referenceId,
          });
        }
      });
    }

    // Sort all messages by created_at
    allMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    setMessages(allMessages);
    setIsLoading(false);

    // Mark unread messages as read
    const unreadIds = allMessages
      .filter(m => !m.read_at && m.sender_type !== userType)
      .map(m => m.id);
    
    if (unreadIds.length > 0) {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadIds);
    }
  }, [conversations, userType]);

  // Initial fetch and polling
  useEffect(() => {
    fetchMessages();

    // Set up polling fallback (every 5 seconds)
    pollingIntervalRef.current = setInterval(fetchMessages, 5000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [fetchMessages]);

  // Real-time subscription
  useEffect(() => {
    if (conversations.length === 0) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];

    // Subscribe to messages for each conversation
    conversations.forEach(conv => {
      const filter = conv.type === 'order'
        ? `order_id=eq.${conv.referenceId}`
        : conv.type === 'inquiry'
          ? `venue_inquiry_id=eq.${conv.referenceId}`
          : `waitlist_entry_id=eq.${conv.referenceId}`;

      const channel = supabase
        .channel(`grouped-messages-${conv.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter
        }, () => {
          fetchMessages();
        })
        .subscribe();
      
      channels.push(channel);
    });

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [conversations, fetchMessages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || isSending || !selectedContext) return;
    
    setIsSending(true);
    
    const messageData: any = {
      sender_type: userType,
      sender_id: userId,
      message: newMessage.trim(),
      waitlist_entry_id: null,
      order_id: null,
      venue_inquiry_id: null,
    };

    // Set the appropriate reference ID
    if (selectedContext.type === 'order') {
      messageData.order_id = selectedContext.referenceId;
    } else if (selectedContext.type === 'waitlist' || selectedContext.type === 'reservation') {
      messageData.waitlist_entry_id = selectedContext.referenceId;
    } else if (selectedContext.type === 'inquiry') {
      messageData.venue_inquiry_id = selectedContext.referenceId;
    }
    
    const { error } = await supabase.from('messages').insert(messageData);
    
    if (error) {
      console.error('Error sending message:', error);
    } else {
      setNewMessage("");
      fetchMessages();
    }
    
    setIsSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Group messages by date for display
  const messagesByDate = messages.reduce((acc, msg) => {
    const date = format(new Date(msg.created_at), 'yyyy-MM-dd');
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {} as Record<string, GroupedMessage[]>);

  return (
    <div className="flex flex-col h-full">
      {/* Context selector for sending - only show if multiple conversations */}
      {conversations.length > 1 && (
        <div className="px-4 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Reply to:</span>
            <div className="flex gap-1 flex-wrap">
              {conversations.map(conv => {
                const Icon = getContextIcon(conv.type);
                const isSelected = selectedContext?.id === conv.id;
                return (
                  <Button
                    key={conv.id}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="h-6 text-xs gap-1"
                    onClick={() => setSelectedContext(conv)}
                  >
                    <Icon className="h-3 w-3" />
                    {getContextLabel(conv)}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="font-medium">No messages yet</p>
              <p className="text-sm">Start a conversation with {entityName}!</p>
            </div>
          ) : (
            Object.entries(messagesByDate).map(([date, dayMessages]) => (
              <div key={date}>
                {/* Date separator */}
                <div className="flex items-center justify-center my-4">
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    {format(new Date(date), 'MMMM d, yyyy')}
                  </span>
                </div>
                
                {/* Messages for this date */}
                <div className="space-y-3">
                  {dayMessages.map((msg, idx) => {
                    const Icon = getContextIcon(msg.contextType);
                    const showContextLabel = idx === 0 || 
                      dayMessages[idx - 1]?.contextId !== msg.contextId;
                    
                    return (
                      <div key={msg.id}>
                        {/* Context label when switching between conversations */}
                        {showContextLabel && conversations.length > 1 && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1 ml-1">
                            <Icon className="h-3 w-3" />
                            <span>{msg.contextLabel}</span>
                          </div>
                        )}
                        
                        <div 
                          className={cn(
                            "max-w-[80%] p-3 rounded-2xl",
                            msg.sender_type === userType 
                              ? "ml-auto bg-primary text-primary-foreground rounded-br-sm"
                              : msg.sender_type === 'system'
                                ? "mx-auto bg-muted text-muted-foreground text-center text-sm italic max-w-[90%]"
                                : "bg-muted rounded-bl-sm"
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                          <p className={cn(
                            "text-[10px] mt-1",
                            msg.sender_type === userType 
                              ? "opacity-70" 
                              : "text-muted-foreground"
                          )}>
                            {format(new Date(msg.created_at), 'HH:mm')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      
      <div className="flex gap-2 p-4 border-t bg-background shrink-0">
        <Input
          ref={inputRef}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={selectedContext ? `Message about ${getContextLabel(selectedContext)}...` : "Type a message..."}
          onKeyDown={handleKeyDown}
          className="flex-1"
          disabled={isSending || !selectedContext}
        />
        <Button 
          onClick={sendMessage} 
          size="icon" 
          disabled={!newMessage.trim() || isSending || !selectedContext}
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
