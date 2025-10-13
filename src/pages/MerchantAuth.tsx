import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Building2 } from "lucide-react";

export default function MerchantAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        // Check if user has merchant role
        setTimeout(async () => {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("*")
            .eq("user_id", session.user.id);

          if (roles && roles.length > 0) {
            const venueId = roles[0].venue_id;
            const { data: venue } = await supabase
              .from("venues")
              .select("*")
              .eq("id", venueId)
              .single();

            if (venue) {
              localStorage.setItem("merchantVenueId", venue.id);
              localStorage.setItem("merchantVenueName", venue.name);
              navigate("/merchant/dashboard");
            }
          } else {
            toast({
              title: "Access Denied",
              description: "You don't have merchant access. Please contact an administrator.",
              variant: "destructive",
            });
            await supabase.auth.signOut();
          }
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary rounded-full flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle>Merchant Portal</CardTitle>
          <CardDescription>Sign in to manage your venue</CardDescription>
        </CardHeader>
        <CardContent>
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
              <Label htmlFor="password">Password</Label>
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
            <p className="text-sm text-muted-foreground text-center mt-4">
              Need access? Contact your venue administrator.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
