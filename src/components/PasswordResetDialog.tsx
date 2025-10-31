import { useState } from "react";
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
import { KeyRound, Mail, Check } from "lucide-react";

interface PasswordResetDialogProps {
  userEmail?: string;
  trigger?: React.ReactNode;
}

export function PasswordResetDialog({ userEmail, trigger }: PasswordResetDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(userEmail || "");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

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
        title: "Reset Email Sent ✅",
        description: "Check your email for the password reset link.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send reset email",
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
              : "Enter your email to receive a password reset link"}
          </DialogDescription>
        </DialogHeader>

        {emailSent ? (
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
        ) : (
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
                You'll receive an email with a link to reset your password. The link is valid for 1
                hour.
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
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
