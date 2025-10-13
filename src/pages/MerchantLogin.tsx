import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChefHat, Users, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Venue {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
}

const MerchantLogin = () => {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [role, setRole] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchVenues = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .order("name");

      if (!error && data) {
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

  const handleLogin = () => {
    if (selectedVenue && role) {
      localStorage.setItem("merchantVenueId", selectedVenue.id);
      localStorage.setItem("merchantVenueName", selectedVenue.name);
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
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search restaurants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {isLoading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading venues...
              </div>
            ) : (
              <Select 
                value={selectedVenue?.id || ""} 
                onValueChange={(value) => {
                  const venue = venues.find(v => v.id === value);
                  setSelectedVenue(venue || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose your venue" />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {filteredVenues.length === 0 ? (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      No venues found
                    </div>
                  ) : (
                    filteredVenues.map((venue) => (
                      <SelectItem key={venue.id} value={venue.id}>
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{venue.name}</span>
                          {venue.address && (
                            <span className="text-xs text-muted-foreground">
                              {venue.address}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
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
            disabled={!selectedVenue || !role}
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