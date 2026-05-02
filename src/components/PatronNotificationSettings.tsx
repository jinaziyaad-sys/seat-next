import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Clock, Moon, CheckCircle, XCircle, HelpCircle, MessageCircle, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { areNotificationsSupported, getNotificationPermission, initializePushNotifications, revokeNotificationPermission } from "@/utils/notifications";
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
  channel_push: boolean;
  channel_sms: boolean;
  channel_whatsapp: boolean;
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
  channel_push: true,
  channel_sms: false,
  channel_whatsapp: false,
};

export function PatronNotificationSettings() {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [showUnblockDialog, setShowUnblockDialog] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSaving, setPushSaving] = useState(false);
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

    const { data: pushSub } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    setPushEnabled(!!pushSub);

    const { data: profile } = await supabase
      .from('profiles')
      .select('phone_verified')
      .eq('id', user.id)
      .maybeSingle();
    setPhoneVerified(!!profile?.phone_verified);

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
        channel_push: (data as any).channel_push ?? true,
        channel_sms: (data as any).channel_sms ?? false,
        channel_whatsapp: (data as any).channel_whatsapp ?? false,
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
        title: t("common.error"),
        description: t("notifications.failedSave"),
        variant: "destructive",
      });
      // Revert on error
      setPreferences(preferences);
    } else {
      toast({
        title: t("notifications.saved"),
        description: t("notifications.preferencesUpdated"),
      });
    }
    setSaving(false);
  };

  const handlePushToggle = async (checked: boolean) => {
    if (!notificationsSupported) return;
    if (notificationPermission === 'denied') {
      setShowUnblockDialog(true);
      return;
    }

    setPushSaving(true);
    if (checked) {
      const success = await initializePushNotifications('');
      setPushEnabled(success);
      toast({
        title: success ? t("notifications.enabledSuccess") : t("notifications.notEnabled"),
        description: success ? t("notifications.enabledDesc") : t("notifications.notEnabledDesc"),
        variant: success ? "default" : "destructive",
      });
    } else {
      await revokeNotificationPermission();
      setPushEnabled(false);
      toast({
        title: t("notifications.saved"),
        description: t("notifications.pushDisabledDesc"),
      });
    }
    setPushSaving(false);
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
          <div className="flex items-center gap-2">
            {notificationPermission === 'denied' && (
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setShowUnblockDialog(true)}
              >
                {t("notifications.howToEnable")}
              </Button>
            )}
            <Switch
              id="push-notifications"
              checked={pushEnabled && notificationPermission === 'granted'}
              onCheckedChange={handlePushToggle}
              disabled={pushSaving || !notificationsSupported}
            />
          </div>
        </div>

        {/* Delivery channels */}
        <div className="space-y-4 pt-2 border-t">
          <h3 className="text-sm font-medium text-muted-foreground">Delivery channels</h3>
          <p className="text-xs text-muted-foreground">
            Choose where you'd like to receive notifications. Standard SMS rates may apply for SMS messages.
          </p>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5 min-w-0 pr-3">
              <Label htmlFor="ch-push" className="flex items-center gap-2"><Bell size={16} /> Push notifications</Label>
              <p className="text-xs text-muted-foreground">In-app and browser alerts (free)</p>
            </div>
            <Switch
              id="ch-push"
              checked={preferences.channel_push}
              onCheckedChange={(checked) => updatePreference('channel_push', checked)}
              disabled={saving}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5 min-w-0 pr-3">
              <Label htmlFor="ch-sms" className="flex items-center gap-2"><MessageSquare size={16} /> SMS</Label>
              <p className="text-xs text-muted-foreground">
                {phoneVerified
                  ? "Text messages to your verified phone number"
                  : "Verify your phone number in your profile to enable SMS"}
              </p>
            </div>
            <Switch
              id="ch-sms"
              checked={preferences.channel_sms && phoneVerified}
              onCheckedChange={(checked) => updatePreference('channel_sms', checked)}
              disabled={saving || !phoneVerified}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5 min-w-0 pr-3">
              <Label htmlFor="ch-wa" className="flex items-center gap-2"><MessageCircle size={16} /> WhatsApp</Label>
              <p className="text-xs text-muted-foreground">
                {phoneVerified
                  ? "WhatsApp messages to your verified phone number"
                  : "Verify your phone number in your profile to enable WhatsApp"}
              </p>
            </div>
            <Switch
              id="ch-wa"
              checked={preferences.channel_whatsapp && phoneVerified}
              onCheckedChange={(checked) => updatePreference('channel_whatsapp', checked)}
              disabled={saving || !phoneVerified}
            />
          </div>
        </div>

        {/* Nudge Types */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">{t("notifications.reminders")}</h3>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="mealtime">🍽️ {t("notifications.mealtimeReminders")}</Label>
              <p className="text-xs text-muted-foreground">{t("notifications.mealtimeDesc")}</p>
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
              <Label htmlFor="favorite">⚡ {t("notifications.favoriteAlerts")}</Label>
              <p className="text-xs text-muted-foreground">{t("notifications.favoriteDesc")}</p>
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
              <Label htmlFor="weekend">📅 {t("notifications.weekendPlanning")}</Label>
              <p className="text-xs text-muted-foreground">{t("notifications.weekendDesc")}</p>
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
              <Label htmlFor="reengagement">💬 {t("notifications.reengagement")}</Label>
              <p className="text-xs text-muted-foreground">{t("notifications.reengagementDesc")}</p>
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
            <h3 className="text-sm font-medium text-muted-foreground">{t("notifications.frequency")}</h3>
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
            <h3 className="text-sm font-medium text-muted-foreground">{t("notifications.quietHours")}</h3>
          </div>
          <p className="text-xs text-muted-foreground">{t("notifications.quietHoursDesc")}</p>
          
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
