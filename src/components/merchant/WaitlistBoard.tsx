import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, Users, Plus, MapPin, Calendar as CalendarIcon, AlertTriangle, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { invokeSupabaseFunctionWithTimeout } from "@/utils/invokeWithTimeout";
import { differenceInMinutes, format } from "date-fns";
import { cn } from "@/lib/utils";
import { TableExtensionReasonDialog } from "./TableExtensionReasonDialog";
import { initializeAudio } from "@/utils/notificationSound";

interface WaitlistEntry {
  id: string;
  customer_name: string;
  party_size: number;
  preferences?: string[];
  created_at: string;
  eta: string | null;
  original_eta?: string;
  status: "waiting" | "ready" | "seated" | "cancelled" | "no_show";
  position: number | null;
  venue_id: string;
  awaiting_merchant_confirmation?: boolean;
  patron_delayed?: boolean;
  delayed_until?: string | null;
  reservation_type?: string;
  reservation_time?: string | null;
  cancellation_reason?: string;
  cancelled_by?: string;
  ready_at?: string | null;
  linked_reservation_id?: string;
  assigned_table_id?: string;
}

export const WaitlistBoard = ({ venueId }: { venueId: string }) => {
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [todaysReservations, setTodaysReservations] = useState<WaitlistEntry[]>([]);
  const [tableConfiguration, setTableConfiguration] = useState<any[]>([]);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newPartySize, setNewPartySize] = useState("2");
  const [newPreferences, setNewPreferences] = useState("");
  const [addWaitlistDialogOpen, setAddWaitlistDialogOpen] = useState(false);
  const [isAddingWaitlist, setIsAddingWaitlist] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelEntryId, setCancelEntryId] = useState<string>("");
  const [cancelReason, setCancelReason] = useState("");
  const [noShowDialogOpen, setNoShowDialogOpen] = useState(false);
  const [noShowEntryId, setNoShowEntryId] = useState<string>("");
  const [noShowReason, setNoShowReason] = useState("");
  const [extensionDialogOpen, setExtensionDialogOpen] = useState(false);
  const [extensionEntryId, setExtensionEntryId] = useState<string>("");
  const { toast } = useToast();

  // Fetch table configuration and cancelled count
  useEffect(() => {
    const fetchVenueSettings = async () => {
      const { data } = await supabase
        .from('venues')
        .select('settings')
        .eq('id', venueId)
        .single();
      
      const settings = data?.settings as any;
      if (settings?.table_configuration) {
        setTableConfiguration(settings.table_configuration);
      }
    };

    fetchVenueSettings();
  }, [venueId]);

  // Fetch upcoming reservations (within 1 hour window)
  useEffect(() => {
    const fetchUpcomingReservations = async () => {
      const now = new Date();
      const oneHourBefore = new Date(now.getTime() - 60 * 60 * 1000);
      const futureTime = new Date(now.getTime() + 60 * 60 * 1000);

      const { data } = await supabase
        .from('waitlist_entries')
        .select('*')
        .eq('venue_id', venueId)
        .eq('reservation_type', 'reservation')
        .gte('reservation_time', oneHourBefore.toISOString())
        .lte('reservation_time', futureTime.toISOString())
        .in('status', ['waiting', 'ready'])
        .order('reservation_time', { ascending: true });

      setTodaysReservations(data || []);
    };

    fetchUpcomingReservations();
    
    // Set up real-time subscription for reservations
    const reservationChannel = supabase
      .channel('reservation-updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'waitlist_entries',
        filter: `venue_id=eq.${venueId},reservation_type=eq.reservation`
      }, () => {
        fetchUpcomingReservations();
      })
      .subscribe();
    
    const interval = setInterval(fetchUpcomingReservations, 60000);
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(reservationChannel);
    };
  }, [venueId]);

  // Fetch waitlist and set up real-time subscription
  useEffect(() => {
    // Initialize audio on mount
    initializeAudio();
    
    const fetchWaitlist = async () => {
      // Fetch waitlist entries for this venue
      // Exclude: seated and merchant-acknowledged entries
      // Include: no_show (auto-cancelled) for merchant to acknowledge
      const { data: waitlistData, error: waitlistError } = await supabase
        .from("waitlist_entries")
        .select("*")
        .eq("venue_id", venueId)
        .eq("merchant_acknowledged", false)
        .not("status", "eq", "seated")
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
        table: 'waitlist_entries',
        filter: `venue_id=eq.${venueId}`
      }, (payload) => {
        console.log('Waitlist change:', payload);
        
        if (payload.eventType === 'INSERT') {
          // Sound is now played globally from MerchantDashboard
          setWaitlist(prev => [...prev, payload.new as WaitlistEntry]);
          
        } else if (payload.eventType === 'UPDATE') {
          // Check if patron cancelled a ready table (show notification)
          if (payload.new.status === 'cancelled' && 
              payload.new.cancelled_by === 'patron' &&
              payload.old.status === 'ready') {
            
            toast({
              title: "⚠️ Patron Cancelled",
              description: `${payload.new.customer_name} cancelled their ready table (Party of ${payload.new.party_size})`,
              variant: "destructive",
            });
          }
          
          // Check if system auto-cancelled (no_show) - notify merchant
          if (payload.new.status === 'no_show' && 
              payload.new.cancelled_by === 'system' &&
              payload.old?.status === 'ready') {
            
            toast({
              title: "⏰ Auto-Cancelled (No Show)",
              description: `${payload.new.customer_name} didn't arrive in time - table released`,
              variant: "destructive",
            });
          }
          
          // Remove entry from list if it no longer matches display criteria
          const shouldRemove = 
            payload.new.status === 'seated' ||
            payload.new.merchant_acknowledged === true;
          
          if (shouldRemove) {
            setWaitlist(prev => prev.filter(entry => entry.id !== payload.new.id));
          } else {
            // Check if entry already exists in list
            setWaitlist(prev => {
              const exists = prev.some(entry => entry.id === payload.new.id);
              if (exists) {
                // Update the specific entry in local state with ALL fields from payload
                return prev.map(entry => 
                  entry.id === payload.new.id 
                    ? { ...entry, ...(payload.new as WaitlistEntry) }
                    : entry
                );
              } else {
                // Add no_show entry to list so merchant can acknowledge
                if (payload.new.status === 'no_show' && !payload.new.merchant_acknowledged) {
                  return [payload.new as WaitlistEntry, ...prev];
                }
                return prev;
              }
            });
          }
          
        } else if (payload.eventType === 'DELETE') {
          // Remove entry from local state
          setWaitlist(prev => prev.filter(entry => entry.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId, toast]);

  const confirmSeating = async (entryId: string) => {
    const { error } = await supabase
      .from("waitlist_entries")
      .update({ 
        status: 'seated',
        awaiting_merchant_confirmation: false 
      })
      .eq("id", entryId);

    if (error) {
      toast({
        title: "Error",
        description: "Could not confirm seating",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Seating Confirmed",
      description: "Patron will now be asked to rate their experience",
    });
  };

  const acknowledgeCancellation = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from('waitlist_entries')
        .update({ merchant_acknowledged: true })
        .eq('id', entryId);

      if (error) throw error;

      // Remove from local state after successful update
      setWaitlist(prevWaitlist => prevWaitlist.filter(entry => entry.id !== entryId));
      
      toast({
        title: "Acknowledged",
        description: "Patron cancellation has been acknowledged",
      });
    } catch (error: any) {
      console.error("Error acknowledging cancellation:", error);
      toast({
        title: "Error",
        description: "Failed to acknowledge cancellation",
        variant: "destructive"
      });
    }
  };

  const openCancelDialog = (entryId: string) => {
    setCancelEntryId(entryId);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  const cancelWaitlistEntry = async () => {
    if (!cancelEntryId || !cancelReason.trim()) {
      toast({
        title: "Cancellation Reason Required",
        description: "Please provide a reason for cancelling this reservation",
        variant: "destructive"
      });
      return;
    }

    // Find the entry being cancelled to check for linked reservations
    const entryToCancel = waitlist.find(e => e.id === cancelEntryId);
    const linkedReservationId = entryToCancel?.linked_reservation_id;

    // Find all linked entries if this is a multi-table booking
    const linkedEntryIds = linkedReservationId
      ? waitlist.filter(e => e.linked_reservation_id === linkedReservationId).map(e => e.id)
      : [cancelEntryId];

    // Optimistic update for all linked entries
    setWaitlist(prevWaitlist => 
      prevWaitlist.map(entry => 
        linkedEntryIds.includes(entry.id)
          ? { ...entry, status: "cancelled" as const, cancellation_reason: cancelReason } 
          : entry
      )
    );

    const { error } = await supabase
      .from("waitlist_entries")
      .update({ 
        status: "cancelled",
        cancellation_reason: linkedReservationId 
          ? `Linked reservation cancelled: ${cancelReason}`
          : `Cancelled: ${cancelReason}`,
        cancelled_by: "venue",
        updated_at: new Date().toISOString()
      })
      .in("id", linkedEntryIds);

    if (error) {
      toast({
        title: "Error",
        description: "Could not cancel waitlist entry",
        variant: "destructive"
      });
      // Revert by refetching
      const { data } = await supabase
        .from("waitlist_entries")
        .select("*")
        .eq("venue_id", venueId)
        .or("status.neq.seated,awaiting_merchant_confirmation.eq.true")
        .neq("status", "cancelled")
        .order("created_at", { ascending: true });
      if (data) {
        setWaitlist(data);
      }
      return;
    }

    toast({
      title: linkedReservationId ? "Linked Reservations Cancelled" : "Entry Cancelled",
      description: linkedReservationId 
        ? `Cancelled all ${linkedEntryIds.length} linked tables for this booking`
        : "Waitlist entry has been cancelled",
    });

    setCancelDialogOpen(false);
    setCancelEntryId("");
    setCancelReason("");
  };

  const openNoShowDialog = (entryId: string) => {
    setNoShowEntryId(entryId);
    setNoShowReason("");
    setNoShowDialogOpen(true);
  };

  const markAsNoShow = async () => {
    if (!noShowEntryId || !noShowReason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for marking as no show",
        variant: "destructive"
      });
      return;
    }

    // Find the entry being marked to check for linked reservations
    const entryToMark = [...waitlist, ...todaysReservations].find(e => e.id === noShowEntryId);
    const linkedReservationId = entryToMark?.linked_reservation_id;

    // Find all linked entries if this is a multi-table booking
    const linkedEntryIds = linkedReservationId
      ? [...waitlist, ...todaysReservations].filter(e => e.linked_reservation_id === linkedReservationId).map(e => e.id)
      : [noShowEntryId];

    // Optimistic update for all linked entries
    setWaitlist(prevWaitlist => 
      prevWaitlist.map(entry => 
        linkedEntryIds.includes(entry.id)
          ? { ...entry, status: "no_show" as const, cancellation_reason: `No show: ${noShowReason}` } 
          : entry
      )
    );

    setTodaysReservations(prevReservations =>
      prevReservations.map(entry =>
        linkedEntryIds.includes(entry.id)
          ? { ...entry, status: "no_show" as const, cancellation_reason: `No show: ${noShowReason}` }
          : entry
      )
    );

    const { error } = await supabase
      .from("waitlist_entries")
      .update({ 
        status: "no_show",
        cancellation_reason: linkedReservationId 
          ? `Linked reservation no-show: ${noShowReason}`
          : `No show: ${noShowReason}`,
        cancelled_by: "venue",
        updated_at: new Date().toISOString()
      })
      .in("id", linkedEntryIds);

    if (error) {
      toast({
        title: "Error",
        description: "Could not mark as no show",
        variant: "destructive"
      });
      // Revert optimistic update
      const { data } = await supabase
        .from("waitlist_entries")
        .select("*")
        .eq("venue_id", venueId)
        .or("status.neq.seated,awaiting_merchant_confirmation.eq.true")
        .neq("status", "cancelled")
        .order("created_at", { ascending: true });
      if (data) {
        setWaitlist(data);
      }
      return;
    }

    toast({
      title: linkedReservationId ? "Linked Reservations Marked as No Show" : "Marked as No Show",
      description: linkedReservationId 
        ? `Marked all ${linkedEntryIds.length} linked tables as no-show`
        : "Customer marked as no show",
    });

    // Reset dialog state
    setNoShowDialogOpen(false);
    setNoShowEntryId("");
    setNoShowReason("");
  };


  const setETA = async (entryId: string, minutes: number, reason: string) => {
    const entry = waitlist.find(e => e.id === entryId);
    if (!entry || !entry.eta) return;

    // Fetch venue settings to check max extension time
    const { data: venueData } = await supabase
      .from('venues')
      .select('settings')
      .eq('id', venueId)
      .single();

    const settings = venueData?.settings as any || {};
    const maxExtensionTime = settings.max_extension_time || 45;
    
    const currentEta = new Date(entry.eta);
    const originalEta = entry.original_eta ? new Date(entry.original_eta) : new Date(entry.eta);
    
    // Calculate total extension so far
    const currentExtension = Math.floor((currentEta.getTime() - originalEta.getTime()) / 60000);
    const newTotalExtension = currentExtension + minutes;
    
    // Check if we would exceed the maximum
    if (newTotalExtension > maxExtensionTime) {
      const remainingExtension = maxExtensionTime - currentExtension;
      toast({
        title: "Extension Limit Reached",
        description: remainingExtension > 0
          ? `Maximum extension time is ${maxExtensionTime} minutes. You can only add ${remainingExtension} more minutes.`
          : `Maximum extension time of ${maxExtensionTime} minutes has been reached.`,
        variant: "destructive"
      });
      return;
    }

    const newEta = new Date(currentEta.getTime() + minutes * 60000);

    // Optimistic update
    setWaitlist(prevWaitlist => 
      prevWaitlist.map(e => 
        e.id === entryId ? { ...e, eta: newEta.toISOString() } : e
      )
    );

    const { error } = await supabase
      .from("waitlist_entries")
      .update({ 
        eta: newEta.toISOString(),
        notes: `Extended: ${reason}`
      })
      .eq("id", entryId);

    if (error) {
      toast({
        title: "Error",
        description: "Could not update wait time",
        variant: "destructive"
      });
      // Revert optimistic update on error
      const { data } = await supabase
        .from("waitlist_entries")
        .select("*")
        .eq("venue_id", venueId)
        .neq("status", "seated")
        .order("created_at", { ascending: true });
      if (data) {
        setWaitlist(data);
      }
      return;
    }

    toast({
      title: "Wait Time Extended",
      description: `Customer will be notified of ${minutes} minute delay - ${reason}`,
    });
  };

  const openExtensionDialog = (entryId: string) => {
    setExtensionEntryId(entryId);
    setExtensionDialogOpen(true);
  };

  const handleExtensionConfirm = (minutes: number, reason: string) => {
    setETA(extensionEntryId, minutes, reason);
  };

  const updateEntryStatus = async (entryId: string, newStatus: WaitlistEntry["status"]) => {
    // If cancelled, show dialog
    if (newStatus === "cancelled") {
      openCancelDialog(entryId);
      return;
    }

    // Get current entry state to preserve important flags and check for linked reservations
    const currentEntry = [...waitlist, ...todaysReservations].find(e => e.id === entryId);
    const linkedReservationId = currentEntry?.linked_reservation_id;
    
    // Find all linked entries if this is a multi-table booking
    const linkedEntryIds = linkedReservationId
      ? [...waitlist, ...todaysReservations].filter(e => e.linked_reservation_id === linkedReservationId).map(e => e.id)
      : [entryId];
    
    // Prepare update object
    const updateData: any = { status: newStatus };
    
    // If marking as ready, set ready_at and ready_deadline (5 minutes from now)
    if (newStatus === "ready") {
      const now = new Date();
      const deadline = new Date(now.getTime() + 5 * 60000); // 5 minutes from now
      updateData.ready_at = now.toISOString();
      updateData.ready_deadline = deadline.toISOString();
      updateData.patron_delayed = false; // Reset delay flag
      
      // CRITICAL: Preserve awaiting_merchant_confirmation from current state
      if (currentEntry?.awaiting_merchant_confirmation) {
        updateData.awaiting_merchant_confirmation = true;
      }
    }
    
    // If marking as seated, always set awaiting_merchant_confirmation to false
    if (newStatus === "seated") {
      updateData.awaiting_merchant_confirmation = false;
    }

    // Optimistic update BEFORE database call to prevent flickering (both waitlist and reservations)
    setWaitlist(prevWaitlist => 
      prevWaitlist.map(entry => 
        linkedEntryIds.includes(entry.id) ? { ...entry, ...updateData } : entry
      )
    );

    setTodaysReservations(prevReservations =>
      prevReservations.map(entry =>
        linkedEntryIds.includes(entry.id) ? { ...entry, ...updateData } : entry
      )
    );

    const { error } = await supabase
      .from("waitlist_entries")
      .update(updateData)
      .in("id", linkedEntryIds);

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
        .or("status.neq.seated,awaiting_merchant_confirmation.eq.true")
        .neq("status", "cancelled")
        .order("created_at", { ascending: true });
      if (data) {
        setWaitlist(data);
      }
      return;
    }

    toast({
      title: linkedReservationId ? "Linked Reservations Updated" : "Waitlist Updated",
      description: linkedReservationId
        ? `All ${linkedEntryIds.length} linked tables marked as ${newStatus.replace("_", " ")}${newStatus === "ready" ? " - patron has 5 minutes" : ""}`
        : `Entry status changed to ${newStatus.replace("_", " ")}${newStatus === "ready" ? " - patron has 5 minutes" : ""}`,
    });
  };

  const getNextStatus = (currentStatus: WaitlistEntry["status"], isReservation: boolean): WaitlistEntry["status"] | null => {
    if (isReservation) {
      // Reservations: waiting → ready → seated
      switch (currentStatus) {
        case "waiting":
          return "ready";
        case "ready":
          return "seated";
        case "seated":
          return null; // Complete
        default:
          return null;
      }
    } else {
      // Walk-in waitlist: waiting → ready → seated
      switch (currentStatus) {
        case "waiting":
          return "ready";
        case "ready":
          return "seated";
        case "seated":
          return null; // Complete
        default:
          return null;
      }
    }
  };

  const getNextStatusLabel = (currentStatus: WaitlistEntry["status"]): string => {
    switch (currentStatus) {
      case "waiting":
        return "Table Ready";
      case "ready":
        return "Mark Seated";
      case "seated":
        return "Seated";
      default:
        return "";
    }
  };

  const getNextStatusButtonVariant = (currentStatus: WaitlistEntry["status"]) => {
    switch (currentStatus) {
      case "waiting":
        return "default";
      case "ready":
        return "default";
      default:
        return "secondary";
    }
  };

  const addToWaitlist = async () => {
    const customerName = newCustomerName.trim();
    const partySize = Number.parseInt(newPartySize, 10);

    if (!venueId) {
      toast({
        title: "Error",
        description: "Missing venue id",
        variant: "destructive",
      });
      return;
    }

    if (!customerName) {
      toast({
        title: "Customer name required",
        description: "Please enter a customer name.",
        variant: "destructive",
      });
      return;
    }

    if (!Number.isFinite(partySize) || partySize < 1 || partySize > 20) {
      toast({
        title: "Invalid party size",
        description: "Please choose a party size between 1 and 20.",
        variant: "destructive",
      });
      return;
    }

    const preferences = newPreferences
      ? newPreferences
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean)
          .slice(0, 10)
      : [];

    setIsAddingWaitlist(true);
    try {
      const { data: etaData, error: etaError, timedOut } =
        await invokeSupabaseFunctionWithTimeout<{
          eta_minutes: number;
          confidence?: string;
          position?: number;
        }>(
          "calculate-waitlist-eta",
          {
            venue_id: venueId,
            party_size: partySize,
            preferences,
          },
          6000,
        );

      let etaMinutes = 20;
      let confidence = "low";

      if (!etaError && etaData?.eta_minutes) {
        etaMinutes = etaData.eta_minutes;
        confidence = etaData.confidence ?? "low";
      } else {
        console.error("Error calculating waitlist ETA:", { etaError, timedOut });
      }

      const eta = new Date(Date.now() + etaMinutes * 60000).toISOString();

      const { error } = await supabase.from("waitlist_entries").insert({
        venue_id: venueId,
        customer_name: customerName,
        party_size: partySize,
        preferences,
        eta,
        original_eta: eta,
        status: "waiting",
        position: etaData?.position ?? null,
      });

      if (error) {
        console.error("Error inserting waitlist entry:", error);
        toast({
          title: "Error",
          description: "Could not add to waitlist",
          variant: "destructive",
        });
        return;
      }

      setNewCustomerName("");
      setNewPartySize("2");
      setNewPreferences("");
      setAddWaitlistDialogOpen(false);
      toast({
        title: "Added to Waitlist",
        description: `${customerName} added to waitlist. ETA: ${etaMinutes}m (${confidence} confidence)`,
      });
    } finally {
      setIsAddingWaitlist(false);
    }
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
    // Highest priority: awaiting confirmation
    if (a.awaiting_merchant_confirmation && !b.awaiting_merchant_confirmation) return -1;
    if (b.awaiting_merchant_confirmation && !a.awaiting_merchant_confirmation) return 1;
    
    // Second priority: cancelled entries (needs acknowledgment)
    const aCancelled = a.status === "cancelled";
    const bCancelled = b.status === "cancelled";
    if (aCancelled && !bCancelled) return -1;
    if (bCancelled && !aCancelled) return 1;
    
    // Third priority: ready status
    if (a.status === "ready" && b.status !== "ready") return -1;
    if (b.status === "ready" && a.status !== "ready") return 1;
    
    // Otherwise by creation time
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return (
    <div className="space-y-6">
      {/* Upcoming Reservations Table */}
      {todaysReservations.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Upcoming Reservations (Next Hour)
                {todaysReservations.some(r => {
                  const timeUntil = differenceInMinutes(new Date(r.reservation_time!), new Date());
                  return timeUntil <= 10 && timeUntil >= 0;
                }) && (
                  <Badge className="bg-red-500 text-white animate-pulse">
                    ARRIVING SOON
                  </Badge>
                )}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Party Size</TableHead>
                  <TableHead>Preferences</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  // Group reservations by linked_reservation_id
                  const groupedReservations = todaysReservations.reduce((acc, reservation) => {
                    const key = reservation.linked_reservation_id || reservation.id;
                    if (!acc[key]) {
                      acc[key] = [];
                    }
                    acc[key].push(reservation);
                    return acc;
                  }, {} as Record<string, WaitlistEntry[]>);

                  // Render grouped reservations
                  return Object.values(groupedReservations).map((group) => {
                    const primaryReservation = group[0];
                    const isMultiTable = group.length > 1;
                    const totalPartySize = group.reduce((sum, r) => sum + r.party_size, 0);
                    
                    const timeUntil = differenceInMinutes(
                      new Date(primaryReservation.reservation_time!),
                      new Date()
                    );
                    const isNear = timeUntil <= 30 && timeUntil >= -15;
                    const isVeryNear = timeUntil <= 10 && timeUntil >= 0;
                    const nextStatus = getNextStatus(primaryReservation.status, true);

                    // Get table names
                    const tableNames = group
                      .map(r => {
                        const table = tableConfiguration.find(t => t.id === r.assigned_table_id);
                        return table ? table.name : r.assigned_table_id;
                      })
                      .filter(Boolean)
                      .join(" + ");

                    return (
                      <TableRow 
                        key={primaryReservation.linked_reservation_id || primaryReservation.id}
                        className={cn(
                          isVeryNear && "bg-red-50 dark:bg-red-950/30 animate-pulse",
                          isNear && !isVeryNear && "bg-yellow-50 dark:bg-yellow-950/30"
                        )}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <CalendarIcon size={14} className="text-muted-foreground" />
                            {format(new Date(primaryReservation.reservation_time!), 'HH:mm')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold">{primaryReservation.customer_name}</span>
                            {isMultiTable && tableNames && (
                              <span className="text-xs text-muted-foreground">{tableNames}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1">
                              <Users size={14} />
                              {totalPartySize}
                            </span>
                            {isMultiTable && (
                              <Badge variant="secondary" className="text-xs">
                                🔗 Multi-Table
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {primaryReservation.preferences && primaryReservation.preferences.length > 0
                            ? primaryReservation.preferences.join(", ")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge className={getStatusColor(primaryReservation.status)}>
                              {primaryReservation.status.replace("_", " ").toUpperCase()}
                            </Badge>
                            {isVeryNear && primaryReservation.status === "waiting" && (
                              <Badge className="bg-red-500 text-white text-xs">
                                {timeUntil > 0 ? `${timeUntil}m left` : "NOW"}
                              </Badge>
                            )}
                            {isNear && !isVeryNear && primaryReservation.status === "waiting" && (
                              <Badge className="bg-yellow-500 text-white text-xs">
                                In {timeUntil}m
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {primaryReservation.status !== "seated" && (
                              <Button
                                size="sm"
                                onClick={() => updateEntryStatus(primaryReservation.id, nextStatus)}
                                className="text-xs"
                              >
                                {nextStatus === "ready" ? "Mark Ready" : "Mark Seated"}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setCancelEntryId(primaryReservation.id);
                                setCancelDialogOpen(true);
                              }}
                              className="text-xs"
                            >
                              Cancel
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Regular Waitlist Section */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Walk-in Waitlist</h2>
        <div className="flex gap-2">
          <Dialog open={addWaitlistDialogOpen} onOpenChange={setAddWaitlistDialogOpen}>
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
              <Button onClick={addToWaitlist} className="w-full" disabled={isAddingWaitlist}>
                {isAddingWaitlist ? "Adding…" : "Add to Waitlist"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedWaitlist
          .filter(entry => entry.reservation_type !== 'reservation')
          .map((entry) => (
          <Card key={entry.id} className={cn(
            "shadow-card",
            entry.status === "cancelled" && "border-2 border-destructive bg-destructive/5"
          )}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{entry.customer_name}</CardTitle>
                <div className="flex flex-col gap-1 items-end">
                  <Badge className={`${getStatusColor(entry.status)} text-white`}>
                    {entry.status === "waiting" ? `#${entry.position || '?'}` : entry.status.replace("_", " ").toUpperCase()}
                  </Badge>
                  {entry.awaiting_merchant_confirmation && entry.status === "ready" && (
                    <Badge className="bg-orange-500 text-white animate-pulse text-xs font-bold shadow-lg">
                      🔔 PATRON HERE - ACTION REQUIRED
                    </Badge>
                  )}
                  {entry.patron_delayed && entry.status === "ready" && (
                    <Badge className="bg-yellow-500 text-white text-xs">
                      NEEDS 5 MIN
                    </Badge>
                  )}
                  {entry.status === "cancelled" && entry.cancelled_by === "patron" && (
                    <Badge className="bg-destructive text-white animate-pulse text-xs">
                      PATRON CANCELLED
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users size={14} />
                  {entry.party_size}
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {getMinutesLeft(entry.eta)} min • ETA {formatTime(entry.eta)}
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
                {/* Cancelled or No Show entry - show acknowledge button */}
                {(entry.status === "cancelled" || entry.status === "no_show") && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-destructive font-semibold">
                      <AlertTriangle className="h-5 w-5" />
                      <span>
                        {entry.status === "no_show" 
                          ? (entry.cancelled_by === "system" ? "Auto-Cancelled (No Show)" : "No Show")
                          : (entry.cancelled_by === "patron" ? "Patron Cancelled" : "Cancelled")
                        }
                      </span>
                    </div>
                    {entry.cancellation_reason && (
                      <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                        <p className="text-sm text-foreground">"{entry.cancellation_reason}"</p>
                      </div>
                    )}
                    {entry.status === "no_show" && entry.cancelled_by === "system" && (
                      <p className="text-xs text-muted-foreground">
                        Patron didn't arrive within the time limit. Table has been released.
                      </p>
                    )}
                    <Button
                      onClick={() => acknowledgeCancellation(entry.id)}
                      variant="destructive"
                      className="w-full"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Acknowledge & Dismiss
                    </Button>
                  </div>
                )}
                
                {/* Normal entry actions - hide for cancelled and no_show entries */}
                {entry.status !== "cancelled" && entry.status !== "no_show" && (
                  <>
                    {entry.awaiting_merchant_confirmation && entry.status === "ready" && (
                      <Button
                        onClick={() => confirmSeating(entry.id)}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        ✓ Confirm Patron Seated
                      </Button>
                    )}
                
                {/* Extension button - only for waiting status */}
                {entry.status === "waiting" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openExtensionDialog(entry.id)}
                  >
                    <Clock className="h-4 w-4 mr-1" />
                    Extend Wait
                  </Button>
                )}

                <div className="space-y-2">
                  {/* Main action button - progressive status flow */}
                  {getNextStatus(entry.status, entry.reservation_type === 'reservation') && (
                    <Button
                      onClick={() => {
                        const nextStatus = getNextStatus(entry.status, entry.reservation_type === 'reservation');
                        if (nextStatus) {
                          updateEntryStatus(entry.id, nextStatus);
                        }
                      }}
                      className="w-full"
                      variant={getNextStatusButtonVariant(entry.status) as any}
                    >
                      {getNextStatusLabel(entry.status)}
                    </Button>
                  )}
                  
                  {/* Secondary actions row */}
                  <div className="flex gap-2">
                    {/* Cancel button - always available except for completed statuses */}
                    {!['seated', 'cancelled', 'no_show'].includes(entry.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openCancelDialog(entry.id)}
                        className="flex-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                      >
                        Cancel
                      </Button>
                    )}
                    
                    {/* No Show button - only for ready status (customer should be arriving) */}
                    {entry.status === 'ready' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openNoShowDialog(entry.id)}
                        className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        No Show
                      </Button>
                    )}
                  </div>
                </div>
                </>
                )}
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

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Reservation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please provide a reason for cancelling this reservation. The customer will see this reason.
            </p>
            <div>
              <Label htmlFor="cancelReason">Cancellation Reason *</Label>
              <Textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g., No tables available, Kitchen closed, Customer no-show..."
                className="mt-2"
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCancelDialogOpen(false);
                  setCancelEntryId("");
                  setCancelReason("");
                }}
                className="flex-1"
              >
                Keep Reservation
              </Button>
              <Button
                variant="destructive"
                onClick={cancelWaitlistEntry}
                disabled={!cancelReason.trim()}
                className="flex-1"
              >
                Cancel Reservation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* No Show Dialog */}
      <Dialog open={noShowDialogOpen} onOpenChange={setNoShowDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as No Show</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please provide details about the no-show. This helps improve future wait time estimates.
            </p>
            <div>
              <Label htmlFor="noShowReason">No Show Details *</Label>
              <Textarea
                id="noShowReason"
                value={noShowReason}
                onChange={(e) => setNoShowReason(e.target.value)}
                placeholder="e.g., Called and couldn't reach, Waited 15 mins past ready time, Left before seating..."
                className="mt-2"
                rows={4}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setNoShowDialogOpen(false);
                  setNoShowEntryId("");
                  setNoShowReason("");
                }}
                className="flex-1"
              >
                Go Back
              </Button>
              <Button
                onClick={markAsNoShow}
                disabled={!noShowReason.trim()}
                variant="destructive"
                className="flex-1"
              >
                Confirm No Show
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <TableExtensionReasonDialog
        open={extensionDialogOpen}
        onOpenChange={setExtensionDialogOpen}
        onConfirm={handleExtensionConfirm}
        title="Extend Wait Time"
        description="Select extension time and provide a reason for the customer"
      />
    </div>
  );
};