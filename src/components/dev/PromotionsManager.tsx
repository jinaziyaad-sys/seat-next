import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Megaphone, Eye, MousePointer, Loader2, Trash2, Edit2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Campaign {
  id: string;
  venue_id: string;
  title: string;
  description: string | null;
  banner_image_url: string | null;
  cta_text: string | null;
  cta_link: string | null;
  placements: string[];
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  payment_status: string;
  amount_charged: number;
  payment_notes: string | null;
  impressions_count: number;
  clicks_count: number;
  created_at: string;
  venue_name?: string;
}

interface Venue {
  id: string;
  name: string;
}

const PLACEMENT_OPTIONS = [
  { id: "home", label: "Home Carousel" },
  { id: "explore", label: "Explore Page" },
  { id: "tracking", label: "Active Tracking" },
  { id: "push", label: "Push Notification" },
];

export const PromotionsManager = () => {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    venue_id: "",
    title: "",
    description: "",
    banner_image_url: "",
    cta_text: "Learn More",
    cta_link: "",
    placements: ["home"] as string[],
    is_active: true,
    payment_status: "pending",
    amount_charged: "0",
    payment_notes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [campaignsRes, venuesRes] = await Promise.all([
      supabase.from("promo_campaigns").select("*").order("created_at", { ascending: false }),
      supabase.from("venues").select("id, name").order("name"),
    ]);

    if (venuesRes.data) setVenues(venuesRes.data);
    if (campaignsRes.data) {
      const venueMap = new Map(venuesRes.data?.map(v => [v.id, v.name]) || []);
      setCampaigns(campaignsRes.data.map(c => ({ ...c, venue_name: venueMap.get(c.venue_id) })));
    }
    setLoading(false);
  };

  const resetForm = () => {
    setForm({
      venue_id: "", title: "", description: "", banner_image_url: "",
      cta_text: "Learn More", cta_link: "", placements: ["home"],
      is_active: true, payment_status: "pending", amount_charged: "0", payment_notes: "",
    });
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.venue_id || !form.title) {
      toast({ title: "Error", description: "Venue and title are required", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        venue_id: form.venue_id,
        title: form.title,
        description: form.description || null,
        banner_image_url: form.banner_image_url || null,
        cta_text: form.cta_text || null,
        cta_link: form.cta_link || null,
        placements: form.placements,
        is_active: form.is_active,
        payment_status: form.payment_status,
        amount_charged: parseFloat(form.amount_charged) || 0,
        payment_notes: form.payment_notes || null,
        created_by: user?.id,
      };

      if (editingId) {
        const { error } = await supabase.from("promo_campaigns").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("promo_campaigns").insert(payload);
        if (error) throw error;
      }

      toast({ title: editingId ? "Campaign updated" : "Campaign created" });
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (campaign: Campaign) => {
    setForm({
      venue_id: campaign.venue_id,
      title: campaign.title,
      description: campaign.description || "",
      banner_image_url: campaign.banner_image_url || "",
      cta_text: campaign.cta_text || "Learn More",
      cta_link: campaign.cta_link || "",
      placements: campaign.placements || ["home"],
      is_active: campaign.is_active,
      payment_status: campaign.payment_status,
      amount_charged: String(campaign.amount_charged || 0),
      payment_notes: campaign.payment_notes || "",
    });
    setEditingId(campaign.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("promo_campaigns").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Campaign deleted" });
      fetchData();
    }
  };

  const togglePlacement = (placement: string) => {
    setForm(prev => ({
      ...prev,
      placements: prev.placements.includes(placement)
        ? prev.placements.filter(p => p !== placement)
        : [...prev.placements, placement],
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-6 w-6" />
            Promotional Campaigns
          </h2>
          <p className="text-muted-foreground">Manage venue ad campaigns across the patron app</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Campaign" : "Create Campaign"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Venue *</Label>
                <Select value={form.venue_id} onValueChange={v => setForm(p => ({ ...p, venue_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select venue..." /></SelectTrigger>
                  <SelectContent>
                    {venues.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="10% off today!" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Get 10% off your entire bill..." />
              </div>
              <div className="space-y-2">
                <Label>Banner Image URL</Label>
                <Input value={form.banner_image_url} onChange={e => setForm(p => ({ ...p, banner_image_url: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CTA Text</Label>
                  <Input value={form.cta_text} onChange={e => setForm(p => ({ ...p, cta_text: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>CTA Link</Label>
                  <Input value={form.cta_link} onChange={e => setForm(p => ({ ...p, cta_link: e.target.value }))} placeholder="https://..." />
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Placements</Label>
                <div className="grid grid-cols-2 gap-2">
                  {PLACEMENT_OPTIONS.map(p => (
                    <div key={p.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={form.placements.includes(p.id)}
                        onCheckedChange={() => togglePlacement(p.id)}
                      />
                      <span className="text-sm">{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Payment Status</Label>
                <Select value={form.payment_status} onValueChange={v => setForm(p => ({ ...p, payment_status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="comp">Complimentary</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount Charged</Label>
                  <Input type="number" value={form.amount_charged} onChange={e => setForm(p => ({ ...p, amount_charged: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Active</Label>
                  <div className="pt-2">
                    <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Payment Notes</Label>
                <Textarea value={form.payment_notes} onChange={e => setForm(p => ({ ...p, payment_notes: e.target.value }))} placeholder="Invoice #, payment date, etc." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingId ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Campaign List */}
      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No campaigns yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns.map(campaign => (
            <Card key={campaign.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{campaign.title}</h3>
                      <Badge variant={campaign.is_active ? "default" : "secondary"}>
                        {campaign.is_active ? "Active" : "Inactive"}
                      </Badge>
                      <Badge variant={
                        campaign.payment_status === "paid" ? "default" :
                        campaign.payment_status === "comp" ? "secondary" : "outline"
                      }>
                        {campaign.payment_status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{campaign.venue_name}</p>
                    {campaign.description && (
                      <p className="text-sm mt-1">{campaign.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="h-3 w-3" />
                        {campaign.impressions_count} impressions
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MousePointer className="h-3 w-3" />
                        {campaign.clicks_count} clicks
                      </div>
                      <div className="flex gap-1">
                        {campaign.placements?.map(p => (
                          <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(campaign)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(campaign.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
