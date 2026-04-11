import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, Utensils, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { TableConfigurationManager } from "./TableConfigurationManager";
import { useToast } from "@/hooks/use-toast";

interface TableConfig {
  id: string;
  name: string;
  capacity: number;
}

interface TableBooking {
  tableId: string;
  customerName: string;
  partySize: number;
  reservationTime: string;
}

interface FloorPlanProps {
  venueId: string;
}

export function FloorPlan({ venueId }: FloorPlanProps) {
  const [tables, setTables] = useState<TableConfig[]>([]);
  const [bookings, setBookings] = useState<Map<string, TableBooking[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [currentSettings, setCurrentSettings] = useState<Record<string, any>>({});
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    // Fetch venue settings for table config
    const { data: venueData } = await supabase
      .from("venues")
      .select("settings")
      .eq("id", venueId)
      .single();

    const settings = (venueData?.settings as Record<string, any>) || {};
    setCurrentSettings(settings);
    const tableConfig: TableConfig[] = settings.table_configuration || [];
    setTables(tableConfig);

    // Fetch today's reservations only
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const { data: reservations } = await supabase
      .from("waitlist_entries")
      .select("customer_name, party_size, assigned_table_id, reservation_time")
      .eq("venue_id", venueId)
      .eq("reservation_type", "reservation")
      .not("assigned_table_id", "is", null)
      .gte("reservation_time", todayStart.toISOString())
      .lte("reservation_time", todayEnd.toISOString())
      .not("status", "eq", "cancelled");

    const bookingMap = new Map<string, TableBooking[]>();
    reservations?.forEach((r: any) => {
      const tableId = r.assigned_table_id;
      const booking: TableBooking = {
        tableId,
        customerName: r.customer_name,
        partySize: r.party_size,
        reservationTime: r.reservation_time,
      };
      const existing = bookingMap.get(tableId) || [];
      existing.push(booking);
      bookingMap.set(tableId, existing);
    });

    setBookings(bookingMap);
    setLoading(false);
  }, [venueId]);

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel(`floor-plan-${venueId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "waitlist_entries",
        filter: `venue_id=eq.${venueId}`,
      }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId, fetchData]);

  const handleTableConfigChange = async (updatedTables: TableConfig[]) => {
    setTables(updatedTables);

    const { error } = await supabase
      .from("venues")
      .update({
        settings: { ...currentSettings, table_configuration: updatedTables } as any,
      })
      .eq("id", venueId);

    if (error) {
      toast({
        title: "Error",
        description: "Could not save table configuration",
        variant: "destructive",
      });
      return;
    }

    setCurrentSettings((prev) => ({ ...prev, table_configuration: updatedTables }));
    toast({ title: "Saved", description: "Table configuration updated" });
  };

  const now = new Date();

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading floor plan...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Table Configuration Section */}
      <TableConfigurationManager tables={tables} onChange={handleTableConfigChange} />

      {/* Visual Floor Grid */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5" />
              Floor Plan — Today
            </CardTitle>
            <Badge variant="outline" className="gap-1">
              <CalendarDays className="h-3 w-3" />
              {now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {tables.length === 0 ? (
            <div className="text-center py-8">
              <Utensils className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No tables configured yet</p>
              <p className="text-sm text-muted-foreground">
                Add tables above to see your floor plan
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {tables.map((table) => {
                const tableBookings = bookings.get(table.id) || [];
                const hasBooking = tableBookings.length > 0;

                return (
                  <div
                    key={table.id}
                    className={cn(
                      "border-2 rounded-xl p-4 flex flex-col items-center gap-2 transition-all",
                      hasBooking
                        ? "border-primary/50 bg-primary/10"
                        : "border-muted bg-muted/20"
                    )}
                  >
                    <p className="font-semibold text-sm">{table.name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      {table.capacity} seats
                    </div>

                    {hasBooking ? (
                      tableBookings.map((b, i) => (
                        <div key={i} className="text-center w-full">
                          <Badge className="bg-primary/20 text-primary">Booked</Badge>
                          <p className="text-xs truncate w-full mt-1">{b.customerName}</p>
                          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {new Date(b.reservationTime).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Party of {b.partySize}
                          </p>
                        </div>
                      ))
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Available
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
