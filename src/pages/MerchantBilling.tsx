import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMerchantAuth } from "@/hooks/useAuth";
import { useMerchantSubscription } from "@/hooks/useMerchantSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CreditCard, ExternalLink, ArrowLeft, AlertTriangle, CheckCircle2, XCircle, Loader2, Receipt, Settings } from "lucide-react";
import { toast } from "sonner";
import { getCurrencySymbol } from "@/utils/currency";

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}

export default function MerchantBilling() {
  const { user, loading: authLoading, userRole } = useMerchantAuth();
  const subscription = useMerchantSubscription(userRole?.venue_id);
  const navigate = useNavigate();
  const [portalLoading, setPortalLoading] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);

  useEffect(() => {
    const fetchInvoices = async () => {
      if (!user || !userRole?.venue_id) return;
      const { data } = await supabase
        .from("billing_invoices")
        .select("id, invoice_number, amount, currency, status, period_start, period_end, created_at")
        .eq("venue_id", userRole.venue_id)
        .order("created_at", { ascending: false })
        .limit(20);
      setInvoices((data as Invoice[]) || []);
      setInvoicesLoading(false);
    };
    if (!authLoading && user) fetchInvoices();
  }, [user, authLoading, userRole?.venue_id]);

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
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
    trial: { label: "Free Trial", variant: "secondary", icon: CheckCircle2 },
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
                {subscription.status === 'trial' && subscription.trialEnd && (
                  <div className="p-3 rounded-lg bg-secondary/50 border border-secondary text-sm">
                    <p className="font-medium">🎉 You're on a 7-day free trial</p>
                    <p className="text-muted-foreground">
                      Trial ends on {new Date(subscription.trialEnd).toLocaleDateString()}
                      {' '}({Math.max(0, Math.ceil((new Date(subscription.trialEnd).getTime() - Date.now()) / 86400000))} days remaining)
                    </p>
                  </div>
                )}
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
                <Button onClick={() => navigate(`/merchant/signup?upgrade=true&venueId=${userRole?.venue_id}`)}>Choose a Plan</Button>
              )}
              {subscription.subscribed && (
                <>
                  <Button onClick={() => navigate(`/merchant/signup?upgrade=true&venueId=${userRole?.venue_id}`)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Change Plan
                  </Button>
                  <Button variant="outline" onClick={handleOpenPortal} disabled={portalLoading}>
                    {portalLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Manage Billing
                  </Button>
                </>
              )}
            </div>

            {subscription.subscribed && (
              <p className="text-xs text-muted-foreground">
                Upgrades are prorated immediately. Downgrades take effect at the end of your current billing period.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Payment Method */}
        {subscription.subscribed && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Method
                <Badge variant="outline" className="ml-2">{subscription.paymentProvider === 'payfast' ? '🇿🇦 PayFast' : '💳 Stripe'}</Badge>
              </CardTitle>
              <CardDescription>
                {subscription.paymentProvider === 'payfast'
                  ? 'Manage your PayFast subscription at payfast.co.za'
                  : 'Update your card or payment details via Stripe'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {subscription.paymentProvider === 'payfast' ? (
                <Button onClick={() => window.open('https://www.payfast.co.za/dashboard', '_blank')} variant="outline">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Manage on PayFast
                </Button>
              ) : (
                <Button onClick={handleOpenPortal} disabled={portalLoading} variant="outline">
                  {portalLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  Manage Payment Method
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Invoice History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Invoice History
            </CardTitle>
            <CardDescription>Your past invoices and payments</CardDescription>
          </CardHeader>
          <CardContent>
            {invoicesLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No invoices yet</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium text-sm">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(inv.created_at).toLocaleDateString()}
                        {inv.period_start && inv.period_end && (
                          <> • {new Date(inv.period_start).toLocaleDateString()} – {new Date(inv.period_end).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {getCurrencySymbol(inv.currency)}{(inv.amount / 100).toFixed(2)}
                      </span>
                      <Badge variant={inv.status === 'paid' ? 'default' : inv.status === 'overdue' ? 'destructive' : 'outline'}>
                        {inv.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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
              <Button onClick={handleOpenPortal} disabled={portalLoading} variant="destructive">
                {portalLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Update Payment Method
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Cancel via Portal */}
        {subscription.subscribed && (
          <Card>
            <CardHeader>
              <CardTitle>Cancel Subscription</CardTitle>
              <CardDescription>
                Cancel your subscription via the billing portal. You'll retain access until the end of your current billing period.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="text-destructive border-destructive hover:bg-destructive/10"
                onClick={handleOpenPortal}
                disabled={portalLoading}
              >
                {portalLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Manage Cancellation
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}