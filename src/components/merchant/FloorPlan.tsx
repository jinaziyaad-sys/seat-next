import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Clock, Utensils, CalendarDays, Plus, Edit2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
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
  readOnly?: boolean;
}

export function FloorPlan({ venueId, readOnly = false }: FloorPlanProps) {
  const [tables, setTables] = useState<TableConfig[]>([]);
  const [bookings, setBookings] = useState<Map<string, TableBooking[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [currentSettings, setCurrentSettings] = useState<Record<string, any>>({});
  const { toast } = useToast();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableConfig | null>(null);
  const [tableName, setTableName] = useState("");
  const [tableCapacity, setTableCapacity] = useState("4");

  const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);
  const now = new Date();

  const fetchData = useCallback(async () => {
    const { data: venueData } = await supabase
      .from("venues")
      .select("settings")
      .eq("id", venueId)
      .single();

    const settings = (venueData?.settings as Record<string, any>) || {};
    setCurrentSettings(settings);
    const tableConfig: TableConfig[] = settings.table_configuration || [];
    setTables(tableConfig);

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

  const saveTableConfig = async (updatedTables: TableConfig[]) => {
    setTables(updatedTables);

    const { error } = await supabase
      .from("venues")
      .update({
        settings: { ...currentSettings, table_configuration: updatedTables } as any,
      })
      .eq("id", venueId);

    if (error) {
      toast({ title: "Error", description: "Could not save table configuration", variant: "destructive" });
      return;
    }

    setCurrentSettings((prev) => ({ ...prev, table_configuration: updatedTables }));
    toast({ title: "Saved", description: "Table configuration updated" });
  };

  const resetDialog = () => {
    setDialogOpen(false);
    setEditingTable(null);
    setTableName("");
    setTableCapacity("4");
  };

  const handleAddOrUpdateTable = () => {
    if (!tableName.trim()) return;
    const capacity = parseInt(tableCapacity);
    if (isNaN(capacity) || capacity < 1) return;

    if (editingTable) {
      saveTableConfig(tables.map(t => t.id === editingTable.id ? { ...t, name: tableName.trim(), capacity } : t));
    } else {
      saveTableConfig([...tables, { id: `table_${Date.now()}`, name: tableName.trim(), capacity }]);
    }
    resetDialog();
  };

  const handleEditTable = (table: TableConfig) => {
    setEditingTable(table);
    setTableName(table.name);
    setTableCapacity(table.capacity.toString());
    setDialogOpen(true);
  };

  const handleDeleteTable = (tableId: string) => {
    saveTableConfig(tables.filter(t => t.id !== tableId));
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <Utensils className="h-5 w-5" />
            Floor Plan
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <CalendarDays className="h-3 w-3" />
              {now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
            </Badge>
            {tables.length > 0 && (
              <Badge variant="secondary">
                {tables.length} tables • {totalCapacity} seats
              </Badge>
            )}
            {!readOnly && (
              <Button size="sm" onClick={() => { resetDialog(); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" />
                Add Table
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {tables.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed rounded-lg">
            <Utensils className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-2">No tables configured yet</p>
            <p className="text-sm text-muted-foreground mb-4">Add tables to see your floor plan</p>
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
                    "border-2 rounded-xl p-4 flex flex-col items-center gap-2 transition-all relative group",
                    hasBooking
                      ? "border-primary/50 bg-primary/10"
                      : "border-muted bg-muted/20"
                  )}
                >
                  {/* Edit/Delete actions (admin only) */}
                  {!readOnly && (
                    <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditTable(table)}>
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteTable(table.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

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
                          {new Date(b.reservationTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                        <p className="text-xs text-muted-foreground">Party of {b.partySize}</p>
                      </div>
                    ))
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Available</Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetDialog(); else setDialogOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTable ? "Edit Table" : "Add Table"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="table-name">Table Name</Label>
              <Input id="table-name" placeholder="e.g., Table 1, Window Booth" value={tableName} onChange={(e) => setTableName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="table-capacity">Seating Capacity</Label>
              <Select value={tableCapacity} onValueChange={setTableCapacity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20].map(n => (
                    <SelectItem key={n} value={n.toString()}>{n} seats</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetDialog}>Cancel</Button>
            <Button onClick={handleAddOrUpdateTable}>{editingTable ? "Update" : "Add"} Table</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
