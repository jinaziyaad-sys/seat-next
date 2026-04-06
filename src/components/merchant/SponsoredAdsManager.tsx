import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Megaphone, Loader2, CalendarIcon, Image as ImageIcon, X, Eye, MousePointer } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BannerCropDialog } from '@/components/BannerCropDialog';
import { cn } from '@/lib/utils';

interface Campaign {
  id: string;
  title: string;
  description: string | null;
  banner_image_url: string | null;
  placements: string[];
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  payment_status: string;
  review_status: string;
  review_notes: string | null;
  impressions_count: number;
  clicks_count: number;
  created_at: string;
}

const PLACEMENT_OPTIONS = [
  { id: 'home', label: 'Home Carousel' },
  { id: 'explore', label: 'Explore Page' },
  { id: 'tracking', label: 'Active Tracking' },
  { id: 'push', label: 'Push Notification' },
];

interface Props {
  venueId: string;
}

interface PricingRule {
  base_price_per_day: number;
  placement_multipliers: Record<string, number>;
  reach_tiers: { min_days: number; max_days: number; multiplier: number }[];
}

export function SponsoredAdsManager({ venueId }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState('');
  const [pricingRule, setPricingRule] = useState<PricingRule | null>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    banner_image_url: '',
    placements: ['home'] as string[],
    start_date: null as Date | null,
    end_date: null as Date | null,
  });

  const fetchCampaigns = async () => {
    setLoading(true);
    const [{ data: campData }, { data: priceData }] = await Promise.all([
      supabase
        .from('promo_campaigns')
        .select('id, title, description, banner_image_url, placements, start_date, end_date, is_active, payment_status, review_status, review_notes, impressions_count, clicks_count, created_at')
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false }),
      supabase
        .from('promo_pricing_rules')
        .select('base_price_per_day, placement_multipliers, reach_tiers')
        .eq('is_active', true)
        .limit(1)
        .single(),
    ]);
    setCampaigns((campData as Campaign[]) || []);
    if (priceData) setPricingRule(priceData as unknown as PricingRule);
    setLoading(false);
  };

  useEffect(() => { fetchCampaigns(); }, [venueId]);

  const resetForm = () => {
    setForm({ title: '', description: '', banner_image_url: '', placements: ['home'], start_date: null, end_date: null });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5MB'); return; }
    const reader = new FileReader();
    reader.onload = () => { setCropImageSrc(reader.result as string); setCropDialogOpen(true); };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setCropDialogOpen(false);
    setUploading(true);
    try {
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const { error: uploadError } = await supabase.storage.from('promo-banners').upload(fileName, croppedBlob, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('promo-banners').getPublicUrl(fileName);
      setForm(p => ({ ...p, banner_image_url: publicUrl }));
    } catch (err: any) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const togglePlacement = (p: string) => {
    setForm(prev => ({
      ...prev,
      placements: prev.placements.includes(p) ? prev.placements.filter(x => x !== p) : [...prev.placements, p],
    }));
  };

  const calculatePrice = (placements: string[], startDate: Date | null, endDate: Date | null) => {
    const days = endDate && startDate
      ? Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000))
      : 7;
    const basePrice = pricingRule?.base_price_per_day ?? 50;
    const placementMultipliers = pricingRule?.placement_multipliers ?? {};
    const reachTiers = pricingRule?.reach_tiers ?? [];

    // Sum placement multipliers (default 1.0 per placement)
    const placementTotal = placements.reduce((sum, p) => sum + (placementMultipliers[p] ?? 1.0), 0);

    // Find reach tier discount
    let reachMult = 1.0;
    for (const tier of reachTiers) {
      if (days >= tier.min_days && days <= tier.max_days) {
        reachMult = tier.multiplier;
        break;
      }
    }

    return { total: Math.round(days * basePrice * placementTotal * reachMult), days, basePrice };
  };

  const initiateCheckout = async (campaignId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('create-promo-checkout', {
        body: {
          campaignId,
          successUrl: `${window.location.origin}/merchant/dashboard?promo=success`,
          cancelUrl: `${window.location.origin}/merchant/dashboard?promo=cancelled`,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
        toast.success('Redirecting to payment...');
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err: any) {
      toast.error('Payment redirect failed: ' + err.message);
    }
  };

  const handleSubmit = async () => {
    if (!form.title || !form.start_date) {
      toast.error('Title and start date are required');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { total: estimatedPrice } = calculatePrice(form.placements, form.start_date, form.end_date);

      const { data: inserted, error } = await supabase.from('promo_campaigns').insert({
        venue_id: venueId,
        title: form.title,
        description: form.description || null,
        banner_image_url: form.banner_image_url || null,
        placements: form.placements,
        start_date: form.start_date.toISOString(),
        end_date: form.end_date?.toISOString() || null,
        is_active: false,
        payment_status: 'pending',
        review_status: 'pending',
        amount_charged: estimatedPrice,
        submitted_by: user?.id,
        created_by: user?.id,
      }).select('id').single();

      if (error) throw error;

      setDialogOpen(false);
      resetForm();
      fetchCampaigns();

      // Initiate Stripe checkout
      if (inserted?.id) {
        await initiateCheckout(inserted.id);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (c: Campaign) => {
    if (c.review_status === 'rejected') return <Badge variant="destructive">Rejected</Badge>;
    if (c.review_status === 'pending') return <Badge variant="outline">Pending Review</Badge>;
    if (c.review_status === 'approved' && c.is_active) return <Badge variant="default">Live</Badge>;
    if (c.review_status === 'approved' && !c.is_active) return <Badge variant="secondary">Approved (Inactive)</Badge>;
    return <Badge variant="outline">{c.review_status}</Badge>;
  };

  const getPaymentBadge = (c: Campaign) => {
    if (c.payment_status === 'paid') return <Badge variant="default" className="bg-green-600">Paid</Badge>;
    return <Badge variant="outline" className="text-amber-600 border-amber-600">Unpaid</Badge>;
  };

  // Estimate price for preview
  const { total: estimatedPrice, days, basePrice } = calculatePrice(form.placements, form.start_date, form.end_date);

  if (loading) {
    return <Card><CardContent className="p-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Megaphone className="h-5 w-5" /> Sponsored Promotions</h2>
          <p className="text-sm text-muted-foreground">Promote your venue to more patrons</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Create Campaign</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Promotion Campaign</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Weekend Special!" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="What's the promotion about?" />
              </div>

              <div className="space-y-2">
                <Label>Banner Image</Label>
                {form.banner_image_url ? (
                  <div className="relative rounded-lg overflow-hidden border">
                    <img src={form.banner_image_url} alt="Banner" className="w-full h-32 object-cover" />
                    <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => setForm(p => ({ ...p, banner_image_url: '' }))}><X className="h-3 w-3" /></Button>
                  </div>
                ) : (
                  <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                    {uploading ? <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /> : (
                      <>
                        <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Click to upload banner</p>
                      </>
                    )}
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
              </div>

              <div className="space-y-2">
                <Label>Placements</Label>
                <div className="flex flex-wrap gap-2">
                  {PLACEMENT_OPTIONS.map(p => (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={form.placements.includes(p.id)} onCheckedChange={() => togglePlacement(p.id)} />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn('w-full justify-start', !form.start_date && 'text-muted-foreground')}>
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {form.start_date ? format(form.start_date, 'PP') : 'Select'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={form.start_date || undefined} onSelect={d => setForm(p => ({ ...p, start_date: d || null }))} /></PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn('w-full justify-start', !form.end_date && 'text-muted-foreground')}>
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {form.end_date ? format(form.end_date, 'PP') : 'Select'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={form.end_date || undefined} onSelect={d => setForm(p => ({ ...p, end_date: d || null }))} /></PopoverContent>
                  </Popover>
                </div>
              </div>

              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <p className="text-sm font-medium">Estimated Cost</p>
                  <p className="text-2xl font-bold">R{estimatedPrice}</p>
                  <p className="text-xs text-muted-foreground">{days} days × {form.placements.length} placement(s) × R{basePrice}/day base</p>
                </CardContent>
              </Card>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Pay & Submit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No campaigns yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create a sponsored promotion to reach more patrons</p>
            <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> Create Campaign</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {c.banner_image_url && <img src={c.banner_image_url} alt={c.title} className="w-20 h-12 rounded-md object-cover shrink-0" />}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{c.title}</h3>
                      {getPaymentBadge(c)}
                      {getStatusBadge(c)}
                    </div>
                    {c.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{c.description}</p>}
                    {c.review_notes && c.review_status === 'rejected' && (
                      <p className="text-sm text-destructive mt-1">Reason: {c.review_notes}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {c.impressions_count}</span>
                      <span className="flex items-center gap-1"><MousePointer className="h-3 w-3" /> {c.clicks_count}</span>
                      <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" /> {format(new Date(c.start_date), 'MMM d')}{c.end_date && ` – ${format(new Date(c.end_date), 'MMM d')}`}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <BannerCropDialog
        open={cropDialogOpen}
        onClose={() => setCropDialogOpen(false)}
        imageSrc={cropImageSrc}
        onCropComplete={handleCropComplete}
      />
    </div>
  );
}
