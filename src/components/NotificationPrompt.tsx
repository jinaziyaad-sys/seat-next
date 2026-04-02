import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, X, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { initializePushNotifications, areNotificationsSupported, getNotificationPermission } from "@/utils/notifications";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { UnblockNotificationsDialog } from "@/components/notifications/UnblockNotificationsDialog";
import { useTranslation } from "react-i18next";

interface NotificationPromptProps {
  onDismiss?: () => void;
}

export function NotificationPrompt({ onDismiss }: NotificationPromptProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showUnblockDialog, setShowUnblockDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkShouldShow();
  }, []);

  const checkShouldShow = async () => {
    if (!areNotificationsSupported()) return;
    const permission = getNotificationPermission();
    if (permission === 'granted') return;
    if (permission === 'denied') {
      setIsBlocked(true);
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const dismissed = localStorage.getItem('notificationPromptDismissed');
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) return;
    }
    if (permission !== 'denied') {
      const { data: prefs } = await supabase
        .from('patron_notification_preferences')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (prefs) return;
    }
    setVisible(true);
  };

  const handleEnable = async () => {
    if (isBlocked) {
      setShowUnblockDialog(true);
      return;
    }
    setLoading(true);
    try {
      const success = await initializePushNotifications('');
      if (success) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('patron_notification_preferences')
            .upsert({
              user_id: user.id,
              mealtime_nudges: true,
              reengagement_nudges: true,
              favorite_venue_alerts: true,
              weekend_planning_nudges: true,
            }, { onConflict: 'user_id' });
        }
        toast({
          title: t("notifications.enabledSuccess"),
          description: t("notifications.enabledDesc"),
        });
        setVisible(false);
        onDismiss?.();
      } else {
        if (getNotificationPermission() === 'denied') {
          setIsBlocked(true);
          toast({
            title: t("notifications.blockedTitle"),
            description: t("notifications.blockedDesc"),
          });
        } else {
          toast({
            title: t("notifications.notEnabled"),
            description: t("notifications.notEnabledDesc"),
          });
        }
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
    }
    setLoading(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('notificationPromptDismissed', new Date().toISOString());
    setVisible(false);
    onDismiss?.();
  };

  if (!visible) return null;

  return (
    <>
      <Card className={cn(
        "fixed bottom-20 left-4 right-4 z-50 shadow-lg border-primary/20 bg-card/95 backdrop-blur-sm",
        "animate-in slide-in-from-bottom-5 duration-300"
      )}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              "rounded-full p-2 shrink-0",
              isBlocked ? "bg-destructive/10" : "bg-primary/10"
            )}>
              {isBlocked ? (
                <AlertCircle className="h-5 w-5 text-destructive" />
              ) : (
                <Bell className="h-5 w-5 text-primary" />
              )}
            </div>
            
            <div className="flex-1 space-y-2">
              {isBlocked ? (
                <>
                  <p className="font-medium text-sm">{t("notifications.areBlocked")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("notifications.browserBlocking")}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-sm">{t("notifications.neverMiss")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("notifications.getNotified")}
                  </p>
                </>
              )}
              
              <div className="flex gap-2 pt-1">
                {isBlocked ? (
                  <Button 
                    size="sm" 
                    onClick={() => setShowUnblockDialog(true)}
                  >
                    {t("notifications.howToEnable")}
                  </Button>
                ) : (
                  <Button 
                    size="sm" 
                    onClick={handleEnable}
                    disabled={loading}
                  >
                    {loading ? t("notifications.enabling") : t("notifications.enableNotifications")}
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={handleDismiss}
                >
                  {t("notifications.notNow")}
                </Button>
              </div>
            </div>
            
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <UnblockNotificationsDialog 
        open={showUnblockDialog} 
        onOpenChange={setShowUnblockDialog} 
      />
    </>
  );
}