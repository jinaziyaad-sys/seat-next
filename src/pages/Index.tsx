import { useState } from "react";
import { TabNavigation, QRSimulateButton } from "@/components/TabNavigation";
import { FoodReadyFlow } from "@/components/FoodReadyFlow";
import { TableReadyFlow } from "@/components/TableReadyFlow";
import { ProfileSection } from "@/components/ProfileSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UtensilsCrossed, Users, MapPin, Clock } from "lucide-react";

const Index = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [showQRScan, setShowQRScan] = useState(false);

  const mockNearbyRestaurants = [
    { name: "Joe's Burger Bar", distance: "150m", wait: "12 min", rating: 4.5 },
    { name: "Mama's Pizza Kitchen", distance: "250m", wait: "18 min", rating: 4.7 },
    { name: "The Coffee Spot", distance: "320m", wait: "5 min", rating: 4.3 },
    { name: "Sushi Express", distance: "450m", wait: "22 min", rating: 4.6 }
  ];

  const handleQRPress = () => {
    setShowQRScan(true);
    setActiveTab("food-ready");
  };

  if (showQRScan || activeTab === "food-ready") {
    return (
      <div className="min-h-screen bg-background">
        <FoodReadyFlow onBack={() => {
          setShowQRScan(false);
          setActiveTab("home");
        }} />
        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    );
  }

  if (activeTab === "table-ready") {
    return (
      <div className="min-h-screen bg-background">
        <TableReadyFlow onBack={() => setActiveTab("home")} />
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
      <QRSimulateButton onPress={handleQRPress} />
      
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

      {/* Quick Actions */}
      <div className="space-y-6 p-6 pb-24">
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

        {/* Nearby Restaurants */}
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <MapPin size={24} className="text-primary" />
              <CardTitle>Nearby Restaurants</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">Within 500m of your location</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockNearbyRestaurants.map((restaurant) => (
              <div
                key={restaurant.name}
                className="flex items-center justify-between rounded-xl border p-4 transition-colors hover:bg-muted"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">{restaurant.name}</h4>
                    <span className="text-sm">⭐ {restaurant.rating}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin size={14} />
                      {restaurant.distance}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={14} />
                      ~{restaurant.wait}
                    </span>
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  Select
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Features Overview */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-semibold">Scan or Select</h4>
                  <p className="text-sm text-muted-foreground">
                    Scan QR code at your table or select a restaurant manually
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-semibold">Enter Details</h4>
                  <p className="text-sm text-muted-foreground">
                    Enter your order number or join the table waitlist
                  </p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-semibold">Get Notified</h4>
                  <p className="text-sm text-muted-foreground">
                    Receive real-time updates when your order or table is ready
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <TabNavigation activeTab="home" onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
