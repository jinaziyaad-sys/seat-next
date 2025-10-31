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
import { supabase } from "@/integrations/supabase/client";

interface WaitlistEntry {
  id: string;
  customer_name: string;
  party_size: number;
  preferences?: string[];
  created_at: string;
  eta: string | null;
  status: "waiting" | "ready" | "seated" | "cancelled" | "no_show";
  position: number | null;
  venue_id: string;
}

export const WaitlistBoard = ({ venueId }: { venueId: string }) => {
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newPartySize, setNewPartySize] = useState("2");
  const [newPreferences, setNewPreferences] = useState("");
  const { toast } = useToast();

  // Fetch waitlist and set up real-time subscription
  useEffect(() => {
    const fetchWaitlist = async () => {
      // Fetch waitlist entries for this venue
      const { data: waitlistData, error: waitlistError } = await supabase
        .from("waitlist_entries")
        .select("*")
        .eq("venue_id", venueId)
        .neq("status", "seated")
        .neq("status", "cancelled")
        .order("created_at", { ascending: true });

      if (waitlistError) {
        toast({
          title: "Error", 
          description: "Could not load waitlist",
          variant: "destructive"
        });
        return;
      }

      setWaitlist(waitlistData || []);
    };

    fetchWaitlist();

    // Set up real-time subscription
    const channel = supabase
      .channel('waitlist-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'waitlist_entries'
      }, (payload) => {
        console.log('Waitlist change:', payload);
        // Refresh waitlist when any entry changes
        fetchWaitlist();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId, toast]);

  const updateEntryStatus = async (entryId: string, newStatus: WaitlistEntry["status"]) => {
    // Optimistic update
    setWaitlist(prevWaitlist => 
      prevWaitlist.map(entry => 
        entry.id === entryId ? { ...entry, status: newStatus } : entry
      )
    );

    const { error } = await supabase
      .from("waitlist_entries")
      .update({ status: newStatus })
      .eq("id", entryId);

    if (error) {
      toast({
        title: "Error",
        description: "Could not update waitlist status",
        variant: "destructive"
      });
      // Revert optimistic update on error by refetching
      const { data } = await supabase
        .from("waitlist_entries")
        .select("*")
        .eq("venue_id", venueId)
        .neq("status", "seated")
        .neq("status", "cancelled")
        .order("created_at", { ascending: true });
      if (data) {
        setWaitlist(data);
      }
      return;
    }

    toast({
      title: "Waitlist Updated",
      description: `Entry status changed to ${newStatus.replace("_", " ")}`,
    });
  };

  const setETA = async (entryId: string, minutes: number) => {
    const entry = waitlist.find(e => e.id === entryId);
    if (!entry) return;

    const currentETA = entry.eta ? new Date(entry.eta) : new Date();
    const newETA = new Date(currentETA.getTime() + minutes * 60000);

    // Optimistic update
    setWaitlist(prevWaitlist => 
      prevWaitlist.map(e => 
        e.id === entryId ? { ...e, eta: newETA.toISOString() } : e
      )
    );

    const { error } = await supabase
      .from("waitlist_entries")
      .update({ eta: newETA.toISOString() })
      .eq("id", entryId);

    if (error) {
      toast({
        title: "Error",
        description: "Could not update ETA",
        variant: "destructive"
      });
      // Revert optimistic update on error by refetching
      const { data } = await supabase
        .from("waitlist_entries")
        .select("*")
        .eq("venue_id", venueId)
        .neq("status", "seated")
        .neq("status", "cancelled")
        .order("created_at", { ascending: true });
      if (data) {
        setWaitlist(data);
      }
      return;
    }

    toast({
      title: "ETA Extended",
      description: `Wait time extended by ${minutes} minutes`,
    });
  };

  const addToWaitlist = async () => {
    if (!newCustomerName || !venueId) return;
    
    const preferences = newPreferences ? newPreferences.split(",").map(p => p.trim()) : [];
    
    // Call edge function to calculate dynamic ETA
    const { data: etaData, error: etaError } = await supabase.functions.invoke('calculate-waitlist-eta', {
      body: { 
        venue_id: venueId, 
        party_size: parseInt(newPartySize),
        preferences
      }
    });

    let eta: string;
    let confidence = 'low';
    
    if (etaError || !etaData) {
      console.error('Error calculating waitlist ETA:', etaError);
      // Fallback to default 20 minutes
      eta = new Date(Date.now() + 20 * 60000).toISOString();
    } else {
      eta = new Date(Date.now() + etaData.eta_minutes * 60000).toISOString();
      confidence = etaData.confidence;
      console.log('Dynamic waitlist ETA calculated:', etaData);
    }

    const { error } = await supabase
      .from("waitlist_entries")
      .insert({
        venue_id: venueId,
        customer_name: newCustomerName,
        party_size: parseInt(newPartySize),
        preferences,
        eta,
        status: "waiting",
        position: etaData?.position || null
      });

    if (error) {
      toast({
        title: "Error",
        description: "Could not add to waitlist",
        variant: "destructive"
      });
      return;
    }

    setNewCustomerName("");
    setNewPartySize("2");
    setNewPreferences("");
    toast({
      title: "Added to Waitlist",
      description: `${newCustomerName} added to waitlist. ETA: ${etaData?.eta_minutes || 20}m (${confidence} confidence)`,
    });
  };

  const getStatusColor = (status: WaitlistEntry["status"]) => {
    switch (status) {
      case "waiting": return "bg-blue-500";
      case "ready": return "bg-green-500";
      case "seated": return "bg-gray-500";
      case "no_show": return "bg-red-500";
      case "cancelled": return "bg-orange-500";
      default: return "bg-gray-500";
    }
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return "No ETA set";
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", { 
      hour: "2-digit", 
      minute: "2-digit",
      hour12: false 
    });
  };

  const getMinutesLeft = (eta: string | null) => {
    if (!eta) return 0;
    const diff = new Date(eta).getTime() - new Date().getTime();
    const minutes = Math.ceil(diff / (1000 * 60));
    return minutes;
  };

  const getWaitTime = (createdAt: string) => {
    const diff = new Date().getTime() - new Date(createdAt).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    return `${minutes}m`;
  };

  const sortedWaitlist = [...waitlist].sort((a, b) => {
    if (a.status === "ready" && b.status !== "ready") return -1;
    if (b.status === "ready" && a.status !== "ready") return 1;
    if (a.status === "waiting" && b.status === "waiting") {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
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
                  <SelectContent className="bg-background z-50">
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
                <CardTitle className="text-lg">{entry.customer_name}</CardTitle>
                <Badge className={`${getStatusColor(entry.status)} text-white`}>
                  {entry.status === "waiting" ? `#${entry.position || '?'}` : entry.status.replace("_", " ").toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users size={14} />
                  {entry.party_size}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  ETA: {formatTime(entry.eta)} ({getMinutesLeft(entry.eta)}m)
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {entry.preferences && entry.preferences.length > 0 && (
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="mt-0.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {entry.preferences.join(", ")}
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setETA(entry.id, 5)}
                    className="flex-1"
                  >
                    +5m
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setETA(entry.id, 10)}
                    className="flex-1"
                  >
                    +10m
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setETA(entry.id, 15)}
                    className="flex-1"
                  >
                    +15m
                  </Button>
                </div>

                <Select
                  value={entry.status}
                  onValueChange={(value) => updateEntryStatus(entry.id, value as WaitlistEntry["status"])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="waiting">Waiting</SelectItem>
                    <SelectItem value="ready">Table Ready</SelectItem>
                    <SelectItem value="seated">Seated</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="no_show">No Show</SelectItem>
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