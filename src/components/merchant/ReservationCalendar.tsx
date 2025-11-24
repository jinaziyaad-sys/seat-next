import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, isSameDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Users, Utensils } from "lucide-react";

interface Reservation {
  id: string;
  customer_name: string;
  party_size: number;
  reservation_time: string;
  status: string;
  preferences?: string[];
  assigned_table_id?: string;
}

interface TableOccupancy {
  table_id: string;
  party_size: number;
  customer_name: string;
  reservation_time: string;
}

export const ReservationCalendar = ({ venueId }: { venueId: string }) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [datesWithReservations, setDatesWithReservations] = useState<Date[]>([]);
  const [tableConfiguration, setTableConfiguration] = useState<any[]>([]);

  useEffect(() => {
    fetchVenueSettings();
    fetchReservationDates();
  }, [venueId]);

  useEffect(() => {
    if (selectedDate) {
      fetchReservationsForDate(selectedDate);
    }
  }, [selectedDate, venueId]);

  const fetchVenueSettings = async () => {
    const { data } = await supabase
      .from('venues')
      .select('settings')
      .eq('id', venueId)
      .single();

    if (data?.settings) {
      const settings = data.settings as any;
      setTableConfiguration(settings.table_configuration || []);
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
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "waiting": return "secondary";
      case "ready": return "default";
      case "seated": return "outline";
      default: return "secondary";
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6">
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
              reservations.map((reservation) => (
                <Card key={reservation.id} className="p-4">
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
                    </div>
                    <Badge variant={getStatusColor(reservation.status)}>
                      {reservation.status}
                    </Badge>
                  </div>
                </Card>
              ))
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