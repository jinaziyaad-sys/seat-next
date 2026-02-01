import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  sender_type: 'patron' | 'venue' | 'system';
  sender_id: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

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
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input when sheet opens
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // Fetch messages and set up real-time subscription
  useEffect(() => {
    if (!open) return;
    if (!waitlistEntryId && !orderId) return;
    
    const fetchMessages = async () => {
      setIsLoading(true);
      
      let query = supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (waitlistEntryId) {
        query = query.eq('waitlist_entry_id', waitlistEntryId);
      } else if (orderId) {
        query = query.eq('order_id', orderId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching messages:', error);
      } else {
        setMessages((data || []) as Message[]);
        
        // Mark messages as read
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
      }
      
      setIsLoading(false);
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
        const newMsg = payload.new as Message;
        setMessages(prev => [...prev, newMsg]);
        
        // Auto-mark as read if chat is open and message is from other party
        if (newMsg.sender_type !== userType) {
          supabase
            .from('messages')
            .update({ read_at: new Date().toISOString() })
            .eq('id', newMsg.id);
        }
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [waitlistEntryId, orderId, open, userType]);

  const sendMessage = async () => {
    if (!newMessage.trim() || isSending) return;
    
    setIsSending(true);
    
    const messageData = {
      sender_type: userType as string,
      sender_id: userId,
      message: newMessage.trim(),
      waitlist_entry_id: waitlistEntryId || null,
      order_id: orderId || null
    };
    
    const { error } = await supabase.from('messages').insert(messageData);
    
    if (error) {
      console.error('Error sending message:', error);
    } else {
      setNewMessage("");
    }
    
    setIsSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const chatTitle = userType === 'patron' 
    ? `Chat with ${venueName || 'Restaurant'}` 
    : `Chat with ${customerName || 'Customer'}`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            {chatTitle}
          </SheetTitle>
        </SheetHeader>
        
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
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
        
        <div className="flex gap-2 p-4 border-t bg-background">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={handleKeyDown}
            className="flex-1"
            disabled={isSending}
          />
          <Button 
            onClick={sendMessage} 
            size="icon" 
            disabled={!newMessage.trim() || isSending}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
