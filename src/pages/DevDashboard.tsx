import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDevAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
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
import { Store, UserPlus, LogOut, BarChart3, Users, ShoppingBag, Trash2, UtensilsCrossed, Edit2, Save, X, Sparkles, Lock, KeyRound, Clock, CheckCircle2, XCircle, Plus, Upload } from "lucide-react";
import { VenueLogo } from "@/components/VenueLogo";
import { LogoCropDialog } from "@/components/LogoCropDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PatronManagement } from "@/components/dev/PatronManagement";
import { PlatformAnalytics } from "@/components/dev/PlatformAnalytics";
import { AIControlCenter } from "@/components/dev/AIControlCenter";
import { DevExport } from "@/components/dev/DevExport";
import { PromotionsManager } from "@/components/dev/PromotionsManager";
import { LocationMap } from "@/components/LocationMap";
import { InteractiveLocationMap } from "@/components/InteractiveLocationMap";
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

// Small inline component for loyalty toggle per venue
const VenueLoyaltyToggle = ({ venueId }: { venueId: string }) => {
  const [loyaltyStatus, setLoyaltyStatus] = useState<{ exists: boolean; adminEnabled: boolean; isActive: boolean } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    supabase
      .from("loyalty_programs")
      .select("id, is_active, admin_enabled")
      .eq("venue_id", venueId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setLoyaltyStatus({ exists: true, adminEnabled: (data as any).admin_enabled !== false, isActive: data.is_active });
        } else {
          setLoyaltyStatus({ exists: false, adminEnabled: true, isActive: false });
        }
      });
  }, [venueId]);

  if (!loyaltyStatus?.exists) return null;

  const toggleAdmin = async (enabled: boolean) => {
    await supabase
      .from("loyalty_programs")
      .update({ admin_enabled: enabled } as any)
      .eq("venue_id", venueId);
    setLoyaltyStatus(prev => prev ? { ...prev, adminEnabled: enabled } : prev);
    toast({ title: enabled ? "Loyalty enabled" : "Loyalty suspended" });
  };

  return (
    <div className="flex items-center gap-2 mt-1">
      <Gift className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Loyalty:</span>
      {loyaltyStatus.adminEnabled ? (
        <Badge variant="secondary" className="text-xs cursor-pointer" onClick={() => toggleAdmin(false)}>
          {loyaltyStatus.isActive ? "Active" : "Inactive (merchant off)"}
        </Badge>
      ) : (
        <Badge variant="destructive" className="text-xs cursor-pointer" onClick={() => toggleAdmin(true)}>
          Suspended
        </Badge>
      )}
    </div>
  );
};

  id: string;
  name: string;
  address: string | null;
  display_address?: string | null;
  phone: string | null;
  service_types?: string[];
  orders_count?: number;
  waitlist_count?: number;
  staff_count?: number;
  latitude?: number | null;
  longitude?: number | null;
  logo_url?: string | null;
}

// Validation schema for venue editing
const venueEditSchema = z.object({
  name: z.string().trim().min(1, "Venue name is required").max(100, "Name must be less than 100 characters"),
  phone: z.string().trim().max(20, "Phone must be less than 20 characters").optional(),
  display_address: z.string().trim().max(500, "Display address must be less than 500 characters").optional(),
});

interface MerchantUser {
  id: string;
  user_id: string;
  venue_id: string;
  role: string;
  email?: string;
  full_name?: string;
  venue_name?: string;
  email_confirmed?: boolean;
}

export default function DevDashboard() {
  const { loading: authLoading } = useDevAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [merchantUsers, setMerchantUsers] = useState<MerchantUser[]>([]);
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venueDisplayAddress, setVenueDisplayAddress] = useState("");
  const [venuePhone, setVenuePhone] = useState("");
  const [serviceTypes, setServiceTypes] = useState<string[]>(["food_ready", "table_ready"]);
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null);
  const [editingServiceTypes, setEditingServiceTypes] = useState<string[]>([]);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [editVenueName, setEditVenueName] = useState("");
  const [editVenuePhone, setEditVenuePhone] = useState("");
  const [editVenueDisplayAddress, setEditVenueDisplayAddress] = useState("");
  const [editVenueAddress, setEditVenueAddress] = useState("");
  const [editValidatedAddress, setEditValidatedAddress] = useState<{
    formatted_address: string;
    latitude: number;
    longitude: number;
    precision?: string;
  } | null>(null);
  const [validatedAddress, setValidatedAddress] = useState<{
    formatted_address: string;
    latitude: number;
    longitude: number;
    precision?: string;
  } | null>(null);
  const [showEditMap, setShowEditMap] = useState(false);
  const [showCreateMap, setShowCreateMap] = useState(false);
  const [merchantEmail, setMerchantEmail] = useState("");
  const [merchantPassword, setMerchantPassword] = useState("");
  const [merchantFullName, setMerchantFullName] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState("");
  const [loading, setLoading] = useState(false);
  const [setPasswordUser, setSetPasswordUser] = useState<{ userId: string; email: string; resetRequestId?: string } | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [passwordResetRequests, setPasswordResetRequests] = useState<any[]>([]);
  const [assigningUserToVenue, setAssigningUserToVenue] = useState<{
    userId: string;
    email: string;
    fullName: string;
    existingVenueIds: string[];
  } | null>(null);
  const [quickAssignVenueId, setQuickAssignVenueId] = useState("");
  const [quickAssignRole, setQuickAssignRole] = useState<"admin" | "staff">("admin");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string>("");
  const [cropTarget, setCropTarget] = useState<"create" | "edit">("create");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading) {
      fetchVenues();
      fetchMerchantUsers();
      fetchPasswordResetRequests();
    }
  }, [authLoading]);

  const fetchPasswordResetRequests = async () => {
    const { data } = await supabase
      .from("password_reset_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setPasswordResetRequests(data);
  };

  const handleDismissResetRequest = async (requestId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("password_reset_requests")
        .update({ status: "dismissed", resolved_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw error;
      toast({ title: "Request dismissed" });
      fetchPasswordResetRequests();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

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

  const handleValidateAddress = async () => {
    if (!venueAddress || !venueAddress.trim()) {
      toast({
        variant: "destructive",
        title: "Address Required",
        description: "Please enter an address to validate.",
      });
      return;
    }

    setLoading(true);

    try {
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

      // Store validated address data with precision
      setValidatedAddress({
        formatted_address: validationData.formatted_address,
        latitude: validationData.latitude,
        longitude: validationData.longitude,
        precision: validationData.precision || 'area',
      });

      const precisionEmoji = validationData.precision === 'exact' ? '🎯' : validationData.precision === 'street' ? '📍' : '📌';
      const precisionLabel = validationData.precision === 'exact' ? 'Exact' : validationData.precision === 'street' ? 'Street Level' : 'Area Level';

      toast({
        title: `${precisionEmoji} Address Verified - ${precisionLabel}`,
        description: validationData.precision !== 'exact' ? "You can adjust the exact location on the map below." : "Review the details below and create the venue.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to validate address",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

    // If address is provided but not validated yet
    if (venueAddress && venueAddress.trim() && !validatedAddress) {
      toast({
        title: "Address Validation Required",
        description: "Please validate the address before creating the venue.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    try {
      // Default settings for new venues - sensible defaults for business hours and operations
      const DEFAULT_VENUE_SETTINGS = {
        business_hours: {
          monday: { open: "09:00", close: "22:00", is_closed: false, breaks: [] },
          tuesday: { open: "09:00", close: "22:00", is_closed: false, breaks: [] },
          wednesday: { open: "09:00", close: "22:00", is_closed: false, breaks: [] },
          thursday: { open: "09:00", close: "22:00", is_closed: false, breaks: [] },
          friday: { open: "09:00", close: "22:00", is_closed: false, breaks: [] },
          saturday: { open: "09:00", close: "22:00", is_closed: false, breaks: [] },
          sunday: { open: "09:00", close: "22:00", is_closed: true, breaks: [] }
        },
        holiday_closures: [],
        grace_periods: {
          last_reservation: 0,
          last_order: 15,
          last_waitlist_join: 30
        },
        venue_capacity: "40",
        tables_per_interval: "4",
        default_prep_time: "10",
        max_extension_time: "45",
        pickup_instructions: "Please collect your order from the main counter. Show your order number to staff.",
        auto_no_show_time: "15",
        order_number_refresh_minutes: "15",
        cob_time: "23:00",
        auto_cleanup_cancelled_waitlist: true,
        auto_cleanup_rejected: true,
        prep_time_mode: "analytics",
        table_configuration: []
      };

      const { data: venueData, error } = await supabase
        .from("venues")
        .insert({
          name: venueName,
          address: validatedAddress?.formatted_address || venueAddress || null,
          display_address: venueDisplayAddress || null,
          phone: venuePhone || null,
          service_types: serviceTypes,
          latitude: validatedAddress?.latitude || null,
          longitude: validatedAddress?.longitude || null,
          settings: DEFAULT_VENUE_SETTINGS
        })
        .select('id')
        .single();

      if (error) throw error;

      // Upload logo if provided
      if (logoFile && venueData?.id) {
        const ext = logoFile.name.split('.').pop();
        const filePath = `${venueData.id}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('venue-logos')
          .upload(filePath, logoFile, { upsert: true });
        
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('venue-logos')
            .getPublicUrl(filePath);
          
          // Add cache-buster to force fresh image load
          const logoUrlWithCacheBuster = `${urlData.publicUrl}?t=${Date.now()}`;
          await supabase
            .from('venues')
            .update({ logo_url: logoUrlWithCacheBuster })
            .eq('id', venueData.id);
        }
      }

      toast({
        title: "Success!",
        description: `Venue "${venueName}" created successfully${validatedAddress ? ' with GPS coordinates!' : ''}`,
      });

      setVenueName("");
      setVenueAddress("");
      setVenueDisplayAddress("");
      setVenuePhone("");
      setServiceTypes(["food_ready", "table_ready"]);
      setValidatedAddress(null);
      setShowCreateMap(false);
      setLogoFile(null);
      setLogoPreview(null);
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

      // Handle different response scenarios
      if (data?.alreadyAssigned) {
        toast({
          title: "Already Assigned",
          description: `${merchantEmail} already has access to this venue.`,
        });
      } else if (data?.isNewUser === false) {
        // Existing user added to a new venue
        toast({
          title: "User Added to Venue",
          description: data.message || `${merchantEmail} now has access to this venue (${data.existingRoles?.length || 1} total venue(s))`,
        });
      } else {
        toast({
          title: "Success!",
          description: `New merchant admin account created for ${merchantEmail}`,
        });
      }

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

  const handleEditVenue = (venue: Venue) => {
    setEditingVenue(venue);
    setEditVenueName(venue.name);
    setEditVenuePhone(venue.phone || "");
    setEditVenueDisplayAddress(venue.display_address || "");
    setEditVenueAddress(venue.address || "");
    setEditValidatedAddress(null);
    setEditingServiceTypes(venue.service_types || []);
    setEditLogoFile(null);
    setEditLogoPreview(venue.logo_url || null);
  };

  const handleValidateEditAddress = async () => {
    if (!editVenueAddress || !editVenueAddress.trim()) {
      toast({
        variant: "destructive",
        title: "Address Required",
        description: "Please enter an address to validate.",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: validationData, error: validationError } = await supabase.functions.invoke('validate-address', {
        body: { address: editVenueAddress },
      });

      if (validationError || !validationData || !validationData.valid) {
        toast({
          variant: "destructive",
          title: "Invalid Address",
          description: validationData?.error || "Address not found. Please check and try again.",
        });
        setLoading(false);
        return;
      }

      setEditValidatedAddress({
        formatted_address: validationData.formatted_address,
        latitude: validationData.latitude,
        longitude: validationData.longitude,
        precision: validationData.precision || 'area',
      });

      const precisionEmoji = validationData.precision === 'exact' ? '🎯' : validationData.precision === 'street' ? '📍' : '📌';
      const precisionLabel = validationData.precision === 'exact' ? 'Exact' : validationData.precision === 'street' ? 'Street Level' : 'Area Level';

      toast({
        title: `${precisionEmoji} Address Verified - ${precisionLabel}`,
        description: validationData.precision !== 'exact' ? "You can adjust the exact location on the map below." : "GPS coordinates updated for this address.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to validate address",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVenue = async () => {
    if (!editingVenue) return;

    // Validate inputs
    try {
      venueEditSchema.parse({
        name: editVenueName,
        phone: editVenuePhone || undefined,
        display_address: editVenueDisplayAddress || undefined,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

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
      const updateData: any = {
        name: editVenueName.trim(),
        phone: editVenuePhone.trim() || null,
        display_address: editVenueDisplayAddress.trim() || null,
        service_types: editingServiceTypes,
      };

      // If address was validated, update GPS coordinates
      if (editValidatedAddress) {
        updateData.address = editValidatedAddress.formatted_address;
        updateData.latitude = editValidatedAddress.latitude;
        updateData.longitude = editValidatedAddress.longitude;
      } else if (editVenueAddress.trim() !== editingVenue.address) {
        // If address was changed but not validated
        updateData.address = editVenueAddress.trim() || null;
      }

      // Upload logo if a new file was selected
      if (editLogoFile) {
        const ext = editLogoFile.name.split('.').pop();
        const filePath = `${editingVenue.id}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('venue-logos')
          .upload(filePath, editLogoFile, { upsert: true });
        
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('venue-logos')
            .getPublicUrl(filePath);
          
          updateData.logo_url = `${urlData.publicUrl}?t=${Date.now()}`;
        }
      }

      const { error } = await supabase
        .from("venues")
        .update(updateData)
        .eq("id", editingVenue.id);

      if (error) throw error;

      toast({
        title: "Success!",
        description: `Venue "${editVenueName}" updated successfully`,
      });

      setEditingVenue(null);
      setEditValidatedAddress(null);
      setShowEditMap(false);
      fetchVenues();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update venue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEditVenue = () => {
    setEditingVenue(null);
    setEditValidatedAddress(null);
    setShowEditMap(false);
    setEditLogoFile(null);
    setEditLogoPreview(null);
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

  const handleSetPassword = async () => {
    if (!setPasswordUser || !newPasswordInput) return;
    
    if (newPasswordInput.length < 6) {
      toast({
        title: "Invalid Password",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-merchant-user", {
        body: { 
          userId: setPasswordUser.userId, 
          action: "set_password",
          newPassword: newPasswordInput,
          resetRequestId: setPasswordUser.resetRequestId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Password Updated",
        description: `Password set successfully for ${setPasswordUser.email}. They can now log in.`,
      });

      setSetPasswordUser(null);
      setNewPasswordInput("");
      fetchMerchantUsers();
      fetchPasswordResetRequests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to set password",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAssignToVenue = async () => {
    if (!assigningUserToVenue || !quickAssignVenueId) return;
    
    setLoading(true);
    try {
      // Use the create-merchant edge function which has proper permissions
      // For existing users, it will add them to the new venue
      const { data, error } = await supabase.functions.invoke("create-merchant", {
        body: {
          email: assigningUserToVenue.email,
          password: "placeholder-not-used-for-existing-users",
          fullName: assigningUserToVenue.fullName,
          venueId: quickAssignVenueId,
          role: quickAssignRole,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const venueName = venues.find(v => v.id === quickAssignVenueId)?.name;
      
      if (data?.alreadyAssigned) {
        toast({
          title: "Already Assigned",
          description: `${assigningUserToVenue.email} already has access to ${venueName}.`,
        });
      } else {
        toast({
          title: "Success!",
          description: `${assigningUserToVenue.email} now has ${quickAssignRole} access to ${venueName}`,
        });
      }

      setAssigningUserToVenue(null);
      setQuickAssignVenueId("");
      setQuickAssignRole("admin");
      fetchMerchantUsers();
      fetchVenues();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to assign venue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
          <TabsList className="flex-wrap">
            <TabsTrigger value="venues">Manage Venues</TabsTrigger>
            <TabsTrigger value="merchants">Manage Merchants</TabsTrigger>
            <TabsTrigger value="password-resets" className="flex items-center gap-1">
              <KeyRound className="h-3 w-3" />
              Password Resets
              {passwordResetRequests.filter(r => r.status === 'pending').length > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                  {passwordResetRequests.filter(r => r.status === 'pending').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="patrons">Patron Management</TabsTrigger>
            <TabsTrigger value="platform">Platform Analytics</TabsTrigger>
            <TabsTrigger value="ai-control" className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              AI Control
            </TabsTrigger>
            <TabsTrigger value="promotions" className="flex items-center gap-1">
              Promotions
            </TabsTrigger>
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
                    <div className="flex gap-2">
                      <Textarea
                        id="venue-address"
                        value={venueAddress}
                        onChange={(e) => {
                          setVenueAddress(e.target.value);
                          setValidatedAddress(null); // Reset validation when address changes
                        }}
                        placeholder="123 Main St, City, State/Province, Country"
                        rows={2}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleValidateAddress}
                        disabled={loading || !venueAddress.trim()}
                        className="self-end"
                      >
                        Validate
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Used for GPS tracking and distance calculations
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="venue-display-address">Display Address (Optional)</Label>
                    <Textarea
                      id="venue-display-address"
                      value={venueDisplayAddress}
                      onChange={(e) => setVenueDisplayAddress(e.target.value)}
                      placeholder="e.g. 123 Main Street, Downtown"
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">
                      Override address shown to patrons (if different from GPS address)
                    </p>
                  </div>
                  <div className="space-y-2">
                    {validatedAddress ? (
                      <div className="space-y-3">
                        <div className="p-3 border rounded-md bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium text-green-900 dark:text-green-100">
                              {validatedAddress.precision === 'exact' ? '🎯' : validatedAddress.precision === 'street' ? '📍' : '📌'} Address Verified
                              <span className="ml-2 text-xs">
                                ({validatedAddress.precision === 'exact' ? 'Exact Match' : validatedAddress.precision === 'street' ? 'Street Level' : 'Area Level'})
                              </span>
                            </p>
                            {validatedAddress.precision !== 'exact' && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowCreateMap(!showCreateMap)}
                              >
                                {showCreateMap ? 'Hide Map' : 'Adjust Location'}
                              </Button>
                            )}
                          </div>
                          <p className="text-sm text-green-700 dark:text-green-300 mb-2">
                            {validatedAddress.formatted_address}
                          </p>
                          <div className="flex gap-4 text-xs text-green-600 dark:text-green-400">
                            <span>Lat: {validatedAddress.latitude.toFixed(6)}</span>
                            <span>Lng: {validatedAddress.longitude.toFixed(6)}</span>
                          </div>
                        </div>
                        {showCreateMap ? (
                          <InteractiveLocationMap
                            initialLatitude={validatedAddress.latitude}
                            initialLongitude={validatedAddress.longitude}
                            address={validatedAddress.formatted_address}
                            onLocationChange={(lat, lng) => {
                              setValidatedAddress({
                                ...validatedAddress,
                                latitude: lat,
                                longitude: lng,
                              });
                            }}
                          />
                        ) : (
                          <LocationMap
                            latitude={validatedAddress.latitude}
                            longitude={validatedAddress.longitude}
                            address={validatedAddress.formatted_address}
                          />
                        )}
                        {validatedAddress.precision !== 'exact' && !showCreateMap && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            💡 Address precision is {validatedAddress.precision === 'street' ? 'street level' : 'approximate'}. Click "Adjust Location" to pinpoint the exact coordinates.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Click "Validate" to verify the address and get GPS coordinates
                      </p>
                    )}
                  </div>
                  {/* Logo Upload */}
                  <div className="space-y-2">
                    <Label>Venue Logo</Label>
                    <div className="flex items-center gap-4">
                      {logoPreview ? (
                        <VenueLogo logoUrl={logoPreview} name={venueName || 'V'} size="xl" />
                      ) : (
                        <VenueLogo logoUrl={null} name={venueName || 'V'} size="xl" />
                      )}
                      <div className="flex-1">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setCropTarget("create");
                              setCropImageSrc(URL.createObjectURL(file));
                              setCropDialogOpen(true);
                            }
                          }}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Upload any image — you can crop and adjust it</p>
                      </div>
                    </div>
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

            {/* Export Section */}
            <DevExport />

            {/* Venues List */}
            <Card>
              <CardHeader>
                <CardTitle>All Venues ({venues.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {venues.map((venue) => (
                    <div key={venue.id} className="border rounded-lg p-4">
                      {editingVenue?.id === venue.id ? (
                        // Edit Mode
                        <div className="space-y-4">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-lg">Edit Venue</h3>
                            <div className="flex gap-2">
                              <Button 
                                variant="default" 
                                size="sm" 
                                onClick={handleSaveVenue}
                                disabled={loading}
                              >
                                <Save className="w-4 h-4 mr-2" />
                                Save
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleCancelEditVenue}
                                disabled={loading}
                              >
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor={`edit-name-${venue.id}`}>Venue Name *</Label>
                              <Input
                                id={`edit-name-${venue.id}`}
                                value={editVenueName}
                                onChange={(e) => setEditVenueName(e.target.value)}
                                placeholder="e.g. The Gourmet Corner"
                                maxLength={100}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`edit-phone-${venue.id}`}>Phone</Label>
                              <Input
                                id={`edit-phone-${venue.id}`}
                                value={editVenuePhone}
                                onChange={(e) => setEditVenuePhone(e.target.value)}
                                placeholder="(555) 123-4567"
                                maxLength={20}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`edit-address-${venue.id}`}>GPS Address</Label>
                            <div className="flex gap-2">
                              <Textarea
                                id={`edit-address-${venue.id}`}
                                value={editVenueAddress}
                                onChange={(e) => {
                                  setEditVenueAddress(e.target.value);
                                  setEditValidatedAddress(null);
                                }}
                                placeholder="123 Main St, City, State/Province, Country"
                                rows={2}
                                className="flex-1"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleValidateEditAddress}
                                disabled={loading || !editVenueAddress.trim()}
                                className="self-end"
                              >
                                Validate
                              </Button>
                            </div>
                            {editValidatedAddress && (
                              <div className="space-y-3">
                                <div className="p-3 border rounded-md bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                                  <div className="flex items-center justify-between mb-1">
                                    <p className="text-sm font-medium text-green-900 dark:text-green-100">
                                      {editValidatedAddress.precision === 'exact' ? '🎯' : editValidatedAddress.precision === 'street' ? '📍' : '📌'} Address Verified
                                      <span className="ml-2 text-xs">
                                        ({editValidatedAddress.precision === 'exact' ? 'Exact Match' : editValidatedAddress.precision === 'street' ? 'Street Level' : 'Area Level'})
                                      </span>
                                    </p>
                                    {editValidatedAddress.precision !== 'exact' && (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowEditMap(!showEditMap)}
                                      >
                                        {showEditMap ? 'Hide Map' : 'Adjust Location'}
                                      </Button>
                                    )}
                                  </div>
                                  <p className="text-sm text-green-700 dark:text-green-300 mb-2">
                                    {editValidatedAddress.formatted_address}
                                  </p>
                                  <div className="flex gap-4 text-xs text-green-600 dark:text-green-400">
                                    <span>Lat: {editValidatedAddress.latitude.toFixed(6)}</span>
                                    <span>Lng: {editValidatedAddress.longitude.toFixed(6)}</span>
                                  </div>
                                </div>
                                {showEditMap ? (
                                  <InteractiveLocationMap
                                    initialLatitude={editValidatedAddress.latitude}
                                    initialLongitude={editValidatedAddress.longitude}
                                    address={editValidatedAddress.formatted_address}
                                    onLocationChange={(lat, lng) => {
                                      setEditValidatedAddress({
                                        ...editValidatedAddress,
                                        latitude: lat,
                                        longitude: lng,
                                      });
                                    }}
                                  />
                                ) : editingVenue?.latitude && editingVenue?.longitude ? (
                                  <LocationMap
                                    latitude={editValidatedAddress.latitude}
                                    longitude={editValidatedAddress.longitude}
                                    address={editValidatedAddress.formatted_address}
                                  />
                                ) : null}
                                {editValidatedAddress.precision !== 'exact' && !showEditMap && (
                                  <p className="text-xs text-amber-600 dark:text-amber-400">
                                    💡 Address precision is {editValidatedAddress.precision === 'street' ? 'street level' : 'approximate'}. Click "Adjust Location" to pinpoint the exact coordinates.
                                  </p>
                                )}
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Used for GPS tracking and distance calculations
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`edit-display-${venue.id}`}>Display Address (Optional)</Label>
                            <Textarea
                              id={`edit-display-${venue.id}`}
                              value={editVenueDisplayAddress}
                              onChange={(e) => setEditVenueDisplayAddress(e.target.value)}
                              placeholder="e.g. 123 Main Street, Downtown"
                              rows={2}
                              maxLength={500}
                            />
                            <p className="text-xs text-muted-foreground">
                              Override address shown to patrons (if different from GPS address)
                            </p>
                          </div>

                          {/* Logo Upload (Edit) */}
                          <div className="space-y-2">
                            <Label>Venue Logo</Label>
                            <div className="flex items-center gap-4">
                              <VenueLogo logoUrl={editLogoPreview} name={editVenueName || 'V'} size="xl" />
                              <div className="flex-1">
                                <Input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setCropTarget("edit");
                                      setCropImageSrc(URL.createObjectURL(file));
                                      setCropDialogOpen(true);
                                    }
                                  }}
                                />
                                <p className="text-xs text-muted-foreground mt-1">Upload any image — you can crop and adjust it</p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <Label>Service Types *</Label>
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
                        </div>
                      ) : (
                        // View Mode
                        <div className="flex items-start gap-4">
                          <VenueLogo logoUrl={venue.logo_url} name={venue.name} size="xl" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-lg">{venue.name}</h3>
                              <div className="flex gap-1">
                                {venue.service_types?.includes("food_ready") && (
                                  <Badge variant="secondary" className="text-xs">🍔 Pickup</Badge>
                                )}
                                {venue.service_types?.includes("table_ready") && (
                                  <Badge variant="secondary" className="text-xs">🍽️ Dine-in</Badge>
                                )}
                              </div>
                            </div>
                            {(venue.display_address || venue.address) && (
                              <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">
                                  {venue.display_address || venue.address}
                                  {venue.display_address && venue.address && venue.display_address !== venue.address && (
                                    <span className="text-xs ml-2 text-muted-foreground/70">(Display Override)</span>
                                  )}
                                </p>
                                {venue.display_address && venue.address && venue.display_address !== venue.address && (
                                  <p className="text-xs text-muted-foreground/70">GPS: {venue.address}</p>
                                )}
                              </div>
                            )}
                            {venue.phone && (
                              <p className="text-sm text-muted-foreground">{venue.phone}</p>
                            )}
                            <div className="text-sm text-muted-foreground mt-2">
                              {venue.staff_count} staff • {venue.orders_count} orders • {venue.waitlist_count} waitlist
                            </div>
                            <VenueLoyaltyToggle venueId={venue.id} />
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleEditVenue(venue)}
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
                                    Delete Venue
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      )}
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
                <CardDescription>
                  Create a new admin account or add an existing user to a venue. 
                  If the email already exists, they'll be granted access to the selected venue.
                </CardDescription>
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
                      <p className="text-xs text-muted-foreground">
                        If this email exists, the user will be added to the selected venue
                      </p>
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
                    <p className="text-xs text-muted-foreground">
                      For existing users, the password field is ignored (they keep their current password)
                    </p>
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
                    {loading ? "Processing..." : "Create / Add Merchant Admin"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Merchant Users List - grouped by user */}
            <Card>
              <CardHeader>
                <CardTitle>All Merchant Users ({merchantUsers.length})</CardTitle>
                <CardDescription>Admin and staff accounts across all venues. Users with multiple venue access are grouped together.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Group merchants by user_id */}
                  {Object.entries(
                    merchantUsers.reduce((acc: Record<string, typeof merchantUsers>, merchant) => {
                      if (!acc[merchant.user_id]) {
                        acc[merchant.user_id] = [];
                      }
                      acc[merchant.user_id].push(merchant);
                      return acc;
                    }, {})
                  ).map(([userId, userMerchants]) => (
                    <div key={userId} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{userMerchants[0].full_name || userMerchants[0].email || "N/A"}</h3>
                            {userMerchants.length > 1 && (
                              <Badge variant="outline" className="text-xs">
                                {userMerchants.length} venues
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{userMerchants[0].email}</p>
                          
                          {/* Show all venue assignments */}
                          <div className="mt-2 space-y-1">
                            {userMerchants.map((merchant) => (
                              <div key={merchant.id} className="flex items-center gap-2 text-sm">
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  merchant.role === 'admin' 
                                    ? 'bg-primary/10 text-primary' 
                                    : 'bg-muted text-muted-foreground'
                                }`}>
                                  {merchant.role}
                                </span>
                                <span className="text-muted-foreground">at</span>
                                <span className="font-medium">{merchant.venue_name}</span>
                                {userMerchants.length > 1 && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-6 px-2 text-destructive hover:text-destructive" disabled={loading}>
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Remove from Venue?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Remove {merchant.role} access for "{merchant.email}" from {merchant.venue_name}? They will retain access to their other venue(s).
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteMerchant(merchant.user_id, merchant.venue_id, merchant.email || '')}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Remove from Venue
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setAssigningUserToVenue({
                                userId: userMerchants[0].user_id,
                                email: userMerchants[0].email || '',
                                fullName: userMerchants[0].full_name || '',
                                existingVenueIds: userMerchants.map(m => m.venue_id),
                              });
                              setQuickAssignVenueId("");
                              setQuickAssignRole("admin");
                            }}
                            disabled={loading || userMerchants.length >= venues.length}
                            title={userMerchants.length >= venues.length ? "Already assigned to all venues" : "Add to another venue"}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add Venue
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              setSetPasswordUser({ userId: userMerchants[0].user_id, email: userMerchants[0].email || '' });
                              setNewPasswordInput("");
                            }}
                            disabled={loading}
                            title="Set a new password directly"
                          >
                            <Lock className="w-4 h-4 mr-1" />
                            Set Password
                          </Button>
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
                                  {userMerchants.length > 1 
                                    ? `Remove "${userMerchants[0].email}" from ALL ${userMerchants.length} venues? They will lose all merchant access.`
                                    : `Remove ${userMerchants[0].role} "${userMerchants[0].email}" from ${userMerchants[0].venue_name}? They will lose access to the merchant dashboard.`
                                  }
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={async () => {
                                    // Delete all venue assignments for this user
                                    for (const m of userMerchants) {
                                      await handleDeleteMerchant(m.user_id, m.venue_id, m.email || '');
                                    }
                                  }}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  {userMerchants.length > 1 ? 'Remove from All Venues' : 'Remove'}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
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

          <TabsContent value="password-resets">
            <Card>
              <CardHeader>
                <CardTitle>Password Reset Requests</CardTitle>
                <CardDescription>Requests from staff who need admin assistance resetting their password</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {passwordResetRequests.filter(r => r.status === 'pending').map((request) => (
                    <div key={request.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{request.email}</h3>
                            <Badge variant="outline" className="text-xs">
                              <Clock className="w-3 h-3 mr-1" />
                              {new Date(request.created_at).toLocaleDateString()}
                            </Badge>
                          </div>
                          {request.venue_name && (
                            <p className="text-sm text-muted-foreground mt-1">Venue: {request.venue_name}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={async () => {
                              // Find user by email
                              const { data: profile } = await supabase
                                .from("profiles")
                                .select("id")
                                .eq("email", request.email.toLowerCase())
                                .single();
                              if (profile) {
                                setSetPasswordUser({ userId: profile.id, email: request.email, resetRequestId: request.id });
                                setNewPasswordInput("");
                              } else {
                                toast({ title: "User not found", description: "No account found for this email", variant: "destructive" });
                              }
                            }}
                            disabled={loading}
                          >
                            <Lock className="w-4 h-4 mr-1" />
                            Set Password
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDismissResetRequest(request.id)} disabled={loading}>
                            <XCircle className="w-4 h-4 mr-1" />
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {passwordResetRequests.filter(r => r.status === 'pending').length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No pending password reset requests</p>
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

          <TabsContent value="ai-control">
            <AIControlCenter />
          </TabsContent>

          <TabsContent value="promotions">
            <PromotionsManager />
          </TabsContent>
        </Tabs>
      </div>

      {/* Set Password Dialog */}
      <Dialog open={!!setPasswordUser} onOpenChange={(open) => !open && setSetPasswordUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set New Password</DialogTitle>
            <DialogDescription>
              Set a new password for {setPasswordUser?.email}. This will also confirm their email.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
              placeholder="Minimum 6 characters"
              minLength={6}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetPasswordUser(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSetPassword} 
              disabled={loading || newPasswordInput.length < 6}
            >
              {loading ? "Setting..." : "Set Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Assign to Venue Dialog */}
      <Dialog open={!!assigningUserToVenue} onOpenChange={(open) => !open && setAssigningUserToVenue(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Another Venue</DialogTitle>
            <DialogDescription>
              Assign {assigningUserToVenue?.fullName || assigningUserToVenue?.email} to an additional venue.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Venue</Label>
              <Select value={quickAssignVenueId} onValueChange={setQuickAssignVenueId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a venue..." />
                </SelectTrigger>
                <SelectContent>
                  {venues
                    .filter(v => !assigningUserToVenue?.existingVenueIds.includes(v.id))
                    .map((venue) => (
                      <SelectItem key={venue.id} value={venue.id}>
                        {venue.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={quickAssignRole} onValueChange={(v) => setQuickAssignRole(v as "admin" | "staff")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigningUserToVenue(null)}>
              Cancel
            </Button>
            <Button onClick={handleQuickAssignToVenue} disabled={loading || !quickAssignVenueId}>
              {loading ? "Adding..." : "Add to Venue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logo Crop Dialog */}
      <LogoCropDialog
        open={cropDialogOpen}
        imageSrc={cropImageSrc}
        onClose={() => {
          setCropDialogOpen(false);
          setCropImageSrc("");
        }}
        onCropComplete={(croppedBlob) => {
          const file = new File([croppedBlob], "logo.png", { type: "image/png" });
          const preview = URL.createObjectURL(croppedBlob);
          if (cropTarget === "create") {
            setLogoFile(file);
            setLogoPreview(preview);
          } else {
            setEditLogoFile(file);
            setEditLogoPreview(preview);
          }
          setCropDialogOpen(false);
          setCropImageSrc("");
        }}
      />
    </div>
  );
}
