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
import { UtensilsCrossed, Users, MapPin, Clock, ChefHat, LogIn, User as UserIcon, Calendar as CalendarIcon, AlertTriangle, Info, X, Wrench, MessageSquare } from "lucide-react";
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
import { PhonePromptDialog } from "@/components/PhonePromptDialog";
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
      <div className="min-h-screen bg-background">
        <FoodReadyFlow 
          onBack={() => {
            setActiveTab("home");
            setSelectedOrder(null);
            fetchActiveTracking(); // Refresh orders when returning home
          }} 
          initialOrder={selectedOrder}
        />
      </div>
    );
  }

  if (activeTab === "table-ready") {
    return (
      <div className="min-h-screen bg-background">
        <TableReadyFlow 
          onBack={() => {
            setActiveTab("home");
            setSelectedOrder(null);
            fetchActiveTracking(); // Refresh waitlist when returning home
          }} 
          initialEntry={selectedOrder}
        />
      </div>
    );
  }

  if (activeTab === "profile") {
    return (
      <div className="min-h-screen bg-background">
        <ProfileSection onBack={() => setActiveTab("home")} />
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
    <main id="main-content" className="min-h-screen bg-background" role="main">
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

      {/* Loyalty Cards - Compact on Home */}
      {user && (
        <div className="px-6 pt-2">
          <PatronLoyaltyCard compact />
        </div>
      )}

      {/* Active Tracking Section - Show demo data during tour or real data */}
      {(user || isDemoMode) && (isLoadingTracking || activeOrders.length > 0 || activeWaitlist.length > 0 || isDemoMode) && (
        <div className="p-6 space-y-4" data-tour="active-tracking">
          <h2 className="text-xl font-bold">
            {t("home.activeTracking")}
            {isDemoMode && <span className="ml-2 text-xs font-normal text-primary">{t("home.demoMode")}</span>}
          </h2>
          
          {/* Loading Skeleton */}
          {isLoadingTracking && activeOrders.length === 0 && activeWaitlist.length === 0 && !isDemoMode && (
            <ActiveTrackingListSkeleton count={2} />
          )}
          
          {/* Demo Order Card - only shown during tour */}
          {isDemoMode && activeOrders.length === 0 && (
            <Card 
              className="group shadow-card transition-all cursor-pointer hover:shadow-floating hover:scale-[1.01] border-dashed border-2 border-primary/30"
              data-tour="demo-order"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-primary/10">
                      <UtensilsCrossed className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <span className="inline-block text-xs font-bold uppercase tracking-wider text-white bg-primary px-2 py-0.5 rounded mb-1">
                        Order (Demo)
                      </span>
                      <h3 className="font-semibold">{DEMO_ORDER.venues?.name}</h3>
                      <p className="text-sm text-muted-foreground">Order #{DEMO_ORDER.order_number}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Clock size={12} />
                        <span>15 min • ETA {new Date(DEMO_ORDER.eta).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="default">Preparing</Badge>
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Demo Waitlist Card - only shown during tour */}
          {isDemoMode && activeWaitlist.length === 0 && (
            <Card 
              className="group shadow-card transition-all cursor-pointer hover:shadow-floating hover:scale-[1.01] border-dashed border-2 border-accent/30"
              data-tour="demo-waitlist"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-accent/10">
                      <Users className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <span className="inline-block text-xs font-bold uppercase tracking-wider bg-secondary text-secondary-foreground px-2 py-0.5 rounded mb-1">
                        Waitlist (Demo)
                      </span>
                      <h3 className="font-semibold">{DEMO_WAITLIST.venues?.name}</h3>
                      <p className="text-sm text-muted-foreground">Party of {DEMO_WAITLIST.party_size} • #{DEMO_WAITLIST.position}</p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Clock size={12} />
                        <span>~25 min wait</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary">Waiting</Badge>
                </div>
              </CardContent>
            </Card>
          )}
          
          {activeOrders.map((order) => {
            const shouldRate = order.status === 'collected';
            const shouldClear = order.status === 'rejected';
            const canInteract = shouldRate || shouldClear;
            
            return (
              <Card 
                key={order.id} 
                className={cn(
                  "group shadow-card transition-all cursor-pointer hover:shadow-floating hover:scale-[1.01]",
                  order.status === 'ready' && "bg-success/10 border-success animate-pulse-success",
                  order.status === 'rejected' && "bg-destructive/10 border-destructive",
                  order.status === 'collected' && "bg-success/10 border-success"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div 
                      className="flex items-center gap-3 flex-1"
                      onClick={() => {
                        setSelectedOrder(order);
                        setActiveTab("food-ready");
                      }}
                    >
                      <VenueLogo 
                        logoUrl={order.venues?.logo_url} 
                        name={order.venues?.name || ''} 
                        size="lg"
                        className={cn(
                          order.status === 'ready' ? "ring-2 ring-success" : 
                          order.status === 'rejected' ? "ring-2 ring-destructive" :
                          order.status === 'collected' ? "ring-2 ring-success" :
                          ""
                        )}
                      />
                      <div>
                        <span className="inline-block text-xs font-bold uppercase tracking-wider text-white bg-primary px-2 py-0.5 rounded mb-1">
                          {t("home.order")}
                        </span>
                        <h3 className="font-semibold">{order.venues?.name}</h3>
                        <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">Order #{order.order_number}</p>
                        {order.status === 'rejected' && (
                          <p className="text-xs text-destructive mt-1">
                            {t("home.cancelledBy", { by: order.cancelled_by === 'patron' ? t("status.you") : order.cancelled_by === 'system' ? t("status.system") : t("status.venue") })}
                          </p>
                        )}
                        {order.eta && (order.status === 'placed' || order.status === 'in_prep') && (
                          <div className="space-y-1 mt-1">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                              <Clock size={12} />
                              <span>
                                {Math.ceil((new Date(order.eta).getTime() - new Date().getTime()) / (1000 * 60))} min • ETA {new Date(order.eta).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                              </span>
                            </div>
                            {order.confidence && (
                              <div className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors flex items-center gap-1">
                                <Badge variant={order.confidence === 'high' ? 'default' : order.confidence === 'medium' ? 'secondary' : 'outline'} className="h-4 text-[9px] px-1">
                                  {order.confidence === 'high' ? t("status.highConfidence") : order.confidence === 'medium' ? t("status.medium") : t("status.estimate")}
                                </Badge>
                                <span>
                                  {order.confidence === 'high' 
                                    ? t("status.basedOnHistory")
                                    : order.confidence === 'medium' 
                                    ? t("status.someHistory")
                                    : t("status.venueDefault")}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Message button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 relative"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCardMessengerContext({
                            type: 'order',
                            id: order.id,
                            venueName: order.venues?.name || 'Restaurant'
                          });
                          setCardMessengerOpen(true);
                        }}
                      >
                        <MessageSquare className="h-4 w-4" />
                        {unreadCounts[order.id] > 0 && (
                          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] text-white flex items-center justify-center font-medium">
                            {unreadCounts[order.id] > 9 ? '9+' : unreadCounts[order.id]}
                          </span>
                        )}
                      </Button>
                      <Badge variant={
                        order.status === 'ready' ? 'default' : 
                        order.status === 'in_prep' ? 'default' : 
                        order.status === 'awaiting_verification' ? 'outline' :
                        order.status === 'rejected' ? 'destructive' :
                        order.status === 'collected' ? 'default' :
                        'secondary'
                      } className={order.status === 'awaiting_verification' ? 'border-orange-500 text-orange-600 dark:text-orange-400' : ''}>
                        {order.status === 'ready' ? t("status.ready") : 
                         order.status === 'in_prep' ? t("status.preparing") : 
                         order.status === 'awaiting_verification' ? t("status.verifying") :
                         order.status === 'rejected' ? t("status.cancelled") :
                         order.status === 'collected' ? t("status.collected") :
                         t("status.placed")}
                      </Badge>
                      {shouldRate && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRatingItem({
                              type: 'order',
                              id: order.id,
                              venueId: order.venue_id,
                              venueName: order.venues?.name || ''
                            });
                            setRatingDialogOpen(true);
                          }}
                          className="bg-success hover:bg-success/90"
                        >
                          {t("home.rate")}
                        </Button>
                      )}
                      {shouldClear && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDismissOrder(order.id);
                          }}
                        >
                          {t("home.clear")}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {activeWaitlist.map((entry) => {
            // A reservation is any entry with reservation_type === 'reservation', regardless of time
            const isReservation = entry.reservation_type === 'reservation';
            const reservationTime = entry.reservation_time ? new Date(entry.reservation_time) : null;
            const now = new Date();
            
            // Check if reservation time is still upcoming (for countdown display purposes)
            const isUpcomingTime = reservationTime && reservationTime > now;
            
            const isToday = reservationTime && 
              reservationTime.toDateString() === now.toDateString();

            // Overdue detection: reservation is past its time and still waiting
            const isOverdue = isReservation && 
              entry.status === 'waiting' && 
              reservationTime && 
              reservationTime < now;

            // Calculate how late (in minutes)
            const minutesLate = isOverdue && reservationTime
              ? Math.floor((now.getTime() - reservationTime.getTime()) / 60000) 
              : 0;

            // Get venue's auto_no_show_time setting (default 15)
            const autoNoShowMinutes = (entry.venues?.settings as any)?.auto_no_show_time || 15;

            // Time remaining before auto-cancel
            const minutesUntilRelease = isOverdue ? Math.max(0, autoNoShowMinutes - minutesLate) : null;

            const shouldRate = entry.status === 'seated';
            // Include 'no_show' so patron can dismiss auto-cancelled entries
            const shouldClear = entry.status === 'cancelled' || entry.status === 'no_show';
            const canInteract = shouldRate; // Removed shouldClear - allow clicking cancelled to view details

            return (
              <Card 
                key={entry.id} 
                className={cn(
                  "group shadow-card transition-all cursor-pointer hover:shadow-floating hover:scale-[1.01]",
                  entry.status === 'ready' && "bg-success/10 border-success animate-pulse-success",
                  (entry.status === 'cancelled' || entry.status === 'no_show') && "bg-destructive/10 border-destructive",
                  entry.status === 'seated' && "bg-success/10 border-success",
                  isOverdue && "bg-amber-500/10 border-amber-500 dark:bg-amber-900/20"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div 
                      className="flex items-center gap-3 flex-1"
                      onClick={() => {
                        setSelectedOrder(entry);
                        setActiveTab("table-ready");
                      }}
                    >
                      <VenueLogo 
                        logoUrl={entry.venues?.logo_url} 
                        name={entry.venues?.name || ''} 
                        size="lg"
                        className={cn(
                          entry.status === 'ready' ? "ring-2 ring-success" : 
                          (entry.status === 'cancelled' || entry.status === 'no_show') ? "ring-2 ring-destructive" :
                          entry.status === 'seated' ? "ring-2 ring-success" :
                          isOverdue ? "ring-2 ring-amber-500" :
                          ""
                        )}
                      />
                      <div>
                        <span className={cn(
                          "inline-block text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded mb-1",
                          isReservation 
                            ? "bg-purple-600 text-white" 
                            : "bg-secondary text-secondary-foreground"
                        )}>
                          {isReservation ? t("home.reservation") : t("home.waitlist")}
                        </span>
                        <h3 className="font-semibold">{entry.venues?.name}</h3>
                        {entry.customer_name && (
                          <p className="text-xs font-medium text-primary">{entry.customer_name}</p>
                        )}
                        {isReservation && reservationTime ? (
                          <>
                            <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                              Reservation for {entry.party_size}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground transition-colors mt-1">
                              <CalendarIcon size={12} />
                              <span>
                                {isTomorrow(reservationTime) 
                                  ? 'Tomorrow' 
                                  : isToday 
                                    ? 'Today' 
                                    : format(reservationTime, 'MMM d')
                                } 
                                {' at '}
                                {format(reservationTime, 'HH:mm')}
                                {isOverdue ? (
                                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                                    {' • '}{minutesLate} min late
                                  </span>
                                ) : isUpcomingTime ? (
                                  <>
                                    {' • '}
                                    {formatTimeUntil(reservationTime)}
                                  </>
                                ) : null}
                              </span>
                            </div>
                            {/* Auto-cancel warning for overdue reservations */}
                            {isOverdue && minutesUntilRelease !== null && minutesUntilRelease > 0 && (
                              <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 mt-1">
                                <AlertTriangle size={12} />
                                <span>
                                  Arriving within {minutesUntilRelease} min? Check in now!
                                </span>
                              </div>
                            )}
                            {isOverdue && minutesUntilRelease === 0 && (
                              <div className="flex items-center gap-1 text-xs text-destructive mt-1">
                                <AlertTriangle size={12} />
                                <span>Reservation may be released any moment</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                              Party of {entry.party_size}{entry.position ? ` • #${entry.position}` : ''}
                            </p>
                        {(entry.status === 'cancelled' || entry.status === 'no_show') && (
                          <p className="text-xs text-destructive mt-1">
                            {entry.status === 'no_show' 
                              ? "Table released - didn't arrive in time" 
                              : `Cancelled by ${entry.cancelled_by === 'patron' ? 'you' : entry.cancelled_by === 'system' ? 'system' : 'venue'}`}
                          </p>
                        )}
                            {entry.eta && entry.status === 'waiting' && (
                              <div className="space-y-1 mt-1">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                                  <Clock size={12} />
                                  <span>
                                    {formatTimeUntil(new Date(entry.eta))} • ETA {new Date(entry.eta).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                                  </span>
                                </div>
                                {entry.confidence && (
                                  <div className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors flex items-center gap-1">
                                    <Badge variant={entry.confidence === 'high' ? 'default' : entry.confidence === 'medium' ? 'secondary' : 'outline'} className="h-4 text-[9px] px-1">
                                      {entry.confidence === 'high' ? 'High Confidence' : entry.confidence === 'medium' ? 'Medium' : 'Estimate'}
                                    </Badge>
                                    <span>
                                      {entry.confidence === 'high' 
                                        ? 'Based on historical data' 
                                        : entry.confidence === 'medium' 
                                        ? 'Some historical data' 
                                        : 'Venue default time'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Message button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 relative"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCardMessengerContext({
                            type: 'waitlist',
                            id: entry.id,
                            venueName: entry.venues?.name || 'Restaurant'
                          });
                          setCardMessengerOpen(true);
                        }}
                      >
                        <MessageSquare className="h-4 w-4" />
                        {unreadCounts[entry.id] > 0 && (
                          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] text-white flex items-center justify-center font-medium">
                            {unreadCounts[entry.id] > 9 ? '9+' : unreadCounts[entry.id]}
                          </span>
                        )}
                      </Button>
                      <Badge 
                        variant={
                          isOverdue ? 'outline' :
                          isReservation ? 'outline' : 
                          entry.status === 'ready' ? 'default' : 
                          entry.status === 'cancelled' ? 'destructive' :
                          entry.status === 'seated' ? 'default' :
                          'secondary'
                        }
                        className={cn(
                          isOverdue && "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                        )}
                      >
                        {isOverdue ? 'Overdue' : 
                         isReservation ? 'Reserved' : 
                         entry.status === 'ready' ? 'Ready' : 
                         entry.status === 'cancelled' ? 'Cancelled' :
                         entry.status === 'seated' ? 'Seated' :
                         'Waiting'}
                      </Badge>
                      {shouldRate && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRatingItem({
                              type: 'waitlist',
                              id: entry.id,
                              venueId: entry.venue_id,
                              venueName: entry.venues?.name || ''
                            });
                            setRatingDialogOpen(true);
                          }}
                          className="bg-success hover:bg-success/90"
                        >
                          Rate
                        </Button>
                      )}
                      {shouldClear && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDismissWaitlist(entry.id);
                          }}
                        >
                          Dismiss
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Quick Actions */}
      <div className="space-y-6 p-6">
        {!user && (
          <Card className="shadow-card border-2 border-primary/20">
            <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
              <div>
                <h3 className="font-semibold">Sign In</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Sign in to track your orders and reservations
                </p>
                <Button onClick={() => navigate("/auth")} className="w-full">
                  Sign In or Sign Up
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-4">
          {features.food_ordering_enabled && (
            <Card 
              className="cursor-pointer shadow-card transition-all hover:scale-105 hover:shadow-floating active:scale-95"
              onClick={() => setActiveTab("food-ready")}
              data-tour="card-food"
            >
              <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <UtensilsCrossed size={28} />
                </div>
                <div>
                  <h3 className="font-semibold">Food Ready</h3>
                  <p className="text-sm text-muted-foreground">Track your order status</p>
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
              <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Users size={28} />
                </div>
                <div>
                  <h3 className="font-semibold">Table Ready</h3>
                  <p className="text-sm text-muted-foreground">Join a waitlist</p>
                </div>
              </CardContent>
            </Card>
          )}

          
          {!features.food_ordering_enabled && !features.waitlist_enabled && (
            <div className="col-span-2 text-center py-8 text-muted-foreground">
              <p>No features are currently available.</p>
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
    </main>
  );
};

export default Index;
