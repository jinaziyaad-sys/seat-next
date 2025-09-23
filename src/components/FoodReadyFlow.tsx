import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Clock, CheckCircle, Package, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

type OrderStatus = "placed" | "in-prep" | "ready" | "collected";

interface Order {
  id: string;
  venue: string;
  status: OrderStatus;
  eta: number; // minutes
  instructions?: string;
}

const statusConfig = {
  placed: { label: "Order Placed", icon: Package, color: "bg-slate text-white", progress: 25 },
  "in-prep": { label: "In Preparation", icon: Clock, color: "bg-warning text-white", progress: 60 },
  ready: { label: "Ready for Pickup", icon: CheckCircle, color: "bg-primary text-primary-foreground", progress: 90 },
  collected: { label: "Collected", icon: Truck, color: "bg-success text-white", progress: 100 },
};

export function FoodReadyFlow({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<"scan" | "order-entry" | "tracking" | "feedback">("scan");
  const [orderNumber, setOrderNumber] = useState("");
  const [selectedVenue, setSelectedVenue] = useState("");
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);

  const mockVenues = [
    "Joe's Burger Bar",
    "Mama's Pizza Kitchen", 
    "The Coffee Spot",
    "Sushi Express"
  ];

  const handleQRScan = () => {
    setSelectedVenue("Joe's Burger Bar");
    setStep("order-entry");
  };

  const handleOrderSubmit = () => {
    if (orderNumber.trim()) {
      const order: Order = {
        id: orderNumber.toUpperCase(),
        venue: selectedVenue,
        status: "placed",
        eta: 12,
        instructions: "Please collect from the main counter"
      };
      setCurrentOrder(order);
      setStep("tracking");
      
      // Simulate status progression
      setTimeout(() => {
        setCurrentOrder(prev => prev ? { ...prev, status: "in-prep", eta: 8 } : null);
      }, 3000);
      
      setTimeout(() => {
        setCurrentOrder(prev => prev ? { ...prev, status: "ready", eta: 0 } : null);
      }, 8000);
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
          </CardHeader>
          <CardContent className="space-y-3">
            {mockVenues.map((venue) => (
              <Button
                key={venue}
                variant="outline" 
                className="w-full justify-start h-12"
                onClick={() => {
                  setSelectedVenue(venue);
                  setStep("order-entry");
                }}
              >
                {venue}
              </Button>
            ))}
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

            {currentOrder.eta > 0 && (
              <div className="flex items-center justify-center gap-2 text-lg">
                <Clock size={20} />
                <span className="font-semibold">{currentOrder.eta} min remaining</span>
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