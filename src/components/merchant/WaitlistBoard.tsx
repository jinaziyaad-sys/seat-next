import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Users, Plus, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WaitlistEntry {
  id: string;
  customerName: string;
  partySize: number;
  preferences?: string;
  joinedAt: Date;
  eta: Date;
  status: "waiting" | "ready" | "seated" | "no-show";
  position: number;
}

export const WaitlistBoard = ({ venue }: { venue: string }) => {
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newPartySize, setNewPartySize] = useState("2");
  const [newPreferences, setNewPreferences] = useState("");
  const { toast } = useToast();

  // Mock waitlist for demo
  useEffect(() => {
    const mockWaitlist: WaitlistEntry[] = [
      {
        id: "1",
        customerName: "Smith Party",
        partySize: 4,
        preferences: "Indoor, Non-smoking",
        joinedAt: new Date(Date.now() - 15 * 60000),
        eta: new Date(Date.now() + 5 * 60000),
        status: "waiting",
        position: 1
      },
      {
        id: "2",
        customerName: "Johnson",
        partySize: 2,
        preferences: "Outdoor",
        joinedAt: new Date(Date.now() - 10 * 60000),
        eta: new Date(Date.now() + 10 * 60000),
        status: "waiting",
        position: 2
      },
      {
        id: "3",
        customerName: "Williams Family",
        partySize: 6,
        preferences: "Indoor, High chair needed",
        joinedAt: new Date(Date.now() - 5 * 60000),
        eta: new Date(Date.now() + 20 * 60000),
        status: "ready",
        position: 3
      }
    ];
    setWaitlist(mockWaitlist);
  }, []);

  const updateEntryStatus = (entryId: string, newStatus: WaitlistEntry["status"]) => {
    setWaitlist(prev => prev.map(entry => 
      entry.id === entryId ? { ...entry, status: newStatus } : entry
    ));
    
    // Reorder positions for waiting entries
    if (newStatus === "seated" || newStatus === "no-show") {
      setWaitlist(prev => {
        const updated = prev.map(entry => entry.id === entryId ? { ...entry, status: newStatus } : entry);
        const waiting = updated.filter(e => e.status === "waiting").sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
        return updated.map(entry => {
          if (entry.status === "waiting") {
            const index = waiting.findIndex(w => w.id === entry.id);
            return { ...entry, position: index + 1 };
          }
          return entry;
        });
      });
    }

    toast({
      title: "Waitlist Updated",
      description: `Entry status changed to ${newStatus.replace("-", " ")}`,
    });
  };

  const setETA = (entryId: string, minutes: number) => {
    setWaitlist(prev => prev.map(entry => 
      entry.id === entryId 
        ? { ...entry, eta: new Date(Date.now() + minutes * 60000) }
        : entry
    ));
    toast({
      title: "ETA Updated",
      description: `Estimated wait time set to ${minutes} minutes`,
    });
  };

  const addToWaitlist = () => {
    if (!newCustomerName) return;
    
    const waitingEntries = waitlist.filter(e => e.status === "waiting");
    const newPosition = waitingEntries.length + 1;
    
    const newEntry: WaitlistEntry = {
      id: Date.now().toString(),
      customerName: newCustomerName,
      partySize: parseInt(newPartySize),
      preferences: newPreferences || undefined,
      joinedAt: new Date(),
      eta: new Date(Date.now() + 15 * 60000),
      status: "waiting",
      position: newPosition
    };
    
    setWaitlist(prev => [...prev, newEntry]);
    setNewCustomerName("");
    setNewPartySize("2");
    setNewPreferences("");
    toast({
      title: "Added to Waitlist",
      description: `${newEntry.customerName} added to waitlist`,
    });
  };

  const getStatusColor = (status: WaitlistEntry["status"]) => {
    switch (status) {
      case "waiting": return "bg-blue-500";
      case "ready": return "bg-green-500";
      case "seated": return "bg-gray-500";
      case "no-show": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", { 
      hour: "2-digit", 
      minute: "2-digit",
      hour12: false 
    });
  };

  const getWaitTime = (joinedAt: Date) => {
    const diff = new Date().getTime() - joinedAt.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    return `${minutes}m`;
  };

  const sortedWaitlist = [...waitlist].sort((a, b) => {
    if (a.status === "ready" && b.status !== "ready") return -1;
    if (b.status === "ready" && a.status !== "ready") return 1;
    if (a.status === "waiting" && b.status === "waiting") return a.position - b.position;
    return a.joinedAt.getTime() - b.joinedAt.getTime();
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Waitlist Management</h2>
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <Plus size={16} className="mr-2" />
              Add to Waitlist
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Customer to Waitlist</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="customerName">Customer Name</Label>
                <Input
                  id="customerName"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="e.g., Smith Party"
                />
              </div>
              <div>
                <Label htmlFor="partySize">Party Size</Label>
                <Select value={newPartySize} onValueChange={setNewPartySize}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6,7,8].map(size => (
                      <SelectItem key={size} value={size.toString()}>
                        {size} {size === 1 ? "person" : "people"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="preferences">Preferences (optional)</Label>
                <Input
                  id="preferences"
                  value={newPreferences}
                  onChange={(e) => setNewPreferences(e.target.value)}
                  placeholder="e.g., Indoor, Non-smoking"
                />
              </div>
              <Button onClick={addToWaitlist} className="w-full">
                Add to Waitlist
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedWaitlist.map((entry) => (
          <Card key={entry.id} className="shadow-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{entry.customerName}</CardTitle>
                <Badge className={`${getStatusColor(entry.status)} text-white`}>
                  {entry.status === "waiting" ? `#${entry.position}` : entry.status.toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users size={14} />
                  {entry.partySize}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  Waiting {getWaitTime(entry.joinedAt)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {entry.preferences && (
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="mt-0.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {entry.preferences}
                  </span>
                </div>
              )}

              <div className="text-sm">
                <span className="font-medium">ETA: </span>
                <span>{formatTime(entry.eta)}</span>
              </div>

              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setETA(entry.id, 5)}
                    className="flex-1"
                  >
                    5m
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setETA(entry.id, 10)}
                    className="flex-1"
                  >
                    10m
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setETA(entry.id, 20)}
                    className="flex-1"
                  >
                    20m
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setETA(entry.id, 30)}
                    className="flex-1"
                  >
                    30m
                  </Button>
                </div>

                <Select
                  value={entry.status}
                  onValueChange={(value) => updateEntryStatus(entry.id, value as WaitlistEntry["status"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="waiting">Waiting</SelectItem>
                    <SelectItem value="ready">Table Ready</SelectItem>
                    <SelectItem value="seated">Seated</SelectItem>
                    <SelectItem value="no-show">No Show</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {waitlist.length === 0 && (
        <Card className="p-12 text-center">
          <CardContent>
            <p className="text-muted-foreground">No customers currently on waitlist</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};