import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { X, AlertTriangle, Info, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  audience: string;
  dismissible: boolean;
  priority: number;
  expires_at: string | null;
}

interface Props {
  venueId: string;
  tierName: string | null;
}

export function MerchantAnnouncementBanner({ venueId, tierName }: Props) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [annRes, dismissRes] = await Promise.all([
        supabase
          .from('merchant_announcements')
          .select('id, title, message, type, audience, dismissible, priority, expires_at')
          .eq('is_active', true)
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('merchant_announcement_dismissals')
          .select('announcement_id')
          .eq('user_id', user.id),
      ]);

      const dismissed = new Set((dismissRes.data || []).map((d: any) => d.announcement_id));
      setDismissedIds(dismissed);

      const tierLower = (tierName || '').toLowerCase();
      const filtered = ((annRes.data as Announcement[]) || []).filter(a => {
        if (dismissed.has(a.id)) return false;
        if (a.expires_at && new Date(a.expires_at) < new Date()) return false;

        switch (a.audience) {
          case 'all': return true;
          case 'tier_starter': return tierLower === 'starter';
          case 'tier_pro': return tierLower === 'pro';
          case 'tier_enterprise': return tierLower === 'enterprise';
          case 'specific_venues': return false; // would need target_venue_ids check
          default: return true;
        }
      });

      setAnnouncements(filtered);
    };

    fetchData();
  }, [venueId, tierName]);

  const handleDismiss = async (announcementId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('merchant_announcement_dismissals').insert({
      announcement_id: announcementId,
      user_id: user.id,
    });

    setAnnouncements(prev => prev.filter(a => a.id !== announcementId));
  };

  const getIcon = (type: string) => {
    if (type === 'maintenance') return Wrench;
    if (type === 'warning' || type === 'error') return AlertTriangle;
    return Info;
  };

  if (announcements.length === 0) return null;

  return (
    <>
      {announcements.map(a => {
        const Icon = getIcon(a.type);
        return (
          <div
            key={a.id}
            className={cn(
              'px-4 py-3 flex items-center gap-3',
              a.type === 'maintenance' && 'bg-amber-600 text-white',
              a.type === 'warning' && 'bg-yellow-500 text-black',
              a.type === 'error' && 'bg-red-600 text-white',
              a.type === 'info' && 'bg-blue-600 text-white'
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">{a.message}</p>
            </div>
            {a.dismissible && (
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-6 w-6 shrink-0',
                  a.type === 'warning' ? 'hover:bg-black/10 text-black' : 'hover:bg-white/20 text-white'
                )}
                onClick={() => handleDismiss(a.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      })}
    </>
  );
}
