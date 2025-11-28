import { useState, useEffect } from "react";
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
import { 
  playNewOrderSound, 
  playNewWaitlistSound, 
  stopSoundForId, 
  initializeAudio 
} from "@/utils/notificationSound";
import { toast } from "sonner";

const MerchantDashboard = () => {
  const { userRole, loading } = useMerchantAuth();
  const navigate = useNavigate();
  const [venueServiceTypes, setVenueServiceTypes] = useState<string[]>([]);
  const [venueData, setVenueData] = useState<any>(null);
  const [loadingVenue, setLoadingVenue] = useState(true);

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

  // Track active order sounds (keyed by order ID)
  const [pendingOrderSounds, setPendingOrderSounds] = useState<Map<string, () => void>>(new Map());

  // Global real-time subscriptions for sounds (works across ALL tabs)
  useEffect(() => {
    if (!userRole?.venue_id) return;
    
    initializeAudio();
    
    // Subscribe to new orders (INSERT events) - start continuous sound
    const ordersInsertChannel = supabase
      .channel('global-orders-insert-alert')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `venue_id=eq.${userRole.venue_id}`
        },
        (payload) => {
          const orderId = payload.new?.id;
          if (orderId && payload.new?.status === 'awaiting_verification') {
            console.log('🍽️ New order received - starting continuous sound for', orderId);
            // Start continuous sound (repeats 2x every 10 seconds)
            const stopFn = playNewOrderSound(orderId);
            setPendingOrderSounds(prev => new Map(prev).set(orderId, stopFn));
            toast.success("🍽️ New order received!");
          }
        }
      )
      .subscribe();

    // Subscribe to order updates (UPDATE events) - stop sound when approved/rejected
    const ordersUpdateChannel = supabase
      .channel('global-orders-update-alert')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `venue_id=eq.${userRole.venue_id}`
        },
        (payload) => {
          const orderId = payload.new?.id;
          const newStatus = payload.new?.status;
          // Stop sound when order is no longer awaiting verification
          if (orderId && newStatus !== 'awaiting_verification') {
            stopSoundForId('newOrder', orderId);
            setPendingOrderSounds(prev => {
              const newMap = new Map(prev);
              newMap.delete(orderId);
              return newMap;
            });
          }
        }
      )
      .subscribe();

    // Subscribe to new waitlist entries (INSERT events) - one-time sound
    const waitlistChannel = supabase
      .channel('global-waitlist-alert')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'waitlist_entries',
          filter: `venue_id=eq.${userRole.venue_id}`
        },
        () => {
          console.log('👥 New waitlist entry - playing sound');
          playNewWaitlistSound();
          toast.success("👥 New waitlist entry!");
        }
      )
      .subscribe();

    return () => {
      // Stop all pending order sounds on cleanup
      pendingOrderSounds.forEach(stopFn => stopFn());
      supabase.removeChannel(ordersInsertChannel);
      supabase.removeChannel(ordersUpdateChannel);
      supabase.removeChannel(waitlistChannel);
    };
  }, [userRole?.venue_id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/merchant/auth");
  };

  const hasFoodReady = venueServiceTypes.includes("food_ready");
  const hasTableReady = venueServiceTypes.includes("table_ready");

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
        <Tabs defaultValue={hasFoodReady ? "kitchen" : "waitlist"} className="space-y-6">
          <TabsList className={`grid w-full ${
            userRole.role === "admin" 
              ? (hasFoodReady && hasTableReady ? "grid-cols-6" : 
                 hasFoodReady || hasTableReady ? "grid-cols-5" : "grid-cols-3")
              : (hasFoodReady && hasTableReady ? "grid-cols-3" : hasFoodReady || hasTableReady ? "grid-cols-2" : "grid-cols-1")
          }`}>
            {hasFoodReady && (
              <TabsTrigger value="kitchen" className="flex items-center gap-2">
                <ChefHat size={16} />
                Kitchen Orders
              </TabsTrigger>
            )}
            {hasTableReady && (
              <>
                <TabsTrigger value="waitlist" className="flex items-center gap-2">
                  <Users size={16} />
                  Waitlist
                </TabsTrigger>
                <TabsTrigger value="reservations" className="flex items-center gap-2">
                  <Calendar size={16} />
                  Reservations
                </TabsTrigger>
              </>
            )}
            {userRole.role === "admin" && (
              <>
                <TabsTrigger value="staff" className="flex items-center gap-2">
                  <Users size={16} />
                  Staff
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings size={16} />
                  Settings
                </TabsTrigger>
                <TabsTrigger value="reports" className="flex items-center gap-2">
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
    </div>
  );
};

export default MerchantDashboard;