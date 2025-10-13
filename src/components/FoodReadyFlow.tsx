import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Clock, CheckCircle, Package, Truck, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type OrderStatus = "placed" | "in_prep" | "ready" | "collected" | "no_show";

interface Order {
  id: string;
  order_number: string;
  venue: string;
  status: OrderStatus;
  eta: string | null;
  instructions?: string;
  items: any[];
}

const statusConfig = {
  placed: { label: "Order Placed", icon: Package, color: "bg-slate text-white", progress: 25 },
  "in_prep": { label: "In Preparation", icon: Clock, color: "bg-warning text-white", progress: 60 },
  ready: { label: "Ready for Pickup", icon: CheckCircle, color: "bg-primary text-primary-foreground", progress: 90 },
  collected: { label: "Collected", icon: Truck, color: "bg-success text-white", progress: 100 },
  no_show: { label: "No Show", icon: Truck, color: "bg-destructive text-white", progress: 100 },
};

export function FoodReadyFlow({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<"scan" | "order-entry" | "tracking" | "feedback">("scan");
  const [orderNumber, setOrderNumber] = useState("");
  const [selectedVenue, setSelectedVenue] = useState("");
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [venues, setVenues] = useState<{id: string; name: string; address?: string; phone?: string}[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Fetch venues on component mount
  useEffect(() => {
    const fetchVenues = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("venues")
        .select("id, name, address, phone")
        .order("name");
      
      if (data && !error) {
        setVenues(data);
      }
      setIsLoading(false);
    };

    fetchVenues();
  }, []);

  const filteredVenues = venues.filter(venue => 
    venue.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleQRScan = () => {
    if (venues.length > 0) {
      setSelectedVenue(venues[0].name);
      setStep("order-entry");
    }
  };

  const handleOrderSubmit = async () => {
    if (!orderNumber.trim() || !selectedVenue) return;

    // Find the venue
    const venue = venues.find(v => v.name === selectedVenue);
    if (!venue) return;

    // Check if order exists
    const { data: existingOrder, error } = await supabase
      .from("orders")
      .select("*")
      .eq("venue_id", venue.id)
      .eq("order_number", orderNumber.toUpperCase())
      .single();

    if (error && error.code !== 'PGRST116') {
      // Error other than "not found"
      return;
    }

    if (existingOrder) {
      // Order found, start tracking
      const order: Order = {
        id: existingOrder.id,
        order_number: existingOrder.order_number,
        venue: selectedVenue,
        status: existingOrder.status,
        eta: existingOrder.eta,
        instructions: "Please collect from the main counter",
        items: Array.isArray(existingOrder.items) ? existingOrder.items : [existingOrder.items]
      };
      setCurrentOrder(order);
      setStep("tracking");

      // Set up real-time subscription for this order
      const channel = supabase
        .channel(`order-${existingOrder.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public', 
          table: 'orders',
          filter: `id=eq.${existingOrder.id}`
        }, (payload) => {
          if (payload.new) {
            setCurrentOrder(prev => prev ? {
              ...prev,
              status: payload.new.status,
              eta: payload.new.eta
            } : null);
          }
        })
        .subscribe();

      return () => supabase.removeChannel(channel);
    } else {
      // Order not found - create a new one for demo purposes
      const { data: newOrder, error: insertError } = await supabase
        .from("orders")
        .insert({
          venue_id: venue.id,
          order_number: orderNumber.toUpperCase(),
          status: "placed",
          items: [{ name: "Sample Item" }],
          eta: new Date(Date.now() + 12 * 60000).toISOString()
        })
        .select()
        .single();

      if (newOrder && !insertError) {
        const order: Order = {
          id: newOrder.id,
          order_number: newOrder.order_number,
          venue: selectedVenue,
          status: newOrder.status,
          eta: newOrder.eta,
          instructions: "Please collect from the main counter",
          items: Array.isArray(newOrder.items) ? newOrder.items : [newOrder.items]
        };
        setCurrentOrder(order);
        setStep("tracking");
      }
    }
  };

  const handleFeedback = () => {
    setStep("feedback");
  };

  if (step === "scan") {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Food Ready</h1>
        </div>

        <Card className="shadow-card">
          <CardContent className="p-8 text-center space-y-6">
            <div className="text-6xl">📱</div>
            <h2 className="text-xl font-semibold">Scan QR Code</h2>
            <p className="text-muted-foreground">Scan the QR code on your table or receipt to track your order</p>
            
            <Button 
              onClick={handleQRScan}
              className="w-full h-12 text-lg"
            >
              Simulate QR Scan
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Or Select Venue Manually</CardTitle>
            <p className="text-sm text-muted-foreground">Search and select your restaurant</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Search restaurants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading venues...</div>
            ) : filteredVenues.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "No venues found matching your search" : "No venues available"}
              </div>
            ) : (
              <Select onValueChange={(value) => {
                setSelectedVenue(value);
                setStep("order-entry");
              }}>
                <SelectTrigger className="w-full h-12">
                  <SelectValue placeholder="Select a restaurant" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {filteredVenues.map((venue) => (
                    <SelectItem key={venue.id} value={venue.name}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{venue.name}</span>
                        {venue.address && (
                          <span className="text-xs text-muted-foreground">{venue.address}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "order-entry") {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setStep("scan")}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Enter Order Number</h1>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>{selectedVenue}</CardTitle>
            <p className="text-muted-foreground">Enter your POS order number from your receipt</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="e.g. A123, 4567, XY89..."
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value.toUpperCase().slice(0, 8))}
              className="text-center text-lg font-mono h-12"
              maxLength={8}
            />
            <Button 
              onClick={handleOrderSubmit}
              disabled={!orderNumber.trim()}
              className="w-full h-12"
            >
              Track My Order
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "tracking" && currentOrder) {
    const config = statusConfig[currentOrder.status];
    const StatusIcon = config.icon;

    return (
      <div className="space-y-6 p-6 pb-24">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Order #{currentOrder.id}</h1>
        </div>

        <Card className="shadow-card">
          <CardContent className="p-8 text-center space-y-6">
            <div className={cn("inline-flex items-center gap-3 px-6 py-3 rounded-full", config.color)}>
              <StatusIcon size={24} />
              <span className="font-semibold">{config.label}</span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{config.progress}%</span>
              </div>
              <Progress value={config.progress} className="h-2" />
            </div>

            {currentOrder.eta && new Date(currentOrder.eta) > new Date() && (
              <div className="flex items-center justify-center gap-2 text-lg">
                <Clock size={20} />
                <span className="font-semibold">
                  {Math.ceil((new Date(currentOrder.eta).getTime() - new Date().getTime()) / (1000 * 60))} min remaining
                </span>
              </div>
            )}

            {currentOrder.status === "ready" && (
              <div className="space-y-4 pt-4 border-t">
                <div className="text-left">
                  <h3 className="font-semibold mb-2">Pickup Instructions</h3>
                  <p className="text-muted-foreground">{currentOrder.instructions}</p>
                </div>
                <Button onClick={handleFeedback} className="w-full h-12">
                  Mark as Collected
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Order Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(statusConfig).map(([status, config]) => {
                const StatusIcon = config.icon;
                const isCompleted = Object.keys(statusConfig).indexOf(status) <= Object.keys(statusConfig).indexOf(currentOrder.status);
                const isCurrent = status === currentOrder.status;
                
                return (
                  <div key={status} className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                      isCompleted ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}>
                      <StatusIcon size={16} />
                    </div>
                    <span className={cn(
                      "font-medium transition-colors",
                      isCurrent && "text-primary"
                    )}>
                      {config.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="shadow-card text-center">
        <CardContent className="p-8 space-y-6">
          <div className="text-6xl">🎉</div>
          <h2 className="text-2xl font-bold">Thank You!</h2>
          <p className="text-muted-foreground">How was your experience today?</p>
          
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} className="text-3xl hover:scale-110 transition-transform">
                ⭐
              </button>
            ))}
          </div>
          
          <Button onClick={onBack} className="w-full h-12">
            Done
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}