import { useState } from "react";
import { TabNavigation, QRSimulateButton } from "@/components/TabNavigation";
import { FoodReadyFlow } from "@/components/FoodReadyFlow";
import { TableReadyFlow } from "@/components/TableReadyFlow";
import { ProfileSection } from "@/components/ProfileSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UtensilsCrossed, Users, MapPin, Clock, ChefHat } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [showQRScan, setShowQRScan] = useState(false);
  const navigate = useNavigate();

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

        {/* Merchant Access */}
        <Card className="shadow-card border-2 border-dashed border-muted-foreground/20">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <ChefHat size={28} className="text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold">Restaurant Staff?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Access merchant dashboard to manage orders and waitlists
              </p>
              <Button 
                variant="outline" 
                onClick={() => navigate("/merchant")}
                className="w-full"
              >
                Go to Merchant Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <TabNavigation activeTab="home" onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
