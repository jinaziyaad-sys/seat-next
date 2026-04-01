import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Utensils, Users, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface TableConfig {
  id: string;
  name: string;
  capacity: number;
}

interface TableOccupancy {
  tableId: string;
  status: "free" | "occupied" | "reserved" | "ready";
  customerName?: string;
  partySize?: number;
  since?: string;
}

interface LiveFloorPlanProps {
  venueId: string;
}

export function LiveFloorPlan({ venueId }: LiveFloorPlanProps) {
  const [tables, setTables] = useState<TableConfig[]>([]);
  const [occupancy, setOccupancy] = useState<Map<string, TableOccupancy>>(new Map());
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    // Fetch venue table configuration
    const { data: venueData } = await supabase
      .from("venues")
      .select("settings")
      .eq("id", venueId)
      .single();

    const settings = venueData?.settings as any;
    const tableConfig: TableConfig[] = settings?.table_configuration || [];
    setTables(tableConfig);

    // Fetch active waitlist entries with table assignments
    const { data: entries } = await supabase
      .from("waitlist_entries")
      .select("id, customer_name, party_size, status, assigned_table_id, created_at, reservation_time, reservation_type")
      .eq("venue_id", venueId)
      .in("status", ["waiting", "ready", "seated"]);

    const occupancyMap = new Map<string, TableOccupancy>();

    // Initialize all tables as free
    tableConfig.forEach((t) => {
      occupancyMap.set(t.id, { tableId: t.id, status: "free" });
    });

    // Map entries to tables
    entries?.forEach((entry: any) => {
      if (entry.assigned_table_id && occupancyMap.has(entry.assigned_table_id)) {
        let status: TableOccupancy["status"] = "free";
        if (entry.status === "seated") status = "occupied";
        else if (entry.status === "ready") status = "ready";
        else if (entry.reservation_type === "reservation") status = "reserved";
        else status = "reserved"; // waiting with assigned table

        occupancyMap.set(entry.assigned_table_id, {
          tableId: entry.assigned_table_id,
          status,
          customerName: entry.customer_name,
          partySize: entry.party_size,
          since: entry.reservation_time || entry.created_at,
        });
      }
    });

    setOccupancy(occupancyMap);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    // Real-time subscription
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
  }, [venueId]);

  const getStatusColor = (status: TableOccupancy["status"]) => {
    switch (status) {
      case "free": return "border-green-500/50 bg-green-500/10";
      case "occupied": return "border-red-500/50 bg-red-500/10";
      case "reserved": return "border-amber-500/50 bg-amber-500/10";
      case "ready": return "border-blue-500/50 bg-blue-500/10 animate-pulse";
    }
  };

  const getStatusLabel = (status: TableOccupancy["status"]) => {
    switch (status) {
      case "free": return <Badge className="bg-green-500/20 text-green-700 dark:text-green-400">Free</Badge>;
      case "occupied": return <Badge className="bg-red-500/20 text-red-700 dark:text-red-400">Occupied</Badge>;
      case "reserved": return <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400">Reserved</Badge>;
      case "ready": return <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-400">Ready</Badge>;
    }
  };

  const stats = {
    total: tables.length,
    free: Array.from(occupancy.values()).filter(o => o.status === "free").length,
    occupied: Array.from(occupancy.values()).filter(o => o.status === "occupied").length,
    reserved: Array.from(occupancy.values()).filter(o => o.status === "reserved").length,
    ready: Array.from(occupancy.values()).filter(o => o.status === "ready").length,
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading floor plan...
        </CardContent>
      </Card>
    );
  }

  if (tables.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Utensils className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No tables configured</p>
          <p className="text-sm text-muted-foreground">
            Add tables in Settings → Table Configuration to see the live floor plan
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5" />
            Live Floor Plan
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="gap-1">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              {stats.free} Free
            </Badge>
            <Badge variant="outline" className="gap-1">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              {stats.occupied} Occupied
            </Badge>
            <Badge variant="outline" className="gap-1">
              <div className="h-2 w-2 rounded-full bg-amber-500" />
              {stats.reserved} Reserved
            </Badge>
            {stats.ready > 0 && (
              <Badge variant="outline" className="gap-1">
                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                {stats.ready} Ready
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {tables.map((table) => {
            const occ = occupancy.get(table.id) || { tableId: table.id, status: "free" as const };
            return (
              <div
                key={table.id}
                className={cn(
                  "border-2 rounded-xl p-4 flex flex-col items-center gap-2 transition-all",
                  getStatusColor(occ.status)
                )}
              >
                <p className="font-semibold text-sm">{table.name}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {occ.partySize ? `${occ.partySize}/${table.capacity}` : `0/${table.capacity}`}
                </div>
                {getStatusLabel(occ.status)}
                {occ.customerName && (
                  <p className="text-xs text-center truncate w-full">{occ.customerName}</p>
                )}
                {occ.since && occ.status !== "free" && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(occ.since).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
