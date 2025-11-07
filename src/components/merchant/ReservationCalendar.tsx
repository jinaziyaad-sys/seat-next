import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, isSameDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Users } from "lucide-react";

interface Reservation {
  id: string;
  customer_name: string;
  party_size: number;
  reservation_time: string;
  status: string;
  preferences?: string[];
}

export const ReservationCalendar = ({ venueId }: { venueId: string }) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [datesWithReservations, setDatesWithReservations] = useState<Date[]>([]);

  useEffect(() => {
    fetchReservationDates();
  }, [venueId]);

  useEffect(() => {
    if (selectedDate) {
      fetchReservationsForDate(selectedDate);
    }
  }, [selectedDate, venueId]);

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
  );
};