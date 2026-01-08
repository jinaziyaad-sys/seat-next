import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, X, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { initializePushNotifications, areNotificationsSupported, getNotificationPermission } from "@/utils/notifications";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { UnblockNotificationsDialog } from "@/components/notifications/UnblockNotificationsDialog";

interface NotificationPromptProps {
  onDismiss?: () => void;
}

export function NotificationPrompt({ onDismiss }: NotificationPromptProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showUnblockDialog, setShowUnblockDialog] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkShouldShow();
  }, []);

  const checkShouldShow = async () => {
    // Don't show if notifications aren't supported
    if (!areNotificationsSupported()) return;
    
    const permission = getNotificationPermission();
    
    // If already granted, don't show
    if (permission === 'granted') return;
    
    // If denied/blocked, we'll show a different UI
    if (permission === 'denied') {
      setIsBlocked(true);
    }

    // Check if user is logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if user has dismissed this prompt before
    const dismissed = localStorage.getItem('notificationPromptDismissed');
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSinceDismissed = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      // Show again after 7 days
      if (daysSinceDismissed < 7) return;
    }

    // If blocked, still show the prompt but with blocked UI
    // If default, show normal prompt
    // Don't check preferences if blocked - we want to show the prompt regardless
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
    // If already blocked, show unblock dialog instead
    if (isBlocked) {
      setShowUnblockDialog(true);
      return;
    }
    
    setLoading(true);
    
    try {
      const success = await initializePushNotifications('');
      
      if (success) {
        // Create default notification preferences
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
          title: "Notifications enabled! 🎉",
          description: "You'll get helpful reminders and alerts",
        });
        setVisible(false);
        onDismiss?.();
      } else {
        // Check if it's now blocked
        if (getNotificationPermission() === 'denied') {
          setIsBlocked(true);
          toast({
            title: "Notifications blocked",
            description: "Click 'How to enable' for instructions",
          });
        } else {
          toast({
            title: "Notifications not enabled",
            description: "You can try again anytime",
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
                  <p className="font-medium text-sm">Notifications are blocked</p>
                  <p className="text-xs text-muted-foreground">
                    Your browser is blocking notifications. Update your settings to receive alerts.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium text-sm">Never miss when your food is ready!</p>
                  <p className="text-xs text-muted-foreground">
                    Get notified when your order or table is ready, plus helpful reminders
                  </p>
                </>
              )}
              
              <div className="flex gap-2 pt-1">
                {isBlocked ? (
                  <Button 
                    size="sm" 
                    onClick={() => setShowUnblockDialog(true)}
                  >
                    How to enable
                  </Button>
                ) : (
                  <Button 
                    size="sm" 
                    onClick={handleEnable}
                    disabled={loading}
                  >
                    {loading ? "Enabling..." : "Enable notifications"}
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={handleDismiss}
                >
                  Not now
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
