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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KeyRound, Mail, Check, AlertCircle, HelpCircle } from "lucide-react";

interface PasswordResetDialogProps {
  userEmail?: string;
  trigger?: React.ReactNode;
  /** If true, shows only the "Request Admin Help" option (for merchant auth) */
  showAdminHelpOption?: boolean;
}

export function PasswordResetDialog({ userEmail, trigger, showAdminHelpOption }: PasswordResetDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(userEmail || "");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [adminHelpRequested, setAdminHelpRequested] = useState(false);
  const [showAdminHelpForm, setShowAdminHelpForm] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      });

      if (error) throw error;

      setEmailSent(true);
      toast({
        title: t("passwordReset.emailSentSuccess"),
        description: t("passwordReset.emailSentDesc"),
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || t("passwordReset.failedSendReset"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAdminHelp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("request-password-reset", {
        body: { email },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAdminHelpRequested(true);
      toast({
        title: t("passwordReset.requestSuccess"),
        description: t("passwordReset.requestSuccessDesc"),
      });
    } catch (error: any) {
      toast({
        title: t("common.error"),
        description: error.message || t("passwordReset.failedSubmitRequest"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset state after dialog closes
    setTimeout(() => {
      setEmailSent(false);
      setAdminHelpRequested(false);
      setShowAdminHelpForm(false);
      setEmail(userEmail || "");
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else setOpen(true);
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <KeyRound size={16} className="mr-2" />
            Reset Password
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            {emailSent
              ? "Check your email for the reset link"
              : adminHelpRequested
              ? "Your request has been submitted"
              : showAdminHelpForm
              ? "Request password reset assistance"
              : "Choose how to reset your password"}
          </DialogDescription>
        </DialogHeader>

        {/* Success state - Email sent */}
        {emailSent && (
          <div className="space-y-4 py-4">
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950/30">
              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-900 dark:text-green-100">
                <p className="font-semibold mb-2">Reset link sent to {email}</p>
                <p className="text-sm">
                  Click the link in your email to reset your password. The link will redirect you
                  back to this site where you can set a new password.
                </p>
              </AlertDescription>
            </Alert>
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        )}

        {/* Success state - Admin help requested */}
        {adminHelpRequested && (
          <div className="space-y-4 py-4">
            <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950/30">
              <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-900 dark:text-blue-100">
                <p className="font-semibold mb-2">Request submitted for {email}</p>
                <p className="text-sm">
                  An administrator will review your request and contact you directly with a new password.
                </p>
              </AlertDescription>
            </Alert>
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        )}

        {/* Admin help form */}
        {!emailSent && !adminHelpRequested && showAdminHelpForm && (
          <form onSubmit={handleRequestAdminHelp} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="admin-help-email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="admin-help-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <Alert>
              <HelpCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Your request will be sent to an administrator who will contact you directly with a new password.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setShowAdminHelpForm(false)} className="flex-1">
                Back
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </form>
        )}

        {/* Main form - choose method */}
        {!emailSent && !adminHelpRequested && !showAdminHelpForm && (
          <form onSubmit={handleSendResetEmail} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription className="text-sm">
                You'll receive an email with a link to reset your password. The link is valid for 1 hour.
              </AlertDescription>
            </Alert>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </div>

            {/* Admin help option */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <AlertCircle className="h-4 w-4" />
                <span>Having trouble receiving emails?</span>
              </div>
              <Button 
                type="button" 
                variant="ghost" 
                className="w-full text-primary"
                onClick={() => setShowAdminHelpForm(true)}
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Request Admin Help
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
