import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Megaphone, AlertTriangle, Info, AlertCircle, Wrench, Trash2, Send } from 'lucide-react';
import { Announcement } from '@/hooks/usePlatformConfig';

interface AnnouncementsPanelProps {
  announcement: Announcement;
  loading: boolean;
  onPublish: (announcement: Announcement) => Promise<void>;
  onClear: () => Promise<void>;
}

const ANNOUNCEMENT_TYPES = [
  { value: 'info', label: 'Information', icon: Info, color: 'bg-blue-500' },
  { value: 'warning', label: 'Warning', icon: AlertTriangle, color: 'bg-yellow-500' },
  { value: 'error', label: 'Error/Outage', icon: AlertCircle, color: 'bg-destructive' },
  { value: 'maintenance', label: 'Maintenance', icon: Wrench, color: 'bg-orange-500' },
];

export function AnnouncementsPanel({ announcement, loading, onPublish, onClear }: AnnouncementsPanelProps) {
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'info' | 'warning' | 'error' | 'maintenance'>('info');
  const [dismissible, setDismissible] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [clearing, setClearing] = useState(false);

  const handlePublish = async () => {
    if (!message.trim()) return;
    setPublishing(true);
    await onPublish({ message, type, dismissible });
    setMessage('');
    setPublishing(false);
  };

  const handleClear = async () => {
    setClearing(true);
    await onClear();
    setClearing(false);
  };

  const currentType = ANNOUNCEMENT_TYPES.find((t) => t.value === announcement?.type);
  const CurrentIcon = currentType?.icon || Info;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          Global Announcements
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        </CardTitle>
        <CardDescription>
          Push announcements to all users instantly. Perfect for maintenance notices, updates, or alerts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Announcement */}
        {announcement && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CurrentIcon className="h-4 w-4" />
                <span className="text-sm font-medium">Active Announcement</span>
                <Badge variant="outline" className="capitalize">
                  {announcement.type}
                </Badge>
                {announcement.dismissible && (
                  <Badge variant="secondary">Dismissible</Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={clearing}
                className="text-destructive hover:text-destructive"
              >
                {clearing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Clear
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{announcement.message}</p>
          </div>
        )}

        {/* Create New Announcement */}
        <div className="space-y-4">
          <div>
            <Label htmlFor="announcement-message">Message</Label>
            <Textarea
              id="announcement-message"
              placeholder="Enter your announcement message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mt-1.5"
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="announcement-type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger id="announcement-type" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANNOUNCEMENT_TYPES.map((t) => {
                    const Icon = t.icon;
                    return (
                      <SelectItem key={t.value} value={t.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {t.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-4 pt-6">
              <Switch
                id="dismissible"
                checked={dismissible}
                onCheckedChange={setDismissible}
              />
              <Label htmlFor="dismissible" className="cursor-pointer">
                Allow users to dismiss
              </Label>
            </div>
          </div>

          <Button
            onClick={handlePublish}
            disabled={!message.trim() || publishing}
            className="w-full"
          >
            {publishing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            Publish Announcement
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
