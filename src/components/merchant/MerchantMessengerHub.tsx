import { useState } from "react";
import { MessageSquare, ChefHat, Users, Calendar, ArrowLeft, HelpCircle, User, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Messenger } from "@/components/Messenger";
import { GroupedMessenger } from "@/components/GroupedMessenger";
import { useConversations, type Conversation, type ConversationGroup } from "@/hooks/useConversations";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface MerchantMessengerHubProps {
  venueId: string;
  userId: string;
}

function GroupCard({ 
  group, 
  onClick 
}: { 
  group: ConversationGroup; 
  onClick: () => void;
}) {
  const getItemsSummary = () => {
    const counts: string[] = [];
    const orders = group.conversations.filter(c => c.type === 'order').length;
    const reservations = group.conversations.filter(c => c.type === 'reservation').length;
    const waitlist = group.conversations.filter(c => c.type === 'waitlist').length;
    const inquiries = group.conversations.filter(c => c.type === 'inquiry').length;
    
    if (orders > 0) counts.push(`${orders} order${orders > 1 ? 's' : ''}`);
    if (reservations > 0) counts.push(`${reservations} reservation${reservations > 1 ? 's' : ''}`);
    if (waitlist > 0) counts.push(`${waitlist} waitlist`);
    if (inquiries > 0) counts.push(`${inquiries} inquir${inquiries > 1 ? 'ies' : 'y'}`);
    
    return counts.join(' + ');
  };

  const lastMessage = group.conversations
    .filter(c => c.lastMessage)
    .sort((a, b) => {
      if (!a.lastMessageTime || !b.lastMessageTime) return 0;
      return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
    })[0];

  return (
    <button 
      onClick={onClick} 
      className="w-full p-4 hover:bg-muted/50 border-b border-border transition-colors text-left"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full shrink-0 bg-primary/10">
          <User className="h-5 w-5 text-primary" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium truncate">{group.name}</span>
            <div className="flex items-center gap-2 shrink-0">
              {group.totalUnread > 0 && (
                <Badge variant="destructive" className="h-5 min-w-[20px]">
                  {group.totalUnread}
                </Badge>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground">
            {getItemsSummary()}
          </p>
          
          {lastMessage?.lastMessage && (
            <p className="text-sm text-muted-foreground truncate mt-1">
              {lastMessage.lastMessage}
            </p>
          )}
        </div>
      </div>
    </button>
  );
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
      case 'inquiry': return HelpCircle;
      default: return Users;
    }
  };
  const Icon = getIcon();

  const getSubtitle = () => {
    if (conversation.type === 'order') {
      return `Order #${conversation.metadata.orderNumber} • ${conversation.status}`;
    }
    if (conversation.type === 'reservation' && conversation.metadata.reservationTime) {
      return `Reservation • ${format(new Date(conversation.metadata.reservationTime), 'MMM d, HH:mm')}`;
    }
    if (conversation.type === 'inquiry' && conversation.metadata.createdAt) {
      return `Pre-booking inquiry • ${format(new Date(conversation.metadata.createdAt), 'MMM d')}`;
    }
    if (conversation.type === 'inquiry') {
      return 'Pre-booking inquiry';
    }
    return `Waitlist • Party of ${conversation.metadata.partySize}`;
  };

  return (
    <button 
      onClick={onClick} 
      className="w-full p-3 hover:bg-muted/50 border-b border-border transition-colors text-left"
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "p-2 rounded-full shrink-0",
          conversation.type === 'inquiry' ? "bg-accent/20" : "bg-primary/10"
        )}>
          <Icon className={cn(
            "h-4 w-4",
            conversation.type === 'inquiry' ? "text-accent" : "text-primary"
          )} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm truncate">{getSubtitle()}</span>
            {conversation.unreadCount > 0 && (
              <Badge variant="destructive" className="h-5 min-w-[20px] shrink-0">
                {conversation.unreadCount}
              </Badge>
            )}
          </div>
          
          {conversation.lastMessage && (
            <p className="text-sm text-muted-foreground truncate">
              {conversation.lastMessage}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

type ViewMode = 'groups' | 'group-detail' | 'chat' | 'unified';

export function MerchantMessengerHub({ venueId, userId }: MerchantMessengerHubProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('groups');
  const [selectedGroup, setSelectedGroup] = useState<ConversationGroup | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const { groupedConversations, totalUnread, loading } = useConversations('venue', undefined, venueId);

  const handleOpenGroup = (group: ConversationGroup) => {
    setSelectedGroup(group);
    // If only one conversation in group, go directly to chat
    if (group.conversations.length === 1) {
      setSelectedConversation(group.conversations[0]);
      setViewMode('chat');
    } else {
      setViewMode('group-detail');
    }
  };

  const handleOpenUnifiedChat = () => {
    if (selectedGroup) {
      setViewMode('unified');
    }
  };

  const handleOpenConversation = (conv: Conversation) => {
    setSelectedConversation(conv);
    setViewMode('chat');
  };

  const handleBack = () => {
    if (viewMode === 'chat' && selectedGroup && selectedGroup.conversations.length > 1) {
      setSelectedConversation(null);
      setViewMode('group-detail');
    } else if (viewMode === 'unified') {
      setViewMode('group-detail');
    } else {
      setSelectedConversation(null);
      setSelectedGroup(null);
      setViewMode('groups');
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setViewMode('groups');
    setSelectedGroup(null);
    setSelectedConversation(null);
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="p-6 text-center text-muted-foreground">
          Loading conversations...
        </div>
      );
    }

    if (groupedConversations.length === 0) {
      return (
        <div className="p-6 text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground font-medium">No active conversations</p>
          <p className="text-sm text-muted-foreground mt-1">
            Messages from customers will appear here.
          </p>
        </div>
      );
    }

    switch (viewMode) {
      case 'groups':
        return groupedConversations.map(group => (
          <GroupCard
            key={group.id}
            group={group}
            onClick={() => handleOpenGroup(group)}
          />
        ));
      
      case 'group-detail':
        if (!selectedGroup) return null;
        return (
          <div className="flex flex-col h-full">
            {/* Tabs for switching between threads and unified view */}
            <div className="px-4 py-2 border-b">
              <Tabs defaultValue="threads" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="threads">Threads</TabsTrigger>
                  <TabsTrigger value="all" onClick={handleOpenUnifiedChat}>All Messages</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            <ScrollArea className="flex-1">
              {selectedGroup.conversations.map(conv => (
                <ConversationCard
                  key={conv.id}
                  conversation={conv}
                  onClick={() => handleOpenConversation(conv)}
                />
              ))}
            </ScrollArea>
          </div>
        );
      
      case 'unified':
        if (!selectedGroup) return null;
        return (
          <GroupedMessenger
            conversations={selectedGroup.conversations}
            userType="venue"
            userId={userId}
            entityName={selectedGroup.name}
          />
        );
      
      case 'chat':
        if (!selectedConversation) return null;
        return (
          <Messenger
            open={true}
            onOpenChange={() => handleBack()}
            waitlistEntryId={selectedConversation.type === 'waitlist' || selectedConversation.type === 'reservation' ? selectedConversation.referenceId : undefined}
            orderId={selectedConversation.type === 'order' ? selectedConversation.referenceId : undefined}
            venueInquiryId={selectedConversation.type === 'inquiry' ? selectedConversation.referenceId : undefined}
            userType="venue"
            userId={userId}
            customerName={selectedConversation.customerName}
            embedded={true}
          />
        );
    }
  };

  const getTitle = () => {
    switch (viewMode) {
      case 'groups':
        return 'Customer Messages';
      case 'group-detail':
        return selectedGroup?.name || 'Customer';
      case 'unified':
        return `All with ${selectedGroup?.name}`;
      case 'chat':
        return selectedConversation?.type === 'order' 
          ? `Order #${selectedConversation.metadata.orderNumber}`
          : selectedConversation?.type === 'reservation'
            ? 'Reservation'
            : selectedConversation?.type === 'inquiry'
              ? 'Inquiry'
              : 'Waitlist';
    }
  };

  return (
    <>
      {/* Floating button */}
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

      {/* Main sheet */}
      <Sheet open={isOpen} onOpenChange={handleClose}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-4 pb-3 border-b shrink-0">
            <div className="flex items-center gap-3">
              {viewMode !== 'groups' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleBack}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <SheetTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-5 w-5" />
                {getTitle()}
              </SheetTitle>
            </div>
          </SheetHeader>
          
          <div className="flex-1 overflow-hidden">
            {viewMode === 'groups' || viewMode === 'group-detail' ? (
              <ScrollArea className="h-full">
                {renderContent()}
              </ScrollArea>
            ) : (
              renderContent()
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
