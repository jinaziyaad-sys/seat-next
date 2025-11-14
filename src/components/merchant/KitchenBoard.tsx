import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Plus, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Order {
  id: string;
  order_number: string;
  status: "awaiting_verification" | "placed" | "in_prep" | "ready" | "collected" | "no_show" | "rejected";
  items: any[];
  created_at: string;
  eta: string | null;
  notes?: string | null;
  customer_name?: string | null;
  venue_id: string;
  user_id?: string | null;
  awaiting_merchant_confirmation?: boolean;
  order_ratings?: Array<{
    rating: number;
    feedback_text: string | null;
  }>;
}

export const KitchenBoard = ({ venueId }: { venueId: string }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [newOrderNumber, setNewOrderNumber] = useState("");
  const [newOrderItems, setNewOrderItems] = useState("");
  const [showRejected, setShowRejected] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string>("");
  const [cancelReason, setCancelReason] = useState("");
  const { toast } = useToast();

  // Fetch orders function (defined outside useEffect so subscription can use it)
  const fetchOrders = async () => {
    // Build query based on showRejected state
    const query = supabase
      .from("orders")
      .select(`
        *,
        order_ratings (
          rating,
          feedback_text
        )
      `)
      .eq("venue_id", venueId);

    if (showRejected) {
      // Show only rejected orders, most recent first
      query
        .eq("status", "rejected")
        .order("created_at", { ascending: false });
    } else {
      // Show all orders except rejected
      query
        .neq("status", "rejected")
        .or('status.neq.collected,and(status.eq.collected,awaiting_merchant_confirmation.eq.true)')
        .order("status", { ascending: true }) // awaiting_verification first
        .order("awaiting_merchant_confirmation", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: true });
    }

    const { data: ordersData, error: ordersError } = await query;

    if (ordersError) {
      toast({
        title: "Error",
        description: "Could not load orders",
        variant: "destructive"
      });
      return;
    }

    if (ordersData) {
      setOrders(ordersData.map(order => ({
        ...order,
        items: Array.isArray(order.items) ? order.items : [order.items],
        order_ratings: Array.isArray(order.order_ratings) ? order.order_ratings : []
      })));
    }
  };

  // Fetch orders when showRejected changes
  useEffect(() => {
    fetchOrders();

    // Set up real-time subscription with venue filter
    const channel = supabase
      .channel(`kitchen-orders-${venueId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `venue_id=eq.${venueId}`
      }, (payload) => {
        console.log('Order change for venue:', payload);
        
        // Handle the update directly in state for instant UI update
        if (payload.eventType === 'INSERT') {
          fetchOrders(); // Fetch fresh data for new orders
        } else if (payload.eventType === 'UPDATE' && payload.new) {
          // Optimistically update the specific order in state
          setOrders(prevOrders => 
            prevOrders.map(order => 
              order.id === payload.new.id 
                ? { ...order, ...payload.new as any, items: Array.isArray(payload.new.items) ? payload.new.items : [payload.new.items] }
                : order
            )
          );
          // Also fetch to ensure we have ratings data
          fetchOrders();
        } else if (payload.eventType === 'DELETE') {
          setOrders(prevOrders => prevOrders.filter(order => order.id !== payload.old?.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId, showRejected, toast]);

  const updateOrderStatus = async (orderId: string, newStatus: Order["status"]) => {
    // Optimistic update
    setOrders(prevOrders => 
      prevOrders.map(order => 
        order.id === orderId ? { ...order, status: newStatus } : order
      )
    );

    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      toast({
        title: "Error",
        description: "Could not update order status",
        variant: "destructive"
      });
      // Revert optimistic update on error by refetching
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .neq("status", "collected")
        .order("created_at", { ascending: true });
      if (data) {
        setOrders(data.map(order => ({
          ...order,
          items: Array.isArray(order.items) ? order.items : [order.items]
        })));
      }
      return;
    }

    toast({
      title: "Order Updated",
      description: `Order status changed to ${newStatus.replace("_", " ")}`,
    });
  };

  const getNextStatus = (currentStatus: Order["status"]): Order["status"] | null => {
    switch (currentStatus) {
      case "placed":
        return "in_prep";
      case "in_prep":
        return "ready";
      case "ready":
        return "collected";
      case "collected":
        return null; // No next status, order complete
      case "awaiting_verification":
        return null; // Special handling
      case "no_show":
        return null;
      case "rejected":
        return null;
      default:
        return null;
    }
  };

  const getNextStatusLabel = (currentStatus: Order["status"]): string => {
    switch (currentStatus) {
      case "placed":
        return "In Prep";
      case "in_prep":
        return "Ready";
      case "ready":
        return "Collected";
      default:
        return "";
    }
  };

  const openCancelDialog = (orderId: string) => {
    setCancelOrderId(orderId);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  const cancelOrder = async () => {
    if (!cancelOrderId || !cancelReason.trim()) {
      toast({
        title: "Cancellation Reason Required",
        description: "Please provide a reason for cancelling this order",
        variant: "destructive"
      });
      return;
    }

    // Optimistic update
    setOrders(prevOrders => 
      prevOrders.map(order => 
        order.id === cancelOrderId 
          ? { ...order, status: "rejected", notes: `Cancelled: ${cancelReason}` } 
          : order
      )
    );

    const { error } = await supabase
      .from("orders")
      .update({ 
        status: "rejected",
        eta: null, // Clear ETA for rejected orders
        notes: `Cancelled: ${cancelReason}`,
        updated_at: new Date().toISOString()
      })
      .eq("id", cancelOrderId);

    if (error) {
      toast({
        title: "Error",
        description: "Could not cancel order",
        variant: "destructive"
      });
      fetchOrders(); // Revert
      return;
    }

    toast({
      title: "Order Cancelled",
      description: `Order cancelled: ${cancelReason}`,
    });

    // Reset dialog state
    setCancelDialogOpen(false);
    setCancelOrderId("");
    setCancelReason("");
  };

  const extendETA = async (orderId: string, minutes: number, reason?: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const currentETA = order.eta ? new Date(order.eta) : new Date();
    const newETA = new Date(currentETA.getTime() + minutes * 60000);
    const newNotes = reason ? `Extended: ${reason}` : order.notes;

    // Optimistic update
    setOrders(prevOrders => 
      prevOrders.map(o => 
        o.id === orderId ? { ...o, eta: newETA.toISOString(), notes: newNotes } : o
      )
    );

    const { error } = await supabase
      .from("orders")
      .update({ 
        eta: newETA.toISOString(),
        notes: newNotes
      })
      .eq("id", orderId);

    if (error) {
      toast({
        title: "Error",
        description: "Could not update ETA",
        variant: "destructive"
      });
      // Revert optimistic update on error by refetching
      const { data } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .neq("status", "collected")
        .order("created_at", { ascending: true });
      if (data) {
        setOrders(data.map(order => ({
          ...order,
          items: Array.isArray(order.items) ? order.items : [order.items]
        })));
      }
      return;
    }

    toast({
      title: "ETA Extended",
      description: `Order ETA extended by ${minutes} minutes`,
    });
  };

  const addOrder = async () => {
    if (!newOrderNumber || !newOrderItems || !venueId) return;
    
    const items = newOrderItems.split(",").map(item => ({ name: item.trim() }));
    
    // Call edge function to calculate dynamic ETA
    const { data: etaData, error: etaError } = await supabase.functions.invoke('calculate-order-eta', {
      body: { 
        venue_id: venueId, 
        items, 
        order_number: newOrderNumber.toUpperCase() 
      }
    });

    let eta: string;
    let confidence = 'low';
    
    if (etaError || !etaData) {
      console.error('Error calculating ETA:', etaError);
      // Fallback to default 15 minutes
      eta = new Date(Date.now() + 15 * 60000).toISOString();
    } else {
      eta = new Date(Date.now() + etaData.eta_minutes * 60000).toISOString();
      confidence = etaData.confidence;
      console.log('Dynamic ETA calculated:', etaData);
    }

    const { error } = await supabase
      .from("orders")
      .insert({
        venue_id: venueId,
        order_number: newOrderNumber.toUpperCase(),
        status: "placed",
        items,
        eta
      });

    if (error) {
      toast({
        title: "Error",
        description: "Could not add order",
        variant: "destructive"
      });
      return;
    }

    setNewOrderNumber("");
    setNewOrderItems("");
    toast({
      title: "Order Added",
      description: `Order ${newOrderNumber.toUpperCase()} added to kitchen. ETA: ${etaData?.eta_minutes || 15}m (${confidence} confidence)`,
    });
  };

  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "awaiting_verification": return "bg-orange-500";
      case "placed": return "bg-blue-500";
      case "in_prep": return "bg-yellow-500";
      case "ready": return "bg-green-500";
      case "collected": return "bg-gray-500";
      case "no_show": return "bg-red-500";
      case "rejected": return "bg-red-600";
      default: return "bg-gray-500";
    }
  };

  const getTimeStatus = (eta: string | null) => {
    if (!eta) return "text-muted-foreground";
    const now = new Date();
    const etaDate = new Date(eta);
    const diff = etaDate.getTime() - now.getTime();
    const minutes = diff / (1000 * 60);
    
    if (minutes < -7) return "text-red-500";
    if (minutes < -3) return "text-amber-500";
    return "text-muted-foreground";
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "No ETA set";
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", { 
      hour: "2-digit", 
      minute: "2-digit",
      hour12: false 
    });
  };

  const getMinutesLeft = (eta: string | null) => {
    if (!eta) return 0;
    const diff = new Date(eta).getTime() - new Date().getTime();
    const minutes = Math.ceil(diff / (1000 * 60));
    return minutes;
  };

  const closeOrder = async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ awaiting_merchant_confirmation: false })
      .eq("id", orderId);

    if (error) {
      toast({
        title: "Error",
        description: "Could not close order",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Order Closed",
      description: "Order has been marked as complete",
    });
  };

  const confirmPatronOrder = async (orderId: string) => {
    // Change status from awaiting_verification to placed
    const { error } = await supabase
      .from("orders")
      .update({ 
        status: 'placed'
      })
      .eq("id", orderId);

    if (error) {
      toast({
        title: "Error",
        description: "Could not verify order",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Order Verified ✓",
      description: "Patron can now track their order",
    });
  };

  const rejectPatronOrder = async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ 
        status: 'rejected',
        eta: null, // Clear ETA so it doesn't affect analytics
        updated_at: new Date().toISOString()
      })
      .eq("id", orderId);

    if (error) {
      toast({
        title: "Error",
        description: "Could not reject order",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Order Rejected",
      description: "Order marked as invalid and moved to rejected orders",
    });
  };

  const clearAllRejectedOrders = async () => {
    // Get all rejected order IDs first
    const { data: rejectedOrders } = await supabase
      .from("orders")
      .select("id")
      .eq("venue_id", venueId)
      .eq("status", "rejected");

    if (!rejectedOrders || rejectedOrders.length === 0) {
      toast({
        title: "No Orders",
        description: "No rejected orders to clear",
      });
      return;
    }

    // Delete the orders
    const { error } = await supabase
      .from("orders")
      .delete()
      .eq("venue_id", venueId)
      .eq("status", "rejected");

    if (error) {
      toast({
        title: "Error",
        description: "Could not clear rejected orders",
        variant: "destructive"
      });
      return;
    }

    // Delete their analytics records
    const orderIds = rejectedOrders.map(o => o.id);
    await supabase
      .from("order_analytics")
      .delete()
      .in("order_id", orderIds);

    setOrders(prevOrders => prevOrders.filter(o => o.status !== 'rejected'));
    setShowRejected(false); // Switch back to active view

    toast({
      title: "Rejected Orders Cleared",
      description: `${rejectedOrders.length} invalid ${rejectedOrders.length === 1 ? 'order' : 'orders'} removed`,
    });
  };

  const handleClearAllRejected = () => {
    if (window.confirm('Are you sure you want to permanently delete all rejected orders? This cannot be undone.')) {
      clearAllRejectedOrders();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {showRejected ? "Rejected Orders" : "Kitchen Orders"}
        </h2>
        <div className="flex gap-2">
          {showRejected && (
            <Button
              variant="destructive"
              onClick={handleClearAllRejected}
            >
              Clear All Rejected
            </Button>
          )}
          <Button
            variant={showRejected ? "default" : "outline"}
            onClick={() => setShowRejected(!showRejected)}
          >
            {showRejected ? "Active Orders" : "Rejected Orders"}
          </Button>
          <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus size={16} className="mr-2" />
              Add Order
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Order</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="orderNumber">Order Number</Label>
                <Input
                  id="orderNumber"
                  value={newOrderNumber}
                  onChange={(e) => setNewOrderNumber(e.target.value)}
                  placeholder="e.g., A123"
                  maxLength={8}
                />
              </div>
              <div>
                <Label htmlFor="items">Items (comma separated)</Label>
                <Textarea
                  id="items"
                  value={newOrderItems}
                  onChange={(e) => setNewOrderItems(e.target.value)}
                  placeholder="e.g., Burger, Fries, Coke"
                />
              </div>
              <Button onClick={addOrder} className="w-full">
                Add Order
              </Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Cancel Order Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please provide a reason for cancelling this order. This will be recorded for accountability.
            </p>
            <div>
              <Label htmlFor="cancelReason">Cancellation Reason *</Label>
              <Textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g., Customer requested cancellation, Wrong order entered, Customer no-show..."
                className="mt-2"
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCancelDialogOpen(false);
                  setCancelOrderId("");
                  setCancelReason("");
                }}
                className="flex-1"
              >
                Keep Order
              </Button>
              <Button
                variant="destructive"
                onClick={cancelOrder}
                disabled={!cancelReason.trim()}
                className="flex-1"
              >
                Cancel Order
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showRejected && orders.length > 0 && (
        <p className="text-sm text-muted-foreground mb-4">
          {orders.length} rejected {orders.length === 1 ? 'order' : 'orders'} to review
        </p>
      )}

      <style>{`
        @keyframes flash-green {
          0%, 100% { background-color: rgba(34, 197, 94, 0.2); }
          50% { background-color: rgba(34, 197, 94, 0.5); }
        }
        @keyframes flash-orange {
          0%, 100% { background-color: rgba(249, 115, 22, 0.2); }
          50% { background-color: rgba(249, 115, 22, 0.5); }
        }
        .awaiting-confirmation {
          animation: flash-green 2s ease-in-out infinite;
        }
        .awaiting-patron-verification {
          animation: flash-orange 2s ease-in-out infinite;
        }
      `}</style>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {orders.map((order) => {
          const hasRating = order.order_ratings && order.order_ratings.length > 0;
          const rating = hasRating ? order.order_ratings[0] : null;
          
          return (
            <Card 
              key={order.id} 
              className={`shadow-card ${
                order.status === 'awaiting_verification' ? 'awaiting-patron-verification' : 
                order.awaiting_merchant_confirmation ? 'awaiting-confirmation' : ''
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">#{order.order_number}</CardTitle>
                  <div className="flex flex-col gap-1 items-end">
                    <Badge className={`${getStatusColor(order.status)} text-white`}>
                      {order.status.replace("_", " ").toUpperCase()}
                    </Badge>
                    {order.status === 'awaiting_verification' && (
                      <Badge className="bg-orange-500 text-white animate-pulse text-xs">
                        NEEDS VERIFICATION
                      </Badge>
                    )}
                    {order.awaiting_merchant_confirmation && (
                      <Badge className="bg-green-500 text-white text-xs">
                        AWAITING CONFIRMATION
                      </Badge>
                    )}
                  </div>
                </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock size={14} />
                <span className={getTimeStatus(order.eta)}>
                  {getMinutesLeft(order.eta)} min • ETA {formatTime(order.eta)}
                </span>
                {getMinutesLeft(order.eta) < 0 && (
                  <AlertTriangle size={14} className="text-red-500" />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-sm mb-2">Items:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {order.items.map((item: any, index: number) => (
                    <li key={index}>• {item.name || item}</li>
                  ))}
                </ul>
              </div>

              {order.customer_name && (
                <div className="p-2 bg-muted rounded text-sm">
                  <strong>Customer:</strong> {order.customer_name}
                </div>
              )}

              {order.notes && (
                <div className="p-2 bg-muted rounded text-sm">
                  {order.notes}
                </div>
              )}

              {hasRating && rating && (
                <div className="p-3 bg-primary/10 rounded-lg space-y-2 border border-primary/20">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Customer Rating:</span>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star} className={star <= rating.rating ? "text-yellow-400" : "text-gray-300"}>
                          ⭐
                        </span>
                      ))}
                    </div>
                    <span className="text-sm font-bold">({rating.rating}/5)</span>
                  </div>
                  {rating.feedback_text && (
                    <p className="text-sm text-muted-foreground italic">
                      "{rating.feedback_text}"
                    </p>
                  )}
                </div>
              )}

              {order.status === 'awaiting_verification' ? (
                <div className="space-y-2">
                  <div className="p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200">
                    <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                      Patron Order #{order.order_number}
                    </p>
                    <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                      Verify this order exists in your POS system
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => confirmPatronOrder(order.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      ✓ Valid Order
                    </Button>
                    <Button
                      onClick={() => rejectPatronOrder(order.id)}
                      variant="destructive"
                    >
                      ✗ Not Found
                    </Button>
                  </div>
                </div>
              ) : order.awaiting_merchant_confirmation ? (
                <Button 
                  onClick={() => closeOrder(order.id)}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  ✓ Close Order
                </Button>
              ) : (
                <div className="space-y-2">
                  {/* Primary Action: Move to Next Stage */}
                  {getNextStatus(order.status) ? (
                    <Button
                      onClick={() => updateOrderStatus(order.id, getNextStatus(order.status)!)}
                      className="w-full bg-primary hover:bg-primary/90"
                      size="lg"
                    >
                      Move to: {getNextStatusLabel(order.status)} →
                    </Button>
                  ) : order.status === "collected" ? (
                    <div className="w-full p-3 bg-green-100 dark:bg-green-900 rounded-lg text-center">
                      <span className="text-green-700 dark:text-green-100 font-semibold">
                        ✓ Order Completed
                      </span>
                    </div>
                  ) : null}

                  {/* Cancel Order Button - Always Visible for Active Orders */}
                  {order.status !== "collected" && order.status !== "rejected" && order.status !== "no_show" && (
                    <Button
                      onClick={() => openCancelDialog(order.id)}
                      variant="destructive"
                      className="w-full"
                      size="sm"
                    >
                      Cancel Order
                    </Button>
                  )}

                  {/* ETA Extension Buttons - Only show for in_prep and ready */}
                  {(order.status === "in_prep" || order.status === "ready") && (
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => extendETA(order.id, 5, "Kitchen delay")}
                        className="flex-1"
                      >
                        +5m
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => extendETA(order.id, 10, "Extra prep time")}
                        className="flex-1"
                      >
                        +10m
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => extendETA(order.id, 15, "Busy period")}
                        className="flex-1"
                      >
                        +15m
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
        })}
      </div>

      {orders.length === 0 && (
        <Card className="p-12 text-center">
          <CardContent>
            <p className="text-muted-foreground">No orders currently in the kitchen</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};