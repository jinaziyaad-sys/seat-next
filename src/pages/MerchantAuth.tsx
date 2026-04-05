import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Mail, Store } from "lucide-react";
import { PasswordResetDialog } from "@/components/PasswordResetDialog";
import logo from "@/assets/logo.png";

interface VenueRole {
  role: string;
  venue_id: string;
  venues: { name: string } | null;
}

export default function MerchantAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [showResendOption, setShowResendOption] = useState(false);
  const [venueChoices, setVenueChoices] = useState<VenueRole[] | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await handlePostLogin(session.user.id);
      }
    };
    checkAuth();
  }, [navigate, toast]);

  const handlePostLogin = async (userId: string) => {
    // Fetch ALL roles with venue names
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role, venue_id, venues(name)")
      .eq("user_id", userId);

    if (!roles || roles.length === 0) {
      toast({
        title: "Access Denied",
        description: "You don't have merchant access. This is for restaurant staff only.",
        variant: "destructive",
      });
      await supabase.auth.signOut();
      return;
    }

    // Super admin goes straight to dev dashboard
    const superAdminRole = roles.find((r: any) => r.role === "super_admin");
    if (superAdminRole) {
      navigate("/dev/dashboard");
      return;
    }

    // Filter to staff/admin roles
    const merchantRoles = roles.filter((r: any) => r.role === "staff" || r.role === "admin");

    if (merchantRoles.length === 0) {
      toast({
        title: "Access Denied",
        description: "Invalid role. Please contact an administrator.",
        variant: "destructive",
      });
      await supabase.auth.signOut();
      return;
    }

    // Single venue — go straight to dashboard
    if (merchantRoles.length === 1) {
      navigate("/merchant/dashboard");
      return;
    }

    // Multiple venues — show picker
    setVenueChoices(merchantRoles as VenueRole[]);
  };

  const handleVenueSelect = (venueId: string) => {
    // Store selected venue in sessionStorage so useAuth picks it up
    sessionStorage.setItem("selectedVenueId", venueId);
    navigate("/merchant/dashboard");
  };

  const handleResendConfirmation = async () => {
    if (!email) {
      toast({ title: "Email Required", description: "Please enter your email address.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setEmailVerificationSent(true);
      toast({ title: "Email Sent!", description: "Check your inbox for the confirmation link." });
    }
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.includes("Email not confirmed") || error.message.includes("email_not_confirmed")) {
        toast({
          title: "Email Not Verified",
          description: "Please check your inbox and click the confirmation link, or resend it below.",
          variant: "destructive",
        });
        setShowResendOption(true);
        setEmailVerificationSent(false);
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
      setLoading(false);
      return;
    }

    if (data.session) {
      await handlePostLogin(data.session.user.id);
    }
    setLoading(false);
  };

  // Venue picker screen
  if (venueChoices) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <img src={logo} alt="ReadyUp" className="h-16 w-auto mx-auto" />
            </div>
            <CardTitle>Select a Venue</CardTitle>
            <CardDescription>You have access to multiple venues. Which one would you like to manage?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {venueChoices.map((vc) => (
              <Button
                key={vc.venue_id}
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-4"
                onClick={() => handleVenueSelect(vc.venue_id)}
              >
                <Store className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="text-left">
                  <p className="font-medium">{(vc.venues as any)?.name || "Unknown Venue"}</p>
                  <p className="text-xs text-muted-foreground capitalize">{vc.role}</p>
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <img src={logo} alt="ReadyUp" className="h-16 w-auto mx-auto" />
          </div>
          <CardTitle>Merchant Portal</CardTitle>
          <CardDescription>Sign in to manage your venue</CardDescription>
        </CardHeader>
        <CardContent>
          {emailVerificationSent && (
            <Alert className="mb-4">
              <Mail className="h-4 w-4" />
              <AlertTitle>Verification Email Sent</AlertTitle>
              <AlertDescription>
                Please check your inbox and click the confirmation link to complete setup.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="password">Password</Label>
                <PasswordResetDialog
                  userEmail={email}
                  trigger={
                    <button type="button" className="text-sm text-primary hover:underline">
                      Forgot password?
                    </button>
                  }
                />
              </div>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>

            {showResendOption && (
              <Button type="button" variant="ghost" onClick={handleResendConfirmation} className="w-full" disabled={loading}>
                Resend Confirmation Email
              </Button>
            )}

            <div className="text-sm text-center mt-4 space-y-1">
              <p className="text-muted-foreground">
                Don't have an account?{" "}
                <button type="button" className="text-primary hover:underline font-medium" onClick={() => navigate("/merchant/signup")}>
                  Sign up here
                </button>
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}