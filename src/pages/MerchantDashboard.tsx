import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMerchantAuth } from "@/hooks/useAuth";
import { usePlatformConfig } from "@/hooks/usePlatformConfig";
import { useMerchantSubscription } from "@/hooks/useMerchantSubscription";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { KitchenBoard } from "@/components/merchant/KitchenBoard";
import { WaitlistBoard } from "@/components/merchant/WaitlistBoard";
import { VenueQRCode } from "@/components/merchant/VenueQRCode";
import { ReservationCalendar } from "@/components/merchant/ReservationCalendar";
import { MerchantSettings } from "@/components/merchant/MerchantSettings";
import { StaffManagement } from "@/components/merchant/StaffManagement";
import { MerchantReports } from "@/components/merchant/MerchantReports";
import { VenueStatusIndicator } from "@/components/merchant/VenueStatusIndicator";
import { VenueSwitcher } from "@/components/merchant/VenueSwitcher";
import { VenueNotificationBell } from "@/components/merchant/VenueNotificationBell";
import { SoundSnoozeButton } from "@/components/merchant/SoundSnoozeButton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChefHat, Users, Settings, BarChart3, LogOut, Lock, Calendar, AlertTriangle, Info, X, Wrench, Gift, LayoutGrid, CreditCard, ArrowUpCircle, Megaphone, Store } from "lucide-react";
import { PasswordResetDialog } from "@/components/PasswordResetDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { initializeAudio, playNewWaitlistSound, playNewOrderSound, stopSoundForId, playPatronArrivedSound } from "@/utils/notificationSound";
import { toast as sonnerToast } from "sonner";
import { HelpButton, HelpPanel, OnboardingTour } from "@/components/help";
import { MerchantMessengerHub } from "@/components/merchant/MerchantMessengerHub";
import { LoyaltyManagement } from "@/components/merchant/LoyaltyManagement";
import { FloorPlan } from "@/components/merchant/FloorPlan";
import { MerchantAnnouncementBanner } from "@/components/merchant/MerchantAnnouncementBanner";
import { SponsoredAdsManager } from "@/components/merchant/SponsoredAdsManager";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MerchantDashboard = () => {
  const { user, userRole, allVenueRoles, switchVenue, loading } = useMerchantAuth();
  const { features, announcement } = usePlatformConfig();
  const subscription = useMerchantSubscription(userRole?.venue_id);
  const [searchParams, setSearchParams] = useSearchParams();
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);

  // Detect checkout=success and show welcome toast
  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      // Clear the param from URL
      searchParams.delete('checkout');
      setSearchParams(searchParams, { replace: true });
      
      // Wait briefly for subscription to refresh, then show toast
      const timer = setTimeout(() => {
        const planName = subscription.tierName || 'your new plan';
        sonnerToast.success(`Payment confirmed! Welcome to ${planName}`, {
          description: 'Your subscription is now active. Enjoy all your features!',
          duration: 6000,
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);
  
  // Helper function for announcement icon
  const getAnnouncementIcon = (type: 'info' | 'warning' | 'error' | 'maintenance') => {
    switch (type) {
      case 'maintenance': return Wrench;
      case 'warning': return AlertTriangle;
      case 'error': return AlertTriangle;
      case 'info': 
      default: return Info;
    }
  };
  const navigate = useNavigate();
  const [venueServiceTypes, setVenueServiceTypes] = useState<string[]>([]);
  const [venueData, setVenueData] = useState<any>(null);
  const [loadingVenue, setLoadingVenue] = useState(true);
  
  // Tab and unsaved changes state
  const [activeTab, setActiveTab] = useState<string>("");
  const [settingsHasUnsavedChanges, setSettingsHasUnsavedChanges] = useState(false);
  const [pendingTabChange, setPendingTabChange] = useState<string | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  
  // Tab notification counts
  const [kitchenCount, setKitchenCount] = useState(0);
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [reservationCount, setReservationCount] = useState(0);
  
  // Track if there are new (unseen) items for each tab
  const [kitchenHasNew, setKitchenHasNew] = useState(false);
  const [waitlistHasNew, setWaitlistHasNew] = useState(false);
  const [reservationHasNew, setReservationHasNew] = useState(false);
  const [loyaltyAdminEnabled, setLoyaltyAdminEnabled] = useState(false);
  
  // Help system state
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTab, setHelpTab] = useState<'faq' | 'chat' | 'tour' | 'report'>('faq');
  const [tourOpen, setTourOpen] = useState(false);
  const [showTourPulse, setShowTourPulse] = useState(false);

  // Check if first visit for tour
  useEffect(() => {
    const hasSeenTour = localStorage.getItem('merchantTourCompleted');
    if (!hasSeenTour && userRole?.role === 'admin') {
      setShowTourPulse(true);
    }
  }, [userRole?.role]);

  const handleStartTour = () => {
    setTourOpen(true);
    setShowTourPulse(false);
  };

  const handleTourComplete = () => {
    setTourOpen(false);
    localStorage.setItem('merchantTourCompleted', 'true');
  };

  const handleHelpNavigate = (target: string) => {
    setHelpOpen(false);
    if (['kitchen', 'waitlist', 'reservations', 'staff', 'settings', 'reports'].includes(target)) {
      handleTabChange(target);
    }
  };

  // Fetch tab notification counts
  const fetchKitchenCount = useCallback(async (isInitial = false) => {
    if (!userRole?.venue_id) return;
    const { count } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("venue_id", userRole.venue_id)
      .in("status", ["awaiting_verification", "placed", "in_prep", "ready"]);
    const newCount = count || 0;
    setKitchenCount(prev => {
      // Mark as new if count increased and not initial load
      if (!isInitial && newCount > prev) {
        setKitchenHasNew(true);
      }
      return newCount;
    });
  }, [userRole?.venue_id]);

  const fetchWaitlistCount = useCallback(async (isInitial = false) => {
    if (!userRole?.venue_id) return;
    const { count } = await supabase
      .from("waitlist_entries")
      .select("*", { count: "exact", head: true })
      .eq("venue_id", userRole.venue_id)
      .in("status", ["waiting", "ready"])
      .neq("reservation_type", "reservation");
    const newCount = count || 0;
    setWaitlistCount(prev => {
      if (!isInitial && newCount > prev) {
        setWaitlistHasNew(true);
      }
      return newCount;
    });
  }, [userRole?.venue_id]);

  const fetchReservationCount = useCallback(async (isInitial = false) => {
    if (!userRole?.venue_id) return;

    // Count unseen reservations, deduplicated by linked_reservation_id
    const { data: unseenData } = await supabase
      .from("waitlist_entries")
      .select("id, linked_reservation_id")
      .eq("venue_id", userRole.venue_id)
      .eq("reservation_type", "reservation")
      .eq("merchant_seen", false)
      .in("status", ["waiting", "ready"]);
    const newCount = new Set(
      (unseenData || []).map((r: any) => r.linked_reservation_id || r.id)
    ).size;
    setReservationCount(newCount);
    
    // Badge is red when there are unseen reservations
    if (!isInitial && newCount > 0) {
      setReservationHasNew(true);
    } else if (newCount > 0) {
      // Even on initial load, show red if there are unseen reservations
      setReservationHasNew(true);
    } else {
      setReservationHasNew(false);
    }
  }, [userRole?.venue_id]);

  // Fetch venue data
  useEffect(() => {
    const fetchVenueData = async () => {
      if (!userRole?.venue_id) return;
      
      setLoadingVenue(true);
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .eq("id", userRole.venue_id)
        .single();
      
      if (data && !error) {
        setVenueData(data);
        setVenueServiceTypes(data.service_types || ["food_ready", "table_ready"]);
      }
      
      // Check if loyalty is admin-enabled for this venue
      const { data: loyaltyData } = await supabase
        .from("loyalty_programs")
        .select("admin_enabled")
        .eq("venue_id", userRole.venue_id)
        .maybeSingle();
      setLoyaltyAdminEnabled(loyaltyData?.admin_enabled !== false && !!loyaltyData);
      
      setLoadingVenue(false);
    };

    if (userRole?.venue_id) {
      fetchVenueData();
    }
  }, [userRole?.venue_id]);

  // Fetch initial counts and subscribe to real-time updates
  useEffect(() => {
    if (!userRole?.venue_id) return;

    // Initial fetch (marked as initial so no "new" highlight)
    fetchKitchenCount(true);
    fetchWaitlistCount(true);
    fetchReservationCount(true);

    // Subscribe to orders table for kitchen count updates
    const ordersCountChannel = supabase
      .channel(`orders-count-${userRole.venue_id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `venue_id=eq.${userRole.venue_id}`
      }, () => fetchKitchenCount(false))
      .subscribe();

    // Subscribe to waitlist_entries for waitlist + reservation count updates
    const waitlistCountChannel = supabase
      .channel(`waitlist-count-${userRole.venue_id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'waitlist_entries',
        filter: `venue_id=eq.${userRole.venue_id}`
      }, () => {
        fetchWaitlistCount(false);
        fetchReservationCount(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersCountChannel);
      supabase.removeChannel(waitlistCountChannel);
    };
  }, [userRole?.venue_id, fetchKitchenCount, fetchWaitlistCount, fetchReservationCount]);

  // Track items we've already played sounds for
  const soundStartedForWaitlist = useRef<Set<string>>(new Set());
  const soundStartedForOrders = useRef<Set<string>>(new Set());
  const arrivedPatronsRef = useRef<Set<string>>(new Set());

  // Initialize audio and set up GLOBAL sound subscriptions
  useEffect(() => {
    initializeAudio();

    if (!userRole?.venue_id) return;

    // Global waitlist INSERT subscription - plays sound regardless of active tab
    const waitlistSoundChannel = supabase
      .channel(`global-waitlist-insert-sound-${userRole.venue_id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'waitlist_entries',
        filter: `venue_id=eq.${userRole.venue_id}`
      }, (payload) => {
        const id = (payload.new as any)?.id as string | undefined;
        const reservationType = (payload.new as any)?.reservation_type as string | undefined;
        if (!id) return;

        if (soundStartedForWaitlist.current.has(id)) return;
        soundStartedForWaitlist.current.add(id);

        // Show contextual notification based on type
        if (reservationType === 'reservation') {
          console.log('📅 New reservation (global) - playing sound');
          playNewWaitlistSound();
          sonnerToast.success("📅 New reservation!");
        } else {
          console.log('👥 New waitlist entry (global) - playing sound');
          playNewWaitlistSound();
          sonnerToast.success("👥 New waitlist entry!");
        }

        // Clean up after 30 seconds to prevent memory buildup
        setTimeout(() => {
          soundStartedForWaitlist.current.delete(id);
        }, 30000);
      })
      .subscribe();

    // Global order subscription - plays/clears new order sound regardless of active tab
    const orderSoundChannel = supabase
      .channel(`global-order-sound-${userRole.venue_id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `venue_id=eq.${userRole.venue_id}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const id = (payload.new as any)?.id as string | undefined;
          const status = (payload.new as any)?.status as string | undefined;
          if (!id || status !== 'awaiting_verification') return;

          if (soundStartedForOrders.current.has(id)) return;
          soundStartedForOrders.current.add(id);

          console.log('🍽️ New order received (global) - starting continuous sound for', id);
          playNewOrderSound(id);
          sonnerToast.success("🍽️ New order received!");
        }

        if (payload.eventType === 'UPDATE') {
          const id = (payload.new as any)?.id as string | undefined;
          const oldStatus = (payload.old as any)?.status as string | undefined;
          const newStatus = (payload.new as any)?.status as string | undefined;

          if (id && oldStatus === 'awaiting_verification' && newStatus && newStatus !== 'awaiting_verification') {
            stopSoundForId('newOrder', id);
            soundStartedForOrders.current.delete(id);
          }
        }
      })
      .subscribe();

    // Global patron arrival subscription - plays sound when patron confirms arrival
    const patronArrivalChannel = supabase
      .channel(`global-patron-arrival-${userRole.venue_id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'waitlist_entries',
        filter: `venue_id=eq.${userRole.venue_id}`
      }, (payload) => {
        const id = (payload.new as any)?.id as string | undefined;
        const oldAwaitingConfirmation = (payload.old as any)?.awaiting_merchant_confirmation;
        const newAwaitingConfirmation = (payload.new as any)?.awaiting_merchant_confirmation;
        const customerName = (payload.new as any)?.customer_name as string | undefined;

        // Check if patron just confirmed arrival (awaiting_merchant_confirmation changed to true)
        if (!oldAwaitingConfirmation && newAwaitingConfirmation === true) {
          if (!arrivedPatronsRef.current.has(id!)) {
            arrivedPatronsRef.current.add(id!);
            console.log(`🚶 Patron arrived: ${customerName} - playing sound`);
            playPatronArrivedSound();
            sonnerToast.success(`🚶 ${customerName || 'A patron'} has arrived!`);

            // Cleanup after 30 seconds
            setTimeout(() => {
              arrivedPatronsRef.current.delete(id!);
            }, 30000);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(waitlistSoundChannel);
      supabase.removeChannel(orderSoundChannel);
      supabase.removeChannel(patronArrivalChannel);
    };
  }, [userRole?.venue_id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/merchant/auth");
  };

  const hasFoodReady = venueServiceTypes.includes("food_ready") && features.food_ordering_enabled;
  const hasTableReady = venueServiceTypes.includes("table_ready") && features.waitlist_enabled;
  const hasReservations = hasTableReady && features.reservations_enabled;
  const hasKitchenBoard = hasFoodReady && features.kitchen_board_enabled;
  const hasAnalytics = features.analytics_enabled && subscription.hasFeature('analytics');
  const hasLoyalty = subscription.hasFeature('loyalty');
  const analyticsLocked = features.analytics_enabled && !subscription.hasFeature('analytics');
  const loyaltyLocked = !subscription.hasFeature('loyalty');
  const hasPromotions = true; // Promotions available to all plans

  // Tab trigger class for consistent sizing
  const tabTriggerClass = "flex items-center gap-2 flex-1 min-w-fit";

  // Set initial tab when service types are loaded
  useEffect(() => {
    if (!activeTab && venueServiceTypes.length > 0 && userRole) {
      if (hasKitchenBoard) {
        setActiveTab("kitchen");
      } else if (hasTableReady) {
        setActiveTab("waitlist");
      } else if (userRole.role === "admin") {
        setActiveTab("settings");
      }
    }
  }, [venueServiceTypes, activeTab, hasKitchenBoard, hasTableReady, userRole]);

  // Handle tab change with unsaved changes check and clear "new" state
  const handleTabChange = useCallback((newTab: string) => {
    // Clear "new" state when switching to a tab
    if (newTab === "kitchen") setKitchenHasNew(false);
    if (newTab === "waitlist") setWaitlistHasNew(false);
    if (newTab === "reservations") setReservationHasNew(false);
    
    if (activeTab === "settings" && settingsHasUnsavedChanges && newTab !== "settings") {
      setPendingTabChange(newTab);
      setShowUnsavedDialog(true);
    } else {
      setActiveTab(newTab);
    }
  }, [activeTab, settingsHasUnsavedChanges]);

  const handleDiscardAndChangeTab = useCallback(() => {
    setShowUnsavedDialog(false);
    if (pendingTabChange) {
      setActiveTab(pendingTabChange);
      setPendingTabChange(null);
    }
  }, [pendingTabChange]);

  const handleStayOnSettings = useCallback(() => {
    setShowUnsavedDialog(false);
    setPendingTabChange(null);
  }, []);

  if (loading || !userRole || loadingVenue) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Onboarding incomplete guard
  if (venueData && venueData.onboarding_completed === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md text-center space-y-6 p-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Store size={32} className="text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Complete Your Setup</h1>
          <p className="text-muted-foreground">
            Your venue is almost ready. Complete the onboarding to start using your dashboard.
          </p>
          <Button onClick={() => navigate("/merchant/signup")} size="lg">
            Continue Setup
          </Button>
        </div>
      </div>
    );
  }

  // Subscription paywall
  if (!subscription.loading && !subscription.subscribed && subscription.status !== 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md text-center space-y-6 p-8">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Lock size={32} className="text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold">
            {subscription.status === 'past_due' ? 'Payment Overdue' : 'Subscribe to Get Started'}
          </h1>

          {/* Show which venue this subscription is for */}
          <div className="space-y-2">
            {allVenueRoles.length > 1 ? (
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm text-muted-foreground">Subscribing for:</p>
                <VenueSwitcher
                  currentVenue={userRole}
                  allVenues={allVenueRoles}
                  onVenueChange={switchVenue}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Subscribing for: <span className="font-semibold text-foreground">{userRole.venue_name}</span>
              </p>
            )}
          </div>

          <p className="text-muted-foreground">
            {subscription.status === 'past_due'
              ? 'Your subscription payment failed. Please update your payment method to regain access.'
              : 'Choose a plan to access your merchant dashboard and start managing your venue.'}
          </p>
          <div className="flex flex-col gap-3">
            {subscription.status === 'past_due' ? (
              <Button onClick={() => navigate("/merchant/billing")} size="lg">
                Update Payment Method
              </Button>
            ) : (
              <Button onClick={() => navigate(`/merchant/signup?upgrade=true&venueId=${userRole.venue_id}`)} size="lg">
                View Plans & Subscribe
              </Button>
            )}
            <Button variant="outline" onClick={handleLogout}>
              <LogOut size={16} className="mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b shadow-sm" data-tour="merchant-header">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <VenueSwitcher 
                  currentVenue={userRole}
                  allVenues={allVenueRoles}
                  onVenueChange={switchVenue}
                />
                {allVenueRoles.length > 1 && userRole.venue_id && (
                  <VenueNotificationBell
                    allVenues={allVenueRoles}
                    currentVenueId={userRole.venue_id}
                    onVenueChange={switchVenue}
                  />
                )}
                <Badge variant={userRole.role === 'admin' ? 'default' : 'secondary'}>
                  {userRole.role === 'admin' ? 'Administrator' : 'Staff Member'}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-2">
                {venueData && (
                  <VenueStatusIndicator 
                    venueId={userRole.venue_id!} 
                    settings={venueData.settings}
                  />
                )}
                <span className="text-sm text-muted-foreground">
                  {userRole.role === 'admin' ? 'Full access to all features' : 'Operational access'}
                  {allVenueRoles.length > 1 && ` • ${allVenueRoles.length} venues`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {subscription.tierName && (
                <Badge variant="secondary" className="text-xs">
                  {subscription.tierName}
                </Badge>
              )}
              <SoundSnoozeButton data-tour="sound-snooze" />
              <ThemeToggle />
              <PasswordResetDialog />
              {userRole.role === 'admin' && (
                <Button variant="outline" size="sm" onClick={() => navigate("/merchant/billing")}>
                  <CreditCard size={16} className="mr-2" />
                  Billing
                </Button>
              )}
              <Button variant="outline" onClick={handleLogout}>
                <LogOut size={16} className="mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Targeted Merchant Announcements */}
      <MerchantAnnouncementBanner venueId={userRole.venue_id!} tierName={subscription.tierName} />

      <div className="max-w-7xl mx-auto p-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="flex w-full overflow-x-auto h-auto p-1 bg-muted/50">
            {hasKitchenBoard && (
              <TabsTrigger value="kitchen" data-tour="tab-kitchen" className={tabTriggerClass}>
                <ChefHat size={16} />
                Kitchen Orders
                {kitchenCount > 0 && (
                  <Badge 
                    variant={kitchenHasNew ? "destructive" : "secondary"} 
                    className="ml-1 h-5 min-w-5 px-1.5 text-xs"
                  >
                    {kitchenCount}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            {hasTableReady && (
              <TabsTrigger value="waitlist" data-tour="tab-waitlist" className={tabTriggerClass}>
                <Users size={16} />
                Waitlist
                {waitlistCount > 0 && (
                  <Badge 
                    variant={waitlistHasNew ? "destructive" : "secondary"} 
                    className="ml-1 h-5 min-w-5 px-1.5 text-xs"
                  >
                    {waitlistCount}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            {hasReservations && (
              <TabsTrigger value="reservations" data-tour="tab-reservations" className={tabTriggerClass}>
                <Calendar size={16} />
                Reservations
                {reservationCount > 0 && (
                  <Badge 
                    variant={reservationHasNew ? "destructive" : "secondary"} 
                    className="ml-1 h-5 min-w-5 px-1.5 text-xs"
                  >
                    {reservationCount}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            {hasTableReady && (
              <TabsTrigger value="floor-plan" className={tabTriggerClass}>
                <LayoutGrid size={16} />
                Floor Plan
              </TabsTrigger>
            )}
            {userRole.role === "admin" && (
              <>
                <TabsTrigger value="staff" data-tour="tab-staff" className={tabTriggerClass}>
                  <Users size={16} />
                  Staff
                </TabsTrigger>
                <TabsTrigger value="settings" data-tour="tab-settings" className={tabTriggerClass}>
                  <Settings size={16} />
                  Settings
                </TabsTrigger>
                {(hasAnalytics || analyticsLocked) && (
                  <TabsTrigger value="reports" data-tour="tab-reports" className={tabTriggerClass}>
                    <BarChart3 size={16} />
                    Reports
                    {analyticsLocked && <Lock size={12} className="ml-1 text-muted-foreground" />}
                  </TabsTrigger>
                )}
                {hasPromotions && (
                  <TabsTrigger value="promotions" className={tabTriggerClass}>
                    <Megaphone size={16} />
                    Promotions
                  </TabsTrigger>
                )}
              </>
            )}
            {userRole.role === 'admin' && (
              <TabsTrigger value="loyalty" className={tabTriggerClass}>
                <Gift size={16} />
                Loyalty
                {loyaltyLocked && <Lock size={12} className="ml-1 text-muted-foreground" />}
              </TabsTrigger>
            )}
          </TabsList>

          {hasKitchenBoard && (
            <TabsContent value="kitchen" data-tour="kitchen-content">
              <KitchenBoard venueId={userRole.venue_id!} />
            </TabsContent>
          )}

          {hasTableReady && (
            <TabsContent value="waitlist" data-tour="waitlist-content">
              <WaitlistBoard venueId={userRole.venue_id!} />
            </TabsContent>
          )}
          
          {hasReservations && (
            <TabsContent value="reservations" data-tour="reservations-content">
              <ReservationCalendar venueId={userRole.venue_id!} venueName={userRole.venue_name || ""} />
            </TabsContent>
          )}

          {hasTableReady && (
            <TabsContent value="floor-plan">
              <FloorPlan venueId={userRole.venue_id!} readOnly={userRole.role !== 'admin'} />
            </TabsContent>
          )}

          {/* Loyalty tab - always visible for admins, locked shows upgrade prompt */}
          {userRole.role === 'admin' && (
            hasLoyalty ? (
              <TabsContent value="loyalty">
                <LoyaltyManagement venueId={userRole.venue_id!} readOnly={false} />
              </TabsContent>
            ) : (
              <TabsContent value="loyalty">
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <ArrowUpCircle className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">Upgrade to Enterprise</h3>
                  <p className="text-muted-foreground max-w-md">
                    Loyalty programs are available on the Enterprise plan. Upgrade to create stamp cards, rewards, and keep customers coming back.
                  </p>
                  <Button onClick={() => navigate(`/merchant/signup?upgrade=true&venueId=${userRole.venue_id}`)}>
                    View Plans & Upgrade
                  </Button>
                </div>
              </TabsContent>
            )
          )}

          {/* Admin-only tab contents */}
          {userRole.role === "admin" ? (
            <>
              <TabsContent value="staff" data-tour="staff-content">
                <StaffManagement venueId={userRole.venue_id!} />
              </TabsContent>

              <TabsContent value="settings" data-tour="settings-content">
                <MerchantSettings 
                  venue={userRole.venue_name!} 
                  venueId={userRole.venue_id!}
                  serviceTypes={venueServiceTypes}
                  onUnsavedChangesChange={setSettingsHasUnsavedChanges}
                />
              </TabsContent>

              {hasAnalytics ? (
                <TabsContent value="reports" data-tour="reports-content">
                  {venueData ? (
                    <MerchantReports venue={venueData} />
                  ) : (
                    <div className="flex items-center justify-center py-12">
                      <p className="text-muted-foreground">Loading venue data...</p>
                    </div>
                  )}
                </TabsContent>
              ) : analyticsLocked ? (
                <TabsContent value="reports">
                  <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                      <ArrowUpCircle className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold">Upgrade to Pro</h3>
                    <p className="text-muted-foreground max-w-md">
                      Analytics & Reports are available on the Pro plan. Upgrade to unlock detailed insights about your venue's performance.
                    </p>
                    <Button onClick={() => navigate(`/merchant/signup?upgrade=true&venueId=${userRole.venue_id}`)}>
                      View Plans & Upgrade
                    </Button>
                  </div>
                </TabsContent>
              ) : null}

              {hasPromotions && (
                <TabsContent value="promotions">
                  <SponsoredAdsManager venueId={userRole.venue_id!} />
                </TabsContent>
              )}
            </>
          ) : null}
        </Tabs>
      </div>

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in Settings. Are you sure you want to leave without saving?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleStayOnSettings}>
              Stay on Settings
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDiscardAndChangeTab}>
              Discard & Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report Issue & Help System */}
      {user && <MerchantMessengerHub venueId={userRole.venue_id!} userId={user.id} />}
      <div className="fixed bottom-4 right-4 z-50">
        <HelpButton onClick={() => { setHelpOpen(true); setShowTourPulse(false); }} showPulse={showTourPulse} />
      </div>
      <HelpPanel
        variant="merchant"
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        activeTab={helpTab}
        onTabChange={setHelpTab}
        onStartTour={handleStartTour}
        onNavigate={handleHelpNavigate}
        venueId={userRole.venue_id!}
        venueName={userRole.venue_name!}
      />
      <OnboardingTour
        variant="merchant"
        isOpen={tourOpen}
        onClose={() => setTourOpen(false)}
        onComplete={handleTourComplete}
      />
    </div>
  );
};

export default MerchantDashboard;