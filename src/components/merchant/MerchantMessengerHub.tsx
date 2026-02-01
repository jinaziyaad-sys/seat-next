import { useState } from "react";
import { MessageSquare, ChefHat, Users, Calendar, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Messenger } from "@/components/Messenger";
import { useConversations, type Conversation } from "@/hooks/useConversations";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface MerchantMessengerHubProps {
  venueId: string;
  userId: string;
}

function ConversationCard({ 
  conversation, 
  onClick 
}: { 
  conversation: Conversation; 
  onClick: () => void;
}) {
  const getIcon = () => {
    switch (conversation.type) {
      case 'order': return ChefHat;
      case 'reservation': return Calendar;
      default: return Users;
    }
  };
  const Icon = getIcon();

  const getSubtitle = () => {
    if (conversation.type === 'order') {
      return `Order #${conversation.metadata.orderNumber}`;
    }
    if (conversation.type === 'reservation' && conversation.metadata.reservationTime) {
      return `Reservation • ${format(new Date(conversation.metadata.reservationTime), 'MMM d, HH:mm')}`;
    }
    return `Waitlist • Party of ${conversation.metadata.partySize}`;
  };

  return (
    <button 
      onClick={onClick} 
      className="w-full p-4 hover:bg-muted/50 border-b border-border transition-colors text-left"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/10 rounded-full shrink-0">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium truncate">{conversation.customerName || 'Guest'}</span>
            {conversation.unreadCount > 0 && (
              <Badge variant="destructive" className="h-5 min-w-[20px] shrink-0">
                {conversation.unreadCount}
              </Badge>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground">
            {getSubtitle()}
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

export function MerchantMessengerHub({ venueId, userId }: MerchantMessengerHubProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const { conversations, totalUnread, loading } = useConversations('venue', undefined, venueId);

  const handleOpenConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
  };

  const handleBackToList = () => {
    setSelectedConversation(null);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedConversation(null);
  };

  return (
    <>
      {/* Floating button - positioned above Help button */}
      <Button
        onClick={() => setIsOpen(true)}
        size="icon"
        className={cn(
          "fixed bottom-24 right-6 z-50 h-14 w-14 rounded-full shadow-floating",
          "bg-primary text-primary-foreground hover:bg-primary/90",
          "transition-all duration-300 hover:scale-105"
        )}
        aria-label="Open messages"
      >
        <MessageSquare className="h-6 w-6" />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-xs text-white flex items-center justify-center font-medium">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </Button>

      {/* Conversation list sheet */}
      <Sheet open={isOpen && !selectedConversation} onOpenChange={handleClose}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0">
          <SheetHeader className="p-6 pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Customer Messages
            </SheetTitle>
          </SheetHeader>
          
          <ScrollArea className="h-[calc(100vh-100px)]">
            {loading ? (
              <div className="p-6 text-center text-muted-foreground">
                Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-muted-foreground font-medium">No active conversations</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Messages from customers will appear here.
                </p>
              </div>
            ) : (
              conversations.map(conv => (
                <ConversationCard
                  key={conv.id}
                  conversation={conv}
                  onClick={() => handleOpenConversation(conv)}
                />
              ))
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Individual chat sheet */}
      {selectedConversation && (
        <Sheet open={!!selectedConversation} onOpenChange={(open) => !open && handleBackToList()}>
          <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
            <SheetHeader className="p-4 pb-3 border-b shrink-0">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleBackToList}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <SheetTitle className="text-base">
                  Chat with {selectedConversation.customerName || 'Guest'}
                </SheetTitle>
              </div>
            </SheetHeader>
            
            <div className="flex-1 overflow-hidden">
              <Messenger
                open={true}
                onOpenChange={() => handleBackToList()}
                waitlistEntryId={selectedConversation.type !== 'order' ? selectedConversation.referenceId : undefined}
                orderId={selectedConversation.type === 'order' ? selectedConversation.referenceId : undefined}
                userType="venue"
                userId={userId}
                customerName={selectedConversation.customerName}
                embedded={true}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
