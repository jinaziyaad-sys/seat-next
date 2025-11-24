import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, Utensils } from "lucide-react";

interface TableConfig {
  id: string;
  capacity: number;
  name: string;
}

interface TableConfigurationManagerProps {
  tables: TableConfig[];
  onChange: (tables: TableConfig[]) => void;
}

export const TableConfigurationManager = ({ tables, onChange }: TableConfigurationManagerProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableConfig | null>(null);
  const [tableName, setTableName] = useState("");
  const [tableCapacity, setTableCapacity] = useState("4");

  const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);

  const handleAddOrUpdateTable = () => {
    if (!tableName.trim()) return;

    const capacity = parseInt(tableCapacity);
    if (isNaN(capacity) || capacity < 1) return;

    if (editingTable) {
      // Update existing table
      onChange(
        tables.map(t => 
          t.id === editingTable.id 
            ? { ...t, name: tableName.trim(), capacity }
            : t
        )
      );
    } else {
      // Add new table
      const newTable: TableConfig = {
        id: `table_${Date.now()}`,
        name: tableName.trim(),
        capacity
      };
      onChange([...tables, newTable]);
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
    onChange(tables.filter(t => t.id !== tableId));
  };

  const resetDialog = () => {
    setDialogOpen(false);
    setEditingTable(null);
    setTableName("");
    setTableCapacity("4");
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5" />
              Table Configuration
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Configure individual tables for reservation management
            </p>
          </div>
          <Badge variant="secondary" className="text-base px-4 py-2">
            {tables.length} tables • {totalCapacity} seats
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {tables.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed rounded-lg">
            <Utensils className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">No tables configured yet</p>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Table
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Table</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="table-name">Table Name</Label>
                    <Input
                      id="table-name"
                      placeholder="e.g., Table 1, Window Booth"
                      value={tableName}
                      onChange={(e) => setTableName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="table-capacity">Seating Capacity</Label>
                    <Select value={tableCapacity} onValueChange={setTableCapacity}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 seats</SelectItem>
                        <SelectItem value="3">3 seats</SelectItem>
                        <SelectItem value="4">4 seats</SelectItem>
                        <SelectItem value="5">5 seats</SelectItem>
                        <SelectItem value="6">6 seats</SelectItem>
                        <SelectItem value="8">8 seats</SelectItem>
                        <SelectItem value="10">10 seats</SelectItem>
                        <SelectItem value="12">12 seats</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={resetDialog}>Cancel</Button>
                  <Button onClick={handleAddOrUpdateTable}>Add Table</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tables.map((table) => (
                <Card key={table.id} className="p-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{table.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {table.capacity} seats
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditTable(table)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteTable(table.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Table
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingTable ? "Edit Table" : "Add Table"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="table-name">Table Name</Label>
                    <Input
                      id="table-name"
                      placeholder="e.g., Table 1, Window Booth"
                      value={tableName}
                      onChange={(e) => setTableName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="table-capacity">Seating Capacity</Label>
                    <Select value={tableCapacity} onValueChange={setTableCapacity}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 seats</SelectItem>
                        <SelectItem value="3">3 seats</SelectItem>
                        <SelectItem value="4">4 seats</SelectItem>
                        <SelectItem value="5">5 seats</SelectItem>
                        <SelectItem value="6">6 seats</SelectItem>
                        <SelectItem value="8">8 seats</SelectItem>
                        <SelectItem value="10">10 seats</SelectItem>
                        <SelectItem value="12">12 seats</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={resetDialog}>Cancel</Button>
                  <Button onClick={handleAddOrUpdateTable}>
                    {editingTable ? "Update" : "Add"} Table
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </CardContent>
    </Card>
  );
};
