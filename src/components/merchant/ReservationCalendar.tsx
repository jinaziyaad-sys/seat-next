import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format, isSameDay, formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Users, Utensils, X, Pencil, Bell, Check, Phone, XCircle, MessageSquare } from "lucide-react";
import { EditReservationDialog } from "@/components/EditReservationDialog";
import { useToast } from "@/hooks/use-toast";
import { Messenger } from "@/components/Messenger";
import { useMultipleUnreadMessages } from "@/hooks/useUnreadMessages";

interface Reservation {
  id: string;
  customer_name: string;
  customer_phone?: string;
  party_size: number;
  reservation_time: string;
  status: string;
  preferences?: string[];
  notes?: string;
  assigned_table_id?: string;
  linked_reservation_id?: string;
  last_edited_at?: string;
  edit_summary?: string;
  venue_id: string;
}

interface TableOccupancy {
  table_id: string;
  party_size: number;
  customer_name: string;
  reservation_time: string;
}

export const ReservationCalendar = ({ venueId, venueName = "" }: { venueId: string; venueName?: string }) => {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [datesWithReservations, setDatesWithReservations] = useState<Date[]>([]);
  const [tableConfiguration, setTableConfiguration] = useState<any[]>([]);
  const [newReservations, setNewReservations] = useState<Reservation[]>([]);
  
  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReservationId, setCancelReservationId] = useState<string>("");
  const [cancelLinkedId, setCancelLinkedId] = useState<string | undefined>(undefined);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  
  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  
  // Venue settings for edit dialog
  const [venueSettings, setVenueSettings] = useState<any>(null);
  
  // Messenger state
  const [messengerOpen, setMessengerOpen] = useState(false);
  const [messengerReservation, setMessengerReservation] = useState<Reservation | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Track unread messages for all reservations
  const unreadCounts = useMultipleUnreadMessages(
    reservations.map(r => ({ waitlistEntryId: r.id })),
    'venue'
  );
  
  // Fetch current user
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    fetchVenueSettings();
    fetchReservationDates();
    fetchNewReservations();
  }, [venueId]);

  useEffect(() => {
    if (selectedDate) {
      fetchReservationsForDate(selectedDate);
    }
  }, [selectedDate, venueId]);

  // Real-time subscription for new reservations
  useEffect(() => {
    const channel = supabase
      .channel('new-reservations-alert')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'waitlist_entries',
        filter: `venue_id=eq.${venueId}`
      }, (payload) => {
        const newEntry = payload.new as any;
        if (newEntry.reservation_type === 'reservation' && !newEntry.merchant_seen) {
          setNewReservations(prev => [{
            id: newEntry.id,
            customer_name: newEntry.customer_name,
            customer_phone: newEntry.customer_phone || undefined,
            party_size: newEntry.party_size,
            reservation_time: newEntry.reservation_time,
            status: newEntry.status,
            preferences: newEntry.preferences,
            notes: newEntry.notes || undefined,
            assigned_table_id: newEntry.assigned_table_id,
            linked_reservation_id: newEntry.linked_reservation_id,
            last_edited_at: newEntry.last_edited_at,
            edit_summary: newEntry.edit_summary,
            venue_id: newEntry.venue_id,
          }, ...prev]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [venueId]);

  const fetchNewReservations = async () => {
    const { data } = await supabase
      .from('waitlist_entries')
      .select('*')
      .eq('venue_id', venueId)
      .eq('reservation_type', 'reservation')
      .eq('merchant_seen', false)
      .in('status', ['waiting', 'ready'])
      .order('created_at', { ascending: false });

    if (data) {
      setNewReservations(data.map(entry => ({
        id: entry.id,
        customer_name: entry.customer_name,
        customer_phone: entry.customer_phone || undefined,
        party_size: entry.party_size,
        reservation_time: entry.reservation_time || '',
        status: entry.status,
        preferences: entry.preferences || undefined,
        notes: entry.notes || undefined,
        assigned_table_id: entry.assigned_table_id || undefined,
        linked_reservation_id: entry.linked_reservation_id || undefined,
        last_edited_at: entry.last_edited_at || undefined,
        edit_summary: entry.edit_summary || undefined,
        venue_id: entry.venue_id,
      })));
    }
  };

  // Group newReservations by linked_reservation_id (standalone entries use their own id)
  const groupedNewReservations = (() => {
    const groups = new Map<string, Reservation[]>();
    for (const r of newReservations) {
      const key = r.linked_reservation_id || r.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    return Array.from(groups.entries()).map(([groupKey, entries]) => ({
      groupKey,
      representative: entries[0],
      allIds: entries.map(e => e.id),
    }));
  })();

  const acknowledgeReservation = async (groupKey: string, allIds: string[]) => {
    await supabase
      .from('waitlist_entries')
      .update({ merchant_seen: true })
      .in('id', allIds);
    
    const idSet = new Set(allIds);
    setNewReservations(prev => prev.filter(r => !idSet.has(r.id)));
  };

  const acknowledgeAllReservations = async () => {
    const ids = newReservations.map(r => r.id);
    if (ids.length === 0) return;
    
    await supabase
      .from('waitlist_entries')
      .update({ merchant_seen: true })
      .in('id', ids);
    
    setNewReservations([]);
  };

  const fetchVenueSettings = async () => {
    const { data } = await supabase
      .from('venues')
      .select('settings')
      .eq('id', venueId)
      .single();

    if (data?.settings) {
      const settings = data.settings as any;
      setTableConfiguration(settings.table_configuration || []);
      setVenueSettings(settings);
    }
  };

  const fetchReservationDates = async () => {
    const { data } = await supabase
      .from('waitlist_entries')
      .select('reservation_time')
      .eq('venue_id', venueId)
      .eq('reservation_type', 'reservation')
      .gte('reservation_time', new Date().toISOString())
      .not('status', 'in', '(cancelled,no_show)');

    if (data) {
      const dates = data
        .map(r => new Date(r.reservation_time))
        .filter((date, index, self) => 
          self.findIndex(d => isSameDay(d, date)) === index
        );
      setDatesWithReservations(dates);
    }
  };

  const fetchReservationsForDate = async (date: Date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data } = await supabase
      .from('waitlist_entries')
      .select('*')
      .eq('venue_id', venueId)
      .eq('reservation_type', 'reservation')
      .gte('reservation_time', startOfDay.toISOString())
      .lte('reservation_time', endOfDay.toISOString())
      .order('reservation_time', { ascending: true });

    setReservations(data || []);

    // If a reservation is edited/moved to another day, refresh the calendar markers
    // so the newly-booked day is highlighted without requiring a full page reload.
    fetchReservationDates();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "waiting": return "secondary";
      case "ready": return "default";
      case "seated": return "outline";
      case "cancelled": return "destructive";
      case "no_show": return "destructive";
      default: return "secondary";
    }
  };

  const handleClearReservation = async (reservationId: string, linkedReservationId?: string) => {
    try {
      if (linkedReservationId) {
        // Delete all linked entries for multi-table bookings
        await supabase
          .from('waitlist_entries')
          .delete()
          .eq('linked_reservation_id', linkedReservationId);
      } else {
        // Delete single entry
        await supabase
          .from('waitlist_entries')
          .delete()
          .eq('id', reservationId);
      }
      
      // Refresh the lists
      if (selectedDate) {
        fetchReservationsForDate(selectedDate);
      }
      fetchReservationDates();
    } catch (error) {
      console.error('Error clearing reservation:', error);
    }
  };

  // Cancel reservation handler
  const handleCancelReservation = async () => {
    if (!cancelReservationId || !cancelReason.trim()) return;
    
    setIsCancelling(true);
    try {
      const idsToCancel = cancelLinkedId 
        ? reservations.filter(r => r.linked_reservation_id === cancelLinkedId).map(r => r.id)
        : [cancelReservationId];
      
      await supabase
        .from('waitlist_entries')
        .update({
          status: 'cancelled',
          cancelled_by: 'venue',
          cancellation_reason: `Venue cancelled: ${cancelReason}`,
          updated_at: new Date().toISOString()
        })
        .in('id', idsToCancel);
      
      toast({
        title: "Reservation Cancelled",
        description: `The reservation has been cancelled.`,
      });
      
      setCancelDialogOpen(false);
      setCancelReason("");
      setCancelReservationId("");
      setCancelLinkedId(undefined);
      
      if (selectedDate) {
        fetchReservationsForDate(selectedDate);
      }
      fetchReservationDates();
    } catch (error) {
      console.error('Error cancelling reservation:', error);
      toast({
        title: "Error",
        description: "Failed to cancel reservation. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  // Open cancel dialog
  const openCancelDialog = (reservation: Reservation) => {
    setCancelReservationId(reservation.id);
    setCancelLinkedId(reservation.linked_reservation_id);
    setCancelDialogOpen(true);
  };

  // Open edit dialog
  const handleEditReservation = (reservation: Reservation) => {
    setEditingReservation(reservation);
    setEditDialogOpen(true);
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* New Reservations Alert Panel */}
      {newReservations.length > 0 && (
        <Card className="shadow-card border-2 border-primary bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-primary">
                <Bell className="h-5 w-5 animate-pulse" />
                New Reservations ({newReservations.length})
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={acknowledgeAllReservations}
              >
                <Check className="h-4 w-4 mr-1" />
                Acknowledge All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {newReservations.map((reservation) => (
              <div 
                key={reservation.id}
                className="flex items-center justify-between p-3 bg-background rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => acknowledgeReservation(reservation.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">📅</span>
                  <div>
                    <p className="font-medium">{reservation.customer_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Party of {reservation.party_size} • {format(new Date(reservation.reservation_time), 'MMM d @ HH:mm')}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Reservation Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
              modifiers={{
                booked: datesWithReservations
              }}
              modifiersStyles={{
                booked: { 
                  backgroundColor: 'hsl(var(--primary))',
                  color: 'white',
                  fontWeight: 'bold'
                }
              }}
            />
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>
              {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a date'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {reservations.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No reservations for this date
              </p>
            ) : (
              (() => {
                // Group reservations by linked_reservation_id
                const groupedReservations: { [key: string]: Reservation[] } = {};
                const standaloneReservations: Reservation[] = [];
                
                reservations.forEach(reservation => {
                  if (reservation.linked_reservation_id) {
                    if (!groupedReservations[reservation.linked_reservation_id]) {
                      groupedReservations[reservation.linked_reservation_id] = [];
                    }
                    groupedReservations[reservation.linked_reservation_id].push(reservation);
                  } else {
                    standaloneReservations.push(reservation);
                  }
                });

                return (
                  <>
                    {/* Render linked reservations as groups */}
                    {Object.entries(groupedReservations).map(([linkedId, linkedReservations]) => {
                      const firstRes = linkedReservations[0];
                      const tableNames = linkedReservations
                        .map(r => tableConfiguration.find(t => t.id === r.assigned_table_id)?.name || r.assigned_table_id)
                        .filter(Boolean)
                        .join(' + ');
                      
                      const isClearable = ['seated', 'cancelled', 'no_show'].includes(firstRes.status);
                      
                      return (
                        <Card 
                          key={linkedId} 
                          className={`p-4 border-2 ${
                            ['cancelled', 'no_show'].includes(firstRes.status)
                              ? 'border-destructive/50 opacity-60'
                              : firstRes.status === 'seated'
                                ? 'border-green-500/50 opacity-75'
                                : 'border-primary/30'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">🔗 Multi-Table Booking</Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-semibold">{firstRes.customer_name}</p>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                <span className="flex items-center gap-1">
                                  <Users size={14} />
                                  Party of {firstRes.party_size}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock size={14} />
                                  {format(new Date(firstRes.reservation_time), 'HH:mm')}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Utensils size={14} />
                                  {tableNames}
                                </span>
                              </div>
                              {firstRes.preferences && firstRes.preferences.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {firstRes.preferences.join(", ")}
                                </p>
                              )}
                              <p className="text-xs text-primary mt-1">
                                ℹ️ {linkedReservations.length} tables reserved together
                              </p>
                              {firstRes.last_edited_at && (
                                <div className="flex items-center gap-1 mt-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded border border-amber-200 dark:border-amber-800">
                                  <Pencil size={12} className="text-amber-600 dark:text-amber-400" />
                                  <span className="text-xs text-amber-700 dark:text-amber-300">
                                    Edited {formatDistanceToNow(new Date(firstRes.last_edited_at), { addSuffix: true })}
                                    {firstRes.edit_summary && `: ${firstRes.edit_summary}`}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Message button */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 relative"
                                onClick={() => {
                                  setMessengerReservation(firstRes);
                                  setMessengerOpen(true);
                                }}
                                title="Message patron"
                              >
                                <MessageSquare className="h-4 w-4" />
                                {(unreadCounts[firstRes.id] || 0) > 0 && (
                                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] text-destructive-foreground flex items-center justify-center">
                                    {unreadCounts[firstRes.id]}
                                  </span>
                                )}
                              </Button>
                              {/* Contact button */}
                              {firstRes.customer_phone && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  asChild
                                >
                                  <a href={`tel:${firstRes.customer_phone}`} title="Call patron">
                                    <Phone className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                              {/* Edit button */}
                              {['waiting', 'ready'].includes(firstRes.status) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEditReservation(firstRes)}
                                  title="Edit reservation"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {/* Cancel button */}
                              {['waiting', 'ready'].includes(firstRes.status) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => openCancelDialog(firstRes)}
                                  title="Cancel reservation"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <Badge variant={getStatusColor(firstRes.status)}>
                                {firstRes.status}
                              </Badge>
                              {isClearable && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleClearReservation(firstRes.id, linkedId)}
                                  title="Clear this booking"
                                >
                                  <X size={14} />
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}

                    {/* Render standalone reservations */}
                    {standaloneReservations.map((reservation) => {
                      const isClearable = ['seated', 'cancelled', 'no_show'].includes(reservation.status);
                      
                      return (
                        <Card 
                          key={reservation.id} 
                          className={`p-4 ${
                            ['cancelled', 'no_show'].includes(reservation.status)
                              ? 'border-destructive/50 opacity-60'
                              : reservation.status === 'seated'
                                ? 'border-green-500/50 opacity-75'
                                : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-semibold">{reservation.customer_name}</p>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                <span className="flex items-center gap-1">
                                  <Users size={14} />
                                  Party of {reservation.party_size}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock size={14} />
                                  {format(new Date(reservation.reservation_time), 'HH:mm')}
                                </span>
                                {reservation.assigned_table_id && (
                                  <span className="flex items-center gap-1">
                                    <Utensils size={14} />
                                    {tableConfiguration.find(t => t.id === reservation.assigned_table_id)?.name || reservation.assigned_table_id}
                                  </span>
                                )}
                              </div>
                              {reservation.preferences && reservation.preferences.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {reservation.preferences.join(", ")}
                                </p>
                              )}
                              {reservation.last_edited_at && (
                                <div className="flex items-center gap-1 mt-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded border border-amber-200 dark:border-amber-800">
                                  <Pencil size={12} className="text-amber-600 dark:text-amber-400" />
                                  <span className="text-xs text-amber-700 dark:text-amber-300">
                                    Edited {formatDistanceToNow(new Date(reservation.last_edited_at), { addSuffix: true })}
                                    {reservation.edit_summary && `: ${reservation.edit_summary}`}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Message button */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 relative"
                                onClick={() => {
                                  setMessengerReservation(reservation);
                                  setMessengerOpen(true);
                                }}
                                title="Message patron"
                              >
                                <MessageSquare className="h-4 w-4" />
                                {(unreadCounts[reservation.id] || 0) > 0 && (
                                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] text-destructive-foreground flex items-center justify-center">
                                    {unreadCounts[reservation.id]}
                                  </span>
                                )}
                              </Button>
                              {/* Contact button */}
                              {reservation.customer_phone && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  asChild
                                >
                                  <a href={`tel:${reservation.customer_phone}`} title="Call patron">
                                    <Phone className="h-4 w-4" />
                                  </a>
                                </Button>
                              )}
                              {/* Edit button */}
                              {['waiting', 'ready'].includes(reservation.status) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleEditReservation(reservation)}
                                  title="Edit reservation"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {/* Cancel button */}
                              {['waiting', 'ready'].includes(reservation.status) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() => openCancelDialog(reservation)}
                                  title="Cancel reservation"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <Badge variant={getStatusColor(reservation.status)}>
                                {reservation.status}
                              </Badge>
                              {isClearable && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleClearReservation(reservation.id)}
                                  title="Clear this reservation"
                                >
                                  <X size={14} />
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </>
                );
              })()
            )}
          </CardContent>
        </Card>
      </div>

      {/* Table Occupancy Grid */}
      {tableConfiguration.length > 0 && reservations.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Utensils className="h-5 w-5" />
              Table Occupancy - {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select a date'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {getTimeSlots().map(timeSlot => {
                const slotReservations = reservations.filter(r => {
                  const resTime = new Date(r.reservation_time);
                  const slotTime = new Date(selectedDate!);
                  const [hours, minutes] = timeSlot.split(':');
                  slotTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                  
                  // Check if reservation is within ±30 min window
                  const timeDiff = Math.abs(resTime.getTime() - slotTime.getTime());
                  return timeDiff <= 30 * 60 * 1000;
                });

                if (slotReservations.length === 0) return null;

                const occupiedTableIds = new Set(slotReservations.map(r => r.assigned_table_id).filter(Boolean));
                const totalSeats = slotReservations.reduce((sum, r) => sum + r.party_size, 0);

                return (
                  <div key={timeSlot} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-lg">{timeSlot}</h4>
                      <Badge variant="secondary">
                        {slotReservations.length} reservations • {totalSeats} guests
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {tableConfiguration.map(table => {
                        const reservation = slotReservations.find(r => r.assigned_table_id === table.id);
                        const isOccupied = occupiedTableIds.has(table.id);

                        return (
                          <Card 
                            key={table.id} 
                            className={`p-3 ${isOccupied ? 'bg-destructive/10 border-destructive' : 'bg-muted/30'}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-medium text-sm">{table.name}</p>
                              <Badge 
                                variant={isOccupied ? "destructive" : "secondary"}
                                className="text-xs"
                              >
                                {isOccupied ? "🔴 FULL" : "🟢 FREE"}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {table.capacity} seats
                            </p>
                            {reservation && (
                              <div className="mt-2 pt-2 border-t">
                                <p className="text-xs font-medium">{reservation.customer_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  Party of {reservation.party_size}
                                </p>
                              </div>
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cancel Reservation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Reservation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please provide a reason for cancelling. The customer will see this reason.
            </p>
            <Textarea
              placeholder="Reason for cancellation..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCancelDialogOpen(false)} className="flex-1">
                Keep Reservation
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleCancelReservation}
                disabled={!cancelReason.trim() || isCancelling}
                className="flex-1"
              >
                {isCancelling ? "Cancelling..." : "Cancel Reservation"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Reservation Dialog */}
      {editingReservation && (
        <EditReservationDialog
          open={editDialogOpen}
          onOpenChange={(open) => {
            setEditDialogOpen(open);
            if (!open) setEditingReservation(null);
          }}
          entry={{
            id: editingReservation.id,
            venue: venueName,
            venue_id: editingReservation.venue_id,
            party_size: editingReservation.party_size,
            reservation_time: editingReservation.reservation_time,
            preferences: editingReservation.preferences,
            notes: editingReservation.notes,
            customer_name: editingReservation.customer_name,
          }}
          venueSettings={venueSettings}
          onSuccess={() => {
            setEditDialogOpen(false);
            setEditingReservation(null);
            if (selectedDate) {
              fetchReservationsForDate(selectedDate);
            }
          }}
        />
      )}

      {/* Messenger component */}
      {messengerReservation && currentUserId && (
        <Messenger
          open={messengerOpen}
          onOpenChange={(open) => {
            setMessengerOpen(open);
            if (!open) setMessengerReservation(null);
          }}
          waitlistEntryId={messengerReservation.id}
          userType="venue"
          userId={currentUserId}
          customerName={messengerReservation.customer_name}
          venueName={venueName}
        />
      )}
    </div>
  );
};

// Helper to generate time slots (every 30 minutes from 11:00 to 22:00)
function getTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 11; hour <= 22; hour++) {
    slots.push(`${hour.toString().padStart(2, '0')}:00`);
    if (hour < 22) {
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
  }
  return slots;
}