import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useAuth";

interface UserRole {
  role: AppRole;
  venue_id: string | null;
  venue_name?: string;
}

interface VenueNotification {
  id: string;
  venueId: string;
  venueName: string;
  type: 'order' | 'waitlist' | 'reservation';
  message: string;
  timestamp: Date;
}

interface VenueNotificationBellProps {
  allVenues: UserRole[];
  currentVenueId: string;
  onVenueChange: (venueId: string) => void;
}

export const VenueNotificationBell = ({ 
  allVenues, 
  currentVenueId, 
  onVenueChange 
}: VenueNotificationBellProps) => {
  const [notifications, setNotifications] = useState<VenueNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const processedIds = useRef<Set<string>>(new Set());

  // Create a map of venue IDs to names for quick lookup
  const venueNameMap = allVenues.reduce((acc, venue) => {
    if (venue.venue_id) {
      acc[venue.venue_id] = venue.venue_name || 'Unknown Venue';
    }
    return acc;
  }, {} as Record<string, string>);

  const addNotification = (notification: Omit<VenueNotification, 'id' | 'timestamp'>) => {
    const newNotification: VenueNotification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    setNotifications(prev => [newNotification, ...prev].slice(0, 50)); // Keep max 50 notifications
  };

  // Subscribe to real-time updates for all venues
  useEffect(() => {
    if (allVenues.length <= 1) return;

    const venueIds = allVenues.map(v => v.venue_id).filter(Boolean) as string[];
    
    // Subscribe to orders across all venues
    const ordersChannel = supabase
      .channel('multi-venue-orders-bell')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'orders',
      }, (payload) => {
        const venueId = (payload.new as any)?.venue_id as string;
        const orderNumber = (payload.new as any)?.order_number as string;
        const orderId = (payload.new as any)?.id as string;
        
        // Only add notification if it's from a different venue and we have access
        if (venueId && venueId !== currentVenueId && venueIds.includes(venueId)) {
          // Prevent duplicates
          if (processedIds.current.has(orderId)) return;
          processedIds.current.add(orderId);
          setTimeout(() => processedIds.current.delete(orderId), 30000);
          
          addNotification({
            venueId,
            venueName: venueNameMap[venueId] || 'Unknown Venue',
            type: 'order',
            message: `New order #${orderNumber}`,
          });
        }
      })
      .subscribe();

    // Subscribe to waitlist entries across all venues
    const waitlistChannel = supabase
      .channel('multi-venue-waitlist-bell')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'waitlist_entries',
      }, (payload) => {
        const venueId = (payload.new as any)?.venue_id as string;
        const customerName = (payload.new as any)?.customer_name as string;
        const partySize = (payload.new as any)?.party_size as number;
        const reservationType = (payload.new as any)?.reservation_type as string;
        const entryId = (payload.new as any)?.id as string;
        
        // Only add notification if it's from a different venue and we have access
        if (venueId && venueId !== currentVenueId && venueIds.includes(venueId)) {
          // Prevent duplicates
          if (processedIds.current.has(entryId)) return;
          processedIds.current.add(entryId);
          setTimeout(() => processedIds.current.delete(entryId), 30000);
          
          const type = reservationType === 'reservation' ? 'reservation' : 'waitlist';
          const message = type === 'reservation' 
            ? `New reservation for ${partySize}` 
            : `${customerName} joined waitlist`;
          
          addNotification({
            venueId,
            venueName: venueNameMap[venueId] || 'Unknown Venue',
            type,
            message,
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(waitlistChannel);
    };
  }, [allVenues, currentVenueId, venueNameMap]);

  const handleNotificationClick = (notification: VenueNotification) => {
    onVenueChange(notification.venueId);
    setNotifications(prev => prev.filter(n => n.id !== notification.id));
    setIsOpen(false);
  };

  const handleClearAll = () => {
    setNotifications([]);
    setIsOpen(false);
  };

  const getTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const getTypeIcon = (type: VenueNotification['type']) => {
    switch (type) {
      case 'order': return '🍽️';
      case 'waitlist': return '👥';
      case 'reservation': return '📅';
    }
  };

  // Group notifications by venue
  const groupedNotifications = notifications.reduce((acc, notification) => {
    if (!acc[notification.venueName]) {
      acc[notification.venueName] = [];
    }
    acc[notification.venueName].push(notification);
    return acc;
  }, {} as Record<string, VenueNotification[]>);

  if (allVenues.length <= 1) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {notifications.length > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 min-w-5 px-1.5 text-xs"
            >
              {notifications.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4" /> Notifications
          </span>
          {notifications.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleClearAll}
            >
              Clear All
            </Button>
          )}
        </div>
        
        {notifications.length === 0 ? (
          <div className="px-3 py-6 text-center text-muted-foreground text-sm">
            No new notifications from other venues
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            {Object.entries(groupedNotifications).map(([venueName, venueNotifications], index) => (
              <div key={venueName}>
                {index > 0 && <DropdownMenuSeparator />}
                <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">
                  {venueName}
                </div>
                {venueNotifications.map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className="cursor-pointer px-3 py-2"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="flex items-center gap-2">
                        <span>{getTypeIcon(notification.type)}</span>
                        <span className="text-sm">{notification.message}</span>
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {getTimeAgo(notification.timestamp)}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </div>
            ))}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
