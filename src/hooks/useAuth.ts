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

const withTimeout = async <T,>(
  thenable: PromiseLike<T> | Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> => {
  let timeoutId: number | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(thenable), timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [phoneVerified, setPhoneVerified] = useState(false);

  useEffect(() => {
    const loadPhoneVerification = async (userId: string) => {
      try {
        const { data } = await withTimeout(
          supabase
            .from("profiles")
            .select("phone_verified")
            .eq("id", userId)
            .single(),
          5000,
          "Loading profile",
        );

        setPhoneVerified(data?.phone_verified ?? false);
      } catch (error) {
        console.error("Error loading phone verification:", error);
        setPhoneVerified(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        setTimeout(() => {
          void loadPhoneVerification(nextSession.user.id);
        }, 0);
      } else {
        setPhoneVerified(false);
      }
    });

    void (async () => {
      try {
        const { data: { session: existingSession } } = await withTimeout(
          supabase.auth.getSession(),
          5000,
          "Loading session",
        );

        setSession(existingSession);
        setUser(existingSession?.user ?? null);

        if (existingSession?.user) {
          await loadPhoneVerification(existingSession.user.id);
        } else {
          setPhoneVerified(false);
        }
      } catch (error) {
        console.error("Error loading session:", error);
        setPhoneVerified(false);
      } finally {
        setLoading(false);
      }
    })();

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

  const getSavedVenueId = () => {
    try {
      return localStorage.getItem("selectedVenueId");
    } catch {
      return null;
    }
  };

  const saveVenueId = (venueId: string) => {
    try {
      localStorage.setItem("selectedVenueId", venueId);
    } catch {
    }
  };

  const switchVenue = (venueId: string) => {
    const venue = allVenueRoles.find((v) => v.venue_id === venueId);
    if (venue) {
      setCurrentVenueRole(venue);
      saveVenueId(venueId);
    }
  };

  useEffect(() => {
    const checkMerchantAccess = async () => {
      if (authLoading) return;

      setLoading(true);

      if (!user || !session) {
        navigate("/auth");
        setLoading(false);
        return;
      }

      let roles: any[] | null = null;

      try {
        const { data } = await withTimeout(
          supabase
            .from("user_roles")
            .select("role, venue_id, venues(name, logo_url)")
            .eq("user_id", user.id),
          6000,
          "Loading merchant access",
        );

        roles = data;
      } catch (error) {
        console.error("Error loading merchant roles:", error);
        setAllVenueRoles([]);
        setCurrentVenueRole(null);
        toast({
          title: "Connection issue",
          description: "We couldn't load your merchant access right now. Please try again.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (!roles || roles.length === 0) {
        toast({
          title: "Access Denied",
          description: "You don't have merchant access. This is for restaurant staff only.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        navigate("/auth");
        setLoading(false);
        return;
      }

      const superAdminRole = roles.find((r: any) => r.role === "super_admin");
      if (superAdminRole) {
        navigate("/dev/dashboard");
        setLoading(false);
        return;
      }

      const merchantRoles = roles.filter((r: any) => r.role === "staff" || r.role === "admin");

      if (merchantRoles.length === 0) {
        toast({
          title: "Access Denied",
          description: "You don't have the required permissions.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        navigate("/auth");
        setLoading(false);
        return;
      }

      const formattedRoles: UserRole[] = merchantRoles.map((r: any) => ({
        role: r.role as AppRole,
        venue_id: r.venue_id,
        venue_name: (r.venues as any)?.name || "Unknown Venue",
        venue_logo_url: (r.venues as any)?.logo_url || null,
      }));

      setAllVenueRoles(formattedRoles);

      const savedVenueId = getSavedVenueId();
      const savedVenue = savedVenueId ? formattedRoles.find((r) => r.venue_id === savedVenueId) : null;
      const selectedVenue = savedVenue || formattedRoles[0];

      setCurrentVenueRole(selectedVenue);
      if (selectedVenue.venue_id) {
        saveVenueId(selectedVenue.venue_id);
      }

      setLoading(false);
    };

    void checkMerchantAccess();
  }, [user, session, authLoading, navigate, toast]);

  return {
    user,
    session,
    userRole: currentVenueRole,
    allVenueRoles,
    switchVenue,
    loading,
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

      setLoading(true);

      if (!user || !session) {
        navigate("/auth");
        setLoading(false);
        return;
      }

      try {
        const { data: roles } = await withTimeout(
          supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "super_admin")
            .maybeSingle(),
          6000,
          "Loading admin access",
        );

        if (!roles) {
          toast({
            title: "Access Denied",
            description: "Only platform administrators can access this area.",
            variant: "destructive",
          });
          await supabase.auth.signOut();
          navigate("/auth");
          setLoading(false);
          return;
        }

        setIsSuperAdmin(true);
      } catch (error) {
        console.error("Error loading admin access:", error);
        toast({
          title: "Connection issue",
          description: "We couldn't verify admin access right now. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    void checkDevAccess();
  }, [user, session, authLoading, navigate, toast]);

  return { user, session, isSuperAdmin, loading };
};