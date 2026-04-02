import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Clock, Moon, CheckCircle, XCircle, HelpCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { areNotificationsSupported, getNotificationPermission } from "@/utils/notifications";
import { UnblockNotificationsDialog } from "@/components/notifications/UnblockNotificationsDialog";
interface NotificationPreferences {
  mealtime_nudges: boolean;
  reengagement_nudges: boolean;
  favorite_venue_alerts: boolean;
  weekend_planning_nudges: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  nudge_frequency: 'daily' | 'weekly' | 'minimal';
  max_nudges_per_day: number;
}

const defaultPreferences: NotificationPreferences = {
  mealtime_nudges: true,
  reengagement_nudges: true,
  favorite_venue_alerts: true,
  weekend_planning_nudges: true,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  nudge_frequency: 'daily',
  max_nudges_per_day: 3,
};

export function PatronNotificationSettings() {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [showUnblockDialog, setShowUnblockDialog] = useState(false);
  const { toast } = useToast();
  
  const notificationsSupported = areNotificationsSupported();
  const notificationPermission = notificationsSupported ? getNotificationPermission() : 'denied';

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    
    setUserId(user.id);

    const { data, error } = await supabase
      .from('patron_notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching preferences:', error);
    }

    if (data) {
      setPreferences({
        mealtime_nudges: data.mealtime_nudges,
        reengagement_nudges: data.reengagement_nudges,
        favorite_venue_alerts: data.favorite_venue_alerts,
        weekend_planning_nudges: data.weekend_planning_nudges,
        quiet_hours_start: data.quiet_hours_start || '22:00',
        quiet_hours_end: data.quiet_hours_end || '08:00',
        nudge_frequency: data.nudge_frequency as 'daily' | 'weekly' | 'minimal',
        max_nudges_per_day: data.max_nudges_per_day,
      });
    }
    setLoading(false);
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: any) => {
    if (!userId) return;

    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    setSaving(true);

    // Upsert preferences
    const { error } = await supabase
      .from('patron_notification_preferences')
      .upsert({
        user_id: userId,
        ...newPreferences,
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Error",
        description: "Failed to save notification preferences",
        variant: "destructive",
      });
      // Revert on error
      setPreferences(preferences);
    } else {
      toast({
        title: "Saved",
        description: "Notification preferences updated",
      });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <Card className="shadow-card">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-8 bg-muted rounded"></div>
            <div className="h-8 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Bell size={24} />
          <CardTitle>{t("notifications.title")}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Notification Status */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t("notifications.browserNotifications")}</span>
            {notificationPermission === 'granted' ? (
              <Badge variant="default" className="gap-1 bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-500/20">
                <CheckCircle size={12} />
                {t("notifications.enabled")}
              </Badge>
            ) : notificationPermission === 'denied' ? (
              <Badge variant="destructive" className="gap-1">
                <XCircle size={12} />
                {t("notifications.blocked")}
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <HelpCircle size={12} />
                {t("notifications.notSet")}
              </Badge>
            )}
          </div>
          {notificationPermission === 'denied' && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setShowUnblockDialog(true)}
            >
              How to enable
            </Button>
          )}
        </div>

        {/* Nudge Types */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Reminders</h3>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="mealtime">🍽️ Mealtime reminders</Label>
              <p className="text-xs text-muted-foreground">Get nudges around lunch and dinner time</p>
            </div>
            <Switch
              id="mealtime"
              checked={preferences.mealtime_nudges}
              onCheckedChange={(checked) => updatePreference('mealtime_nudges', checked)}
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="favorite">⚡ Favorite venue alerts</Label>
              <p className="text-xs text-muted-foreground">Know when your favorites have short waits</p>
            </div>
            <Switch
              id="favorite"
              checked={preferences.favorite_venue_alerts}
              onCheckedChange={(checked) => updatePreference('favorite_venue_alerts', checked)}
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="weekend">📅 Weekend planning</Label>
              <p className="text-xs text-muted-foreground">Friday reminders to book ahead</p>
            </div>
            <Switch
              id="weekend"
              checked={preferences.weekend_planning_nudges}
              onCheckedChange={(checked) => updatePreference('weekend_planning_nudges', checked)}
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="reengagement">💬 Check-in messages</Label>
              <p className="text-xs text-muted-foreground">Occasional nudges if you haven't visited</p>
            </div>
            <Switch
              id="reengagement"
              checked={preferences.reengagement_nudges}
              onCheckedChange={(checked) => updatePreference('reengagement_nudges', checked)}
              disabled={saving}
            />
          </div>
        </div>

        {/* Frequency */}
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Frequency</h3>
          </div>
          
          <Select
            value={preferences.nudge_frequency}
            onValueChange={(value: 'daily' | 'weekly' | 'minimal') => 
              updatePreference('nudge_frequency', value)
            }
            disabled={saving}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily (up to 3 per day)</SelectItem>
              <SelectItem value="weekly">Weekly (a few per week)</SelectItem>
              <SelectItem value="minimal">Minimal (only important alerts)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quiet Hours */}
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center gap-2">
            <Moon size={16} className="text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Quiet Hours</h3>
          </div>
          <p className="text-xs text-muted-foreground">No notifications between these hours</p>
          
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-1">
              <Label htmlFor="quiet-start" className="text-xs">From</Label>
              <Select
                value={preferences.quiet_hours_start.slice(0, 5)}
                onValueChange={(value) => updatePreference('quiet_hours_start', value + ':00')}
                disabled={saving}
              >
                <SelectTrigger id="quiet-start">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i.toString().padStart(2, '0');
                    return (
                      <SelectItem key={hour} value={`${hour}:00`}>
                        {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1 space-y-1">
              <Label htmlFor="quiet-end" className="text-xs">Until</Label>
              <Select
                value={preferences.quiet_hours_end.slice(0, 5)}
                onValueChange={(value) => updatePreference('quiet_hours_end', value + ':00')}
                disabled={saving}
              >
                <SelectTrigger id="quiet-end">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i.toString().padStart(2, '0');
                    return (
                      <SelectItem key={hour} value={`${hour}:00`}>
                        {i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
      
      <UnblockNotificationsDialog 
        open={showUnblockDialog} 
        onOpenChange={setShowUnblockDialog} 
      />
    </Card>
  );
}
