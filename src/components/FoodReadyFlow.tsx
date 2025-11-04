import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Clock, CheckCircle, Package, Truck, Search, MapPin, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { sendBrowserNotification, vibratePhone, initializePushNotifications } from "@/utils/notifications";

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

export function FoodReadyFlow({ onBack, initialOrder }: { onBack: () => void; initialOrder?: any }) {
  const [step, setStep] = useState<"scan" | "order-entry" | "tracking" | "feedback">("scan");
  const [orderNumber, setOrderNumber] = useState("");
  const [selectedVenue, setSelectedVenue] = useState("");
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [venues, setVenues] = useState<{id: string; name: string; address?: string; phone?: string}[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const { toast } = useToast();

  // Get authenticated user and initialize notifications
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
      
      // Initialize push notifications if user is logged in
      if (user?.id) {
        const FIREBASE_PROJECT_ID = 'cuoqjgahpfymxqrdlzlf'; // Use your Supabase project ID
        await initializePushNotifications(FIREBASE_PROJECT_ID);
      }
    };
    getUser();
  }, []);

  // Handle initial order from home page
  useEffect(() => {
    if (initialOrder) {
      const order: Order = {
        id: initialOrder.id,
        order_number: initialOrder.order_number,
        venue: initialOrder.venues?.name || "",
        status: initialOrder.status,
        eta: initialOrder.eta,
        instructions: "Please collect from the main counter",
        items: Array.isArray(initialOrder.items) ? initialOrder.items : [initialOrder.items]
      };
      setCurrentOrder(order);
      setStep("tracking");

      // Set up real-time subscription
      const channel = supabase
        .channel(`order-${initialOrder.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${initialOrder.id}`
        }, (payload) => {
          if (payload.new) {
            setCurrentOrder(prev => prev ? {
              ...prev,
              status: payload.new.status,
              eta: payload.new.eta
            } : null);
            
            // Send notification when order is ready
            if (payload.new.status === 'ready') {
              sendBrowserNotification(
                "🍔 Your Order is Ready!",
                `Order #${payload.new.order_number} is ready for pickup`,
                { tag: 'order-ready', requireInteraction: true }
              );
              vibratePhone([200, 100, 200, 100, 200]);
            }
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [initialOrder]);

  // Fetch venues on component mount - only show food_ready venues
  useEffect(() => {
    const fetchVenues = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("venues")
        .select("id, name, address, phone, service_types")
        .contains("service_types", ["food_ready"])
        .order("name");
      
      if (data && !error) {
        setVenues(data);
      }
      setIsLoading(false);
    };

    fetchVenues();
  }, []);

  const filteredVenues = venues.filter(venue => 
    venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (venue.address && venue.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );


  const handleOrderSubmit = async () => {
    if (!orderNumber.trim() || !selectedVenue) return;

    // Check if user is authenticated
    if (!userId) {
      toast({
        title: "Registration Required",
        description: "Please create an account to track your food orders in real-time.",
        variant: "default",
        action: (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.location.href = '/auth'}
          >
            Sign Up
          </Button>
        ),
      });
      return;
    }

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
      // Order found, update with user_id if logged in and not already set
      if (userId && !existingOrder.user_id) {
        await supabase
          .from("orders")
          .update({ user_id: userId })
          .eq("id", existingOrder.id);
      }

      // Start tracking
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
            
            // Send notification when order is ready
            if (payload.new.status === 'ready') {
              sendBrowserNotification(
                "🍔 Your Order is Ready!",
                `Order #${payload.new.order_number} is ready for pickup`,
                { tag: 'order-ready', requireInteraction: true }
              );
              vibratePhone([200, 100, 200, 100, 200]);
            }
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
          eta: new Date(Date.now() + 12 * 60000).toISOString(),
          user_id: userId
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

  const handleRatingSubmit = async () => {
    if (!rating || !currentOrder) return;
    
    setIsSubmittingRating(true);
    
    try {
      // Insert rating
      const { error: ratingError } = await supabase
        .from('order_ratings')
        .insert({
          order_id: currentOrder.id,
          venue_id: venues.find(v => v.name === currentOrder.venue)?.id,
          user_id: userId,
          rating,
          feedback_text: feedbackText.trim() || null
        });

      if (ratingError) throw ratingError;

      // Update order status
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'collected',
          awaiting_merchant_confirmation: true
        })
        .eq('id', currentOrder.id);

      if (orderError) throw orderError;

      toast({
        title: "Thank you for your feedback!",
        description: "Your rating has been submitted successfully."
      });
      
      onBack();
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast({
        title: "Error",
        description: "Could not submit rating. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleSkipRating = async () => {
    if (!currentOrder) return;
    
    // Just mark as collected without rating
    await supabase
      .from('orders')
      .update({
        status: 'collected',
        awaiting_merchant_confirmation: true
      })
      .eq('id', currentOrder.id);
    
    onBack();
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
          <CardHeader>
            <CardTitle>Select Restaurant</CardTitle>
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
              <div className="space-y-2 mt-4">
                <div className="text-sm text-muted-foreground">
                  {filteredVenues.length} {filteredVenues.length === 1 ? 'restaurant' : 'restaurants'} found
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2"
                     style={{ scrollbarGutter: 'stable' }}>
                  {filteredVenues.map((venue) => (
                    <Card 
                      key={venue.id}
                      className="cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => {
                        setSelectedVenue(venue.name);
                        setStep("order-entry");
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{venue.name}</span>
                          {venue.address && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin size={14} />
                              <span>{venue.address}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
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
          <h1 className="text-2xl font-bold">Order #{currentOrder.order_number}</h1>
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
                  {Math.ceil((new Date(currentOrder.eta).getTime() - new Date().getTime()) / (1000 * 60))} minutes • ETA {new Date(currentOrder.eta).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
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
    <div className="space-y-6 p-6 max-w-lg mx-auto">
      <Card className="shadow-card text-center">
        <CardContent className="p-8 space-y-6">
          <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-success/10 flex items-center justify-center animate-scale-in">
            <CheckCircle className="w-10 h-10 text-success" />
          </div>
          <h2 className="text-3xl font-bold">Thank You!</h2>
          <p className="text-lg text-muted-foreground">Rate Your Experience</p>
          
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button 
                key={star} 
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition-all duration-200 hover:scale-110 active:scale-95"
                disabled={isSubmittingRating}
              >
                <Star
                  size={48}
                  className={
                    hoveredRating > 0 && star <= hoveredRating
                      ? "fill-success/70 stroke-success transition-all duration-200"
                    : star <= rating
                      ? "fill-success stroke-success transition-all duration-200"
                    : "fill-transparent stroke-slate/30 stroke-[1.5] transition-all duration-200"
                  }
                />
              </button>
            ))}
          </div>
          
          {rating > 0 && (
            <div className="text-sm font-medium text-primary animate-fade-in">
              {rating === 5 && "Exceptional"}
              {rating === 4 && "Very Good"}
              {rating === 3 && "Satisfactory"}
              {rating === 2 && "Needs Improvement"}
              {rating === 1 && "Below Expectations"}
            </div>
          )}
          
          <div className="space-y-2 animate-fade-in">
            <Label htmlFor="feedback" className="text-sm text-muted-foreground">
              Tell us more (optional)
            </Label>
            <Textarea
              id="feedback"
              placeholder="What did you like? Any suggestions?"
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value.slice(0, 500))}
              maxLength={500}
              rows={4}
              className="resize-none"
              disabled={isSubmittingRating}
            />
            <div className="text-xs text-muted-foreground text-right">
              {feedbackText.length}/500
            </div>
          </div>
          
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={handleSkipRating} 
              className="flex-1 h-12"
              disabled={isSubmittingRating}
            >
              Skip
            </Button>
            <Button 
              onClick={handleRatingSubmit}
              disabled={!rating || isSubmittingRating}
              className="flex-1 h-12"
            >
              {isSubmittingRating ? "Submitting..." : "Submit Rating"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}