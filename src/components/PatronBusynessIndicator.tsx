import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Users, Clock } from "lucide-react";
import { checkVenueStatus, BusinessHours, HolidayClosure } from "@/utils/businessHours";

interface PatronBusynessIndicatorProps {
  venueId: string;
  settings?: {
    business_hours?: BusinessHours;
    holiday_closures?: HolidayClosure[];
    grace_periods?: {
      last_reservation: number;
      last_order: number;
      last_waitlist_join: number;
    };
  } | null;
}

type BusynessLevel = "short" | "moderate" | "long";

export function PatronBusynessIndicator({ venueId, settings }: PatronBusynessIndicatorProps) {
  const [waitingCount, setWaitingCount] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Fetch waitlist count
  useEffect(() => {
    const fetchWaitlistCount = async () => {
      const { count } = await supabase
        .from("waitlist_entries")
        .select("*", { count: "exact", head: true })
        .eq("venue_id", venueId)
        .eq("status", "waiting");

      setWaitingCount(count || 0);
    };

    fetchWaitlistCount();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`patron-waitlist-${venueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "waitlist_entries",
          filter: `venue_id=eq.${venueId}`,
        },
        () => {
          fetchWaitlistCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId]);

  // Check venue open/closed status
  useEffect(() => {
    const checkStatus = () => {
      if (!settings?.business_hours) {
        setIsOpen(true);
        return;
      }

      const gracePeriods = settings.grace_periods || {
        last_reservation: 30,
        last_order: 30,
        last_waitlist_join: 30,
      };

      // Pass full business_hours object - checkVenueStatus handles day lookup internally
      const status = checkVenueStatus(
        settings.business_hours,
        settings.holiday_closures || [],
        gracePeriods,
        "waitlist"
      );

      setIsOpen(status.is_open);
      setStatusMessage(status.message || null);
    };

    checkStatus();
    const interval = setInterval(checkStatus, 60000);

    return () => clearInterval(interval);
  }, [settings]);

  const getBusynessLevel = (): BusynessLevel => {
    if (waitingCount <= 3) return "short";
    if (waitingCount <= 8) return "moderate";
    return "long";
  };

  const getBusynessConfig = (level: BusynessLevel) => {
    switch (level) {
      case "short":
        return {
          label: "Short Wait",
          bgClass: "bg-green-500/10 border-green-500/30",
          textClass: "text-green-600 dark:text-green-400",
          dotClass: "bg-green-500",
        };
      case "moderate":
        return {
          label: "Moderate Wait",
          bgClass: "bg-yellow-500/10 border-yellow-500/30",
          textClass: "text-yellow-600 dark:text-yellow-400",
          dotClass: "bg-yellow-500",
        };
      case "long":
        return {
          label: "Long Wait",
          bgClass: "bg-red-500/10 border-red-500/30",
          textClass: "text-red-600 dark:text-red-400",
          dotClass: "bg-red-500",
        };
    }
  };

  const busynessLevel = getBusynessLevel();
  const config = getBusynessConfig(busynessLevel);

  return (
    <div className={`rounded-lg border p-4 ${config.bgClass}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Status dot */}
          <div className="relative">
            <div className={`w-3 h-3 rounded-full ${isOpen ? config.dotClass : "bg-muted-foreground"}`} />
            {isOpen && (
              <div className={`absolute inset-0 w-3 h-3 rounded-full ${config.dotClass} animate-ping opacity-75`} />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className={`font-medium ${isOpen ? config.textClass : "text-muted-foreground"}`}>
                {isOpen ? "Open" : "Closed"}
              </span>
              {isOpen && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className={`font-medium ${config.textClass}`}>{config.label}</span>
                </>
              )}
            </div>
            
            {isOpen ? (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <Users size={14} />
                {waitingCount === 0
                  ? "No one waiting - you're next!"
                  : waitingCount === 1
                  ? "1 party ahead of you"
                  : `${waitingCount} parties ahead of you`}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-0.5">
                {statusMessage || "Not accepting waitlist entries right now"}
              </p>
            )}
          </div>
        </div>

        {isOpen && (
          <Badge variant="outline" className={`${config.textClass} border-current`}>
            <Clock size={12} className="mr-1" />
            ~{waitingCount <= 2 ? "5-10" : waitingCount <= 5 ? "15-25" : "30+"} min
          </Badge>
        )}
      </div>
    </div>
  );
}
