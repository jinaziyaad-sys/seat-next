import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, Store, Shield, Plus, Trash2, Loader2, FileText, Send, RefreshCw, Globe } from "lucide-react";
import { SUPPORTED_CURRENCIES, CURRENCY_CODES, getCurrencySymbol } from "@/utils/currency";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface VenueSubscription {
  venue_id: string;
  venue_name: string;
  status: string;
  plan_name: string | null;
  stripe_subscription_id: string | null;
  current_period_end: string | null;
  has_override: boolean;
  override_type: string | null;
}

interface InvoiceRow {
  id: string;
  invoice_number: string;
  venue_id: string;
  venue_name?: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

interface PlanPricing {
  id: string;
  name: string;
  monthly_price: number;
  annual_price: number;
  stripe_monthly_price_id: string | null;
  stripe_annual_price_id: string | null;
  stripe_product_id: string | null;
  stripe_annual_product_id: string | null;
}

export function BillingDashboard() {
  const [subscriptions, setSubscriptions] = useState<VenueSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [overrideDialog, setOverrideDialog] = useState<{ venueId: string; venueName: string } | null>(null);
  const [overrideType, setOverrideType] = useState("free_pro");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideExpiry, setOverrideExpiry] = useState("");
  const [saving, setSaving] = useState(false);

  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoiceDialog, setInvoiceDialog] = useState<{ venueId: string; venueName: string } | null>(null);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [invoiceSaving, setInvoiceSaving] = useState(false);

  // Pricing management state
  const [plans, setPlans] = useState<PlanPricing[]>([]);
  const [editingPrices, setEditingPrices] = useState<Record<string, { monthly: string; annual: string }>>({});
  const [pricingSaving, setPricingSaving] = useState<string | null>(null);
  const [confirmPricing, setConfirmPricing] = useState<PlanPricing | null>(null);

  // Promo pricing state
  const [promoBasePrice, setPromoBasePrice] = useState("");
  const [promoPlacementMults, setPromoPlacementMults] = useState<Record<string, string>>({});
  const [promoSaving, setPromoSaving] = useState(false);

  // Currency overrides state
  const [currencyOverrides, setCurrencyOverrides] = useState<any[]>([]);
  const [overrideCurrency, setOverrideCurrency] = useState("USD");
  const [overridePlanId, setOverridePlanId] = useState("");
  const [overrideMonthly, setOverrideMonthly] = useState("");
  const [overrideAnnual, setOverrideAnnual] = useState("");
  const [overrideSaving, setOverrideSaving] = useState(false);

  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: venues } = await supabase.from("venues").select("id, name").order("name");
      if (!venues) return;

      const { data: subs } = await supabase.from("merchant_subscriptions").select("*, subscription_plans(name)");
      const { data: overrides } = await supabase.from("dev_pricing_overrides").select("*");
      const { data: invData } = await supabase
        .from("billing_invoices")
        .select("id, invoice_number, venue_id, amount, currency, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      // Fetch plans for pricing section
      const { data: planData } = await supabase
        .from("subscription_plans")
        .select("id, name, monthly_price, annual_price, stripe_monthly_price_id, stripe_annual_price_id, stripe_product_id, stripe_annual_product_id")
        .eq("is_active", true)
        .order("sort_order");

      // Fetch promo pricing
      const { data: promoData } = await supabase
        .from("promo_pricing_rules")
        .select("base_price_per_day, placement_multipliers")
        .eq("is_active", true)
        .limit(1)
        .single();

      const subMap = new Map((subs || []).map((s: any) => [s.venue_id, s]));
      const overrideMap = new Map((overrides || []).map((o: any) => [o.venue_id, o]));
      const venueMap = new Map(venues.map(v => [v.id, v.name]));

      const result: VenueSubscription[] = venues.map((v) => {
        const sub = subMap.get(v.id) as any;
        const ovr = overrideMap.get(v.id) as any;
        return {
          venue_id: v.id,
          venue_name: v.name,
          status: sub?.status || "inactive",
          plan_name: sub?.subscription_plans?.name || null,
          stripe_subscription_id: sub?.stripe_subscription_id || null,
          current_period_end: sub?.current_period_end || null,
          has_override: !!ovr,
          override_type: ovr?.override_type || null,
        };
      });

      setSubscriptions(result);
      setInvoices((invData || []).map((inv: any) => ({
        ...inv,
        venue_name: venueMap.get(inv.venue_id) || "Unknown",
      })));

      if (planData) {
        setPlans(planData as PlanPricing[]);
        const prices: Record<string, { monthly: string; annual: string }> = {};
        for (const p of planData as PlanPricing[]) {
          prices[p.id] = { monthly: String(p.monthly_price), annual: String(p.annual_price) };
        }
        setEditingPrices(prices);
      }

      if (promoData) {
        setPromoBasePrice(String(promoData.base_price_per_day));
        const mults = (promoData.placement_multipliers || {}) as Record<string, number>;
        const multsStr: Record<string, string> = {};
        for (const [k, v] of Object.entries(mults)) multsStr[k] = String(v);
        setPromoPlacementMults(multsStr);
      }

      // Fetch currency overrides
      const { data: currOverrides } = await supabase
        .from("plan_currency_overrides")
        .select("*")
        .order("currency");
      setCurrencyOverrides(currOverrides || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const activeCount = subscriptions.filter((s) => s.status === "active").length;
  const overrideCount = subscriptions.filter((s) => s.has_override).length;

  const handleAddOverride = async () => {
    if (!overrideDialog) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("dev_pricing_overrides").upsert({
        venue_id: overrideDialog.venueId,
        override_type: overrideType,
        reason: overrideReason || null,
        expires_at: overrideExpiry || null,
      }, { onConflict: "venue_id" });
      if (error) throw error;
      toast({ title: "Override applied", description: `${overrideDialog.venueName} set to ${overrideType}` });
      setOverrideDialog(null);
      setOverrideReason("");
      setOverrideExpiry("");
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveOverride = async (venueId: string) => {
    try {
      const { error } = await supabase.from("dev_pricing_overrides").delete().eq("venue_id", venueId);
      if (error) throw error;
      toast({ title: "Override removed" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleCreateInvoice = async () => {
    if (!invoiceDialog) return;
    setInvoiceSaving(true);
    try {
      const amount = parseFloat(invoiceAmount);
      if (isNaN(amount) || amount <= 0) throw new Error("Invalid amount");

      const { data, error } = await supabase.functions.invoke("create-invoice", {
        body: {
          venueId: invoiceDialog.venueId,
          amountZar: amount,
          description: invoiceNotes || "Monthly subscription fee",
          notes: invoiceNotes || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Invoice created & sent via Stripe", description: `${data.invoice_number} for ${invoiceDialog.venueName}` });
      setInvoiceDialog(null);
      setInvoiceAmount("");
      setInvoiceNotes("");
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setInvoiceSaving(false);
    }
  };

  const handleUpdateInvoiceStatus = async (invoiceId: string, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'sent') updateData.sent_at = new Date().toISOString();
      if (newStatus === 'paid') updateData.paid_at = new Date().toISOString();
      const { error } = await supabase.from("billing_invoices").update(updateData).eq("id", invoiceId);
      if (error) throw error;
      toast({ title: `Invoice marked as ${newStatus}` });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleSavePricing = async (plan: PlanPricing) => {
    const edited = editingPrices[plan.id];
    if (!edited) return;

    const newMonthly = parseFloat(edited.monthly);
    const newAnnual = parseFloat(edited.annual);
    if (isNaN(newMonthly) || isNaN(newAnnual) || newMonthly <= 0 || newAnnual <= 0) {
      toast({ title: "Invalid prices", description: "Prices must be positive numbers", variant: "destructive" });
      return;
    }

    // If prices haven't changed, skip
    if (newMonthly === plan.monthly_price && newAnnual === plan.annual_price) {
      toast({ title: "No changes", description: "Prices are the same" });
      return;
    }

    // Show confirmation
    setConfirmPricing(plan);
  };

  const handleConfirmPricing = async () => {
    if (!confirmPricing) return;
    const plan = confirmPricing;
    const edited = editingPrices[plan.id];
    setConfirmPricing(null);

    const newMonthly = parseFloat(edited.monthly);
    const newAnnual = parseFloat(edited.annual);

    setPricingSaving(plan.id);
    try {
      const body: any = { planId: plan.id };
      if (newMonthly !== plan.monthly_price) body.newMonthlyPrice = newMonthly;
      if (newAnnual !== plan.annual_price) body.newAnnualPrice = newAnnual;

      const { data, error } = await supabase.functions.invoke("update-plan-pricing", { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Pricing updated!", description: `${plan.name} prices synced to Stripe` });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error updating pricing", description: err.message, variant: "destructive" });
    } finally {
      setPricingSaving(null);
    }
  };

  const handleSavePromoPricing = async () => {
    setPromoSaving(true);
    try {
      const base = parseFloat(promoBasePrice);
      if (isNaN(base) || base <= 0) throw new Error("Invalid base price");
      const mults: Record<string, number> = {};
      for (const [k, v] of Object.entries(promoPlacementMults)) {
        const n = parseFloat(v);
        if (isNaN(n) || n <= 0) throw new Error(`Invalid multiplier for ${k}`);
        mults[k] = n;
      }
      const { error } = await supabase
        .from("promo_pricing_rules")
        .update({ base_price_per_day: base, placement_multipliers: mults })
        .eq("is_active", true);
      if (error) throw error;
      toast({ title: "Promo pricing updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setPromoSaving(false);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default", trial: "secondary", past_due: "destructive", inactive: "outline", cancelled: "outline",
    };
    return <Badge variant={map[status] || "outline"}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Store className="h-4 w-4" /> Total Venues
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold">{subscriptions.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Active Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-green-600">{activeCount}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" /> Pricing Overrides
            </CardTitle>
          </CardHeader>
          <CardContent><p className="text-2xl font-bold text-blue-600">{overrideCount}</p></CardContent>
        </Card>
      </div>

      {/* Manage Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" /> Manage Pricing
          </CardTitle>
          <CardDescription>
            Change prices here — updates are synced to Stripe automatically. Existing subscribers keep their current price until renewal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No plans found</p>
          ) : (
            <div className="space-y-4">
              {plans.map((plan) => {
                const edited = editingPrices[plan.id] || { monthly: String(plan.monthly_price), annual: String(plan.annual_price) };
                const hasChanges = parseFloat(edited.monthly) !== plan.monthly_price || parseFloat(edited.annual) !== plan.annual_price;
                const isSaving = pricingSaving === plan.id;

                return (
                  <div key={plan.id} className="p-4 rounded-lg border bg-card space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">{plan.name}</h3>
                      <Button
                        size="sm"
                        disabled={!hasChanges || isSaving}
                        onClick={() => handleSavePricing(plan)}
                      >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                        {isSaving ? "Syncing..." : "Save & Sync"}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Monthly Price (ZAR)</Label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={edited.monthly}
                          onChange={(e) => setEditingPrices(prev => ({
                            ...prev,
                            [plan.id]: { ...prev[plan.id], monthly: e.target.value }
                          }))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Annual Price (ZAR)</Label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={edited.annual}
                          onChange={(e) => setEditingPrices(prev => ({
                            ...prev,
                            [plan.id]: { ...prev[plan.id], annual: e.target.value }
                          }))}
                        />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>Monthly Price ID: <code className="bg-muted px-1 rounded">{plan.stripe_monthly_price_id || 'not set'}</code></p>
                      <p>Annual Price ID: <code className="bg-muted px-1 rounded">{plan.stripe_annual_price_id || 'not set'}</code></p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Currency Overrides */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" /> Currency Price Overrides
          </CardTitle>
          <CardDescription>
            Set fixed prices for specific currencies. If no override exists, prices auto-convert from ZAR using live exchange rates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing overrides */}
          {currencyOverrides.length > 0 && (
            <div className="space-y-2">
              {currencyOverrides.map((ov: any) => {
                const plan = plans.find(p => p.id === ov.plan_id);
                return (
                  <div key={ov.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium text-sm">{plan?.name || 'Unknown'} — {ov.currency}</p>
                      <p className="text-xs text-muted-foreground">
                        {getCurrencySymbol(ov.currency)}{ov.monthly_price}/mo · {getCurrencySymbol(ov.currency)}{ov.annual_price}/yr
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={async () => {
                      await supabase.from("plan_currency_overrides").delete().eq("id", ov.id);
                      toast({ title: "Override removed" });
                      fetchData();
                    }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add new override */}
          <div className="p-4 rounded-lg border bg-muted/50 space-y-3">
            <p className="text-sm font-medium">Add Override</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Plan</Label>
                <Select value={overridePlanId} onValueChange={setOverridePlanId}>
                  <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                  <SelectContent>
                    {plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Currency</Label>
                <Select value={overrideCurrency} onValueChange={setOverrideCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCY_CODES.filter(c => c !== 'ZAR').map(c => (
                      <SelectItem key={c} value={c}>{SUPPORTED_CURRENCIES[c].symbol} {c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Monthly</Label>
                <Input type="number" min="1" value={overrideMonthly} onChange={e => setOverrideMonthly(e.target.value)} placeholder="49" />
              </div>
              <div>
                <Label className="text-xs">Annual</Label>
                <Input type="number" min="1" value={overrideAnnual} onChange={e => setOverrideAnnual(e.target.value)} placeholder="490" />
              </div>
            </div>
            <Button size="sm" disabled={overrideSaving || !overridePlanId || !overrideMonthly || !overrideAnnual} onClick={async () => {
              setOverrideSaving(true);
              try {
                const monthly = parseFloat(overrideMonthly);
                const annual = parseFloat(overrideAnnual);
                if (isNaN(monthly) || isNaN(annual) || monthly <= 0 || annual <= 0) throw new Error("Invalid prices");
                const { error } = await supabase.from("plan_currency_overrides").upsert({
                  plan_id: overridePlanId,
                  currency: overrideCurrency,
                  monthly_price: monthly,
                  annual_price: annual,
                  updated_at: new Date().toISOString(),
                }, { onConflict: "plan_id,currency" });
                if (error) throw error;
                toast({ title: "Currency override saved" });
                setOverrideMonthly("");
                setOverrideAnnual("");
                fetchData();
              } catch (err: any) {
                toast({ title: "Error", description: err.message, variant: "destructive" });
              } finally {
                setOverrideSaving(false);
              }
            }}>
              {overrideSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Save Override
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Promo Ad Pricing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" /> Sponsored Ad Pricing
          </CardTitle>
          <CardDescription>
            Set the base price per day and placement multipliers for merchant-purchased promotions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="max-w-xs">
              <Label className="text-xs text-muted-foreground">Base Price Per Day (ZAR)</Label>
              <Input
                type="number"
                min="1"
                value={promoBasePrice}
                onChange={(e) => setPromoBasePrice(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Placement Multipliers</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(promoPlacementMults).map(([key, val]) => (
                  <div key={key}>
                    <Label className="text-xs capitalize">{key}</Label>
                    <Input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={val}
                      onChange={(e) => setPromoPlacementMults(prev => ({ ...prev, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
            <Button onClick={handleSavePromoPricing} disabled={promoSaving} size="sm">
              {promoSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save Promo Pricing
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Venue Subscriptions</CardTitle>
          <CardDescription>Manage subscription status and pricing overrides for all venues</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {subscriptions.map((sub) => (
                <div key={sub.venue_id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{sub.venue_name}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {sub.plan_name && <span>{sub.plan_name}</span>}
                      {sub.current_period_end && <span>• Renews {new Date(sub.current_period_end).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {sub.has_override && (
                      <Badge variant="secondary" className="text-xs">Override: {sub.override_type}</Badge>
                    )}
                    {statusBadge(sub.status)}
                    <Button size="sm" variant="ghost" title="Create invoice" onClick={() => setInvoiceDialog({ venueId: sub.venue_id, venueName: sub.venue_name })}>
                      <FileText className="h-3.5 w-3.5" />
                    </Button>
                    {sub.has_override ? (
                      <Button size="sm" variant="ghost" onClick={() => handleRemoveOverride(sub.venue_id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setOverrideDialog({ venueId: sub.venue_id, venueName: sub.venue_name })}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {subscriptions.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No venues found</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Invoices
          </CardTitle>
          <CardDescription>Review, send, and manage invoices</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No invoices yet</p>
          ) : (
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">{inv.venue_name} • {new Date(inv.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">R{(inv.amount / 100).toFixed(2)}</span>
                    <Badge variant={inv.status === 'paid' ? 'default' : inv.status === 'sent' ? 'secondary' : 'outline'}>
                      {inv.status}
                    </Badge>
                    {inv.status === 'draft' && (
                      <Button size="sm" variant="ghost" title="Mark as sent" onClick={() => handleUpdateInvoiceStatus(inv.id, 'sent')}>
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {(inv.status === 'draft' || inv.status === 'sent') && (
                      <Button size="sm" variant="ghost" title="Mark as paid" onClick={() => handleUpdateInvoiceStatus(inv.id, 'paid')}>
                        <DollarSign className="h-3.5 w-3.5 text-green-600" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Override Dialog */}
      <Dialog open={!!overrideDialog} onOpenChange={() => setOverrideDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Pricing Override</DialogTitle>
            <DialogDescription>Override subscription for <strong>{overrideDialog?.venueName}</strong></DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Override Type</Label>
              <Select value={overrideType} onValueChange={setOverrideType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free_starter">Free Starter</SelectItem>
                  <SelectItem value="free_pro">Free Pro</SelectItem>
                  <SelectItem value="free_enterprise">Free Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="e.g. Beta tester, partner venue..." />
            </div>
            <div>
              <Label>Expires At (optional)</Label>
              <Input type="date" value={overrideExpiry} onChange={(e) => setOverrideExpiry(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialog(null)}>Cancel</Button>
            <Button onClick={handleAddOverride} disabled={saving}>{saving ? "Applying..." : "Apply Override"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Dialog */}
      <Dialog open={!!invoiceDialog} onOpenChange={() => setInvoiceDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
            <DialogDescription>Generate an invoice for <strong>{invoiceDialog?.venueName}</strong></DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount (ZAR)</Label>
              <Input type="number" min="1" step="0.01" value={invoiceAmount} onChange={(e) => setInvoiceAmount(e.target.value)} placeholder="499.00" />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea value={invoiceNotes} onChange={(e) => setInvoiceNotes(e.target.value)} placeholder="Monthly subscription fee..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInvoiceDialog(null)}>Cancel</Button>
            <Button onClick={handleCreateInvoice} disabled={invoiceSaving}>{invoiceSaving ? "Creating..." : "Create Invoice"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pricing Confirmation Dialog */}
      <Dialog open={!!confirmPricing} onOpenChange={() => setConfirmPricing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Pricing Change</DialogTitle>
            <DialogDescription>
              You are about to update <strong>{confirmPricing?.name}</strong> pricing. This will:
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            <li>Create new Stripe prices and archive old ones</li>
            <li>Update the display prices on the signup page</li>
            <li>Existing subscribers keep their current price until renewal</li>
            <li>New subscribers will be charged the updated price</li>
          </ul>
          {confirmPricing && editingPrices[confirmPricing.id] && (
            <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
              {parseFloat(editingPrices[confirmPricing.id].monthly) !== confirmPricing.monthly_price && (
                <p>Monthly: R{confirmPricing.monthly_price} → <strong>R{editingPrices[confirmPricing.id].monthly}</strong></p>
              )}
              {parseFloat(editingPrices[confirmPricing.id].annual) !== confirmPricing.annual_price && (
                <p>Annual: R{confirmPricing.annual_price} → <strong>R{editingPrices[confirmPricing.id].annual}</strong></p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPricing(null)}>Cancel</Button>
            <Button onClick={handleConfirmPricing}>Confirm & Sync to Stripe</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
