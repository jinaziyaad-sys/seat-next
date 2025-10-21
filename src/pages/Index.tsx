import { useState, useEffect } from "react";
import { TabNavigation } from "@/components/TabNavigation";
import { FoodReadyFlow } from "@/components/FoodReadyFlow";
import { TableReadyFlow } from "@/components/TableReadyFlow";
import { ProfileSection } from "@/components/ProfileSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UtensilsCrossed, Users, MapPin, Clock, ChefHat, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

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

  useEffect(() => {
    if (user) {
      fetchActiveTracking();
      
      const ordersChannel = supabase
        .channel('orders-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `user_id=eq.${user.id}`
        }, () => fetchActiveTracking())
        .subscribe();

      const waitlistChannel = supabase
        .channel('waitlist-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'waitlist_entries',
          filter: `user_id=eq.${user.id}`
        }, () => fetchActiveTracking())
        .subscribe();

      return () => {
        supabase.removeChannel(ordersChannel);
        supabase.removeChannel(waitlistChannel);
      };
    }
  }, [user]);

  const fetchActiveTracking = async () => {
    if (!user) return;

    const { data: orders } = await supabase
      .from('orders')
      .select('*, venues(name)')
      .eq('user_id', user.id)
      .in('status', ['placed', 'in_prep'])
      .order('created_at', { ascending: false });

    const { data: waitlist } = await supabase
      .from('waitlist_entries')
      .select('*, venues(name)')
      .eq('user_id', user.id)
      .eq('status', 'waiting')
      .order('created_at', { ascending: false });

    setActiveOrders(orders || []);
    setActiveWaitlist(waitlist || []);
  };

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
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    );
  }

  if (activeTab === "table-ready") {
    return (
      <div className="min-h-screen bg-background">
        <TableReadyFlow onBack={() => {
          setActiveTab("home");
          fetchActiveTracking(); // Refresh waitlist when returning home
        }} />
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    );
  }

  if (activeTab === "profile") {
    return (
      <div className="min-h-screen bg-background">
        <ProfileSection onBack={() => setActiveTab("home")} />
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-hero px-6 py-12 text-center text-white">
        <div className="relative z-10">
          <h1 className="mb-4 text-4xl font-bold">Patron App</h1>
          <p className="text-lg opacity-90">
            Track your food orders and table reservations in real-time
          </p>
        </div>
        <div className="absolute inset-0 bg-charcoal/20"></div>
      </div>

      {/* Active Tracking Section */}
      {user && (activeOrders.length > 0 || activeWaitlist.length > 0) && (
        <div className="p-6 space-y-4">
          <h2 className="text-xl font-bold">Active Tracking</h2>
          
          {activeOrders.map((order) => (
            <Card 
              key={order.id} 
              className="shadow-card cursor-pointer hover:shadow-floating transition-shadow" 
              onClick={() => {
                setSelectedOrder(order);
                setActiveTab("food-ready");
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <UtensilsCrossed className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{order.venues?.name}</h3>
                      <p className="text-sm text-muted-foreground">Order #{order.order_number}</p>
                      {order.eta && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Clock size={12} />
                          <span>
                            {Math.ceil((new Date(order.eta).getTime() - new Date().getTime()) / (1000 * 60))} min
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant={order.status === 'in_prep' ? 'default' : 'secondary'}>
                    {order.status === 'in_prep' ? 'Preparing' : 'Placed'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}

          {activeWaitlist.map((entry) => (
            <Card key={entry.id} className="shadow-card cursor-pointer" onClick={() => setActiveTab("table-ready")}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center">
                      <Users className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{entry.venues?.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Party of {entry.party_size} • Position {entry.position || '—'}
                      </p>
                    </div>
                  </div>
                  <Badge>Waiting</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="space-y-6 p-6 pb-24">
        {!user && (
          <Card className="shadow-card border-2 border-primary/20">
            <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <LogIn size={28} />
              </div>
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

      <TabNavigation activeTab="home" onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
