import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useMerchantAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { KitchenBoard } from "@/components/merchant/KitchenBoard";
import { WaitlistBoard } from "@/components/merchant/WaitlistBoard";
import { ReservationCalendar } from "@/components/merchant/ReservationCalendar";
import { MerchantSettings } from "@/components/merchant/MerchantSettings";
import { StaffManagement } from "@/components/merchant/StaffManagement";
import { MerchantReports } from "@/components/merchant/MerchantReports";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChefHat, Users, Settings, BarChart3, LogOut, Lock, Calendar } from "lucide-react";
import { PasswordResetDialog } from "@/components/PasswordResetDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { initializeAudio, playNewWaitlistSound, playNewOrderSound, stopSoundForId, playPatronArrivedSound } from "@/utils/notificationSound";
import { toast as sonnerToast } from "sonner";
import { HelpButton, HelpPanel, OnboardingTour } from "@/components/help";
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
  const { userRole, loading } = useMerchantAuth();
  const navigate = useNavigate();
  const [venueServiceTypes, setVenueServiceTypes] = useState<string[]>([]);
  const [venueData, setVenueData] = useState<any>(null);
  const [loadingVenue, setLoadingVenue] = useState(true);
  
  // Tab and unsaved changes state
  const [activeTab, setActiveTab] = useState<string>("");
  const [settingsHasUnsavedChanges, setSettingsHasUnsavedChanges] = useState(false);
  const [pendingTabChange, setPendingTabChange] = useState<string | null>(null);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  
  // Help system state
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTab, setHelpTab] = useState<'faq' | 'chat' | 'tour'>('faq');
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
      setLoadingVenue(false);
    };

    if (userRole?.venue_id) {
      fetchVenueData();
    }
  }, [userRole?.venue_id]);

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
        if (!id) return;

        if (soundStartedForWaitlist.current.has(id)) return;
        soundStartedForWaitlist.current.add(id);

        console.log('👥 New waitlist entry (global) - playing sound');
        playNewWaitlistSound();
        sonnerToast.success("👥 New waitlist entry!");

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

  const hasFoodReady = venueServiceTypes.includes("food_ready");
  const hasTableReady = venueServiceTypes.includes("table_ready");

  // Set initial tab when service types are loaded
  useEffect(() => {
    if (!activeTab && venueServiceTypes.length > 0) {
      setActiveTab(hasFoodReady ? "kitchen" : "waitlist");
    }
  }, [venueServiceTypes, activeTab, hasFoodReady]);

  // Handle tab change with unsaved changes check
  const handleTabChange = useCallback((newTab: string) => {
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-primary">{userRole.venue_name}</h1>
                <Badge variant={userRole.role === 'admin' ? 'default' : 'secondary'}>
                  {userRole.role === 'admin' ? 'Administrator' : 'Staff Member'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {userRole.role === 'admin' ? 'Full access to all features' : 'Kitchen & Waitlist access'}
              </p>
            </div>
            <div className="flex gap-2">
              <ThemeToggle />
              <PasswordResetDialog />
              <Button variant="outline" onClick={handleLogout}>
                <LogOut size={16} className="mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className={`grid w-full ${
            userRole.role === "admin" 
              ? (hasFoodReady && hasTableReady ? "grid-cols-6" : 
                 hasFoodReady || hasTableReady ? "grid-cols-5" : "grid-cols-3")
              : (hasFoodReady && hasTableReady ? "grid-cols-3" : hasFoodReady || hasTableReady ? "grid-cols-2" : "grid-cols-1")
          }`}>
            {hasFoodReady && (
              <TabsTrigger value="kitchen" data-tour="tab-kitchen" className="flex items-center gap-2">
                <ChefHat size={16} />
                Kitchen Orders
              </TabsTrigger>
            )}
            {hasTableReady && (
              <>
                <TabsTrigger value="waitlist" data-tour="tab-waitlist" className="flex items-center gap-2">
                  <Users size={16} />
                  Waitlist
                </TabsTrigger>
                <TabsTrigger value="reservations" data-tour="tab-reservations" className="flex items-center gap-2">
                  <Calendar size={16} />
                  Reservations
                </TabsTrigger>
              </>
            )}
            {userRole.role === "admin" && (
              <>
                <TabsTrigger value="staff" data-tour="tab-staff" className="flex items-center gap-2">
                  <Users size={16} />
                  Staff
                </TabsTrigger>
                <TabsTrigger value="settings" data-tour="tab-settings" className="flex items-center gap-2">
                  <Settings size={16} />
                  Settings
                </TabsTrigger>
                <TabsTrigger value="reports" data-tour="tab-reports" className="flex items-center gap-2">
                  <BarChart3 size={16} />
                  Reports
                </TabsTrigger>
              </>
            )}
          </TabsList>

          {hasFoodReady && (
            <TabsContent value="kitchen">
              <KitchenBoard venueId={userRole.venue_id!} />
            </TabsContent>
          )}

          {hasTableReady && (
            <>
              <TabsContent value="waitlist">
                <WaitlistBoard venueId={userRole.venue_id!} />
              </TabsContent>
              
              <TabsContent value="reservations">
                <ReservationCalendar venueId={userRole.venue_id!} />
              </TabsContent>
            </>
          )}

          {userRole.role === "admin" ? (
            <>
              <TabsContent value="staff">
                <StaffManagement venueId={userRole.venue_id!} />
              </TabsContent>

              <TabsContent value="settings">
                <MerchantSettings 
                  venue={userRole.venue_name!} 
                  venueId={userRole.venue_id!}
                  serviceTypes={venueServiceTypes}
                  onUnsavedChangesChange={setSettingsHasUnsavedChanges}
                />
              </TabsContent>

              <TabsContent value="reports">
                {venueData ? (
                  <MerchantReports venue={venueData} />
                ) : (
                  <div className="flex items-center justify-center py-12">
                    <p className="text-muted-foreground">Loading venue data...</p>
                  </div>
                )}
              </TabsContent>
            </>
          ) : (
            <>
              <TabsContent value="staff">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Lock className="w-16 h-16 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Admin Access Required</h3>
                  <p className="text-muted-foreground max-w-md">
                    You need administrator privileges to manage staff members.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="settings">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Lock className="w-16 h-16 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Admin Access Required</h3>
                  <p className="text-muted-foreground max-w-md">
                    You need administrator privileges to modify venue settings.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="reports">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Lock className="w-16 h-16 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Admin Access Required</h3>
                  <p className="text-muted-foreground max-w-md">
                    You need administrator privileges to view reports and analytics.
                  </p>
                </div>
              </TabsContent>
            </>
          )}
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

      {/* Help System */}
      <HelpButton onClick={() => setHelpOpen(true)} showPulse={showTourPulse} />
      <HelpPanel
        variant="merchant"
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        activeTab={helpTab}
        onTabChange={setHelpTab}
        onStartTour={handleStartTour}
        onNavigate={handleHelpNavigate}
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