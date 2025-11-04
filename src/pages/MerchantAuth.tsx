import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Mail } from "lucide-react";
import { PasswordResetDialog } from "@/components/PasswordResetDialog";
import logo from "@/assets/logo.png";

export default function MerchantAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if already authenticated
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Check user role
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role, venue_id")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (!roles) {
          // User is a patron - deny access
          toast({
            title: "Access Denied",
            description: "You don't have merchant access. This is for restaurant staff only.",
            variant: "destructive",
          });
          await supabase.auth.signOut();
          return;
        }

        // Redirect based on role
        if (roles.role === "super_admin") {
          navigate("/dev/dashboard");
        } else if (roles.role === "staff" || roles.role === "admin") {
          navigate("/merchant/dashboard");
        } else {
          toast({
            title: "Access Denied",
            description: "Invalid role. Please contact an administrator.",
            variant: "destructive",
          });
          await supabase.auth.signOut();
        }
      }
    };

    checkAuth();
  }, [navigate, toast]);

  const handleResendConfirmation = async () => {
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setEmailVerificationSent(true);
      toast({
        title: "Email Sent!",
        description: "Check your inbox for the confirmation link.",
      });
    }
    
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Special handling for unverified email
      if (error.message.includes("Email not confirmed") || error.message.includes("email_not_confirmed")) {
        toast({
          title: "Email Not Verified",
          description: "Please check your inbox and click the confirmation link.",
          variant: "destructive",
        });
        setEmailVerificationSent(false); // Allow resend
      } else {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      }
      setLoading(false);
      return;
    }

    if (data.session) {
      // Check user role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.session.user.id)
        .maybeSingle();

      if (!roles) {
        toast({
          title: "Access Denied",
          description: "You don't have merchant access. This is for restaurant staff only.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      // Redirect based on role
      if (roles.role === "super_admin") {
        navigate("/dev/dashboard");
      } else if (roles.role === "staff" || roles.role === "admin") {
        navigate("/merchant/dashboard");
      } else {
        toast({
          title: "Access Denied",
          description: "Invalid role. Please contact an administrator.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <img 
              src={logo} 
              alt="ReadyUp" 
              className="h-16 w-auto mx-auto"
            />
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
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label htmlFor="password">Password</Label>
                <PasswordResetDialog 
                  userEmail={email}
                  trigger={
                    <button
                      type="button"
                      className="text-sm text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
                  }
                />
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
            
            <Button 
              type="button"
              variant="ghost" 
              onClick={handleResendConfirmation}
              className="w-full"
              disabled={loading}
            >
              Resend Confirmation Email
            </Button>
            
            <p className="text-sm text-muted-foreground text-center mt-4">
              Need access? Contact your venue administrator.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
