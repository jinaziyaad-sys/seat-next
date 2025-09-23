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

interface Order {
  id: string;
  orderNumber: string;
  status: "placed" | "in-prep" | "ready" | "collected" | "no-show";
  items: string[];
  placedAt: Date;
  eta: Date;
  notes?: string;
}

export const KitchenBoard = ({ venue }: { venue: string }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [newOrderNumber, setNewOrderNumber] = useState("");
  const [newOrderItems, setNewOrderItems] = useState("");
  const { toast } = useToast();

  // Mock orders for demo
  useEffect(() => {
    const mockOrders: Order[] = [
      {
        id: "1",
        orderNumber: "A123",
        status: "placed",
        items: ["Burger", "Fries", "Coke"],
        placedAt: new Date(Date.now() - 5 * 60000),
        eta: new Date(Date.now() + 5 * 60000)
      },
      {
        id: "2", 
        orderNumber: "B456",
        status: "in-prep",
        items: ["Pizza Margherita", "Garlic Bread"],
        placedAt: new Date(Date.now() - 15 * 60000),
        eta: new Date(Date.now() - 2 * 60000)
      },
      {
        id: "3",
        orderNumber: "C789",
        status: "ready",
        items: ["Caesar Salad", "Lemonade"],
        placedAt: new Date(Date.now() - 25 * 60000),
        eta: new Date(Date.now() - 5 * 60000)
      }
    ];
    setOrders(mockOrders);
  }, []);

  const updateOrderStatus = (orderId: string, newStatus: Order["status"]) => {
    setOrders(prev => prev.map(order => 
      order.id === orderId ? { ...order, status: newStatus } : order
    ));
    toast({
      title: "Order Updated",
      description: `Order status changed to ${newStatus.replace("-", " ")}`,
    });
  };

  const extendETA = (orderId: string, minutes: number, reason?: string) => {
    setOrders(prev => prev.map(order => 
      order.id === orderId 
        ? { 
            ...order, 
            eta: new Date(order.eta.getTime() + minutes * 60000),
            notes: reason ? `Extended: ${reason}` : order.notes
          } 
        : order
    ));
    toast({
      title: "ETA Extended",
      description: `Order ETA extended by ${minutes} minutes`,
    });
  };

  const addOrder = () => {
    if (!newOrderNumber || !newOrderItems) return;
    
    const newOrder: Order = {
      id: Date.now().toString(),
      orderNumber: newOrderNumber.toUpperCase(),
      status: "placed",
      items: newOrderItems.split(",").map(item => item.trim()),
      placedAt: new Date(),
      eta: new Date(Date.now() + 10 * 60000)
    };
    
    setOrders(prev => [...prev, newOrder]);
    setNewOrderNumber("");
    setNewOrderItems("");
    toast({
      title: "Order Added",
      description: `Order ${newOrder.orderNumber} added to kitchen`,
    });
  };

  const getStatusColor = (status: Order["status"]) => {
    switch (status) {
      case "placed": return "bg-blue-500";
      case "in-prep": return "bg-yellow-500";
      case "ready": return "bg-green-500";
      case "collected": return "bg-gray-500";
      case "no-show": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getTimeStatus = (eta: Date) => {
    const now = new Date();
    const diff = eta.getTime() - now.getTime();
    const minutes = diff / (1000 * 60);
    
    if (minutes < -7) return "text-red-500";
    if (minutes < -3) return "text-amber-500";
    return "text-muted-foreground";
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", { 
      hour: "2-digit", 
      minute: "2-digit",
      hour12: false 
    });
  };

  const getMinutesLeft = (eta: Date) => {
    const diff = eta.getTime() - new Date().getTime();
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
                <CardTitle className="text-lg">#{order.orderNumber}</CardTitle>
                <Badge className={`${getStatusColor(order.status)} text-white`}>
                  {order.status.replace("-", " ").toUpperCase()}
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
                  {order.items.map((item, index) => (
                    <li key={index}>• {item}</li>
                  ))}
                </ul>
              </div>

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
                  <SelectContent>
                    <SelectItem value="placed">Placed</SelectItem>
                    <SelectItem value="in-prep">In Prep</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="collected">Collected</SelectItem>
                    <SelectItem value="no-show">No Show</SelectItem>
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