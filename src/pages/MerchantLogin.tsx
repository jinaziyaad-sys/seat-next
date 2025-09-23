import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChefHat, Users } from "lucide-react";

const MerchantLogin = () => {
  const [venue, setVenue] = useState("");
  const [role, setRole] = useState("");
  const navigate = useNavigate();

  const mockVenues = [
    "Joe's Burger Bar",
    "Mama's Pizza Kitchen", 
    "The Coffee Spot",
    "Sushi Express"
  ];

  const handleLogin = () => {
    if (venue && role) {
      localStorage.setItem("merchantVenue", venue);
      localStorage.setItem("merchantRole", role);
      navigate("/merchant/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">
            Merchant Dashboard
          </CardTitle>
          <p className="text-muted-foreground">
            Login to manage your restaurant
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="venue">Select Venue</Label>
            <Select value={venue} onValueChange={setVenue}>
              <SelectTrigger>
                <SelectValue placeholder="Choose your venue" />
              </SelectTrigger>
              <SelectContent>
                {mockVenues.map((v) => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Your Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select your role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={handleLogin} 
            className="w-full" 
            disabled={!venue || !role}
          >
            Login to Dashboard
          </Button>

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="text-center p-4 rounded-lg bg-muted">
              <ChefHat className="mx-auto mb-2 text-primary" size={24} />
              <p className="text-sm font-medium">Kitchen Orders</p>
              <p className="text-xs text-muted-foreground">Manage order lifecycle</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              <Users className="mx-auto mb-2 text-accent" size={24} />
              <p className="text-sm font-medium">Waitlist</p>
              <p className="text-xs text-muted-foreground">Host management</p>
            </div>
          </div>

          <Button 
            variant="outline" 
            onClick={() => navigate("/")}
            className="w-full"
          >
            Back to Patron App
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default MerchantLogin;