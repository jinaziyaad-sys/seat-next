import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { KitchenBoard } from "@/components/merchant/KitchenBoard";
import { WaitlistBoard } from "@/components/merchant/WaitlistBoard";
import { MerchantSettings } from "@/components/merchant/MerchantSettings";
import { StaffManagement } from "@/components/merchant/StaffManagement";
import { MerchantReports } from "@/components/merchant/MerchantReports";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChefHat, Users, Settings, BarChart3, LogOut } from "lucide-react";

const MerchantDashboard = () => {
  const [venueId, setVenueId] = useState("");
  const [venueName, setVenueName] = useState("");
  const [role, setRole] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const storedVenueId = localStorage.getItem("merchantVenueId");
    const storedVenueName = localStorage.getItem("merchantVenueName");
    const storedRole = localStorage.getItem("merchantRole");
    
    if (!storedVenueId || !storedVenueName || !storedRole) {
      navigate("/merchant");
      return;
    }
    
    setVenueId(storedVenueId);
    setVenueName(storedVenueName);
    setRole(storedRole);
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("merchantVenueId");
    localStorage.removeItem("merchantVenueName");
    localStorage.removeItem("merchantRole");
    navigate("/merchant");
  };

  if (!venueId || !venueName || !role) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary">{venueName}</h1>
              <p className="text-sm text-muted-foreground capitalize">
                {role} Dashboard
              </p>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut size={16} className="mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <Tabs defaultValue="kitchen" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="kitchen" className="flex items-center gap-2">
              <ChefHat size={16} />
              Kitchen Orders
            </TabsTrigger>
            <TabsTrigger value="waitlist" className="flex items-center gap-2">
              <Users size={16} />
              Waitlist
            </TabsTrigger>
            {role === "admin" && (
              <>
                <TabsTrigger value="staff" className="flex items-center gap-2">
                  <Users size={16} />
                  Staff
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings size={16} />
                  Settings
                </TabsTrigger>
                <TabsTrigger value="reports" className="flex items-center gap-2">
                  <BarChart3 size={16} />
                  Reports
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="kitchen">
            <KitchenBoard venueId={venueId} />
          </TabsContent>

          <TabsContent value="waitlist">
            <WaitlistBoard venueId={venueId} />
          </TabsContent>

          {role === "admin" && (
            <>
              <TabsContent value="staff">
                <StaffManagement venueId={venueId} />
              </TabsContent>

              <TabsContent value="settings">
                <MerchantSettings venue={venueName} venueId={venueId} />
              </TabsContent>

              <TabsContent value="reports">
                <MerchantReports venue={venueName} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default MerchantDashboard;