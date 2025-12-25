import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format, formatDistanceToNow } from "date-fns";
import { XCircle, Clock, User, ShoppingBag, Users } from "lucide-react";

interface CancellationEntry {
  id: string;
  type: "order" | "waitlist";
  customerName: string;
  cancelledBy: string;
  reason: string | null;
  timestamp: string;
  details: string;
}

interface CancellationHistoryProps {
  venueId: string;
}

export function CancellationHistory({ venueId }: CancellationHistoryProps) {
  const [cancellations, setCancellations] = useState<CancellationEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCancellations = async () => {
      setIsLoading(true);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Fetch cancelled orders
      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number, customer_name, cancelled_by, cancellation_type, updated_at")
        .eq("venue_id", venueId)
        .eq("status", "cancelled")
        .gte("updated_at", sevenDaysAgo.toISOString())
        .order("updated_at", { ascending: false });

      // Fetch cancelled waitlist entries
      const { data: waitlist } = await supabase
        .from("waitlist_entries")
        .select("id, customer_name, cancelled_by, cancellation_reason, party_size, updated_at")
        .eq("venue_id", venueId)
        .eq("status", "cancelled")
        .gte("updated_at", sevenDaysAgo.toISOString())
        .order("updated_at", { ascending: false });

      const entries: CancellationEntry[] = [];

      // Process orders
      if (orders) {
        orders.forEach((order) => {
          entries.push({
            id: order.id,
            type: "order",
            customerName: order.customer_name || "Unknown",
            cancelledBy: order.cancelled_by || "Unknown",
            reason: order.cancellation_type,
            timestamp: order.updated_at,
            details: `Order #${order.order_number}`,
          });
        });
      }

      // Process waitlist
      if (waitlist) {
        waitlist.forEach((entry) => {
          entries.push({
            id: entry.id,
            type: "waitlist",
            customerName: entry.customer_name,
            cancelledBy: entry.cancelled_by || "Unknown",
            reason: entry.cancellation_reason,
            timestamp: entry.updated_at,
            details: `Party of ${entry.party_size}`,
          });
        });
      }

      // Sort by timestamp descending
      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setCancellations(entries);
      setIsLoading(false);
    };

    fetchCancellations();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`cancellation-history-${venueId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `venue_id=eq.${venueId}`,
        },
        (payload) => {
          if ((payload.new as any).status === "cancelled") {
            fetchCancellations();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "waitlist_entries",
          filter: `venue_id=eq.${venueId}`,
        },
        (payload) => {
          if ((payload.new as any).status === "cancelled") {
            fetchCancellations();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId]);

  const getCancelledByLabel = (cancelledBy: string) => {
    switch (cancelledBy?.toLowerCase()) {
      case "patron":
        return { label: "Patron", variant: "secondary" as const };
      case "venue":
      case "merchant":
        return { label: "Venue", variant: "destructive" as const };
      case "system":
        return { label: "System", variant: "outline" as const };
      default:
        return { label: cancelledBy || "Unknown", variant: "outline" as const };
    }
  };

  // Count by type
  const patronCancellations = cancellations.filter(
    (c) => c.cancelledBy?.toLowerCase() === "patron"
  ).length;
  const venueCancellations = cancellations.filter(
    (c) => c.cancelledBy?.toLowerCase() === "venue" || c.cancelledBy?.toLowerCase() === "merchant"
  ).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <XCircle size={20} className="text-destructive" />
            Cancellation History
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="secondary" className="text-xs">
              <User size={12} className="mr-1" />
              {patronCancellations} patron
            </Badge>
            <Badge variant="destructive" className="text-xs">
              {venueCancellations} venue
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Last 7 days</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : cancellations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <XCircle size={40} className="text-muted-foreground/30 mb-2" />
            <p className="text-muted-foreground">No cancellations in the last 7 days</p>
            <p className="text-xs text-muted-foreground">Great job!</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {cancellations.map((entry) => {
                const cancelledByInfo = getCancelledByLabel(entry.cancelledBy);
                return (
                  <div
                    key={`${entry.type}-${entry.id}`}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                  >
                    <div className="mt-0.5">
                      {entry.type === "order" ? (
                        <ShoppingBag size={18} className="text-primary" />
                      ) : (
                        <Users size={18} className="text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{entry.customerName}</span>
                        <Badge variant={cancelledByInfo.variant} className="text-xs">
                          {cancelledByInfo.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs capitalize">
                          {entry.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{entry.details}</p>
                      {entry.reason && (
                        <p className="text-sm text-muted-foreground mt-1 italic">
                          "{entry.reason}"
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock size={12} />
                        {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(entry.timestamp), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
