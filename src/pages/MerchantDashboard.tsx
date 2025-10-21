import { useNavigate } from "react-router-dom";
import { useMerchantAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { KitchenBoard } from "@/components/merchant/KitchenBoard";
import { WaitlistBoard } from "@/components/merchant/WaitlistBoard";
import { MerchantSettings } from "@/components/merchant/MerchantSettings";
import { StaffManagement } from "@/components/merchant/StaffManagement";
import { MerchantReports } from "@/components/merchant/MerchantReports";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChefHat, Users, Settings, BarChart3, LogOut } from "lucide-react";

const MerchantDashboard = () => {
  const { userRole, loading } = useMerchantAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/merchant/auth");
  };

  if (loading || !userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary">{userRole.venue_name}</h1>
              <p className="text-sm text-muted-foreground capitalize">
                {userRole.role} Dashboard
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
          <TabsList className={userRole.role === "admin" ? "grid w-full grid-cols-5" : "grid w-full grid-cols-2"}>
            <TabsTrigger value="kitchen" className="flex items-center gap-2">
              <ChefHat size={16} />
              Kitchen Orders
            </TabsTrigger>
            <TabsTrigger value="waitlist" className="flex items-center gap-2">
              <Users size={16} />
              Waitlist
            </TabsTrigger>
            {userRole.role === "admin" && (
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
            <KitchenBoard venueId={userRole.venue_id!} />
          </TabsContent>

          <TabsContent value="waitlist">
            <WaitlistBoard venueId={userRole.venue_id!} />
          </TabsContent>

          {userRole.role === "admin" && (
            <>
              <TabsContent value="staff">
                <StaffManagement venueId={userRole.venue_id!} />
              </TabsContent>

              <TabsContent value="settings">
                <MerchantSettings venue={userRole.venue_name!} venueId={userRole.venue_id!} />
              </TabsContent>

              <TabsContent value="reports">
                <MerchantReports venue={userRole.venue_name!} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default MerchantDashboard;