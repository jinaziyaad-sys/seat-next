import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { UtensilsCrossed, Store, Code2, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";

interface RoleRouterProps {
  userId: string;
  userName?: string;
}

type RoleType = "patron" | "merchant" | "super_admin";

export function RoleRouter({ userId, userName }: RoleRouterProps) {
  const [loading, setLoading] = useState(true);
  const [availableRoles, setAvailableRoles] = useState<RoleType[]>([]);
  const [rememberChoice, setRememberChoice] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkRolesAndRoute = async () => {
      // Check for remembered choice
      const remembered = localStorage.getItem("rememberedRoleChoice");
      
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role, venue_id")
        .eq("user_id", userId);

      const roleSet = new Set(roles?.map((r: any) => r.role) || []);
      const isSuperAdmin = roleSet.has("super_admin");
      const isMerchant = roleSet.has("staff") || roleSet.has("admin");

      // Build available role types — every user can access the patron view
      const available: RoleType[] = ["patron"];
      if (isMerchant) available.push("merchant");
      if (isSuperAdmin) available.push("super_admin");

      // If remembered choice exists and is valid, go straight there
      if (remembered && available.includes(remembered as RoleType)) {
        navigateToRole(remembered as RoleType);
        return;
      }

      // Single role or no roles → auto-route
      if (available.length <= 1) {
        navigateToRole(available[0] || "patron");
        return;
      }

      // Multiple roles → show picker
      setAvailableRoles(available);
      setLoading(false);
    };

    checkRolesAndRoute();
  }, [userId]);

  const navigateToRole = (role: RoleType) => {
    switch (role) {
      case "super_admin":
        navigate("/dev/dashboard", { replace: true });
        break;
      case "merchant":
        navigate("/merchant/dashboard", { replace: true });
        break;
      case "patron":
      default:
        navigate("/", { replace: true });
        break;
    }
  };

  const handleRoleSelect = (role: RoleType) => {
    if (rememberChoice) {
      localStorage.setItem("rememberedRoleChoice", role);
    }
    navigateToRole(role);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const roleConfig = {
    patron: {
      icon: UtensilsCrossed,
      label: "Patron",
      description: "Track orders & reservations",
      emoji: "🍽️",
    },
    merchant: {
      icon: Store,
      label: "Merchant",
      description: "Manage your venue",
      emoji: "🏪",
    },
    super_admin: {
      icon: Code2,
      label: "Developer",
      description: "Platform administration",
      emoji: "⚙️",
    },
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <img src={logo} alt="ReadyUp" className="h-16 w-auto mx-auto" />
          </div>
          <CardTitle>Welcome back{userName ? `, ${userName}` : ""}!</CardTitle>
          <CardDescription>Where would you like to go?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {availableRoles.map((role) => {
            const config = roleConfig[role];
            const Icon = config.icon;
            return (
              <Button
                key={role}
                variant="outline"
                className="w-full justify-start gap-4 h-auto py-4 px-5"
                onClick={() => handleRoleSelect(role)}
              >
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">{config.label}</p>
                  <p className="text-xs text-muted-foreground">{config.description}</p>
                </div>
              </Button>
            );
          })}

          <div className="flex items-center space-x-2 pt-3 justify-center">
            <Checkbox
              id="remember"
              checked={rememberChoice}
              onCheckedChange={(checked) => setRememberChoice(checked === true)}
            />
            <label
              htmlFor="remember"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Remember my choice
            </label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function clearRoleChoice() {
  localStorage.removeItem("rememberedRoleChoice");
}
