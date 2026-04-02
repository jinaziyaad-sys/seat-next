import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, X } from "lucide-react";

interface PhonePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onComplete: () => void;
}

export function PhonePromptDialog({
  open,
  onOpenChange,
  userId,
  onComplete,
}: PhonePromptDialogProps) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationStep, setVerificationStep] = useState<"input" | "verify">("input");
  const [otpCode, setOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleSubmitPhone = async () => {
    // Validate phone format
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(phone.replace(/[\s-]/g, ''))) {
      toast({
        title: t("phone.invalidPhone"),
        description: t("phone.invalidPhoneDesc"),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Update profile with phone number
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ phone })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Send SMS OTP for verification
      const { data, error } = await supabase.functions.invoke('send-sms-otp', {
        body: { phone, userId }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: t("phone.codeSent"),
          description: t("phone.codeSentDesc"),
        });
        setVerificationStep("verify");
        
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
      toast({
        title: t("common.error"),
        description: error.message || t("phone.failedUpdate"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length !== 6) {
      toast({
        title: t("phone.invalidCode"),
        description: t("phone.invalidCodeDesc"),
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
          title: t("phone.phoneVerified"),
          description: t("phone.phoneVerifiedDesc"),
        });
        onComplete();
        onOpenChange(false);
      } else {
        toast({
          title: t("phone.verificationFailed"),
          description: data.message || t("phone.failedVerify"),
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || t("phone.failedVerify"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('send-sms-otp', {
        body: { phone, userId }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: t("phone.codeSent"),
          description: t("phone.newCodeSent"),
        });
        
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
      }
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: t("phone.failedResend"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    // Just close the dialog - phone stays empty
    onComplete();
    onOpenChange(false);
    toast({
      title: t("phone.skipped"),
      description: t("phone.skippedDesc"),
    });
  };

  const handleSaveWithoutVerify = async () => {
    // Save phone but mark as unverified
    try {
      setLoading(true);
      const { error } = await supabase
        .from('profiles')
        .update({ phone, phone_verified: false })
        .eq('id', userId);

      if (error) throw error;

      onComplete();
      onOpenChange(false);
      toast({
        title: "Phone Saved",
        description: "Your phone number has been saved. You can verify it later.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save phone number",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Complete Your Profile
          </DialogTitle>
          <DialogDescription>
            Add your phone number to receive SMS notifications when your table or order is ready.
          </DialogDescription>
        </DialogHeader>

        {verificationStep === "input" ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="phone-prompt">Phone Number (with country code)</Label>
              <Input
                id="phone-prompt"
                type="tel"
                placeholder="+1234567890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Include country code (e.g., +1 for US, +44 for UK)
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button 
                onClick={handleSubmitPhone} 
                disabled={loading || !phone}
                className="w-full"
              >
                {loading ? "Sending Code..." : "Verify Phone Number"}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={handleSkip}
                disabled={loading}
                className="w-full"
              >
                Skip for Now
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                We sent a 6-digit code to {phone}
              </p>
            </div>
            
            <div>
              <Label htmlFor="otp-prompt">Verification Code</Label>
              <Input
                id="otp-prompt"
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

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setVerificationStep("input");
                  setOtpCode("");
                }}
                disabled={loading}
                className="flex-1"
              >
                Change Number
              </Button>
              <Button 
                variant="outline" 
                onClick={handleSaveWithoutVerify}
                disabled={loading}
                className="flex-1"
              >
                Skip Verification
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
