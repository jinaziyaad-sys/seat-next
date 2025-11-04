import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Mail, AlertCircle } from "lucide-react";
import { PasswordResetDialog } from "@/components/PasswordResetDialog";
import logo from "@/assets/logo.png";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationStep, setVerificationStep] = useState<"signup" | "phone-verify">("signup");
  const [otpCode, setOtpCode] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verificationMethod, setVerificationMethod] = useState<"email" | "phone">("email");
  const [smsFailureCount, setSmsFailureCount] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });

    // Check for auth errors in URL hash (from email verification failures)
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const error = hashParams.get('error');
    const errorDescription = hashParams.get('error_description');
    
    if (error) {
      let friendlyMessage = errorDescription || 'Authentication failed. Please try again.';
      
      // Enhanced detection for token-related errors
      if (
        error === 'access_denied' || 
        errorDescription?.toLowerCase().includes('expired') ||
        errorDescription?.toLowerCase().includes('token not found') ||
        errorDescription?.toLowerCase().includes('invalid') ||
        errorDescription?.toLowerCase().includes('already been used')
      ) {
        friendlyMessage = "⚠️ This verification link has been used or expired. Please request a fresh one below.";
        setEmailVerificationSent(true); // Show the request fresh link button
      }
      
      setAuthError(friendlyMessage);
      toast({
        title: "Verification Failed",
        description: friendlyMessage,
        variant: "destructive",
      });
      
      // Clear the hash to prevent showing error again on refresh
      window.history.replaceState(null, '', window.location.pathname);
    }

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Both email and phone are now always required
    if (!phone) {
      toast({
        title: "Phone Required",
        description: "Please enter your phone number.",
        variant: "destructive",
      });
      return;
    }

    // Validate phone format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone.replace(/[\s-]/g, ''))) {
      toast({
        title: "Invalid Phone",
        description: "Please enter a valid phone number with country code (e.g., +27823077786).",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: fullName,
          phone: phone,
          verification_method: verificationMethod,
        },
      },
    });

    if (error) {
      // Enhanced detection for user already exists
      if (
        error.message.toLowerCase().includes('already registered') ||
        error.message.toLowerCase().includes('already exists') ||
        error.message.toLowerCase().includes('user already')
      ) {
        setAuthError("You've already signed up! Check your email for the verification link, or request a fresh one below.");
        setEmailVerificationSent(true);
        if (data?.user?.id) {
          setUserId(data.user.id);
        }
        toast({
          title: "Account Already Exists",
          description: "Check your email for the verification link or request a new one.",
          variant: "destructive",
        });
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

    if (data.user) {
      setUserId(data.user.id);
      
      // Different flow based on verification method
      if (verificationMethod === "email") {
        setEmailVerificationSent(true);
        toast({
          title: "Check Your Email! 📧",
          description: "We sent a confirmation link to " + email,
        });
        // User will click email link and be logged in automatically
      } else {
        // Phone verification flow
        toast({
          title: "Email Sent!",
          description: "Now let's verify your phone number.",
        });
        
        // Automatically send SMS OTP
        await handleSendOTP(data.user.id, phone);
        setVerificationStep("phone-verify");
      }
    }
    
    setLoading(false);
  };

  const handleSendOTP = async (uid: string, phoneNumber: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('send-sms-otp', {
        body: { phone: phoneNumber, userId: uid }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Code Sent!",
          description: "Verification code sent to your phone.",
        });
        setSmsFailureCount(0);
        
        // Start resend cooldown (60 seconds)
        setResendCooldown(60);
        const interval = setInterval(() => {
          setResendCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        throw new Error(data.message || 'Failed to send code');
      }
    } catch (error: any) {
      setSmsFailureCount(prev => prev + 1);
      toast({
        title: "SMS Failed",
        description: smsFailureCount >= 1 
          ? "Having trouble with SMS? Try email verification instead."
          : "Failed to send verification code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a 6-digit verification code",
        variant: "destructive",
      });
      return;
    }

    if (!userId) {
      toast({
        title: "Error",
        description: "User ID not found. Please sign up again.",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('verify-sms-otp', {
        body: { code: otpCode, userId }
      });

      if (error) throw error;

      if (data.verified) {
        toast({
          title: "Phone Verified!",
          description: "Your phone number has been verified successfully.",
        });
        navigate("/");
      } else {
        toast({
          title: "Verification Failed",
          description: data.message || "Invalid verification code",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to verify code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = () => {
    if (userId && phone) {
      handleSendOTP(userId, phone);
    }
  };

  const handleSwitchToEmail = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) throw error;

      setEmailVerificationSent(true);
      toast({
        title: "Check Your Email! 📧",
        description: "We sent a fresh confirmation link to " + email,
      });
      
      setVerificationStep("signup");
      setSmsFailureCount(0);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send email verification",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmailVerification = async () => {
    if (!email) return;
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });

      if (error) throw error;

      setAuthError(null);
      toast({
        title: "New Link Sent! ✅",
        description: "Check your email for a fresh verification link.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to resend verification email",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
    } else {
      navigate("/");
    }
    setLoading(false);
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
          <CardTitle>Welcome</CardTitle>
          <CardDescription>Sign in to track your orders and reservations</CardDescription>
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
              </form>
            </TabsContent>

            <TabsContent value="signup">
              {emailVerificationSent ? (
                <div className="space-y-4 py-4">
                  <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
                    <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <AlertTitle className="text-lg">📬 Check Your Email!</AlertTitle>
                    <AlertDescription className="space-y-3">
                      <p className="text-base">We sent a verification link to <strong className="text-amber-900 dark:text-amber-100">{email}</strong></p>
                      <div className="text-sm space-y-2 mt-3 pt-3 border-t-2 border-amber-300 dark:border-amber-700 bg-amber-100/50 dark:bg-amber-900/20 p-3 rounded-md">
                        <p className="font-bold text-amber-900 dark:text-amber-100 text-base flex items-center gap-2">
                          <span className="text-xl">⚠️</span> CRITICAL: Read This!
                        </p>
                        <ul className="list-none space-y-2 text-amber-900 dark:text-amber-100">
                          <li className="flex items-start gap-2">
                            <span className="font-bold min-w-[20px]">1.</span>
                            <span>Each link works <strong className="underline">ONLY ONCE</strong></span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="font-bold min-w-[20px]">2.</span>
                            <span>Use the <strong className="underline">NEWEST</strong> email (ignore older ones)</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="font-bold min-w-[20px]">3.</span>
                            <span>If you clicked an old link → it's expired → request fresh one below</span>
                          </li>
                        </ul>
                      </div>
                    </AlertDescription>
                  </Alert>

                  {authError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Verification Issue</AlertTitle>
                      <AlertDescription>{authError}</AlertDescription>
                    </Alert>
                  )}

                  <Button 
                    onClick={handleResendEmailVerification}
                    className="w-full"
                    disabled={loading}
                    variant="default"
                  >
                    {loading ? "Sending..." : "📧 Request Fresh Verification Link"}
                  </Button>

                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setEmailVerificationSent(false);
                      setAuthError(null);
                      setVerificationStep("signup");
                    }} 
                    className="w-full"
                  >
                    Back to Sign Up
                  </Button>
                </div>
              ) : verificationStep === "signup" ? (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone Number (with country code) *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1234567890"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Include country code (e.g., +1 for US, +44 for UK)
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="signup-email">Email *</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="signup-password">Password *</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Verification Method *</Label>
                    <RadioGroup value={verificationMethod} onValueChange={(value) => setVerificationMethod(value as "email" | "phone")}>
                      <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                        <RadioGroupItem value="email" id="email-verify" />
                        <Label htmlFor="email-verify" className="font-normal cursor-pointer flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">📧</span>
                            <div>
                              <div className="font-medium">Email verification</div>
                              <div className="text-xs text-muted-foreground">Traditional, free</div>
                            </div>
                          </div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
                        <RadioGroupItem value="phone" id="phone-verify" />
                        <Label htmlFor="phone-verify" className="font-normal cursor-pointer flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">📱</span>
                            <div>
                              <div className="font-medium">Phone (SMS) verification</div>
                              <div className="text-xs text-muted-foreground">Faster access</div>
                            </div>
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>
                    <p className="text-xs text-muted-foreground">
                      Choose how you'd like to verify your account
                    </p>
                  </div>

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Creating account..." : "Sign Up"}
                  </Button>
                </form>
              ) : (
                <div className="space-y-4 py-4">
                  <div className="text-center space-y-2">
                    <h3 className="font-semibold text-lg">Verify Your Phone</h3>
                    <p className="text-sm text-muted-foreground">
                      We sent a 6-digit code to {phone}
                    </p>
                  </div>
                  
                  <div>
                    <Label htmlFor="otp">Verification Code</Label>
                    <Input
                      id="otp"
                      type="text"
                      maxLength={6}
                      placeholder="000000"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      className="text-center text-2xl tracking-widest"
                    />
                  </div>

                  <Button 
                    onClick={handleVerifyOTP} 
                    className="w-full" 
                    disabled={loading || otpCode.length !== 6}
                  >
                    {loading ? "Verifying..." : "Verify Phone"}
                  </Button>

                  <Button 
                    variant="ghost" 
                    onClick={handleResendOTP} 
                    className="w-full"
                    disabled={loading || resendCooldown > 0}
                  >
                    {resendCooldown > 0 
                      ? `Resend Code (${resendCooldown}s)` 
                      : "Resend Code"
                    }
                  </Button>

                  {smsFailureCount >= 2 && (
                    <Button 
                      variant="default" 
                      onClick={handleSwitchToEmail}
                      className="w-full"
                      disabled={loading}
                    >
                      📧 Switch to Email Verification
                    </Button>
                  )}

                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setVerificationStep("signup");
                      setOtpCode("");
                      setUserId(null);
                      setSmsFailureCount(0);
                    }} 
                    className="w-full"
                    disabled={loading}
                  >
                    Back to Sign Up
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
