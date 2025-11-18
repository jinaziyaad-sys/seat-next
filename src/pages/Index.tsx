import { useState, useEffect } from "react";
import { FoodReadyFlow } from "@/components/FoodReadyFlow";
import { TableReadyFlow } from "@/components/TableReadyFlow";
import { ProfileSection } from "@/components/ProfileSection";
import { RatingDialog } from "@/components/RatingDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UtensilsCrossed, Users, MapPin, Clock, ChefHat, LogIn, User as UserIcon, Calendar as CalendarIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import logo from "@/assets/logo.png";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [activeWaitlist, setActiveWaitlist] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [dismissedOrders, setDismissedOrders] = useState<string[]>(() => {
    const stored = localStorage.getItem('dismissedOrders');
    return stored ? JSON.parse(stored) : [];
  });
  const [dismissedWaitlist, setDismissedWaitlist] = useState<string[]>(() => {
    const stored = localStorage.getItem('dismissedWaitlist');
    return stored ? JSON.parse(stored) : [];
  });
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [ratingItem, setRatingItem] = useState<{
    type: 'order' | 'waitlist';
    id: string;
    venueId: string;
    venueName: string;
  } | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleRatingComplete = (itemId: string, type: 'order' | 'waitlist') => {
    if (type === 'order') {
      const updated = [...dismissedOrders, itemId];
      setDismissedOrders(updated);
      localStorage.setItem('dismissedOrders', JSON.stringify(updated));
      setActiveOrders(prev => prev.filter(o => o.id !== itemId));
    } else {
      const updated = [...dismissedWaitlist, itemId];
      setDismissedWaitlist(updated);
      localStorage.setItem('dismissedWaitlist', JSON.stringify(updated));
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

  const fetchActiveTracking = async () => {
    if (!user) return;

    // Read dismissed items directly from localStorage to avoid stale closure values
    const storedDismissedOrders = localStorage.getItem('dismissedOrders');
    const currentDismissedOrders = storedDismissedOrders ? JSON.parse(storedDismissedOrders) : [];
    
    const storedDismissedWaitlist = localStorage.getItem('dismissedWaitlist');
    const currentDismissedWaitlist = storedDismissedWaitlist ? JSON.parse(storedDismissedWaitlist) : [];

    const { data: orders } = await supabase
      .from('orders')
      .select('*, venues(name)')
      .eq('user_id', user.id)
      .in('status', ['awaiting_verification', 'placed', 'in_prep', 'ready', 'collected', 'rejected'])
      .order('created_at', { ascending: false });

    const { data: waitlist } = await supabase
      .from('waitlist_entries')
      .select('*, venues(name)')
      .eq('user_id', user.id)
      .or('status.in.(waiting,ready,seated,cancelled),and(reservation_type.eq.reservation,reservation_time.gte.' + new Date().toISOString() + ')')
      .order('reservation_time', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    // Filter out dismissed items using current localStorage values
    const filteredOrders = (orders || []).filter(order => 
      !currentDismissedOrders.includes(order.id)
    );
    const filteredWaitlist = (waitlist || []).filter(entry => 
      !currentDismissedWaitlist.includes(entry.id)
    );

    setActiveOrders(filteredOrders);
    setActiveWaitlist(filteredWaitlist);
  };

  useEffect(() => {
    if (user) {
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
            // Check if order was rejected
            if (payload.new.status === 'rejected') {
              toast({
                title: "Order Rejected",
                description: `Order #${payload.new.order_number} was marked as invalid by the kitchen. Tap the order to retry.`,
                variant: "destructive",
              });
            }
            
            setActiveOrders(prevOrders => {
              const updatedOrders = prevOrders.map(order => 
                order.id === payload.new.id 
                  ? { ...order, ...payload.new, items: Array.isArray(payload.new.items) ? payload.new.items : [payload.new.items] }
                  : order
              );
              // Filter out dismissed items - read from localStorage for current values
              const storedDismissed = localStorage.getItem('dismissedOrders');
              const currentDismissed = storedDismissed ? JSON.parse(storedDismissed) : [];
              return updatedOrders.filter(order => !currentDismissed.includes(order.id));
            });
          } else if (payload.eventType === 'INSERT') {
            fetchActiveTracking(); // Fetch for new orders
          } else if (payload.eventType === 'DELETE') {
            setActiveOrders(prevOrders => prevOrders.filter(order => order.id !== payload.old?.id));
          }
          
          // Also fetch to ensure consistency
          fetchActiveTracking();
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
            setActiveWaitlist(prevEntries => {
              const updatedEntries = prevEntries.map(entry => 
                entry.id === payload.new.id 
                  ? { ...entry, ...payload.new }
                  : entry
              );
              // Filter out dismissed items - read from localStorage for current values
              const storedDismissed = localStorage.getItem('dismissedWaitlist');
              const currentDismissed = storedDismissed ? JSON.parse(storedDismissed) : [];
              const activeFiltered = updatedEntries.filter(entry => 
                ['waiting', 'ready', 'cancelled', 'seated'].includes(entry.status) &&
                !currentDismissed.includes(entry.id)
              );
              return activeFiltered;
            });
          } else if (payload.eventType === 'INSERT') {
            fetchActiveTracking(); // Fetch for new entries
          } else if (payload.eventType === 'DELETE') {
            setActiveWaitlist(prevEntries => prevEntries.filter(entry => entry.id !== payload.old?.id));
          }
          
          // Also fetch to ensure consistency
          fetchActiveTracking();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(ordersChannel);
        supabase.removeChannel(waitlistChannel);
      };
    }
  }, [user]);

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

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section - Black Background */}
      <div className="relative overflow-hidden bg-black px-6 py-20 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,107,53,0.08),transparent_70%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_70%,rgba(255,107,53,0.05),transparent_60%)]" />
        
        <div className="absolute top-4 right-4 z-20">
          {user ? (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm transition-all"
              onClick={() => setActiveTab("profile")}
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

      {/* Active Tracking Section */}
      {user && (activeOrders.length > 0 || activeWaitlist.length > 0) && (
        <div className="p-6 space-y-4">
          <h2 className="text-xl font-bold">Active Tracking</h2>
          
          {activeOrders.map((order) => {
            const shouldRate = order.status === 'collected';
            const shouldClear = order.status === 'rejected';
            const canInteract = shouldRate || shouldClear;
            
            return (
              <Card 
                key={order.id} 
                className={cn(
                  "shadow-card transition-all",
                  !canInteract && "cursor-pointer hover:shadow-floating",
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
                        if (!canInteract) {
                          setSelectedOrder(order);
                          setActiveTab("food-ready");
                        }
                      }}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center",
                        order.status === 'ready' ? "bg-success/20" : 
                        order.status === 'rejected' ? "bg-destructive/20" :
                        order.status === 'collected' ? "bg-success/20" :
                        "bg-primary/10"
                      )}>
                        <UtensilsCrossed className={cn(
                          "w-6 h-6",
                          order.status === 'ready' ? "text-success" : 
                          order.status === 'rejected' ? "text-destructive" :
                          order.status === 'collected' ? "text-success" :
                          "text-primary"
                        )} />
                      </div>
                      <div>
                        <h3 className="font-semibold">{order.venues?.name}</h3>
                        <p className="text-sm text-muted-foreground">Order #{order.order_number}</p>
                        {order.status === 'rejected' && (
                          <p className="text-xs text-destructive mt-1">Cancelled by venue</p>
                        )}
                        {order.eta && (order.status === 'placed' || order.status === 'in_prep') && (
                          <div className="space-y-1 mt-1">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock size={12} />
                              <span>
                                {Math.ceil((new Date(order.eta).getTime() - new Date().getTime()) / (1000 * 60))} min • ETA {new Date(order.eta).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                              </span>
                            </div>
                            {order.confidence && (
                              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Badge variant={order.confidence === 'high' ? 'default' : order.confidence === 'medium' ? 'secondary' : 'outline'} className="h-4 text-[9px] px-1">
                                  {order.confidence === 'high' ? 'High Confidence' : order.confidence === 'medium' ? 'Medium' : 'Estimate'}
                                </Badge>
                                <span>
                                  {order.confidence === 'high' 
                                    ? 'Based on historical data' 
                                    : order.confidence === 'medium' 
                                    ? 'Some historical data' 
                                    : 'Venue default time'}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        order.status === 'ready' ? 'default' : 
                        order.status === 'in_prep' ? 'default' : 
                        order.status === 'awaiting_verification' ? 'outline' :
                        order.status === 'rejected' ? 'destructive' :
                        order.status === 'collected' ? 'default' :
                        'secondary'
                      } className={order.status === 'awaiting_verification' ? 'border-orange-500 text-orange-600 dark:text-orange-400' : ''}>
                        {order.status === 'ready' ? 'Ready' : 
                         order.status === 'in_prep' ? 'Preparing' : 
                         order.status === 'awaiting_verification' ? 'Verifying' :
                         order.status === 'rejected' ? 'Cancelled' :
                         order.status === 'collected' ? 'Collected' :
                         'Placed'}
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
                          Rate
                        </Button>
                      )}
                      {shouldClear && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            const updated = [...dismissedOrders, order.id];
                            setDismissedOrders(updated);
                            localStorage.setItem('dismissedOrders', JSON.stringify(updated));
                            setActiveOrders(prev => prev.filter(o => o.id !== order.id));
                          }}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {activeWaitlist.map((entry) => {
            const isUpcomingReservation = entry.reservation_type === 'reservation' && 
              entry.reservation_time && 
              new Date(entry.reservation_time) > new Date();
            
            const isToday = entry.reservation_time && 
              new Date(entry.reservation_time).toDateString() === new Date().toDateString();

            const shouldRate = entry.status === 'seated';
            const shouldClear = entry.status === 'cancelled';
            const canInteract = shouldRate; // Removed shouldClear - allow clicking cancelled to view details

            return (
              <Card 
                key={entry.id} 
                className={cn(
                  "shadow-card transition-all",
                  !canInteract && "cursor-pointer hover:shadow-floating",
                  entry.status === 'ready' && "bg-success/10 border-success animate-pulse-success",
                  entry.status === 'cancelled' && "bg-destructive/10 border-destructive",
                  entry.status === 'seated' && "bg-success/10 border-success"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div 
                      className="flex items-center gap-3 flex-1"
                      onClick={() => {
                        if (!canInteract) {
                          setSelectedOrder(entry);
                          setActiveTab("table-ready");
                        }
                      }}
                    >
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center",
                        entry.status === 'ready' ? "bg-success/20" : 
                        entry.status === 'cancelled' ? "bg-destructive/20" :
                        entry.status === 'seated' ? "bg-success/20" :
                        "bg-accent/10"
                      )}>
                        <Users className={cn(
                          "w-6 h-6",
                          entry.status === 'ready' ? "text-success" : 
                          entry.status === 'cancelled' ? "text-destructive" :
                          entry.status === 'seated' ? "text-success" :
                          "text-accent"
                        )} />
                      </div>
                      <div>
                        <h3 className="font-semibold">{entry.venues?.name}</h3>
                        {isUpcomingReservation ? (
                          <>
                            <p className="text-sm text-muted-foreground">
                              Reservation for {entry.party_size}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                              <CalendarIcon size={12} />
                              <span>
                                {isToday ? 'Today' : format(new Date(entry.reservation_time), 'MMM d')} 
                                {' at '}
                                {format(new Date(entry.reservation_time), 'HH:mm')}
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-muted-foreground">
                              Party of {entry.party_size}{entry.position ? ` • #${entry.position}` : ''}
                            </p>
                            {entry.status === 'cancelled' && (
                              <p className="text-xs text-destructive mt-1">Tap to view details</p>
                            )}
                            {entry.eta && entry.status === 'waiting' && (
                              <div className="space-y-1 mt-1">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock size={12} />
                                  <span>
                                    {Math.ceil((new Date(entry.eta).getTime() - new Date().getTime()) / (1000 * 60))} min • ETA {new Date(entry.eta).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                                  </span>
                                </div>
                                {entry.confidence && (
                                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
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
                      <Badge variant={
                        isUpcomingReservation ? 'outline' : 
                        entry.status === 'ready' ? 'default' : 
                        entry.status === 'cancelled' ? 'destructive' :
                        entry.status === 'seated' ? 'default' :
                        'secondary'
                      }>
                        {isUpcomingReservation ? 'Reserved' : 
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
                            const updated = [...dismissedWaitlist, entry.id];
                            setDismissedWaitlist(updated);
                            localStorage.setItem('dismissedWaitlist', JSON.stringify(updated));
                            setActiveWaitlist(prev => prev.filter(w => w.id !== entry.id));
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
          <Card 
            className="cursor-pointer shadow-card transition-all hover:scale-105 hover:shadow-floating active:scale-95"
            onClick={() => setActiveTab("food-ready")}
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

          <Card 
            className="cursor-pointer shadow-card transition-all hover:scale-105 hover:shadow-floating active:scale-95"
            onClick={() => setActiveTab("table-ready")}
          >
            <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Users size={28} />
              </div>
              <div>
                <h3 className="font-semibold">Table Ready</h3>
                <p className="text-sm text-muted-foreground">Join a waitlist</p>
              </div>
            </CardContent>
          </Card>
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
    </div>
  );
};

export default Index;
