import { useState, useEffect } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";
import { replayQueue, getQueue } from "@/utils/offlineQueue";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = async () => {
      setIsOffline(false);
      
      // Replay queued actions
      const queue = getQueue();
      if (queue.length > 0) {
        setShowReconnected(true);
        const synced = await replayQueue(supabase);
        if (synced > 0) {
          toast({
            title: "Back online",
            description: `Synced ${synced} pending action${synced > 1 ? 's' : ''}`,
          });
        }
        setTimeout(() => setShowReconnected(false), 3000);
      } else {
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 2000);
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [toast]);

  if (!isOffline && !showReconnected) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors",
        isOffline
          ? "bg-destructive text-destructive-foreground"
          : "bg-success text-white"
      )}
    >
      {isOffline ? (
        <>
          <WifiOff className="h-4 w-4" />
          You're offline — some features may be unavailable
        </>
      ) : (
        <>
          <Wifi className="h-4 w-4" />
          Back online
        </>
      )}
    </div>
  );
}
