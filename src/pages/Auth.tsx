import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Store, Check } from "lucide-react";
import { PasswordResetDialog } from "@/components/PasswordResetDialog";
import { RoleRouter } from "@/components/RoleRouter";
import { getAuthRedirectUrl } from "@/utils/authRedirect";
import logo from "@/assets/logo.png";

const POST_AUTH_REDIRECT_KEY = "postAuthRedirect";
const MERCHANT_SIGNUP_PATH = "/merchant/signup";

const getStoredPostAuthRedirect = () => {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(POST_AUTH_REDIRECT_KEY);
  } catch {
    return null;
  }
};

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const [showResendOption, setShowResendOption] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  // Role routing state
  const [authenticatedUserId, setAuthenticatedUserId] = useState<string | null>(null);
  const [authenticatedUserName, setAuthenticatedUserName] = useState<string | undefined>(undefined);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const merchantIntent = searchParams.get('intent') === 'merchant' || getStoredPostAuthRedirect() === MERCHANT_SIGNUP_PATH;
  const postAuthRedirectPath = merchantIntent ? MERCHANT_SIGNUP_PATH : null;
  const authRedirectUrl = getAuthRedirectUrl(postAuthRedirectPath ?? '/auth');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: authRedirectUrl,
      },
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authenticatedUserId && postAuthRedirectPath) {
      navigate(postAuthRedirectPath, { replace: true });
    }
  }, [authenticatedUserId, postAuthRedirectPath, navigate]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setAuthenticatedUserId(session.user.id);
        setAuthenticatedUserName(
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          undefined
        );
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAuthenticatedUserId(session.user.id);
        setAuthenticatedUserName(
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          undefined
        );
      }
    });

    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const error = hashParams.get('error');
    const errorDescription = hashParams.get('error_description');

    if (error) {
      const expired =
        error === 'access_denied' ||
        errorDescription?.toLowerCase().includes('expired') ||
        errorDescription?.toLowerCase().includes('token not found') ||
        errorDescription?.toLowerCase().includes('invalid') ||
        errorDescription?.toLowerCase().includes('already been used');

      setAuthNotice(
        expired
          ? "That verification link has expired or was already used. Request a fresh one below."
          : (errorDescription || "Verification failed. Please try again.")
      );
      setEmailVerificationSent(true);
      window.history.replaceState(null, '', window.location.pathname);
    }

    return () => subscription.unsubscribe();
  }, []);

  if (authenticatedUserId && postAuthRedirectPath) {
    return null;
  }

  if (authenticatedUserId) {
    return <RoleRouter userId={authenticatedUserId} userName={authenticatedUserName} />;
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: authRedirectUrl,
        data: { full_name: fullName, verification_method: "email" },
      },
    });

    if (error) {
      if (
        error.message.toLowerCase().includes('already registered') ||
        error.message.toLowerCase().includes('already exists') ||
        error.message.toLowerCase().includes('user already')
      ) {
        setAuthNotice("You've already signed up — check your email for the verification link, or request a fresh one below.");
        setEmailVerificationSent(true);
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
      setLoading(false);
      return;
    }

    if (data.user) {
      setEmailVerificationSent(true);
      setAuthNotice(null);
      toast({ title: "Check your email", description: `We sent a verification link to ${email}` });
    }
    setLoading(false);
  };

  const handleResendEmailVerification = async () => {
    if (!email) {
      toast({ title: "Email required", description: "Please enter your email address.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: authRedirectUrl },
      });
      if (error) throw error;
      setAuthNotice(null);
      toast({ title: "New link sent", description: "Check your email for a fresh verification link." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to resend verification email", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) {
      toast({ title: "Email required", description: "Please enter your email address.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: authRedirectUrl },
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setEmailVerificationSent(true);
      toast({ title: "Email sent", description: "Check your inbox for the confirmation link." });
    }
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.includes("Email not confirmed") || error.message.includes("email_not_confirmed")) {
        toast({
          title: "Email not verified",
          description: "Check your inbox for the verification link, or resend it below.",
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

    if (postAuthRedirectPath) {
      navigate(postAuthRedirectPath, { replace: true });
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <img src={logo} alt="ReadyUp" className="h-16 w-auto mx-auto" />
          </div>
          <CardTitle>Welcome to ReadyUp</CardTitle>
          <CardDescription>Sign in to your account or create a new one</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin" onValueChange={(v) => setIsLogin(v === "signin")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
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
                      trigger={<button type="button" className="text-sm text-primary hover:underline">Forgot password?</button>}
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

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-popover px-2 text-muted-foreground">or continue with</span>
                  </div>
                </div>

                <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={loading}>
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Sign in with Google
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              {emailVerificationSent ? (
                <div className="space-y-4 py-4 text-center">
                  <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="h-7 w-7 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold">Check your email</h3>
                    <p className="text-sm text-muted-foreground">
                      We sent a verification link to{" "}
                      <span className="font-medium text-foreground">{email || "your inbox"}</span>.
                      Click it to finish creating your account.
                    </p>
                  </div>

                  {authNotice && (
                    <Alert className="text-left">
                      <AlertDescription className="text-sm">{authNotice}</AlertDescription>
                    </Alert>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Didn't get it? Check your spam folder, then request a fresh link.
                  </p>

                  <div className="space-y-2">
                    <Button onClick={handleResendEmailVerification} className="w-full" disabled={loading}>
                      {loading ? "Sending…" : "Resend verification link"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => { setEmailVerificationSent(false); setAuthNotice(null); }}
                      className="w-full"
                    >
                      Back to sign up
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <Label htmlFor="fullName">Full name</Label>
                    <Input id="fullName" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="signup-password">Password</Label>
                    <Input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                    <p className="text-xs text-muted-foreground mt-1">At least 6 characters</p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-primary" />
                    <span>We'll email you a verification link to finish signup</span>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating account..." : "Create account"}
                  </Button>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-popover px-2 text-muted-foreground">or sign up with</span>
                    </div>
                  </div>

                  <Button type="button" variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={loading}>
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Sign up with Google
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>

          {/* Merchant signup link */}
          <div className="mt-6 pt-4 border-t text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Want to list your restaurant?{" "}
              <button
                type="button"
                className="text-primary hover:underline font-medium inline-flex items-center gap-1"
                onClick={() => navigate("/merchant/signup")}
              >
                <Store className="h-3.5 w-3.5" />
                Create a venue account
              </button>
            </p>
            <p className="text-xs text-muted-foreground">
              <button
                type="button"
                className="hover:underline"
                onClick={() => navigate("/privacy")}
              >
                Privacy Policy
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
