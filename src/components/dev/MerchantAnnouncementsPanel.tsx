import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Megaphone, Loader2, Trash2, Edit2, AlertTriangle, Info, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  audience: string;
  target_venue_ids: string[] | null;
  is_active: boolean;
  dismissible: boolean;
  priority: number;
  expires_at: string | null;
  created_at: string;
}

const TYPE_OPTIONS = [
  { value: 'info', label: 'Info', color: 'bg-blue-600' },
  { value: 'warning', label: 'Warning', color: 'bg-yellow-500' },
  { value: 'error', label: 'Error', color: 'bg-red-600' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-amber-600' },
];

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'All Merchants' },
  { value: 'tier_starter', label: 'Starter Tier' },
  { value: 'tier_pro', label: 'Pro Tier' },
  { value: 'tier_enterprise', label: 'Enterprise Tier' },
  { value: 'specific_venues', label: 'Specific Venues' },
];

export function MerchantAnnouncementsPanel() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    message: '',
    type: 'info',
    audience: 'all',
    dismissible: true,
    priority: 0,
    expires_at: '',
  });

  const fetchAnnouncements = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('merchant_announcements')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });
    setAnnouncements((data as Announcement[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAnnouncements(); }, []);

  const resetForm = () => {
    setForm({ title: '', message: '', type: 'info', audience: 'all', dismissible: true, priority: 0, expires_at: '' });
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.title || !form.message) {
      toast.error('Title and message are required');
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const payload = {
        title: form.title,
        message: form.message,
        type: form.type,
        audience: form.audience,
        dismissible: form.dismissible,
        priority: form.priority,
        expires_at: form.expires_at || null,
        created_by: user?.id,
      };

      if (editingId) {
        const { error } = await supabase.from('merchant_announcements').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('merchant_announcements').insert(payload);
        if (error) throw error;
      }

      toast.success(editingId ? 'Announcement updated' : 'Announcement published');
      setDialogOpen(false);
      resetForm();
      fetchAnnouncements();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (a: Announcement) => {
    setForm({
      title: a.title,
      message: a.message,
      type: a.type,
      audience: a.audience,
      dismissible: a.dismissible,
      priority: a.priority,
      expires_at: a.expires_at ? a.expires_at.slice(0, 16) : '',
    });
    setEditingId(a.id);
    setDialogOpen(true);
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    await supabase.from('merchant_announcements').update({ is_active: active }).eq('id', id);
    fetchAnnouncements();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('merchant_announcements').delete().eq('id', id);
    toast.success('Announcement deleted');
    fetchAnnouncements();
  };

  const getTypeIcon = (type: string) => {
    if (type === 'maintenance') return Wrench;
    if (type === 'warning' || type === 'error') return AlertTriangle;
    return Info;
  };

  if (loading) {
    return <Card><CardContent className="p-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Megaphone className="h-6 w-6" /> Merchant Announcements</h2>
          <p className="text-muted-foreground">Send targeted announcements to merchant dashboards</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New Announcement</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Announcement' : 'Create Announcement'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Scheduled Maintenance" />
              </div>
              <div className="space-y-2">
                <Label>Message *</Label>
                <Textarea value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} placeholder="We'll be performing maintenance..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPE_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Audience</Label>
                  <Select value={form.audience} onValueChange={v => setForm(p => ({ ...p, audience: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {AUDIENCE_OPTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority (higher = shown first)</Label>
                  <Input type="number" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-2">
                  <Label>Expires At (optional)</Label>
                  <Input type="datetime-local" value={form.expires_at} onChange={e => setForm(p => ({ ...p, expires_at: e.target.value }))} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.dismissible} onCheckedChange={v => setForm(p => ({ ...p, dismissible: v }))} />
                <Label>Dismissible by merchants</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingId ? 'Update' : 'Publish'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {announcements.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No announcements yet</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => {
            const Icon = getTypeIcon(a.type);
            const typeConfig = TYPE_OPTIONS.find(t => t.value === a.type);
            const audienceLabel = AUDIENCE_OPTIONS.find(o => o.value === a.audience)?.label || a.audience;
            return (
              <Card key={a.id} className={!a.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${typeConfig?.color || 'bg-muted'} text-white shrink-0`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{a.title}</h3>
                          <Badge variant={a.is_active ? 'default' : 'secondary'}>{a.is_active ? 'Active' : 'Inactive'}</Badge>
                          <Badge variant="outline">{audienceLabel}</Badge>
                          {a.priority > 0 && <Badge variant="outline">Priority: {a.priority}</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{a.message}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span>Created: {new Date(a.created_at).toLocaleDateString()}</span>
                          {a.expires_at && <span>Expires: {new Date(a.expires_at).toLocaleDateString()}</span>}
                          {!a.dismissible && <Badge variant="outline" className="text-[10px]">Non-dismissible</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch checked={a.is_active} onCheckedChange={v => handleToggleActive(a.id, v)} />
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(a)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(a.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
