import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "patron" | "staff" | "admin" | "super_admin";

interface UserRole {
  role: AppRole;
  venue_id: string | null;
  venue_name?: string;
  venue_logo_url?: string | null;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [phoneVerified, setPhoneVerified] = useState(false);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Fetch phone verification status when user changes
      if (session?.user) {
        setTimeout(() => {
          supabase
            .from('profiles')
            .select('phone_verified')
            .eq('id', session.user.id)
            .single()
            .then(({ data }) => {
              setPhoneVerified(data?.phone_verified ?? false);
            });
        }, 0);
      } else {
        setPhoneVerified(false);
      }
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Fetch phone verification status for existing session
      if (session?.user) {
        supabase
          .from('profiles')
          .select('phone_verified')
          .eq('id', session.user.id)
          .single()
          .then(({ data }) => {
            setPhoneVerified(data?.phone_verified ?? false);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, session, loading, phoneVerified };
};

export const useMerchantAuth = () => {
  const { user, session, loading: authLoading } = useAuth();
  const [allVenueRoles, setAllVenueRoles] = useState<UserRole[]>([]);
  const [currentVenueRole, setCurrentVenueRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Load saved venue preference from localStorage
  const getSavedVenueId = () => {
    try {
      return localStorage.getItem('selectedVenueId');
    } catch {
      return null;
    }
  };

  const saveVenueId = (venueId: string) => {
    try {
      localStorage.setItem('selectedVenueId', venueId);
    } catch {
      // Ignore localStorage errors
    }
  };

  const switchVenue = (venueId: string) => {
    const venue = allVenueRoles.find(v => v.venue_id === venueId);
    if (venue) {
      setCurrentVenueRole(venue);
      saveVenueId(venueId);
    }
  };

  useEffect(() => {
    const checkMerchantAccess = async () => {
      if (authLoading) return;

      if (!user || !session) {
        navigate("/auth");
        return;
      }

      // Check user roles - fetch ALL roles for this user
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role, venue_id, venues(name, logo_url)")
        .eq("user_id", user.id);

      if (!roles || roles.length === 0) {
        // User is a patron (no role) - deny access
        toast({
          title: "Access Denied",
          description: "You don't have merchant access. This is for restaurant staff only.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        navigate("/auth");
        return;
      }

      // Check if user is super_admin - redirect to dev portal
      const superAdminRole = roles.find((r: any) => r.role === "super_admin");
      if (superAdminRole) {
        navigate("/dev/dashboard");
        return;
      }

      // Filter to only staff/admin roles
      const merchantRoles = roles.filter((r: any) => r.role === "staff" || r.role === "admin");
      
      if (merchantRoles.length === 0) {
        toast({
          title: "Access Denied",
          description: "You don't have the required permissions.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        navigate("/auth");
        return;
      }

      // Map roles to UserRole format with venue names
      const formattedRoles: UserRole[] = merchantRoles.map((r: any) => ({
        role: r.role as AppRole,
        venue_id: r.venue_id,
        venue_name: (r.venues as any)?.name || "Unknown Venue",
        venue_logo_url: (r.venues as any)?.logo_url || null,
      }));

      setAllVenueRoles(formattedRoles);

      // Determine which venue to select
      const savedVenueId = getSavedVenueId();
      const savedVenue = savedVenueId ? formattedRoles.find(r => r.venue_id === savedVenueId) : null;
      
      // Use saved venue if exists, otherwise first venue
      const selectedVenue = savedVenue || formattedRoles[0];
      setCurrentVenueRole(selectedVenue);
      if (selectedVenue.venue_id) {
        saveVenueId(selectedVenue.venue_id);
      }

      setLoading(false);
    };

    checkMerchantAccess();
  }, [user, session, authLoading, navigate, toast]);

  // For backwards compatibility, expose currentVenueRole as userRole
  return { 
    user, 
    session, 
    userRole: currentVenueRole, 
    allVenueRoles,
    switchVenue,
    loading 
  };
};

export const useDevAuth = () => {
  const { user, session, loading: authLoading } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkDevAccess = async () => {
      if (authLoading) return;

      if (!user || !session) {
        navigate("/auth");
        return;
      }

      // Check if user has super_admin role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      if (!roles) {
        toast({
          title: "Access Denied",
          description: "Only platform administrators can access this area.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        navigate("/auth");
        return;
      }

      setIsSuperAdmin(true);
      setLoading(false);
    };

    checkDevAccess();
  }, [user, session, authLoading, navigate, toast]);

  return { user, session, isSuperAdmin, loading };
};
