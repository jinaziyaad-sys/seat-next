import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDevAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Store, UserPlus, LogOut, BarChart3, Users, ShoppingBag, Trash2, UtensilsCrossed, Edit2, Save, X, Download } from "lucide-react";
import { PasswordResetDialog } from "@/components/PasswordResetDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PatronManagement } from "@/components/dev/PatronManagement";
import { PlatformAnalytics } from "@/components/dev/PlatformAnalytics";
import * as XLSX from 'xlsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Venue {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  service_types?: string[];
  orders_count?: number;
  waitlist_count?: number;
  staff_count?: number;
}

interface MerchantUser {
  id: string;
  user_id: string;
  venue_id: string;
  role: string;
  email?: string;
  full_name?: string;
  venue_name?: string;
}

export default function DevDashboard() {
  const { loading: authLoading } = useDevAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [merchantUsers, setMerchantUsers] = useState<MerchantUser[]>([]);
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venuePhone, setVenuePhone] = useState("");
  const [serviceTypes, setServiceTypes] = useState<string[]>(["food_ready", "table_ready"]);
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null);
  const [editingServiceTypes, setEditingServiceTypes] = useState<string[]>([]);
  const [merchantEmail, setMerchantEmail] = useState("");
  const [merchantPassword, setMerchantPassword] = useState("");
  const [merchantFullName, setMerchantFullName] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading) {
      fetchVenues();
      fetchMerchantUsers();
    }
  }, [authLoading]);

  const fetchVenues = async () => {
    const { data: venuesData } = await supabase
      .from("venues")
      .select("*")
      .order("name");

    if (venuesData) {
      // Fetch counts for each venue
      const venuesWithCounts = await Promise.all(
        venuesData.map(async (venue) => {
          const [ordersCount, waitlistCount, staffCount] = await Promise.all([
            supabase.from("orders").select("*", { count: "exact", head: true }).eq("venue_id", venue.id),
            supabase.from("waitlist_entries").select("*", { count: "exact", head: true }).eq("venue_id", venue.id),
            supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("venue_id", venue.id),
          ]);

          return {
            ...venue,
            orders_count: ordersCount.count || 0,
            waitlist_count: waitlistCount.count || 0,
            staff_count: staffCount.count || 0,
          };
        })
      );

      setVenues(venuesWithCounts);
    }
  };

  const handleCreateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (serviceTypes.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one service type",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    try {
      let latitude = null;
      let longitude = null;

      // Validate address and get coordinates if address is provided
      if (venueAddress && venueAddress.trim()) {
        console.log('Starting address validation for:', venueAddress);
        
        toast({
          title: "Validating address...",
          description: "Please wait while we verify the location.",
        });

        const { data: validationData, error: validationError } = await supabase.functions.invoke('validate-address', {
          body: { address: venueAddress },
        });

        console.log('Validation response:', { validationData, validationError });

        if (validationError) {
          console.error('Validation error:', validationError);
          toast({
            variant: "destructive",
            title: "Validation Error",
            description: `Failed to validate address: ${validationError.message || 'Please try again.'}`,
          });
          setLoading(false);
          return;
        }

        if (!validationData || !validationData.valid) {
          console.warn('Address validation failed:', validationData);
          toast({
            variant: "destructive",
            title: "Invalid Address",
            description: validationData?.error || "Address not found. Please check and try again.",
          });
          setLoading(false);
          return;
        }

        latitude = validationData.latitude;
        longitude = validationData.longitude;

        console.log('Address validated successfully:', { latitude, longitude });
        
        toast({
          title: "Address Verified!",
          description: `Location: ${validationData.formatted_address}`,
        });
      }

      const { error } = await supabase
        .from("venues")
        .insert({
          name: venueName,
          address: venueAddress || null,
          phone: venuePhone || null,
          service_types: serviceTypes,
          latitude,
          longitude,
        });

      if (error) throw error;

      toast({
        title: "Success!",
        description: `Venue "${venueName}" created successfully${latitude ? ' with GPS coordinates!' : ''}`,
      });

      setVenueName("");
      setVenueAddress("");
      setVenuePhone("");
      setServiceTypes(["food_ready", "table_ready"]);
      fetchVenues();
    } catch (error: any) {
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
    
    if (!merchantEmail || !merchantPassword || !merchantFullName || !selectedVenueId) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-merchant", {
        body: {
          email: merchantEmail,
          password: merchantPassword,
          fullName: merchantFullName,
          venueId: selectedVenueId,
          role: "admin",
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Success!",
        description: `Merchant admin account created for ${merchantEmail}`,
      });

      setMerchantEmail("");
      setMerchantPassword("");
      setMerchantFullName("");
      setSelectedVenueId("");
      fetchVenues();
      fetchMerchantUsers();
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

  const fetchMerchantUsers = async () => {
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select(`
        id,
        user_id,
        venue_id,
        role,
        venues (
          name
        )
      `)
      .in("role", ["admin", "staff"])
      .order("role");

    if (rolesData) {
      // Fetch user profiles for each role
      const usersWithProfiles = await Promise.all(
        rolesData.map(async (role: any) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("email, full_name")
            .eq("id", role.user_id)
            .single();

          return {
            id: role.id,
            user_id: role.user_id,
            venue_id: role.venue_id,
            role: role.role,
            email: profile?.email || "",
            full_name: profile?.full_name || "",
            venue_name: role.venues?.name || "N/A",
          };
        })
      );

      setMerchantUsers(usersWithProfiles);
    }
  };

  const handleDeleteVenue = async (venueId: string, venueName: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("venues")
        .delete()
        .eq("id", venueId);

      if (error) throw error;

      toast({
        title: "Success!",
        description: `Venue "${venueName}" deleted successfully`,
      });

      fetchVenues();
      fetchMerchantUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete venue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditServiceTypes = (venueId: string, currentServiceTypes: string[]) => {
    setEditingVenueId(venueId);
    setEditingServiceTypes(currentServiceTypes || ["food_ready", "table_ready"]);
  };

  const handleSaveServiceTypes = async (venueId: string, venueName: string) => {
    if (editingServiceTypes.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one service type",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("venues")
        .update({ service_types: editingServiceTypes })
        .eq("id", venueId);

      if (error) throw error;

      toast({
        title: "Success!",
        description: `Service types updated for "${venueName}"`,
      });

      setEditingVenueId(null);
      fetchVenues();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update service types",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingVenueId(null);
    setEditingServiceTypes([]);
  };

  const handleDeleteMerchant = async (userId: string, venueId: string, email: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-merchant", {
        body: { userId, venueId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Success!",
        description: `Merchant admin "${email}" removed successfully`,
      });

      fetchMerchantUsers();
      fetchVenues();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove merchant admin",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportAllVenues = async () => {
    setExportLoading(true);
    try {
      // Fetch all venues
      const { data: allVenues } = await supabase
        .from('venues')
        .select('*')
        .order('name');

      if (!allVenues || allVenues.length === 0) {
        toast({
          title: "No Data",
          description: "No venues found to export",
          variant: "destructive",
        });
        return;
      }

      // Create workbook
      const wb = XLSX.utils.book_new();

      // Create a summary sheet first
      const summaryData = allVenues.map(v => ({
        'Venue Name': v.name,
        'Address': v.address || 'N/A',
        'Phone': v.phone || 'N/A',
        'Service Types': v.service_types?.join(', ') || 'N/A',
        'Created At': new Date(v.created_at).toLocaleString(),
      }));
      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summarySheet, 'All_Venues_Summary');

      // For each venue, create separate sheets
      for (const venue of allVenues) {
        // Fetch all data for this venue
        const [ordersData, orderAnalyticsData, waitlistData, waitlistAnalyticsData, ratingsData, staffData] = await Promise.all([
          supabase.from('orders').select('*').eq('venue_id', venue.id).order('created_at', { ascending: false }),
          supabase.from('order_analytics').select('*').eq('venue_id', venue.id).order('placed_at', { ascending: false }),
          supabase.from('waitlist_entries').select('*').eq('venue_id', venue.id).order('created_at', { ascending: false }),
          supabase.from('waitlist_analytics').select('*').eq('venue_id', venue.id).order('joined_at', { ascending: false }),
          supabase.from('order_ratings').select('*').eq('venue_id', venue.id).order('created_at', { ascending: false }),
          supabase.from('user_roles').select('user_id, role').eq('venue_id', venue.id)
        ]);

        // Create sanitized sheet name (Excel has 31 char limit)
        const sanitizedName = venue.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 25);

        // Orders sheet for this venue
        if (ordersData.data && ordersData.data.length > 0) {
          const sheet = XLSX.utils.json_to_sheet(ordersData.data.map(o => ({
            'Venue': venue.name,
            'Order Number': o.order_number,
            'Customer Name': o.customer_name,
            'Customer Phone': o.customer_phone,
            'Status': o.status,
            'Items': JSON.stringify(o.items),
            'ETA': o.eta ? new Date(o.eta).toLocaleString() : 'N/A',
            'Created At': new Date(o.created_at).toLocaleString(),
          })));
          XLSX.utils.book_append_sheet(wb, sheet, `${sanitizedName}_Orders`);
        }

        // Order Analytics sheet for this venue
        if (orderAnalyticsData.data && orderAnalyticsData.data.length > 0) {
          const sheet = XLSX.utils.json_to_sheet(orderAnalyticsData.data.map(o => ({
            'Venue': venue.name,
            'Placed At': new Date(o.placed_at).toLocaleString(),
            'Quoted Prep (min)': o.quoted_prep_time,
            'Actual Prep (min)': o.actual_prep_time || 'N/A',
            'Items Count': o.items_count,
            'Hour': o.hour_of_day,
            'Day of Week': o.day_of_week,
          })));
          XLSX.utils.book_append_sheet(wb, sheet, `${sanitizedName}_OrderStats`);
        }

        // Waitlist sheet for this venue
        if (waitlistData.data && waitlistData.data.length > 0) {
          const sheet = XLSX.utils.json_to_sheet(waitlistData.data.map(w => ({
            'Venue': venue.name,
            'Customer Name': w.customer_name,
            'Party Size': w.party_size,
            'Status': w.status,
            'ETA': w.eta ? new Date(w.eta).toLocaleString() : 'N/A',
            'Created At': new Date(w.created_at).toLocaleString(),
          })));
          XLSX.utils.book_append_sheet(wb, sheet, `${sanitizedName}_Waitlist`);
        }

        // Waitlist Analytics sheet for this venue
        if (waitlistAnalyticsData.data && waitlistAnalyticsData.data.length > 0) {
          const sheet = XLSX.utils.json_to_sheet(waitlistAnalyticsData.data.map(w => ({
            'Venue': venue.name,
            'Joined At': new Date(w.joined_at).toLocaleString(),
            'Party Size': w.party_size,
            'Quoted Wait (min)': w.quoted_wait_time,
            'Actual Wait (min)': w.actual_wait_time || 'N/A',
            'No Show': w.was_no_show ? 'Yes' : 'No',
            'Hour': w.hour_of_day,
          })));
          XLSX.utils.book_append_sheet(wb, sheet, `${sanitizedName}_WaitStats`);
        }

        // Ratings sheet for this venue
        if (ratingsData.data && ratingsData.data.length > 0) {
          const sheet = XLSX.utils.json_to_sheet(ratingsData.data.map(r => ({
            'Venue': venue.name,
            'Rating': r.rating,
            'Feedback': r.feedback_text || 'No feedback',
            'Created At': new Date(r.created_at).toLocaleString(),
          })));
          XLSX.utils.book_append_sheet(wb, sheet, `${sanitizedName}_Ratings`);
        }

        // Staff sheet for this venue
        if (staffData.data && staffData.data.length > 0) {
          const sheet = XLSX.utils.json_to_sheet(staffData.data.map(s => ({
            'Venue': venue.name,
            'User ID': s.user_id,
            'Role': s.role,
          })));
          XLSX.utils.book_append_sheet(wb, sheet, `${sanitizedName}_Staff`);
        }
      }

      // Generate filename
      const filename = `All_Venues_Export_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Download
      XLSX.writeFile(wb, filename);

      toast({
        title: "Success",
        description: `Exported data for ${allVenues.length} venues`,
      });

    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Error",
        description: "Failed to export data",
        variant: "destructive",
      });
    } finally {
      setExportLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/dev/auth");
  };

  if (authLoading) {
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
              <h1 className="text-2xl font-bold text-primary">Developer Portal</h1>
              <p className="text-sm text-muted-foreground">Platform Administration</p>
            </div>
            <div className="flex gap-2">
              <ThemeToggle />
              <PasswordResetDialog />
              <Button variant="outline" onClick={handleLogout}>
                <LogOut size={16} className="mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Venues</CardTitle>
              <Store className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{venues.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {venues.reduce((acc, v) => acc + (v.orders_count || 0), 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {venues.reduce((acc, v) => acc + (v.staff_count || 0), 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Management Tabs */}
        <Tabs defaultValue="venues" className="space-y-6">
          <TabsList>
            <TabsTrigger value="venues">Manage Venues</TabsTrigger>
            <TabsTrigger value="merchants">Manage Merchants</TabsTrigger>
            <TabsTrigger value="patrons">Patron Management</TabsTrigger>
            <TabsTrigger value="platform">Platform Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="venues" className="space-y-6">
            {/* Create Venue Form */}
            <Card>
              <CardHeader>
                <CardTitle>Create New Venue</CardTitle>
                <CardDescription>Add a new restaurant or venue to the platform</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateVenue} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="venue-name">Venue Name *</Label>
                      <Input
                        id="venue-name"
                        value={venueName}
                        onChange={(e) => setVenueName(e.target.value)}
                        placeholder="e.g. The Gourmet Corner"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="venue-phone">Phone</Label>
                      <Input
                        id="venue-phone"
                        value={venuePhone}
                        onChange={(e) => setVenuePhone(e.target.value)}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="venue-address">Address (for GPS tracking)</Label>
                    <Textarea
                      id="venue-address"
                      value={venueAddress}
                      onChange={(e) => setVenueAddress(e.target.value)}
                      placeholder="123 Main St, City, State/Province, Country"
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">
                      Address will be validated and GPS coordinates will be stored automatically
                    </p>
                  </div>
                  <div className="space-y-3">
                    <Label>Service Types *</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="food-ready"
                          checked={serviceTypes.includes("food_ready")}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setServiceTypes([...serviceTypes, "food_ready"]);
                            } else {
                              setServiceTypes(serviceTypes.filter(t => t !== "food_ready"));
                            }
                          }}
                        />
                        <label htmlFor="food-ready" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                          🍔 Food Ready (Pickup/Takeout Orders)
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="table-ready"
                          checked={serviceTypes.includes("table_ready")}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setServiceTypes([...serviceTypes, "table_ready"]);
                            } else {
                              setServiceTypes(serviceTypes.filter(t => t !== "table_ready"));
                            }
                          }}
                        />
                        <label htmlFor="table-ready" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                          🍽️ Table Ready (Dine-in Waitlist)
                        </label>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Select which services this venue will offer to patrons
                    </p>
                  </div>
                  <Button type="submit" disabled={loading}>
                    <Store className="w-4 h-4 mr-2" />
                    {loading ? "Creating..." : "Create Venue"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Venues List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>All Venues ({venues.length})</CardTitle>
                  <Button 
                    onClick={handleExportAllVenues} 
                    disabled={exportLoading}
                    variant="outline"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {exportLoading ? "Exporting..." : "Export All Venues"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {venues.map((venue) => (
                    <div key={venue.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">{venue.name}</h3>
                            {editingVenueId !== venue.id && (
                              <div className="flex gap-1">
                                {venue.service_types?.includes("food_ready") && (
                                  <Badge variant="secondary" className="text-xs">🍔 Pickup</Badge>
                                )}
                                {venue.service_types?.includes("table_ready") && (
                                  <Badge variant="secondary" className="text-xs">🍽️ Dine-in</Badge>
                                )}
                              </div>
                            )}
                          </div>
                          {venue.address && (
                            <p className="text-sm text-muted-foreground">{venue.address}</p>
                          )}
                          {venue.phone && (
                            <p className="text-sm text-muted-foreground">{venue.phone}</p>
                          )}
                          <div className="text-sm text-muted-foreground mt-2">
                            {venue.staff_count} staff • {venue.orders_count} orders • {venue.waitlist_count} waitlist
                          </div>

                          {editingVenueId === venue.id && (
                            <div className="mt-3 p-3 bg-muted rounded-md space-y-2">
                              <p className="text-sm font-medium">Edit Service Types:</p>
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`edit-food-${venue.id}`}
                                    checked={editingServiceTypes.includes("food_ready")}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setEditingServiceTypes([...editingServiceTypes, "food_ready"]);
                                      } else {
                                        setEditingServiceTypes(editingServiceTypes.filter(t => t !== "food_ready"));
                                      }
                                    }}
                                  />
                                  <label htmlFor={`edit-food-${venue.id}`} className="text-sm cursor-pointer">
                                    🍔 Food Ready (Pickup/Takeout)
                                  </label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`edit-table-${venue.id}`}
                                    checked={editingServiceTypes.includes("table_ready")}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setEditingServiceTypes([...editingServiceTypes, "table_ready"]);
                                      } else {
                                        setEditingServiceTypes(editingServiceTypes.filter(t => t !== "table_ready"));
                                      }
                                    }}
                                  />
                                  <label htmlFor={`edit-table-${venue.id}`} className="text-sm cursor-pointer">
                                    🍽️ Table Ready (Dine-in Waitlist)
                                  </label>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {editingVenueId === venue.id ? (
                            <>
                              <Button 
                                variant="default" 
                                size="sm" 
                                onClick={() => handleSaveServiceTypes(venue.id, venue.name)}
                                disabled={loading}
                              >
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleCancelEdit}
                                disabled={loading}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => handleEditServiceTypes(venue.id, venue.service_types || [])}
                                disabled={loading}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm" disabled={loading}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Venue?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{venue.name}"? This will remove all associated orders, waitlist entries, and staff assignments. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteVenue(venue.id, venue.name)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {venues.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No venues yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="merchants" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create Merchant Admin</CardTitle>
                <CardDescription>Create an admin account for a venue</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateMerchant} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="merchant-email">Email *</Label>
                      <Input
                        id="merchant-email"
                        type="email"
                        value={merchantEmail}
                        onChange={(e) => setMerchantEmail(e.target.value)}
                        placeholder="admin@restaurant.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="merchant-fullname">Full Name *</Label>
                      <Input
                        id="merchant-fullname"
                        type="text"
                        value={merchantFullName}
                        onChange={(e) => setMerchantFullName(e.target.value)}
                        placeholder="John Doe"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="merchant-password">Password *</Label>
                    <Input
                      id="merchant-password"
                      type="password"
                      value={merchantPassword}
                      onChange={(e) => setMerchantPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="merchant-venue">Assign to Venue *</Label>
                    <Select value={selectedVenueId} onValueChange={setSelectedVenueId} required>
                      <SelectTrigger id="merchant-venue">
                        <SelectValue placeholder="Select a venue" />
                      </SelectTrigger>
                      <SelectContent>
                        {venues.map((venue) => (
                          <SelectItem key={venue.id} value={venue.id}>
                            {venue.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={loading || venues.length === 0}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    {loading ? "Creating..." : "Create Merchant Admin"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Merchant Users List */}
            <Card>
              <CardHeader>
                <CardTitle>All Merchant Users ({merchantUsers.length})</CardTitle>
                <CardDescription>Admin and staff accounts across all venues</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {merchantUsers.map((merchant) => (
                    <div key={merchant.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{merchant.full_name || merchant.email || "N/A"}</h3>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              merchant.role === 'admin' 
                                ? 'bg-primary/10 text-primary' 
                                : 'bg-muted text-muted-foreground'
                            }`}>
                              {merchant.role}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{merchant.email}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Venue: {merchant.venue_name}
                          </p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={loading}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove Merchant User?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove {merchant.role} "{merchant.email}" from {merchant.venue_name}? They will lose access to the merchant dashboard. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteMerchant(merchant.user_id, merchant.venue_id, merchant.email)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  ))}
                  {merchantUsers.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No merchant users yet</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patrons">
            <PatronManagement />
          </TabsContent>

          <TabsContent value="platform">
            <PlatformAnalytics />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
