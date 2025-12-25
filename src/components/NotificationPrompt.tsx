import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { initializePushNotifications, areNotificationsSupported, hasNotificationPermission } from "@/utils/notifications";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface NotificationPromptProps {
  onDismiss?: () => void;
}

export function NotificationPrompt({ onDismiss }: NotificationPromptProps) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkShouldShow();
  }, []);

  const checkShouldShow = async () => {
    // Don't show if notifications aren't supported
    if (!areNotificationsSupported()) return;
    
    // Don't show if already granted
    if (hasNotificationPermission()) return;

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

    // Check if user already has preferences set
    const { data: prefs } = await supabase
      .from('patron_notification_preferences')
      .select('id')
      .eq('user_id', user.id)
      .single();

    // If user has no preferences, show the prompt
    if (!prefs) {
      setVisible(true);
    }
  };

  const handleEnable = async () => {
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
        toast({
          title: "Notifications blocked",
          description: "You can enable them anytime in your browser settings",
          variant: "destructive",
        });
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
    <Card className={cn(
      "fixed bottom-20 left-4 right-4 z-50 shadow-lg border-primary/20 bg-card/95 backdrop-blur-sm",
      "animate-in slide-in-from-bottom-5 duration-300"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 shrink-0">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          
          <div className="flex-1 space-y-2">
            <p className="font-medium text-sm">Never miss when your food is ready!</p>
            <p className="text-xs text-muted-foreground">
              Get notified when your order or table is ready, plus helpful reminders
            </p>
            
            <div className="flex gap-2 pt-1">
              <Button 
                size="sm" 
                onClick={handleEnable}
                disabled={loading}
              >
                {loading ? "Enabling..." : "Enable notifications"}
              </Button>
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
  );
}
