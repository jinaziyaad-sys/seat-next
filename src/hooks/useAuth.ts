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
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, session, loading };
};

export const useMerchantAuth = () => {
  const { user, session, loading: authLoading } = useAuth();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkMerchantAccess = async () => {
      if (authLoading) return;

      if (!user || !session) {
        navigate("/merchant/auth");
        return;
      }

      // Check user role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role, venue_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!roles) {
        // User is a patron (no role) - deny access
        toast({
          title: "Access Denied",
          description: "You don't have merchant access. This is for restaurant staff only.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        navigate("/merchant/auth");
        return;
      }

      // Check if user is super_admin - redirect to dev portal
      if (roles.role === "super_admin") {
        navigate("/dev/dashboard");
        return;
      }

      // Check if user is staff or admin
      if (roles.role !== "staff" && roles.role !== "admin") {
        toast({
          title: "Access Denied",
          description: "You don't have the required permissions.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        navigate("/merchant/auth");
        return;
      }

      // Fetch venue name
      if (roles.venue_id) {
        const { data: venue } = await supabase
          .from("venues")
          .select("name")
          .eq("id", roles.venue_id)
          .single();

        setUserRole({
          ...roles,
          venue_name: venue?.name || "Unknown Venue",
        });
      }

      setLoading(false);
    };

    checkMerchantAccess();
  }, [user, session, authLoading, navigate, toast]);

  return { user, session, userRole, loading };
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
        navigate("/dev/auth");
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
        navigate("/dev/auth");
        return;
      }

      setIsSuperAdmin(true);
      setLoading(false);
    };

    checkDevAccess();
  }, [user, session, authLoading, navigate, toast]);

  return { user, session, isSuperAdmin, loading };
};
