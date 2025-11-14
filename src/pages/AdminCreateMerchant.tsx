import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, UserPlus, Store, AlertTriangle, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AdminCreateMerchant() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [venueId, setVenueId] = useState("");
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  // Venue creation form
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venuePhone, setVenuePhone] = useState("");
  
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkSuperAdminAccess();
  }, []);

  const checkSuperAdminAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Access Denied",
          description: "You must be logged in to access this page",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      // Check if user has super_admin role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .single();

      if (!roles) {
        toast({
          title: "Access Denied",
          description: "Only app developers can access this page",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setIsSuperAdmin(true);
      fetchVenues();
    } catch (error) {
      console.error("Auth check error:", error);
      navigate("/");
    } finally {
      setCheckingAuth(false);
    }
  };

  const fetchVenues = async () => {
    const { data, error } = await supabase
      .from("venues")
      .select("id, name")
      .order("name");

    if (data && !error) {
      setVenues(data);
    }
  };

  const handleCreateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!venueName) {
      toast({
        title: "Missing Information",
        description: "Venue name is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      let latitude = null;
      let longitude = null;

      // Validate address and get coordinates if address is provided
      if (venueAddress) {
        toast({
          title: "Validating address...",
          description: "Please wait while we verify the location.",
        });

        const { data: validationData, error: validationError } = await supabase.functions.invoke('validate-address', {
          body: { address: venueAddress },
        });

        if (validationError) {
          toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Failed to validate address. Please try again.",
          });
          setLoading(false);
          return;
        }

        if (!validationData.valid) {
          toast({
            variant: "destructive",
            title: "Invalid Address",
            description: validationData.error || "Address not found. Please check and try again.",
          });
          setLoading(false);
          return;
        }

        latitude = validationData.latitude;
        longitude = validationData.longitude;

        toast({
          title: "Address Verified!",
          description: `Location: ${validationData.formatted_address}`,
        });
      }

      const { data, error } = await supabase
        .from("venues")
        .insert({
          name: venueName,
          address: venueAddress || null,
          phone: venuePhone || null,
          latitude,
          longitude,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success!",
        description: `Venue "${venueName}" created successfully${latitude ? ' with GPS coordinates!' : ''}`,
      });

      // Reset form and refresh venues
      setVenueName("");
      setVenueAddress("");
      setVenuePhone("");
      fetchVenues();
    } catch (error: any) {
      console.error('Error creating venue:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create venue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
      // Call the edge function to create merchant account
      const { data, error } = await supabase.functions.invoke('create-merchant', {
        body: {
          email,
          password,
          venueId,
          role: 'admin',
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.success) {
        const message = data.isNewUser 
          ? `Account created! ${email} will receive a verification email.`
          : `User ${email} assigned to venue successfully.`;
        
        toast({
          title: "Success!",
          description: message,
        });

        // Reset form
        setEmail("");
        setPassword("");
        setVenueId("");
      }
    } catch (error: any) {
      console.error('Error creating merchant:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create merchant account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <p>Verifying access...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold">Access Denied</h2>
            <p className="text-muted-foreground">
              This page is restricted to app developers only.
            </p>
            <Button onClick={() => navigate("/")}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <div className="flex items-center gap-4 mb-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft size={20} />
            </Button>
            <div className="mx-auto w-12 h-12 bg-primary rounded-full flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-center">Developer Admin Panel</CardTitle>
          <CardDescription className="text-center">
            Create venues and merchant admin accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="venue" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="venue">Create Venue</TabsTrigger>
              <TabsTrigger value="merchant">Create Merchant Admin</TabsTrigger>
            </TabsList>

            <TabsContent value="venue" className="mt-6">
              <form onSubmit={handleCreateVenue} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="venue-name">Venue Name *</Label>
                  <Input
                    id="venue-name"
                    type="text"
                    placeholder="e.g. The Gourmet Corner"
                    value={venueName}
                    onChange={(e) => setVenueName(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="venue-address">Address (for GPS tracking)</Label>
                  <Textarea
                    id="venue-address"
                    placeholder="123 Main St, City, State/Province, Country"
                    value={venueAddress}
                    onChange={(e) => setVenueAddress(e.target.value)}
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    Address will be validated and GPS coordinates will be stored automatically
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="venue-phone">Phone</Label>
                  <Input
                    id="venue-phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={venuePhone}
                    onChange={(e) => setVenuePhone(e.target.value)}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  <Store className="w-4 h-4 mr-2" />
                  {loading ? "Creating Venue..." : "Create Venue"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="merchant" className="mt-6">
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

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                New accounts must verify their email before logging in.
              </AlertDescription>
            </Alert>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h4 className="font-semibold text-sm">What happens after creation:</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Merchant receives email verification link</li>
                <li>After verification, they can login at /merchant/auth</li>
                <li>Full admin access to their venue dashboard</li>
                <li>Can manage orders, waitlist, and settings</li>
              </ul>
            </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  {loading ? "Creating Account..." : "Create Merchant Admin"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold text-sm mb-2">Current Venues ({venues.length})</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {venues.map((venue) => (
                <div key={venue.id} className="text-sm text-muted-foreground">
                  • {venue.name}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
