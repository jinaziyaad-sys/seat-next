import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Megaphone, Eye, MousePointer, Loader2, Trash2, Edit2, X, Image as ImageIcon, CalendarIcon, ChevronDown, StopCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BannerCropDialog } from "@/components/BannerCropDialog";
import { cn } from "@/lib/utils";

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
  review_status?: string;
  review_notes?: string | null;
  submitted_by?: string | null;
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
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Crop dialog state
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState("");

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
    start_date: null as Date | null,
    end_date: null as Date | null,
    start_time: "00:00",
    end_time: "23:59",
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
      start_date: null, end_date: null, start_time: "00:00", end_time: "23:59",
    });
    setEditingId(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB", variant: "destructive" });
      return;
    }

    // Open crop dialog
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setCropDialogOpen(false);
    setUploading(true);
    try {
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("promo-banners")
        .upload(fileName, croppedBlob, { contentType: "image/jpeg" });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("promo-banners")
        .getPublicUrl(fileName);

      setForm(p => ({ ...p, banner_image_url: publicUrl }));
      toast({ title: "Image uploaded" });
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const buildDatetime = (date: Date | null, time: string): string | null => {
    if (!date) return null;
    const [h, m] = time.split(":").map(Number);
    const d = new Date(date);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
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
        start_date: buildDatetime(form.start_date, form.start_time) || new Date().toISOString(),
        end_date: buildDatetime(form.end_date, form.end_time),
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
      start_date: campaign.start_date ? new Date(campaign.start_date) : null,
      end_date: campaign.end_date ? new Date(campaign.end_date) : null,
      start_time: campaign.start_date ? format(new Date(campaign.start_date), "HH:mm") : "00:00",
      end_time: campaign.end_date ? format(new Date(campaign.end_date), "HH:mm") : "23:59",
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

  const handleTerminate = async (id: string) => {
    const { error } = await supabase.from("promo_campaigns").update({
      is_active: false,
      end_date: new Date().toISOString(),
    }).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Campaign terminated" });
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

  const isArchived = (c: Campaign) => !c.is_active || (c.end_date && new Date(c.end_date) < new Date());
  const activeCampaigns = campaigns.filter(c => !isArchived(c));
  const archivedCampaigns = campaigns.filter(c => isArchived(c));

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const renderCampaignCard = (campaign: Campaign, archived: boolean) => (
    <Card key={campaign.id}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            {campaign.banner_image_url && (
              <img
                src={campaign.banner_image_url}
                alt={campaign.title}
                className="w-20 h-12 rounded-md object-cover shrink-0"
              />
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold">{campaign.title}</h3>
                <Badge variant={campaign.is_active ? "default" : "secondary"}>
                  {campaign.is_active ? "Active" : "Ended"}
                </Badge>
                <Badge variant={
                  campaign.payment_status === "paid" ? "default" :
                  campaign.payment_status === "comp" ? "secondary" : "outline"
                }>
                  {campaign.payment_status}
                </Badge>
                {campaign.review_status && (
                  <Badge variant={
                    campaign.review_status === "approved" ? "default" :
                    campaign.review_status === "rejected" ? "destructive" : "outline"
                  }>
                    {campaign.review_status}
                  </Badge>
                )}
                {campaign.submitted_by && <Badge variant="outline" className="text-[10px]">Merchant submitted</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{campaign.venue_name}</p>
              {campaign.description && (
                <p className="text-sm mt-1 line-clamp-1">{campaign.description}</p>
              )}
              <div className="flex items-center gap-4 mt-2 flex-wrap">
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
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <CalendarIcon className="h-3 w-3" />
                {format(new Date(campaign.start_date), "MMM d, yyyy HH:mm")}
                {campaign.end_date && (
                  <> → {format(new Date(campaign.end_date), "MMM d, yyyy HH:mm")}</>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            {!archived && campaign.review_status === 'pending' && (
              <>
                <Button variant="default" size="sm" onClick={async () => {
                  await supabase.from("promo_campaigns").update({ review_status: 'approved', is_active: true }).eq("id", campaign.id);
                  toast({ title: "Campaign approved and activated" });
                  fetchData();
                }}>Approve</Button>
                <Button variant="destructive" size="sm" onClick={async () => {
                  await supabase.from("promo_campaigns").update({ review_status: 'rejected' }).eq("id", campaign.id);
                  toast({ title: "Campaign rejected" });
                  fetchData();
                }}>Reject</Button>
              </>
            )}
            {!archived && campaign.review_status !== 'pending' && (
              <>
                <Button variant="ghost" size="icon" onClick={() => handleEdit(campaign)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => handleTerminate(campaign.id)}
                  title="Terminate campaign"
                >
                  <StopCircle className="h-4 w-4" />
                </Button>
              </>
            )}
            {archived && (
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(campaign.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

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

              {/* Banner Image Upload */}
              <div className="space-y-2">
                <Label>Banner Image</Label>
                {form.banner_image_url ? (
                  <div className="relative rounded-lg overflow-hidden border">
                    <img
                      src={form.banner_image_url}
                      alt="Banner preview"
                      className="w-full h-40 object-cover"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={() => setForm(p => ({ ...p, banner_image_url: "" }))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                    ) : (
                      <>
                        <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Click to upload banner image</p>
                        <p className="text-xs text-muted-foreground mt-1">16:9 crop • Max 5MB • JPG, PNG, WebP</p>
                      </>
                    )}
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Input
                  value={form.banner_image_url}
                  onChange={e => setForm(p => ({ ...p, banner_image_url: e.target.value }))}
                  placeholder="Or paste image URL..."
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>CTA Text</Label>
                  <Input value={form.cta_text} onChange={e => setForm(p => ({ ...p, cta_text: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>CTA Link (optional)</Label>
                  <Input value={form.cta_link} onChange={e => setForm(p => ({ ...p, cta_link: e.target.value }))} placeholder="Leave empty for in-app venue link" />
                </div>
              </div>

              {/* Live Preview */}
              {(form.title || form.banner_image_url) && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Preview — how patrons will see this</Label>
                  <div className="relative rounded-lg overflow-hidden border bg-gradient-to-br from-primary/5 to-accent/5">
                    {form.banner_image_url && (
                      <div className="relative w-full overflow-hidden aspect-video">
                        <img
                          src={form.banner_image_url}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-2 left-3 right-3">
                          <p className="text-white font-bold text-lg leading-tight">{form.title || "Campaign Title"}</p>
                        </div>
                      </div>
                    )}
                    <div className="p-4">
                      {!form.banner_image_url && form.title && (
                        <div className="flex items-center gap-2 mb-2">
                          <Megaphone className="h-4 w-4 text-primary" />
                          <p className="font-bold">{form.title}</p>
                        </div>
                      )}
                      {form.description && (
                        <p className="text-sm text-muted-foreground mb-3">{form.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {venues.find(v => v.id === form.venue_id)?.name || "Venue Name"}
                        </span>
                        {form.cta_text && (
                          <Button size="sm" disabled>{form.cta_text}</Button>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="absolute top-2 right-2 text-[10px] bg-background/80 backdrop-blur-sm">
                      Sponsored
                    </Badge>
                  </div>
                </div>
              )}

              <Separator />

              {/* Schedule */}
              <div className="space-y-3">
                <Label className="text-base font-semibold">Schedule</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !form.start_date && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.start_date ? format(form.start_date, "MMM d, yyyy") : "Now"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={form.start_date || undefined}
                          onSelect={(d) => setForm(p => ({ ...p, start_date: d || null }))}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      type="time"
                      value={form.start_time}
                      onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">End Date (optional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !form.end_date && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {form.end_date ? format(form.end_date, "MMM d, yyyy") : "No end date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={form.end_date || undefined}
                          onSelect={(d) => setForm(p => ({ ...p, end_date: d || null }))}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    {form.end_date && (
                      <Input
                        type="time"
                        value={form.end_time}
                        onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))}
                        className="text-xs"
                      />
                    )}
                  </div>
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

      {/* Active Campaigns */}
      {activeCampaigns.length === 0 && archivedCampaigns.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No campaigns yet. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {activeCampaigns.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Active Campaigns ({activeCampaigns.length})</h3>
              <div className="grid gap-4">
                {activeCampaigns.map(c => renderCampaignCard(c, false))}
              </div>
            </div>
          )}

          {archivedCampaigns.length > 0 && (
            <Collapsible open={archivedOpen} onOpenChange={setArchivedOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  <span className="text-muted-foreground">Archived Campaigns ({archivedCampaigns.length})</span>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", archivedOpen && "rotate-180")} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                {archivedCampaigns.map(c => renderCampaignCard(c, true))}
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}

      {/* Banner Crop Dialog */}
      <BannerCropDialog
        open={cropDialogOpen}
        imageSrc={cropImageSrc}
        onClose={() => setCropDialogOpen(false)}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
};
