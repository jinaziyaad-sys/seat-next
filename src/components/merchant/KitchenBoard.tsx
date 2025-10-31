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
  status: "placed" | "in_prep" | "ready" | "collected" | "no_show";
  items: any[];
  created_at: string;
  eta: string | null;
  notes?: string | null;
  customer_name?: string | null;
  venue_id: string;
}

export const KitchenBoard = ({ venueId }: { venueId: string }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [newOrderNumber, setNewOrderNumber] = useState("");
  const [newOrderItems, setNewOrderItems] = useState("");
  const { toast } = useToast();

  // Fetch orders and set up real-time subscription
  useEffect(() => {
    const fetchOrders = async () => {
      // Fetch orders for this venue
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("venue_id", venueId)
        .neq("status", "collected")
        .order("created_at", { ascending: true });

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
          items: Array.isArray(order.items) ? order.items : [order.items]
        })));
      }
    };

    fetchOrders();

    // Set up real-time subscription
    const channel = supabase
      .channel('kitchen-orders')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders'
      }, (payload) => {
        console.log('Order change:', payload);
        // Refresh orders when any order changes
        fetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId, toast]);

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
      case "placed": return "bg-blue-500";
      case "in_prep": return "bg-yellow-500";
      case "ready": return "bg-green-500";
      case "collected": return "bg-gray-500";
      case "no_show": return "bg-red-500";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Kitchen Orders</h2>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {orders.map((order) => (
          <Card key={order.id} className="shadow-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">#{order.order_number}</CardTitle>
                <Badge className={`${getStatusColor(order.status)} text-white`}>
                  {order.status.replace("_", " ").toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock size={14} />
                <span className={getTimeStatus(order.eta)}>
                  ETA: {formatTime(order.eta)} ({getMinutesLeft(order.eta)}m)
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

              <div className="space-y-2">
                <Select
                  value={order.status}
                  onValueChange={(value) => updateOrderStatus(order.id, value as Order["status"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="placed">Placed</SelectItem>
                    <SelectItem value="in_prep">In Prep</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="collected">Collected</SelectItem>
                    <SelectItem value="no_show">No Show</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
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
              </div>
            </CardContent>
          </Card>
        ))}
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