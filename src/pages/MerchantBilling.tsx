import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMerchantAuth } from "@/hooks/useAuth";
import { useMerchantSubscription } from "@/hooks/useMerchantSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CreditCard, ExternalLink, ArrowLeft, AlertTriangle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function MerchantBilling() {
  const { user, loading: authLoading } = useMerchantAuth();
  const subscription = useMerchantSubscription();
  const navigate = useNavigate();
  const [portalLoading, setPortalLoading] = useState(false);

  const handleManagePayment = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast.error("Failed to open billing portal: " + (err.message || "Unknown error"));
    } finally {
      setPortalLoading(false);
    }
  };

  if (authLoading || subscription.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
    active: { label: "Active", variant: "default", icon: CheckCircle2 },
    trial: { label: "Trial", variant: "secondary", icon: CheckCircle2 },
    past_due: { label: "Past Due", variant: "destructive", icon: AlertTriangle },
    cancelled: { label: "Cancelled", variant: "outline", icon: XCircle },
    locked: { label: "Locked", variant: "destructive", icon: XCircle },
    none: { label: "No Subscription", variant: "outline", icon: XCircle },
  };

  const currentStatus = statusConfig[subscription.status] || statusConfig.none;
  const StatusIcon = currentStatus.icon;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/merchant/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Billing & Subscription</h1>
            <p className="text-muted-foreground">Manage your plan, payment method, and invoices</p>
          </div>
        </div>

        {/* Current Plan */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <StatusIcon className="h-5 w-5" />
                  Current Plan
                </CardTitle>
                <CardDescription>
                  {subscription.subscribed
                    ? `You're on the ${subscription.tierName || "Active"} plan`
                    : "You don't have an active subscription"}
                </CardDescription>
              </div>
              <Badge variant={currentStatus.variant}>{currentStatus.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {subscription.subscribed && (
              <>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Plan</p>
                    <p className="font-medium">{subscription.tierName || "Active"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Next Billing Date</p>
                    <p className="font-medium">
                      {subscription.subscriptionEnd
                        ? new Date(subscription.subscriptionEnd).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                </div>
                <Separator />
              </>
            )}

            <div className="flex flex-wrap gap-3">
              {!subscription.subscribed && (
                <Button onClick={() => navigate("/merchant/signup")}>
                  Choose a Plan
                </Button>
              )}
              {subscription.subscribed && (
                <Button variant="outline" onClick={() => navigate("/merchant/signup")}>
                  Change Plan
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment Method */}
        {subscription.subscribed && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Method
              </CardTitle>
              <CardDescription>Update your card or payment details via Stripe</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleManagePayment} disabled={portalLoading} variant="outline">
                {portalLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Manage Payment Method
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Past Due Warning */}
        {subscription.status === "past_due" && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Payment Overdue
              </CardTitle>
              <CardDescription>
                Your subscription payment failed. Please update your payment method to avoid losing access.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleManagePayment} disabled={portalLoading} variant="destructive">
                {portalLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Update Payment Method
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Cancel Subscription */}
        {subscription.subscribed && (
          <Card>
            <CardHeader>
              <CardTitle>Cancel Subscription</CardTitle>
              <CardDescription>
                Cancel your subscription. You'll retain access until the end of your current billing period.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10">
                    Cancel Subscription
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel your subscription?</AlertDialogTitle>
                    <AlertDialogDescription>
                      You'll lose access to your dashboard features at the end of your current billing period
                      {subscription.subscriptionEnd && (
                        <> on <strong>{new Date(subscription.subscriptionEnd).toLocaleDateString()}</strong></>
                      )}
                      . You can resubscribe at any time.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={handleManagePayment}
                    >
                      Proceed to Cancel
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
