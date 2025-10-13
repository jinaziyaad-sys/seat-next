import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AdminCreateMerchant() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [venueId, setVenueId] = useState("");
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchVenues();
  }, []);

  const fetchVenues = async () => {
    const { data, error } = await supabase
      .from("venues")
      .select("id, name")
      .order("name");

    if (data && !error) {
      setVenues(data);
    }
  };

  const handleCreateMerchant = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password || !venueId) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Create the auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/merchant/auth`,
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create the user role entry
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: authData.user.id,
            venue_id: venueId,
            role: "admin",
          });

        if (roleError) throw roleError;

        toast({
          title: "Success!",
          description: `Merchant account created for ${email}`,
        });

        // Reset form
        setEmail("");
        setPassword("");
        setVenueId("");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create merchant account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft size={20} />
            </Button>
            <div className="mx-auto w-12 h-12 bg-primary rounded-full flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-center">Create Merchant Account</CardTitle>
          <CardDescription className="text-center">
            ReadyUP! Admin Tool - Create staff access for restaurant venues
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateMerchant} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Merchant Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="staff@restaurant.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <p className="text-sm text-muted-foreground">
                This email will be used to login to the merchant portal
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Initial Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <p className="text-sm text-muted-foreground">
                Share this password securely with the merchant
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="venue">Assign to Venue</Label>
              <Select value={venueId} onValueChange={setVenueId} required>
                <SelectTrigger id="venue">
                  <SelectValue placeholder="Select a venue" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {venues.map((venue) => (
                    <SelectItem key={venue.id} value={venue.id}>
                      {venue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                The merchant will have admin access to this venue
              </p>
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h4 className="font-semibold text-sm">What happens after creation:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Merchant receives a confirmation email</li>
                <li>They can login at /merchant/auth</li>
                <li>Full admin access to their venue dashboard</li>
                <li>Can manage orders, waitlist, and settings</li>
              </ul>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating Account..." : "Create Merchant Account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
