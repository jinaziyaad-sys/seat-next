import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FoodReadyFlow } from "@/components/FoodReadyFlow";
import { TableReadyFlow } from "@/components/TableReadyFlow";
import { ProfileSection } from "@/components/ProfileSection";
import { RatingDialog } from "@/components/RatingDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { VenueLogo } from "@/components/VenueLogo";
import { UtensilsCrossed, Users, MapPin, Clock, ChefHat, LogIn, User as UserIcon, Calendar as CalendarIcon, AlertTriangle, Info, X, Wrench, MessageSquare, Share2, Gift } from "lucide-react";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { cn, formatTimeUntil } from "@/lib/utils";
import { format, isTomorrow } from "date-fns";
import logo from "@/assets/logo.png";
import { useToast } from "@/hooks/use-toast";
import { HelpButton, HelpPanel, OnboardingTour } from "@/components/help";
import { MessengerHub } from "@/components/MessengerHub";
import { Messenger } from "@/components/Messenger";
import { NotificationPrompt } from "@/components/NotificationPrompt";
import { CelebrationOverlay } from "@/components/ui/celebration-overlay";
import { PromoBanner } from "@/components/PromoBanner";
import { PatronLoyaltyCard } from "@/components/PatronLoyaltyCard";
import { LoyaltyReadyFlow } from "@/components/LoyaltyReadyFlow";
import { ActivityFlow } from "@/components/ActivityFlow";
import { PhonePromptDialog } from "@/components/PhonePromptDialog";
import { TabNavigation } from "@/components/TabNavigation";
import { ActiveTrackingListSkeleton } from "@/components/ui/skeleton-card";
import { useMultipleUnreadMessages } from "@/hooks/useUnreadMessages";
import {
  playFoodReadySound, 
  playTableReadySound, 
  stopSoundForId, 
  initializeAudio,
  isSoundActive
} from "@/utils/notificationSound";

// Demo data for tour mode
const DEMO_ORDER = {
  id: 'demo-order-1',
  order_number: '42',
  status: 'in_prep',
  eta: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  confidence: 'high',
  venue_id: 'demo-venue',
  venues: { name: 'Demo Restaurant' },
  items: [{ name: 'Demo Burger' }],
  patron_dismissed: false,
};

const DEMO_WAITLIST = {
  id: 'demo-waitlist-1',
  customer_name: 'Demo Guest',
  party_size: 4,
  status: 'waiting',
  position: 3,
  eta: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
  confidence: 'medium',
  venue_id: 'demo-venue',
  venues: { name: 'Demo Restaurant' },
  patron_dismissed: false,
};

const Index = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("home");
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [activeWaitlist, setActiveWaitlist] = useState<any[]>([]);
  const [isLoadingTracking, setIsLoadingTracking] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [ratingItem, setRatingItem] = useState<{
    type: 'order' | 'waitlist';
    id: string;
    venueId: string;
    venueName: string;
  } | null>(null);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { announcement, features } = usePlatformConfig();
  
  // Help system state
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTab, setHelpTab] = useState<'faq' | 'chat' | 'tour' | 'report'>('faq');
  const [tourOpen, setTourOpen] = useState(false);
  const [showTourPulse, setShowTourPulse] = useState(false);
  
  // Demo mode for tour - shows mock data
  const isDemoMode = tourOpen;

  // Phone prompt dialog for Google Sign-In users
  const [showPhonePrompt, setShowPhonePrompt] = useState(false);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('patronTourCompleted');
    if (!hasSeenTour && user) {
      setShowTourPulse(true);
    }
  }, [user]);

  const handleStartTour = () => {
    setTourOpen(true);
    setShowTourPulse(false);
  };

  const handleTourComplete = () => {
    setTourOpen(false);
    localStorage.setItem('patronTourCompleted', 'true');
  };

  const handleHelpNavigate = (target: string) => {
    setHelpOpen(false);
    if (target === 'food') setActiveTab('food-ready');
    else if (target === 'table') setActiveTab('table-ready');
    else if (target === 'profile') setActiveTab('profile');
    else if (target === 'home') setActiveTab('home');
  };
  
  // Track IDs we've already started sounds for to prevent duplicates
  const soundStartedForOrders = useRef<Set<string>>(new Set());
  const soundStartedForWaitlist = useRef<Set<string>>(new Set());

  // Celebration state for home page
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{
    type: 'table-ready' | 'food-ready';
    title: string;
    subtitle: string;
    item: any;
  } | null>(null);
  const celebrationShownForIds = useRef<Set<string>>(new Set());
  
  // Quick-access messenger state for tracking cards
  const [cardMessengerOpen, setCardMessengerOpen] = useState(false);
  const [cardMessengerContext, setCardMessengerContext] = useState<{
    type: 'order' | 'waitlist';
    id: string;
    venueName: string;
  } | null>(null);
  
  // Build entries for unread message tracking
  const unreadEntries = useMemo(() => {
    const entries: Array<{ waitlistEntryId?: string; orderId?: string }> = [];
    activeOrders.forEach(o => entries.push({ orderId: o.id }));
    activeWaitlist.forEach(e => entries.push({ waitlistEntryId: e.id }));
    return entries;
  }, [activeOrders, activeWaitlist]);
  
  const unreadCounts = useMultipleUnreadMessages(unreadEntries, 'patron');

  const handleDismissOrder = async (orderId: string) => {
    if (!user) return;
    
    // Stop continuous sound when dismissing
    stopSoundForId('foodReady', orderId);
    
    await supabase
      .from('orders')
      .update({ patron_dismissed: true })
      .eq('id', orderId)
      .eq('user_id', user.id);
    
    setActiveOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const handleDismissWaitlist = async (entryId: string) => {
    if (!user) return;
    
    // Stop continuous sound when dismissing
    stopSoundForId('tableReady', entryId);
    
    await supabase
      .from('waitlist_entries')
      .update({ patron_dismissed: true })
      .eq('id', entryId)
      .eq('user_id', user.id);
    
    setActiveWaitlist(prev => prev.filter(w => w.id !== entryId));
  };

  const handleRatingComplete = async (itemId: string, type: 'order' | 'waitlist') => {
    if (!user) return;
    
    // Stop any continuous sounds
    if (type === 'order') {
      stopSoundForId('foodReady', itemId);
      await supabase
        .from('orders')
        .update({ patron_dismissed: true })
        .eq('id', itemId)
        .eq('user_id', user.id);
      setActiveOrders(prev => prev.filter(o => o.id !== itemId));
    } else {
      stopSoundForId('tableReady', itemId);
      await supabase
        .from('waitlist_entries')
        .update({ patron_dismissed: true })
        .eq('id', itemId)
        .eq('user_id', user.id);
      setActiveWaitlist(prev => prev.filter(w => w.id !== itemId));
    }
    setRatingDialogOpen(false);
    setRatingItem(null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check if user needs to add phone number (for Google sign-in users)
  useEffect(() => {
    if (!user) return;
    
    supabase
      .from('profiles')
      .select('phone')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (!data?.phone) {
          setShowPhonePrompt(true);
        }
      });
  }, [user]);

  const fetchActiveTracking = async () => {
    if (!user) return;

    setIsLoadingTracking(true);
    
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('*, venues(name, settings, logo_url)')
        .eq('user_id', user.id)
        .eq('patron_dismissed', false)
        .in('status', ['awaiting_verification', 'placed', 'in_prep', 'ready', 'collected', 'rejected'])
        .order('created_at', { ascending: false });

      const { data: waitlist } = await supabase
        .from('waitlist_entries')
        .select('*, venues(name, settings, logo_url)')
        .eq('user_id', user.id)
        .eq('patron_dismissed', false)
        .or('status.in.(waiting,ready,seated,cancelled,no_show),and(reservation_type.eq.reservation,reservation_time.gte.' + new Date().toISOString() + ')')
        .order('reservation_time', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      setActiveOrders(orders || []);
      setActiveWaitlist(waitlist || []);
    } finally {
      setIsLoadingTracking(false);
    }
  };

  useEffect(() => {
    if (user) {
      // Initialize audio on first user interaction
      initializeAudio();
      
      fetchActiveTracking();
      
      const ordersChannel = supabase
        .channel(`patron-orders-${user.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          console.log('Patron order update:', payload);
          
          // Optimistic state update
          if (payload.eventType === 'UPDATE' && payload.new) {
            // Check if order became ready - START CONTINUOUS SOUND! (only once per order)
            if (payload.new.status === 'ready' && payload.old?.status !== 'ready' && 
                !soundStartedForOrders.current.has(payload.new.id) && 
                !isSoundActive('foodReady', payload.new.id)) {
              soundStartedForOrders.current.add(payload.new.id);
              // Play food ready sound (repeats 3x every 10 seconds until collected)
              playFoodReadySound(payload.new.id);
              toast({
                title: "🎉 " + t("home.orderReadyToast"),
                description: t("home.orderReadyDesc", { number: payload.new.order_number }),
              });
            }
            
            // Stop sound when order is collected or cancelled
            if (['collected', 'cancelled', 'rejected'].includes(payload.new.status)) {
              stopSoundForId('foodReady', payload.new.id);
              soundStartedForOrders.current.delete(payload.new.id);
            }
            
            // Check if order was rejected
            if (payload.new.status === 'rejected') {
              toast({
                title: t("home.orderRejected"),
                description: t("home.orderRejectedDesc", { number: payload.new.order_number }),
                variant: "destructive",
              });
            }
            
            // Skip if patron_dismissed is true
            if (payload.new.patron_dismissed) {
              setActiveOrders(prevOrders => prevOrders.filter(order => order.id !== payload.new.id));
              return;
            }
            
            setActiveOrders(prevOrders => {
              const updatedOrders = prevOrders.map(order => 
                order.id === payload.new.id 
                  ? { ...order, ...payload.new, items: Array.isArray(payload.new.items) ? payload.new.items : [payload.new.items] }
                  : order
              );
              return updatedOrders;
            });
          } else if (payload.eventType === 'INSERT' && payload.new) {
            // Insert new order into local state (avoid refetch to prevent duplicate sound triggers)
            if (!payload.new.patron_dismissed) {
              setActiveOrders(prev => {
                if (prev.some(o => o.id === payload.new.id)) return prev;
                return [{ ...payload.new, items: Array.isArray(payload.new.items) ? payload.new.items : [payload.new.items] }, ...prev];
              });
            }
          } else if (payload.eventType === 'DELETE') {
            setActiveOrders(prevOrders => prevOrders.filter(order => order.id !== payload.old?.id));
          }
          // Removed redundant fetchActiveTracking() to prevent re-renders
        })
        .subscribe();

      const waitlistChannel = supabase
        .channel(`patron-waitlist-${user.id}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'waitlist_entries',
          filter: `user_id=eq.${user.id}`
        }, (payload) => {
          console.log('Patron waitlist update:', payload);
          
          // Optimistic state update
          if (payload.eventType === 'UPDATE' && payload.new) {
            // Stop sound when patron confirms arrival (awaiting_merchant_confirmation becomes true)
            if (payload.new.awaiting_merchant_confirmation && !payload.old?.awaiting_merchant_confirmation) {
              stopSoundForId('tableReady', payload.new.id);
              soundStartedForWaitlist.current.delete(payload.new.id);
            }
            
            // Check if table became ready - START CONTINUOUS SOUND! (only once per entry)
            // Don't start if patron already confirmed arrival
            if (payload.new.status === 'ready' && payload.old?.status !== 'ready' && 
                !payload.new.awaiting_merchant_confirmation &&
                !soundStartedForWaitlist.current.has(payload.new.id) && 
                !isSoundActive('tableReady', payload.new.id)) {
              soundStartedForWaitlist.current.add(payload.new.id);
              // Play table ready sound (repeats 2x every 25 seconds until seated/cancelled)
              playTableReadySound(payload.new.id);
              toast({
                title: "🎉 " + t("home.tableReadyToast"),
                description: t("home.tableReadyDesc", { size: payload.new.party_size }),
              });
            }
            
            // Stop sound when seated or cancelled
            if (['seated', 'cancelled', 'no_show'].includes(payload.new.status)) {
              stopSoundForId('tableReady', payload.new.id);
              soundStartedForWaitlist.current.delete(payload.new.id);
            }
            
            // Show toast when system auto-cancels (no_show due to timeout)
            if (payload.new.status === 'no_show' && 
                payload.new.cancelled_by === 'system' &&
                payload.old?.status === 'ready') {
              toast({
                title: "⏰ " + t("home.tableReleased"),
                description: t("home.tableReleasedDesc"),
                variant: "destructive",
              });
            }
            
            // Skip if patron_dismissed is true
            if (payload.new.patron_dismissed) {
              setActiveWaitlist(prevEntries => prevEntries.filter(entry => entry.id !== payload.new.id));
              return;
            }
            
            setActiveWaitlist(prevEntries => {
              const updatedEntries = prevEntries.map(entry => 
                entry.id === payload.new.id 
                  ? { ...entry, ...payload.new }
                  : entry
              );
              // Include 'no_show' so entries don't disappear before patron dismisses them
              const activeFiltered = updatedEntries.filter(entry => 
                ['waiting', 'ready', 'cancelled', 'seated', 'no_show'].includes(entry.status)
               );
               return activeFiltered;
             });
           } else if (payload.eventType === 'INSERT' && payload.new) {
             // Insert new waitlist entry into local state (avoid refetch to prevent duplicate sound triggers)
             if (!payload.new.patron_dismissed) {
               setActiveWaitlist(prev => {
                 if (prev.some(w => w.id === payload.new.id)) return prev;
                 return [payload.new as any, ...prev];
               });
             }
           } else if (payload.eventType === 'DELETE') {
             setActiveWaitlist(prevEntries => prevEntries.filter(entry => entry.id !== payload.old?.id));
           }
           // Removed redundant fetchActiveTracking() to prevent re-renders
        })
        .subscribe();

      return () => {
        supabase.removeChannel(ordersChannel);
        supabase.removeChannel(waitlistChannel);
      };
    }
  }, [user]);

  // Ensure ready sounds play even if user opens the app (or the card) after status is already "ready"
  useEffect(() => {
    if (!user) return;

    activeOrders.forEach((order) => {
      if (order?.status === 'ready') {
        const id = order.id as string;
        if (!soundStartedForOrders.current.has(id) && !isSoundActive('foodReady', id)) {
          soundStartedForOrders.current.add(id);
          playFoodReadySound(id);
        }
      } else if (order?.id) {
        const id = order.id as string;
        stopSoundForId('foodReady', id);
        soundStartedForOrders.current.delete(id);
      }
    });

    activeWaitlist.forEach((entry) => {
      // Only play sound if ready AND patron hasn't confirmed arrival yet
      if (entry?.status === 'ready' && !entry.awaiting_merchant_confirmation) {
        const id = entry.id as string;
        if (!soundStartedForWaitlist.current.has(id) && !isSoundActive('tableReady', id)) {
          soundStartedForWaitlist.current.add(id);
          playTableReadySound(id);
        }
      } else if (entry?.id) {
        const id = entry.id as string;
        stopSoundForId('tableReady', id);
        soundStartedForWaitlist.current.delete(id);
      }
    });
  }, [user, activeOrders, activeWaitlist]);

  // Trigger celebration overlay for ready items on home page
  useEffect(() => {
    if (!user || activeTab !== "home") return;

    // Check for ready orders first
    const readyOrder = activeOrders.find(
      (order) => order.status === 'ready' && !celebrationShownForIds.current.has(order.id)
    );
    if (readyOrder) {
      celebrationShownForIds.current.add(readyOrder.id);
      setCelebrationData({
        type: 'food-ready',
        title: t("home.yourOrderReady"),
        subtitle: t("home.orderReadySub", { number: readyOrder.order_number, venue: readyOrder.venues?.name || '' }),
        item: readyOrder,
      });
      setShowCelebration(true);
      return;
    }

    // Check for ready waitlist entries (not already confirmed arrival)
    const readyEntry = activeWaitlist.find(
      (entry) => entry.status === 'ready' && 
                 !entry.awaiting_merchant_confirmation && 
                 !celebrationShownForIds.current.has(entry.id)
    );
    if (readyEntry) {
      celebrationShownForIds.current.add(readyEntry.id);
      setCelebrationData({
        type: 'table-ready',
        title: t("home.yourTableReady"),
        subtitle: t("home.tableReadySub", { size: readyEntry.party_size, venue: readyEntry.venues?.name || '' }),
        item: readyEntry,
      });
      setShowCelebration(true);
    }
  }, [user, activeOrders, activeWaitlist, activeTab]);

  // Close celebration overlay if its item is no longer valid (cancelled, dismissed, etc.)
  useEffect(() => {
    if (!showCelebration || !celebrationData?.item) return;
    
    const itemId = celebrationData.item.id;
    const isOrder = celebrationData.type === 'food-ready';
    
    if (isOrder) {
      const stillExists = activeOrders.some(o => o.id === itemId && o.status === 'ready');
      if (!stillExists) {
        setShowCelebration(false);
        setCelebrationData(null);
      }
    } else {
      const stillExists = activeWaitlist.some(w => w.id === itemId && w.status === 'ready' && !w.awaiting_merchant_confirmation);
      if (!stillExists) {
        setShowCelebration(false);
        setCelebrationData(null);
      }
    }
  }, [showCelebration, celebrationData, activeOrders, activeWaitlist]);

  // Timer for live overdue countdown updates
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    // Check if any reservation is potentially overdue or approaching
    const hasActiveReservations = activeWaitlist.some(
      entry => entry.reservation_type === 'reservation' && entry.status === 'waiting'
    );
    
    if (!hasActiveReservations) return;
    
    // Force re-render every 30 seconds to update overdue countdowns
    const interval = setInterval(() => {
      forceUpdate(prev => prev + 1);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [activeWaitlist]);

  if (activeTab === "food-ready") {
    return (
      <div className="min-h-screen bg-background pb-24">
        <FoodReadyFlow 
          onBack={() => {
            setActiveTab("home");
            setSelectedOrder(null);
            fetchActiveTracking();
          }} 
          initialOrder={selectedOrder}
        />
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    );
  }

  if (activeTab === "table-ready") {
    return (
      <div className="min-h-screen bg-background pb-24">
        <TableReadyFlow 
          onBack={() => {
            setActiveTab("home");
            setSelectedOrder(null);
            fetchActiveTracking();
          }} 
          initialEntry={selectedOrder}
        />
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    );
  }

  if (activeTab === "profile") {
    return (
      <div className="min-h-screen bg-background pb-24">
        <ProfileSection onBack={() => setActiveTab("home")} />
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    );
  }

  if (activeTab === "loyalty") {
    return (
      <div className="min-h-screen bg-background pb-24">
        <LoyaltyReadyFlow onBack={() => setActiveTab("home")} />
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    );
  }

  if (activeTab === "activity") {
    return (
      <div className="min-h-screen bg-background pb-24">
        <ActivityFlow
          onBack={() => setActiveTab("home")}
          activeOrders={activeOrders}
          activeWaitlist={activeWaitlist}
          unreadCounts={unreadCounts}
          onSelectOrder={(order) => {
            setSelectedOrder(order);
            setActiveTab("food-ready");
          }}
          onSelectWaitlist={(entry) => {
            setSelectedOrder(entry);
            setActiveTab("table-ready");
          }}
          onDismissOrder={handleDismissOrder}
          onDismissWaitlist={handleDismissWaitlist}
          onRateItem={(item) => {
            setRatingItem(item);
            setRatingDialogOpen(true);
          }}
          onOpenMessenger={(ctx) => {
            setCardMessengerContext(ctx);
            setCardMessengerOpen(true);
          }}
          onInviteFriends={(entry) => {
            const url = `${window.location.origin}/waitlist/${entry.venue_id}?group=${entry.id}`;
            const text = t("home.inviteFriendsText", { venue: entry.venues?.name || '' });
            if (navigator.share) {
              navigator.share({ title: entry.venues?.name || '', text, url }).catch(() => {});
            } else {
              navigator.clipboard.writeText(`${text} ${url}`);
              toast({ title: t("explore.linkCopied") });
            }
          }}
        />
        {/* Rating Dialog */}
        <RatingDialog
          open={ratingDialogOpen}
          onOpenChange={setRatingDialogOpen}
          type={ratingItem?.type || 'order'}
          itemId={ratingItem?.id || ''}
          venueId={ratingItem?.venueId || ''}
          venueName={ratingItem?.venueName || ''}
          userId={user?.id || null}
          onComplete={() => {
            if (ratingItem) handleRatingComplete(ratingItem.id, ratingItem.type);
          }}
        />
        {cardMessengerContext && (
          <Messenger
            open={cardMessengerOpen}
            onOpenChange={(open) => { setCardMessengerOpen(open); if (!open) setCardMessengerContext(null); }}
            waitlistEntryId={cardMessengerContext.type === 'waitlist' ? cardMessengerContext.id : undefined}
            orderId={cardMessengerContext.type === 'order' ? cardMessengerContext.id : undefined}
            userType="patron"
            userId={user?.id || ''}
            venueName={cardMessengerContext.venueName}
          />
        )}
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    );
  }


  // Get announcement icon based on type
  const getAnnouncementIcon = (type: string) => {
    switch (type) {
      case 'maintenance': return Wrench;
      case 'warning': return AlertTriangle;
      case 'error': return AlertTriangle;
      default: return Info;
    }
  };

  return (
    <main id="main-content" className="min-h-screen bg-background pb-24" role="main">
      {/* Celebration Overlay for Ready Items */}
      {celebrationData && (
        <CelebrationOverlay
          open={showCelebration}
          type={celebrationData.type}
          title={celebrationData.title}
          subtitle={celebrationData.subtitle}
          actionLabel={celebrationData.type === 'food-ready' ? t("home.viewOrder") : t("home.getSeated")}
          onAction={() => {
            setShowCelebration(false);
            setSelectedOrder(celebrationData.item);
            setActiveTab(celebrationData.type === 'food-ready' ? 'food-ready' : 'table-ready');
          }}
          onDismiss={() => setShowCelebration(false)}
        />
      )}

      {/* Announcement Banner */}
      {announcement && !announcementDismissed && (
        <div className={cn(
          "px-4 py-3 flex items-center gap-3",
          announcement.type === 'maintenance' && "bg-amber-600 text-white",
          announcement.type === 'warning' && "bg-yellow-500 text-black",
          announcement.type === 'error' && "bg-red-600 text-white",
          announcement.type === 'info' && "bg-blue-600 text-white"
        )}>
          {(() => {
            const IconComponent = getAnnouncementIcon(announcement.type);
            return <IconComponent className="h-5 w-5 shrink-0" />;
          })()}
          <p className="text-sm font-medium flex-1">{announcement.message}</p>
          {announcement.dismissible && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-6 w-6 shrink-0",
                announcement.type === 'warning' ? "hover:bg-black/10 text-black" : "hover:bg-white/20 text-white"
              )}
              onClick={() => setAnnouncementDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Hero Section - Black Background */}
      <div className="relative overflow-hidden bg-black px-6 py-20 text-white" data-tour="patron-header">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,107,53,0.08),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,rgba(255,107,53,0.05),transparent_60%)]" />
        
        <div className="absolute top-4 right-4 z-20">
          {user ? (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm transition-all"
              onClick={() => setActiveTab("profile")}
              data-tour="nav-profile"
            >
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-coral/20 text-white font-semibold">
                  {user.email?.charAt(0).toUpperCase() || <UserIcon size={18} />}
                </AvatarFallback>
              </Avatar>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm transition-all"
              onClick={() => navigate("/auth")}
            >
              <LogIn size={22} />
            </Button>
          )}
        </div>
        
        <div className="relative z-10 flex flex-col items-center text-center py-8">
          {/* Logo */}
          <div className="relative">
            <div className="absolute inset-0 bg-primary/25 rounded-full blur-[100px] animate-pulse scale-150" />
            <div className="relative">
              <img 
                src={logo} 
                alt="ReadyUp" 
                className="h-72 w-auto drop-shadow-[0_0_60px_rgba(255,107,53,0.5)]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Promotional Banner Carousel */}
      <div className="px-6 pt-4">
        <PromoBanner placement="home" onNavigateToVenue={(venueId) => {
          setSelectedOrder({ __promoVenueId: venueId });
          setActiveTab("table-ready");
        }} />
      </div>


      {/* Compact Active Tracking Summary */}
      {(user || isDemoMode) && (isLoadingTracking || activeOrders.length > 0 || activeWaitlist.length > 0 || isDemoMode) && (
        <div className="p-6 space-y-3" data-tour="active-tracking">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">
              {t("home.activeTracking")}
              {isDemoMode && <span className="ml-2 text-xs font-normal text-primary">{t("home.demoMode")}</span>}
            </h2>
            {(activeOrders.length + activeWaitlist.length) > 3 && (
              <Button variant="link" size="sm" onClick={() => setActiveTab("activity")} className="text-primary">
                {t("activity.viewAll", { count: activeOrders.length + activeWaitlist.length })}
              </Button>
            )}
          </div>
          
          {/* Loading Skeleton */}
          {isLoadingTracking && activeOrders.length === 0 && activeWaitlist.length === 0 && !isDemoMode && (
            <ActiveTrackingListSkeleton count={2} />
          )}

          {/* Demo cards during tour */}
          {isDemoMode && activeOrders.length === 0 && (
            <Card className="shadow-card border-dashed border-2 border-primary/30 cursor-pointer" data-tour="demo-order">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/10 shrink-0">
                    <UtensilsCrossed className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{DEMO_ORDER.venues?.name}</h3>
                    <p className="text-xs text-muted-foreground">Order #{DEMO_ORDER.order_number}</p>
                  </div>
                  <Badge variant="default" className="shrink-0">Preparing</Badge>
                </div>
              </CardContent>
            </Card>
          )}
          {isDemoMode && activeWaitlist.length === 0 && (
            <Card className="shadow-card border-dashed border-2 border-accent/30 cursor-pointer" data-tour="demo-waitlist">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-accent/10 shrink-0">
                    <Users className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{DEMO_WAITLIST.venues?.name}</h3>
                    <p className="text-xs text-muted-foreground">Party of {DEMO_WAITLIST.party_size}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0">Waiting</Badge>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Compact summary cards - max 3 */}
          {[...activeOrders, ...activeWaitlist].slice(0, 3).map((item) => {
            const isOrder = 'order_number' in item;
            const statusKey = item.status === 'ready' ? t("status.ready") :
              item.status === 'in_prep' ? t("status.preparing") :
              item.status === 'awaiting_verification' ? t("status.verifying") :
              item.status === 'rejected' ? t("status.cancelled") :
              item.status === 'collected' ? t("status.collected") :
              item.status === 'seated' ? t("status.seated") :
              item.status === 'cancelled' ? t("status.cancelled") :
              item.status === 'no_show' ? t("status.cancelled") :
              item.status === 'waiting' ? t("status.waiting") :
              t("status.placed");

            return (
              <Card
                key={item.id}
                className={cn(
                  "shadow-card cursor-pointer transition-all hover:shadow-floating hover:scale-[1.01]",
                  item.status === 'ready' && "bg-success/10 border-success",
                  (item.status === 'rejected' || item.status === 'cancelled' || item.status === 'no_show') && "bg-destructive/10 border-destructive",
                  (item.status === 'collected' || item.status === 'seated') && "bg-success/10 border-success"
                )}
                onClick={() => {
                  if (isOrder) {
                    setSelectedOrder(item);
                    setActiveTab("food-ready");
                  } else {
                    setSelectedOrder(item);
                    setActiveTab("table-ready");
                  }
                }}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <VenueLogo
                      logoUrl={item.venues?.logo_url}
                      name={item.venues?.name || ''}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">{item.venues?.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {isOrder ? `Order #${item.order_number}` : t("home.partyOf", { size: item.party_size })}
                      </p>
                    </div>
                    <Badge
                      variant={
                        item.status === 'ready' ? 'default' :
                        ['rejected', 'cancelled', 'no_show'].includes(item.status) ? 'destructive' :
                        ['collected', 'seated'].includes(item.status) ? 'default' :
                        'secondary'
                      }
                      className="shrink-0"
                    >
                      {statusKey}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* View all link if more than 3 */}
          {(activeOrders.length + activeWaitlist.length) > 3 && (
            <Button
              variant="ghost"
              className="w-full text-primary"
              onClick={() => setActiveTab("activity")}
            >
              {t("activity.viewAll", { count: activeOrders.length + activeWaitlist.length })}
            </Button>
          )}
        </div>
      )}



      {/* Quick Actions */}
      <div className="space-y-6 p-6">
        {!user && (
          <Card className="shadow-card border-2 border-primary/20">
            <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
              <div>
                <h3 className="font-semibold">{t("home.signInButton")}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("home.signInTrack")}
                </p>
                <Button onClick={() => navigate("/auth")} className="w-full">
                  {t("home.signInOrUp")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-3 gap-3">
          {features.food_ordering_enabled && (
            <Card 
              className="cursor-pointer shadow-card transition-all hover:scale-105 hover:shadow-floating active:scale-95"
              onClick={() => setActiveTab("food-ready")}
              data-tour="card-food"
            >
              <CardContent className="flex flex-col items-center gap-3 p-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <UtensilsCrossed size={22} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{t("home.foodReady")}</h3>
                  <p className="text-xs text-muted-foreground">{t("home.trackOrderStatus")}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {features.waitlist_enabled && (
            <Card 
              className="cursor-pointer shadow-card transition-all hover:scale-105 hover:shadow-floating active:scale-95"
              onClick={() => setActiveTab("table-ready")}
              data-tour="card-table"
            >
              <CardContent className="flex flex-col items-center gap-3 p-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Users size={22} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{t("home.tableReady")}</h3>
                  <p className="text-xs text-muted-foreground">{t("home.joinWaitlist")}</p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card 
            className="cursor-pointer shadow-card transition-all hover:scale-105 hover:shadow-floating active:scale-95"
            onClick={() => setActiveTab("loyalty")}
          >
            <CardContent className="flex flex-col items-center gap-3 p-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Gift size={22} />
              </div>
              <div>
                <h3 className="font-semibold text-sm">{t("nav.rewardsReady")}</h3>
                <p className="text-xs text-muted-foreground">{t("home.loyaltyDesc", "Stamps & rewards")}</p>
              </div>
            </CardContent>
          </Card>

          
          {!features.food_ordering_enabled && !features.waitlist_enabled && (
            <div className="col-span-2 text-center py-8 text-muted-foreground">
              <p>{t("home.noFeatures")}</p>
            </div>
          )}
        </div>

      </div>

      {/* Rating Dialog */}
      <RatingDialog
        open={ratingDialogOpen}
        onOpenChange={setRatingDialogOpen}
        type={ratingItem?.type || 'order'}
        itemId={ratingItem?.id || ''}
        venueId={ratingItem?.venueId || ''}
        venueName={ratingItem?.venueName || ''}
        userId={user?.id || null}
        onComplete={() => {
          if (ratingItem) {
            handleRatingComplete(ratingItem.id, ratingItem.type);
          }
        }}
      />

      {/* Report Issue & Help System */}
      {user && <MessengerHub userId={user.id} />}
      <div className="fixed bottom-4 right-4 z-50">
        <HelpButton onClick={() => { setHelpOpen(true); setShowTourPulse(false); }} showPulse={showTourPulse} />
      </div>
      <HelpPanel
        variant="patron"
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        activeTab={helpTab}
        onTabChange={setHelpTab}
        onStartTour={handleStartTour}
        onNavigate={handleHelpNavigate}
      />
      <OnboardingTour
        variant="patron"
        isOpen={tourOpen}
        onClose={() => setTourOpen(false)}
        onComplete={handleTourComplete}
      />
      
      {/* Phone Prompt Dialog for Google Sign-In users */}
      {user && (
        <PhonePromptDialog
          open={showPhonePrompt}
          onOpenChange={setShowPhonePrompt}
          userId={user.id}
          onComplete={() => setShowPhonePrompt(false)}
        />
      )}
      
      {/* Notification Prompt for new users */}
      {user && <NotificationPrompt />}
      
      {/* Quick-access Messenger from tracking cards */}
      {cardMessengerContext && (
        <Messenger
          open={cardMessengerOpen}
          onOpenChange={(open) => {
            setCardMessengerOpen(open);
            if (!open) setCardMessengerContext(null);
          }}
          waitlistEntryId={cardMessengerContext.type === 'waitlist' ? cardMessengerContext.id : undefined}
          orderId={cardMessengerContext.type === 'order' ? cardMessengerContext.id : undefined}
          userType="patron"
          userId={user?.id || ''}
          venueName={cardMessengerContext.venueName}
        />
      )}
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
    </main>
  );
};

export default Index;
