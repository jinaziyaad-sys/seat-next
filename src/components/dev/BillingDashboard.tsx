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
import { DollarSign, Store, Shield, Plus, Trash2, Loader2 } from "lucide-react";
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

export function BillingDashboard() {
  const [subscriptions, setSubscriptions] = useState<VenueSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [overrideDialog, setOverrideDialog] = useState<{ venueId: string; venueName: string } | null>(null);
  const [overrideType, setOverrideType] = useState("free_enterprise");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideExpiry, setOverrideExpiry] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get all venues
      const { data: venues } = await supabase.from("venues").select("id, name").order("name");
      if (!venues) return;

      // Get subscriptions
      const { data: subs } = await supabase.from("merchant_subscriptions").select("*, subscription_plans(name)");

      // Get overrides
      const { data: overrides } = await supabase.from("dev_pricing_overrides").select("*");

      const subMap = new Map((subs || []).map((s: any) => [s.venue_id, s]));
      const overrideMap = new Map((overrides || []).map((o: any) => [o.venue_id, o]));

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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

  const statusBadge = (status: string) => {
    const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      trial: "secondary",
      past_due: "destructive",
      inactive: "outline",
      cancelled: "outline",
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
          <CardContent>
            <p className="text-2xl font-bold">{subscriptions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Active Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" /> Pricing Overrides
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{overrideCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Venue Subscriptions Table */}
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
                <div
                  key={sub.venue_id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{sub.venue_name}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {sub.plan_name && <span>{sub.plan_name}</span>}
                      {sub.current_period_end && (
                        <span>• Renews {new Date(sub.current_period_end).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {sub.has_override && (
                      <Badge variant="secondary" className="text-xs">
                        Override: {sub.override_type}
                      </Badge>
                    )}
                    {statusBadge(sub.status)}
                    {sub.has_override ? (
                      <Button size="sm" variant="ghost" onClick={() => handleRemoveOverride(sub.venue_id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setOverrideDialog({ venueId: sub.venue_id, venueName: sub.venue_name })}
                      >
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

      {/* Override Dialog */}
      <Dialog open={!!overrideDialog} onOpenChange={() => setOverrideDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Pricing Override</DialogTitle>
            <DialogDescription>
              Override subscription for <strong>{overrideDialog?.venueName}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Override Type</Label>
              <Select value={overrideType} onValueChange={setOverrideType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free_starter">Free Starter</SelectItem>
                  <SelectItem value="free_pro">Free Pro</SelectItem>
                  <SelectItem value="free_enterprise">Free Enterprise</SelectItem>
                  <SelectItem value="free">Free (Full Access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. Beta tester, partner venue..."
              />
            </div>
            <div>
              <Label>Expires At (optional)</Label>
              <Input
                type="date"
                value={overrideExpiry}
                onChange={(e) => setOverrideExpiry(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideDialog(null)}>Cancel</Button>
            <Button onClick={handleAddOverride} disabled={saving}>
              {saving ? "Applying..." : "Apply Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
