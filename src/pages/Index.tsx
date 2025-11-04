import { useState, useEffect } from "react";
import { FoodReadyFlow } from "@/components/FoodReadyFlow";
import { TableReadyFlow } from "@/components/TableReadyFlow";
import { ProfileSection } from "@/components/ProfileSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UtensilsCrossed, Users, MapPin, Clock, ChefHat, LogIn, User as UserIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

const Index = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [activeWaitlist, setActiveWaitlist] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const navigate = useNavigate();

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

    const { data: orders } = await supabase
      .from('orders')
      .select('*, venues(name)')
      .eq('user_id', user.id)
      .in('status', ['placed', 'in_prep', 'ready'])
      .order('created_at', { ascending: false });

    const { data: waitlist } = await supabase
      .from('waitlist_entries')
      .select('*, venues(name)')
      .eq('user_id', user.id)
      .in('status', ['waiting', 'ready'])
      .order('created_at', { ascending: false });

    setActiveOrders(orders || []);
    setActiveWaitlist(waitlist || []);
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
            setActiveOrders(prevOrders => {
              const updatedOrders = prevOrders.map(order => 
                order.id === payload.new.id 
                  ? { ...order, ...payload.new, items: Array.isArray(payload.new.items) ? payload.new.items : [payload.new.items] }
                  : order
              );
              // Remove from list if status is no longer active
              return updatedOrders.filter(order => 
                ['placed', 'in_prep', 'ready'].includes(order.status)
              );
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
              // Remove from list if status is no longer active
              return updatedEntries.filter(entry => 
                ['waiting', 'ready'].includes(entry.status)
              );
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
          
          {activeOrders.map((order) => (
            <Card 
              key={order.id} 
              className={cn(
                "shadow-card cursor-pointer hover:shadow-floating transition-all",
                order.status === 'ready' && "bg-success/10 border-success animate-pulse-success"
              )}
              onClick={() => {
                setSelectedOrder(order);
                setActiveTab("food-ready");
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center",
                      order.status === 'ready' ? "bg-success/20" : "bg-primary/10"
                    )}>
                      <UtensilsCrossed className={cn(
                        "w-6 h-6",
                        order.status === 'ready' ? "text-success" : "text-primary"
                      )} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{order.venues?.name}</h3>
                      <p className="text-sm text-muted-foreground">Order #{order.order_number}</p>
                    {order.eta && (order.status === 'placed' || order.status === 'in_prep') && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Clock size={12} />
                        <span>
                          {Math.ceil((new Date(order.eta).getTime() - new Date().getTime()) / (1000 * 60))} min • ETA {new Date(order.eta).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                        </span>
                      </div>
                    )}
                    </div>
                  </div>
                    <Badge variant={
                      order.status === 'ready' ? 'default' : 
                      order.status === 'in_prep' ? 'default' : 
                      'secondary'
                    }>
                      {order.status === 'ready' ? 'Ready' : 
                       order.status === 'in_prep' ? 'Preparing' : 
                       'Placed'}
                    </Badge>
                </div>
              </CardContent>
            </Card>
          ))}

          {activeWaitlist.map((entry) => (
            <Card 
              key={entry.id} 
              className={cn(
                "shadow-card cursor-pointer hover:shadow-floating transition-all",
                entry.status === 'ready' && "bg-success/10 border-success animate-pulse-success"
              )}
              onClick={() => {
                setSelectedOrder(entry);
                setActiveTab("table-ready");
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center",
                      entry.status === 'ready' ? "bg-success/20" : "bg-accent/10"
                    )}>
                      <Users className={cn(
                        "w-6 h-6",
                        entry.status === 'ready' ? "text-success" : "text-accent"
                      )} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{entry.venues?.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Party of {entry.party_size} • Position {entry.position || '—'}
                      </p>
                      {entry.eta && entry.status === 'waiting' && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Clock size={12} />
                          <span>
                            {Math.ceil((new Date(entry.eta).getTime() - new Date().getTime()) / (1000 * 60))} min • ETA {new Date(entry.eta).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant={entry.status === 'ready' ? 'default' : 'secondary'}>
                    {entry.status === 'ready' ? 'Ready' : 'Waiting'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
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
    </div>
  );
};

export default Index;
