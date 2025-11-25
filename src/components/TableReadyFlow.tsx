import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Users, Clock, CheckCircle, Search, MapPin, Loader2, Star, Calendar as CalendarIcon, XCircle, Navigation } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { sendBrowserNotification, vibratePhone, initializePushNotifications } from "@/utils/notifications";
import { checkVenueStatus, getAvailableReservationTimes } from "@/utils/businessHours";
import { calculateDistance, formatDistance, getUserLocation, type UserLocation } from "@/utils/geolocation";

type WaitlistStatus = "waiting" | "ready" | "seated" | "cancelled";
type DatabaseWaitlistStatus = "waiting" | "ready" | "seated" | "cancelled" | "no_show";

// Map database status to frontend status (no_show becomes cancelled on patron side)
const mapDatabaseStatus = (status: DatabaseWaitlistStatus): WaitlistStatus => {
  return status === "no_show" ? "cancelled" : status;
};

interface WaitlistEntry {
  id: string;
  venue: string;
  venue_id: string;
  party_size: number;
  position: number;
  eta: string | null;
  preferences?: string[];
  status: WaitlistStatus;
  awaiting_merchant_confirmation?: boolean;
  patron_delayed?: boolean;
  delayed_until?: string | null;
  reservation_type?: string;
  reservation_time?: string | null;
  cancellation_reason?: string;
  ready_at?: string | null;
  ready_deadline?: string | null;
  customer_name: string;
  cancelled_by?: string;
  updated_at: string;
  notes?: string;
}

const partyDetailsSchema = z.object({
  partyName: z.string().trim().min(1, "Party name is required").max(50, "Party name must be less than 50 characters"),
  partySize: z.number().int().min(1, "Party size must be at least 1").max(12, "Party size cannot exceed 12"),
});

// Helper to extract extension reason from notes (for future use if notes field is added)
const extractExtensionReason = (notes: string | null | undefined): string | null => {
  if (!notes) return null;
  const match = notes.match(/^Extended:\s*(.+)$/i);
  return match ? match[1].trim() : null;
};

export function TableReadyFlow({ onBack, initialEntry }: { onBack: () => void; initialEntry?: any }) {
  const { toast } = useToast();
  const [step, setStep] = useState<"venue-select" | "booking-type" | "reservation-details" | "party-details" | "waiting" | "ready" | "awaiting-confirmation" | "delayed-countdown" | "feedback" | "cancelled-details">("venue-select");
  const [selectedVenue, setSelectedVenue] = useState("");
  const [selectedVenueData, setSelectedVenueData] = useState<any>(null);
  const [bookingType, setBookingType] = useState<"now" | "later">("now");
  const [reservationDate, setReservationDate] = useState<Date | undefined>(undefined);
  const [reservationTime, setReservationTime] = useState<string>("");
  const [partyName, setPartyName] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [seatingPreference, setSeatingPreference] = useState<"indoor" | "outdoor" | "no-preference">("no-preference");
  const [waitlistEntry, setWaitlistEntry] = useState<WaitlistEntry | null>(null);
  const [venues, setVenues] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [countdownMinutes, setCountdownMinutes] = useState(5);
  const [countdownSeconds, setCountdownSeconds] = useState(0);
  const [partiesAhead, setPartiesAhead] = useState<any[]>([]);
  const [requiresMultipleTables, setRequiresMultipleTables] = useState(false);
  const [tablesNeeded, setTablesNeeded] = useState<any[]>([]);
  const [pendingReservationData, setPendingReservationData] = useState<any>(null);

  // Get authenticated user and initialize notifications
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
      
      // Initialize push notifications if user is logged in
      if (user?.id) {
        const FIREBASE_PROJECT_ID = 'cuoqjgahpfymxqrdlzlf'; // Use your Supabase project ID
        await initializePushNotifications(FIREBASE_PROJECT_ID);
      }
    };
    getUser();
  }, []);

  // Listen for merchant confirmation
  useEffect(() => {
    if (!waitlistEntry || step !== "awaiting-confirmation") return;

    const channel = supabase
      .channel(`waitlist-confirmation-${waitlistEntry.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'waitlist_entries',
        filter: `id=eq.${waitlistEntry.id}`
      }, (payload: any) => {
        console.log('Received update:', payload.new);
        if (payload.new.status === 'seated') {
          // Merchant confirmed seating - show rating screen
          console.log('Transitioning to feedback step');
          setStep("feedback");
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [waitlistEntry, step]);

  // Countdown timer - calculate from server-side deadline
  useEffect(() => {
    // Stop timer if patron confirmed arrival
    if (waitlistEntry?.awaiting_merchant_confirmation) {
      setCountdownMinutes(0);
      setCountdownSeconds(0);
      return;
    }

    if ((step !== "ready" && step !== "delayed-countdown") || !waitlistEntry?.ready_deadline) return;

    const updateCountdown = async () => {
      const now = new Date().getTime();
      const deadline = new Date(waitlistEntry.ready_deadline!).getTime();
      const timeLeft = deadline - now;

      if (timeLeft <= 0) {
        // Time expired - auto cancel the entry
      const { error } = await supabase
        .from('waitlist_entries')
        .update({
          status: 'no_show',
          cancellation_reason: 'Time expired - patron did not arrive within allocated time',
          cancelled_by: 'system'
        })
        .eq('id', waitlistEntry.id);

        if (!error) {
          setWaitlistEntry(prev => prev ? {
            ...prev,
            status: 'cancelled',
            cancellation_reason: 'Time expired - patron did not arrive within allocated time'
          } : null);

          toast({
            title: "Booking Cancelled",
            description: "Your table reservation has been cancelled because you didn't arrive in time.",
            variant: "destructive"
          });

          sendBrowserNotification(
            "Waitlist Cancelled",
            "Your table was released because you didn't arrive in time. Please join the waitlist again if needed."
          );
        }
        
        setCountdownMinutes(0);
        setCountdownSeconds(0);
        return;
      }

      const minutes = Math.floor(timeLeft / 60000);
      const seconds = Math.floor((timeLeft % 60000) / 1000);
      setCountdownMinutes(minutes);
      setCountdownSeconds(seconds);
    };

    // Update immediately
    updateCountdown();
    
    // Then update every second
    const timer = setInterval(updateCountdown, 1000);

    return () => clearInterval(timer);
  }, [step, waitlistEntry?.ready_deadline, waitlistEntry?.id, waitlistEntry?.awaiting_merchant_confirmation, toast]);

  // Handle initial entry from home page
  useEffect(() => {
    if (initialEntry) {
      const entry: WaitlistEntry = {
        id: initialEntry.id,
        venue: initialEntry.venues?.name || "",
        venue_id: initialEntry.venue_id,
        party_size: initialEntry.party_size,
        position: initialEntry.position || 0,
        eta: initialEntry.eta,
        preferences: initialEntry.preferences || [],
        status: mapDatabaseStatus(initialEntry.status),
        awaiting_merchant_confirmation: initialEntry.awaiting_merchant_confirmation,
        cancellation_reason: initialEntry.cancellation_reason || undefined,
        ready_at: initialEntry.ready_at,
        ready_deadline: initialEntry.ready_deadline,
        patron_delayed: initialEntry.patron_delayed,
        customer_name: initialEntry.customer_name,
        cancelled_by: initialEntry.cancelled_by,
        updated_at: initialEntry.updated_at,
        notes: initialEntry.notes,
      };
      setWaitlistEntry(entry);
      
      // Check if entry is cancelled and show details view
      if (entry.status === 'cancelled') {
        setStep("cancelled-details");
      } else {
        // Set appropriate step based on status
        if (initialEntry.status === "ready") {
          setStep("ready");
        } else if (initialEntry.status === "cancelled" || initialEntry.status === "no_show") {
          // Don't set step - let the component render based on status check
          // The cancelled screen is shown via: if (waitlistEntry?.status === "cancelled")
        } else {
          setStep("waiting");
        }
      }

      // Set up real-time subscription
      const channel = supabase
        .channel(`waitlist-${initialEntry.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'waitlist_entries',
          filter: `id=eq.${initialEntry.id}`
        }, (payload) => {
          if (payload.new) {
            setWaitlistEntry(prev => prev ? {
              ...prev,
              status: mapDatabaseStatus(payload.new.status),
              eta: payload.new.eta,
              position: payload.new.position,
              cancellation_reason: payload.new.cancellation_reason || undefined,
              ready_at: payload.new.ready_at,
              ready_deadline: payload.new.ready_deadline,
              patron_delayed: payload.new.patron_delayed,
              cancelled_by: payload.new.cancelled_by,
              updated_at: payload.new.updated_at,
              notes: payload.new.notes,
            } : null);
            
            if (payload.new.status === "ready") {
              setStep("ready");
              
              // Send browser notification and vibrate
              sendBrowserNotification(
                "🍽️ Your Table is Ready!",
                "Please proceed to the venue to be seated",
                { tag: 'table-ready', requireInteraction: true }
              );
              vibratePhone([200, 100, 200, 100, 200]);
            } else if (payload.new.status === "cancelled" || payload.new.status === "no_show") {
              setStep("cancelled-details");
            }
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [initialEntry]);

  // Fetch venues on component mount - only show table_ready venues with full settings
  useEffect(() => {
    const fetchVenues = async () => {
      setIsLoading(true);
      
      // Try to get user location
      try {
        const location = await getUserLocation();
        setUserLocation(location);
      } catch (error) {
        console.log('Location access not granted, showing all venues');
      }
      
      const { data, error } = await supabase
        .from("venues")
        .select("id, name, address, display_address, service_types, settings, waitlist_preferences, latitude, longitude")
        .contains("service_types", ["table_ready"])
        .order("name");
      
      if (data && !error) {
        // Add mock wait times for display
        const venuesWithWait = data.map(venue => ({
          ...venue,
          waitTime: "15-20 min",
          tables: Math.floor(Math.random() * 5)
        }));
        setVenues(venuesWithWait);
      }
      setIsLoading(false);
    };

    fetchVenues();
  }, []);

  // Subscribe to venue-wide waitlist changes to update position in real-time
  useEffect(() => {
    if (!waitlistEntry || !selectedVenueData?.id) return;

    const channel = supabase
      .channel('venue-waitlist-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waitlist_entries',
          filter: `venue_id=eq.${selectedVenueData.id}`
        },
        async () => {
          // Refetch the current entry to get updated position
          const { data } = await supabase
            .from('waitlist_entries')
            .select('position')
            .eq('id', waitlistEntry.id)
            .single();
          
          if (data) {
            setWaitlistEntry(prev => prev ? { ...prev, position: data.position } : null);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [waitlistEntry?.id, selectedVenueData?.id]);

  // Fetch and subscribe to parties ahead in the queue
  useEffect(() => {
    if (!waitlistEntry || !selectedVenueData?.id || waitlistEntry.status !== 'waiting') {
      setPartiesAhead([]);
      return;
    }

    const fetchPartiesAhead = async () => {
      const { data } = await supabase
        .from('waitlist_entries')
        .select('id, customer_name, party_size, position, eta, created_at')
        .eq('venue_id', selectedVenueData.id)
        .eq('status', 'waiting')
        .lt('position', waitlistEntry.position)
        .order('position', { ascending: true });
      
      if (data) setPartiesAhead(data);
    };

    fetchPartiesAhead();

    const channel = supabase
      .channel('parties-ahead-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waitlist_entries',
          filter: `venue_id=eq.${selectedVenueData.id}`
        },
        () => fetchPartiesAhead()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [waitlistEntry?.position, waitlistEntry?.status, selectedVenueData?.id]);

  const filteredVenues = venues
    .filter(venue => 
      venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (venue.address && venue.address.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .map(venue => ({
      ...venue,
      distance: userLocation && venue.latitude && venue.longitude
        ? calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            venue.latitude,
            venue.longitude
          )
        : undefined
    }))
    .sort((a, b) => {
      // Sort by distance if available, otherwise keep original order
      if (a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance;
      }
      if (a.distance !== undefined) return -1;
      if (b.distance !== undefined) return 1;
      return 0;
    });


  const handleVenueSelect = (venueId: string) => {
    const venue = venues.find(v => v.id === venueId);
    if (venue) {
      // Check venue status for walk-in (we'll check again for reservations after date selection)
      const status = checkVenueStatus(
        venue.settings?.business_hours || {},
        venue.settings?.holiday_closures || [],
        venue.settings?.grace_periods || { last_order: 15, last_reservation: 0, last_waitlist_join: 30 },
        'waitlist'
      );
      
      if (!status.is_open && bookingType === 'now') {
        toast({
          title: "Venue Closed",
          description: status.message,
          variant: "destructive"
        });
      } else if (status.message.includes('Closing soon') && bookingType === 'now') {
        toast({
          title: "Notice",
          description: status.message,
        });
      }
      
      setSelectedVenue(venue.name);
      setSelectedVenueData(venue);
      setStep("booking-type");
    }
  };

  const togglePreference = (pref: string) => {
    const mutuallyExclusiveGroups = [
      ['Indoor Seating', 'Outdoor Seating']
    ];
    
    setPreferences(prev => {
      if (prev.includes(pref)) {
        // Deselect
        return prev.filter(p => p !== pref);
      } else {
        // Select - but first check if it's mutually exclusive
        let newPrefs = [...prev, pref];
        
        for (const group of mutuallyExclusiveGroups) {
          if (group.includes(pref)) {
            // Remove other options in the same group
            newPrefs = newPrefs.filter(p => !group.includes(p) || p === pref);
          }
        }
        
        return newPrefs;
      }
    });
  };

  const handleJoinWaitlist = async () => {
    // Check if user is authenticated
    if (!userId) {
      toast({
        title: "Registration Required",
        description: "Please create an account to join the waitlist and track your position.",
        variant: "default",
        action: (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.location.href = '/auth'}
          >
            Sign Up
          </Button>
        ),
      });
      return;
    }

    // Validate inputs
    const validation = partyDetailsSchema.safeParse({ partyName, partySize });
    if (!validation.success) {
      toast({
        title: "Validation Error",
        description: validation.error.errors[0].message,
        variant: "destructive"
      });
      return;
    }
    
    const venue = venues.find(v => v.name === selectedVenue);
    if (!venue) {
      toast({
        title: "Error",
        description: "Selected venue not found. Please try again.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    // Build preferences array with seating preference
    const finalPreferences = [...preferences];
    if (seatingPreference === "indoor") {
      finalPreferences.push("Indoor seating");
    } else if (seatingPreference === "outdoor") {
      finalPreferences.push("Outdoor seating");
    }

    try {
      let insertData: any = {
        venue_id: venue.id,
        customer_name: partyName.trim(),
        party_size: partySize,
        preferences: finalPreferences,
        status: "waiting",
        user_id: userId
      };

      if (bookingType === "later" && reservationDate && reservationTime) {
        const [hours, minutes] = reservationTime.split(':').map(Number);
        const reservationDateTime = new Date(reservationDate);
        reservationDateTime.setHours(hours, minutes, 0, 0);

        // Check for existing reservations (duplicate prevention)
        const bufferMinutes = 30;
        const startTime = new Date(reservationDateTime.getTime() - bufferMinutes * 60000).toISOString();
        const endTime = new Date(reservationDateTime.getTime() + bufferMinutes * 60000).toISOString();
        
        const { data: existingReservations } = await supabase
          .from('waitlist_entries')
          .select('id, reservation_time, customer_name, party_size')
          .eq('user_id', userId)
          .eq('venue_id', venue.id)
          .eq('reservation_type', 'reservation')
          .in('status', ['waiting', 'ready'])
          .gte('reservation_time', startTime)
          .lte('reservation_time', endTime);

        if (existingReservations && existingReservations.length > 0) {
          const existingTime = format(new Date(existingReservations[0].reservation_time), 'h:mm a');
          toast({
            title: "Duplicate Booking Detected",
            description: `You already have a reservation at ${existingTime} for ${existingReservations[0].party_size} people.`,
            variant: "destructive"
          });
          return;
        }

        // Check table availability for reservations
        const { data: availabilityData, error: availError } = await supabase.functions.invoke(
          'find-available-table',
          {
            body: {
              venue_id: venue.id,
              reservation_time: reservationDateTime.toISOString(),
              party_size: partySize
            }
          }
        );

        if (availError) {
          console.error('Error checking availability:', availError);
          toast({
            title: "Availability Check Failed",
            description: "Unable to verify table availability. Please try again.",
            variant: "destructive"
          });
          return;
        }

        console.log('📊 Availability response:', availabilityData);

        if (!availabilityData.available) {
          const nextSlotMessage = availabilityData.next_available_slot 
            ? `Next available: ${format(new Date(availabilityData.next_available_slot), 'h:mm a')}`
            : "No tables available today";
          
          toast({
            title: "No Tables Available",
            description: `${availabilityData.reason}. ${nextSlotMessage}`,
            variant: "destructive"
          });
          return;
        }

        // Handle multi-table bookings
        if (availabilityData.requires_multiple_tables) {
          console.log('🪑 Multi-table booking required:', {
            tablesNeeded: availabilityData.tables_needed,
            totalTables: availabilityData.total_tables,
            totalCapacity: availabilityData.total_capacity
          });
          setTablesNeeded(availabilityData.tables_needed);
          setPendingReservationData({
            venue,
            reservationDateTime,
            finalPreferences,
            partyName: partyName.trim(),
            partySize
          });
          console.log('✅ Setting requiresMultipleTables to true');
          setRequiresMultipleTables(true);
          return; // Stop here and show confirmation dialog
        }

        // Show utilization warning if inefficient
        if (availabilityData.warning) {
          toast({
            title: "Table Assignment",
            description: availabilityData.warning,
            variant: "default"
          });
        }

        insertData.reservation_type = 'reservation';
        insertData.reservation_time = reservationDateTime.toISOString();
        insertData.eta = reservationDateTime.toISOString();
        insertData.assigned_table_id = availabilityData.matched_table.id;
      } else {
        insertData.reservation_type = 'walk_in';
        insertData.eta = new Date(Date.now() + 18 * 60000).toISOString();
      }

      const { data: newEntry, error } = await supabase
        .from("waitlist_entries")
        .insert(insertData)
        .select()
        .single();

      // Wait a moment for trigger to complete, then refetch to get updated position
      if (newEntry && !error) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const { data: updatedEntry } = await supabase
          .from("waitlist_entries")
          .select('position')
          .eq('id', newEntry.id)
          .single();
        
        if (updatedEntry) {
          newEntry.position = updatedEntry.position;
        }
      }

      if (error) {
        console.error("Error joining waitlist:", error);
        toast({
          title: "Failed to Join Waitlist",
          description: error.message || "Unable to add you to the waitlist. Please try again.",
          variant: "destructive"
        });
        return;
      }

      if (newEntry) {
        const entry: WaitlistEntry = {
          id: newEntry.id,
          venue: selectedVenue,
          venue_id: newEntry.venue_id,
          party_size: newEntry.party_size,
          position: newEntry.position || 0,
          eta: newEntry.eta,
          preferences: newEntry.preferences || [],
          status: mapDatabaseStatus(newEntry.status),
          cancellation_reason: newEntry.cancellation_reason || undefined,
          customer_name: newEntry.customer_name,
          updated_at: newEntry.created_at,
        };
        setWaitlistEntry(entry);
        
        toast({
          title: "Added to Waitlist!",
          description: `You've been added to the waitlist at ${selectedVenue}.`
        });
        
        setStep("waiting");

        // Set up real-time subscription for this entry
        const channel = supabase
          .channel(`waitlist-${newEntry.id}`)
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'waitlist_entries', 
            filter: `id=eq.${newEntry.id}`
          }, (payload) => {
          if (payload.new) {
              setWaitlistEntry(prev => prev ? {
                ...prev,
                status: mapDatabaseStatus(payload.new.status),
                eta: payload.new.eta,
                position: payload.new.position,
                cancellation_reason: payload.new.cancellation_reason || undefined,
                cancelled_by: payload.new.cancelled_by,
                updated_at: payload.new.updated_at,
                notes: payload.new.notes,
              } : null);
              
              if (payload.new.status === "ready") {
                setStep("ready");
                
                // Send browser notification and vibrate
                sendBrowserNotification(
                  "🍽️ Your Table is Ready!",
                  "Please proceed to the venue to be seated",
                  { tag: 'table-ready', requireInteraction: true }
                );
                vibratePhone([200, 100, 200, 100, 200]);
              } else if (payload.new.status === "cancelled" || payload.new.status === "no_show") {
                setStep("cancelled-details");
              }
            }
          })
          .subscribe();

        return () => supabase.removeChannel(channel);
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      console.log('🔄 Resetting isSubmitting to false');
      setIsSubmitting(false);
    }
  };

  const handleConfirmMultiTableBooking = async () => {
    if (!pendingReservationData) return;
    
    setIsSubmitting(true);
    try {
      const { venue, reservationDateTime, finalPreferences, partyName, partySize } = pendingReservationData;
      const linkedId = crypto.randomUUID();
      
      // Create multiple reservation entries for all required tables
      const reservations = tablesNeeded.map(table => ({
        venue_id: venue.id,
        customer_name: partyName,
        party_size: partySize,
        preferences: finalPreferences,
        status: "waiting" as const,
        user_id: userId,
        reservation_type: 'reservation',
        reservation_time: reservationDateTime.toISOString(),
        eta: reservationDateTime.toISOString(),
        assigned_table_id: table.id,
        linked_reservation_id: linkedId
      }));

      console.log('📝 Creating multi-table booking with data:', reservations);

      const { data: newEntries, error } = await supabase
        .from("waitlist_entries")
        .insert(reservations)
        .select();

      if (error) {
        console.error("❌ Error creating multi-table booking:", error);
        toast({
          title: "Booking Failed",
          description: error.message || "Unable to create your reservation. Please try again.",
          variant: "destructive"
        });
        return;
      }

      console.log('✅ Multi-table booking created successfully:', newEntries);

      if (newEntries && newEntries.length > 0) {
        const entry: WaitlistEntry = {
          id: newEntries[0].id,
          venue: venue.name,
          venue_id: newEntries[0].venue_id,
          party_size: newEntries[0].party_size,
          position: 0,
          eta: newEntries[0].eta,
          preferences: newEntries[0].preferences || [],
          status: mapDatabaseStatus(newEntries[0].status),
          customer_name: newEntries[0].customer_name,
          updated_at: newEntries[0].created_at,
          reservation_type: 'reservation',
          reservation_time: newEntries[0].reservation_time
        };
        setWaitlistEntry(entry);
        
        const tableNames = tablesNeeded.map(t => t.name).join(' + ');
        toast({
          title: "Reservation Confirmed!",
          description: `Your party of ${partySize} has been booked at ${tableNames}.`
        });
        
        setRequiresMultipleTables(false);
        setTablesNeeded([]);
        setPendingReservationData(null);
        setStep("waiting");
      }
    } catch (err) {
      console.error("❌ Unexpected error in multi-table booking:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelMultiTableBooking = () => {
    setRequiresMultipleTables(false);
    setTablesNeeded([]);
    setPendingReservationData(null);
  };

  // Cancelled Waitlist Details View
  if (step === "cancelled-details" && waitlistEntry) {
    return (
      <Card className="max-w-md mx-auto shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Table Booking Cancelled</CardTitle>
            <Badge variant="destructive">
              Cancelled by {waitlistEntry.cancelled_by === 'patron' ? 'You' : waitlistEntry.cancelled_by === 'system' ? 'System' : 'Venue'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Customer Name</p>
            <p className="font-semibold">{waitlistEntry.customer_name}</p>
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground">Party Size</p>
            <p className="font-semibold">{waitlistEntry.party_size} {waitlistEntry.party_size === 1 ? 'person' : 'people'}</p>
          </div>
          
          {waitlistEntry.cancellation_reason && (
            <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
              <p className="text-sm font-semibold mb-1">Cancellation Reason:</p>
              <p className="text-sm">{waitlistEntry.cancellation_reason}</p>
            </div>
          )}
          
          <div>
            <p className="text-sm text-muted-foreground">Cancelled on</p>
            <p className="text-sm">{format(new Date(waitlistEntry.updated_at), 'MMM dd, yyyy @ h:mm a')}</p>
          </div>
          
          <Button onClick={onBack} className="w-full">Close</Button>
        </CardContent>
      </Card>
    );
  }

  const handleCancelBooking = async () => {
    if (!waitlistEntry) return;

    const { error } = await supabase
      .from("waitlist_entries")
      .update({ 
        status: "cancelled",
        cancelled_by: "patron"
      })
      .eq("id", waitlistEntry.id);

    if (!error) {
      setWaitlistEntry(prev => prev ? { 
        ...prev, 
        status: "cancelled",
        cancelled_by: "patron"
      } : null);
      setTimeout(() => {
        onBack();
      }, 1500);
    }
  };

  const handleConfirmSeat = async () => {
    if (!waitlistEntry) return;
    
    // Set flag for merchant to confirm and clear deadline since patron is here
    const { error } = await supabase
      .from('waitlist_entries')
      .update({ 
        awaiting_merchant_confirmation: true,
        ready_deadline: null
      })
      .eq('id', waitlistEntry.id);

    if (!error) {
      setWaitlistEntry(prev => prev ? { 
        ...prev, 
        awaiting_merchant_confirmation: true,
        ready_deadline: null
      } : null);
      setStep("awaiting-confirmation");
      
      toast({
        title: "Notified Host",
        description: "The host has been notified you're here. Please wait to be seated.",
      });
    }
  };

  const handleWait5Minutes = async () => {
    if (!waitlistEntry) return;

    // Check if already used the extension
    if (waitlistEntry.patron_delayed) {
      toast({
        title: "Extension Already Used",
        description: "You've already used your 5-minute extension. Please arrive soon or cancel your booking.",
        variant: "destructive"
      });
      return;
    }

    // Extend deadline by 5 minutes from current deadline (or now if no deadline exists)
    const currentDeadline = waitlistEntry.ready_deadline 
      ? new Date(waitlistEntry.ready_deadline)
      : new Date();
    const newDeadline = new Date(currentDeadline.getTime() + 5 * 60000);

    const { error } = await supabase
      .from("waitlist_entries")
      .update({ 
        patron_delayed: true,
        ready_deadline: newDeadline.toISOString()
      })
      .eq("id", waitlistEntry.id);

    if (!error) {
      setWaitlistEntry(prev => prev ? { 
        ...prev, 
        patron_delayed: true,
        ready_deadline: newDeadline.toISOString()
      } : null);
      
      setStep("delayed-countdown");
      
      toast({
        title: "5 More Minutes Granted",
        description: "The restaurant has been notified. This is your final extension.",
      });
    } else {
      toast({
        title: "Error",
        description: "Could not extend your time. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleAutoCancelAfterDelay = async () => {
    if (!waitlistEntry) return;

    const { error } = await supabase
      .from("waitlist_entries")
      .update({ status: "cancelled" })
      .eq("id", waitlistEntry.id);

    if (!error) {
      toast({
        title: "Booking Cancelled",
        description: "Your table has been released due to no arrival.",
        variant: "destructive"
      });
      
      setTimeout(() => {
        onBack();
      }, 2000);
    }
  };

  const handleConfirmArrivalAfterDelay = async () => {
    if (!waitlistEntry) return;
    
    // Set awaiting confirmation
    const { error } = await supabase
      .from('waitlist_entries')
      .update({ 
        awaiting_merchant_confirmation: true 
      })
      .eq('id', waitlistEntry.id);

    if (!error) {
      setWaitlistEntry(prev => prev ? { 
        ...prev, 
        awaiting_merchant_confirmation: true 
      } : null);
      setStep("awaiting-confirmation");
      
      toast({
        title: "Notified Host",
        description: "The host has been notified you're here. Please wait to be seated.",
      });
    }
  };

  const handleRatingSubmit = async () => {
    if (!rating || !waitlistEntry) return;
    
    setIsSubmittingRating(true);
    
    try {
      const venue = venues.find(v => v.name === waitlistEntry.venue);
      
      // Insert rating
      const { error: ratingError } = await supabase
        .from('waitlist_ratings')
        .insert({
          waitlist_entry_id: waitlistEntry.id,
          venue_id: venue?.id,
          user_id: userId,
          rating,
          feedback_text: feedbackText.trim() || null
        });

      if (ratingError) throw ratingError;

      toast({
        title: "Thank you for your feedback!",
        description: "Your rating has been submitted successfully."
      });
      
      setTimeout(() => {
        onBack();
      }, 1500);
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast({
        title: "Error",
        description: "Could not submit rating. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleSkipRating = async () => {
    setTimeout(() => {
      onBack();
    }, 500);
  };

  // Debug render state
  console.log('🔍 TableReadyFlow render state:', {
    step,
    requiresMultipleTables,
    tablesNeededLength: tablesNeeded.length,
    hasWaitlistEntry: !!waitlistEntry,
    venueId: selectedVenue
  });

  // PRIORITY: Multi-table confirmation dialog (must render first)
  if (requiresMultipleTables && tablesNeeded.length > 0) {
    console.log('🖼️ Rendering multi-table confirmation dialog', {
      requiresMultipleTables,
      tablesNeeded,
      pendingReservationData
    });
    const totalCapacity = tablesNeeded.reduce((sum, t) => sum + t.capacity, 0);
    const reservationTimeStr = pendingReservationData 
      ? format(new Date(pendingReservationData.reservationDateTime), 'h:mm a, MMM d, yyyy')
      : '';
    
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleCancelMultiTableBooking}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Multiple Tables Required</h1>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              🪑 Your party needs to be split across multiple tables
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Your party of {pendingReservationData?.partySize} people requires:
              </p>
              
              <div className="space-y-2">
                {tablesNeeded.map((table, index) => (
                  <div 
                    key={table.id}
                    className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-primary/20"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="font-medium">{table.name}</span>
                      {index === 0 && (
                        <Badge variant="secondary" className="text-xs">Main table</Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">{table.capacity} seats</span>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  ℹ️ Both tables will be reserved together at {reservationTimeStr}
                </p>
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  ⚠️ Important: Cancelling one table will automatically cancel all linked tables
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Button 
                onClick={handleConfirmMultiTableBooking}
                disabled={isSubmitting}
                className="w-full h-12"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  "Confirm Booking"
                )}
              </Button>
              <Button 
                variant="outline"
                onClick={handleCancelMultiTableBooking}
                disabled={isSubmitting}
                className="w-full"
              >
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "venue-select") {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Join Waitlist</h1>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Select Restaurant</CardTitle>
            <p className="text-muted-foreground">Search and choose where you'd like to dine</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Search restaurants..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading venues...</div>
            ) : filteredVenues.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "No venues found matching your search" : "No venues available"}
              </div>
            ) : (
              <div className="space-y-2 mt-4">
                <div className="text-sm text-muted-foreground">
                  {filteredVenues.length} {filteredVenues.length === 1 ? 'restaurant' : 'restaurants'} found
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2"
                     style={{ scrollbarGutter: 'stable' }}>
                  {filteredVenues.map((venue) => (
            <Card 
              key={venue.id}
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => handleVenueSelect(venue.id)}
            >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex flex-col gap-1 flex-1">
                            <span className="font-medium">{venue.name}</span>
                            {(venue.display_address || venue.address) && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <MapPin size={14} />
                                <span>{venue.display_address || venue.address}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock size={14} />
                              <span>Wait: {venue.waitTime}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            {venue.distance !== undefined && (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <Navigation size={12} />
                                {formatDistance(venue.distance)}
                              </Badge>
                            )}
                            <Badge variant={venue.tables && venue.tables > 0 ? "secondary" : "default"}>
                              {venue.tables || 0} ahead
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "booking-type") {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setStep("venue-select")}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">When would you like to dine?</h1>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Card 
            className={cn(
              "cursor-pointer transition-all hover:shadow-floating",
              bookingType === "now" && "border-2 border-primary"
            )}
            onClick={() => {
              setBookingType("now");
              setStep("party-details");
            }}
          >
            <CardContent className="p-6 text-center">
              <Clock className="mx-auto mb-2" size={32} />
              <h3 className="font-semibold">Join Waitlist Now</h3>
              <p className="text-sm text-muted-foreground">Get seated today</p>
            </CardContent>
          </Card>
          
          <Card 
            className={cn(
              "cursor-pointer transition-all hover:shadow-floating",
              bookingType === "later" && "border-2 border-primary"
            )}
            onClick={() => {
              setBookingType("later");
              setStep("reservation-details");
            }}
          >
            <CardContent className="p-6 text-center">
              <CalendarIcon className="mx-auto mb-2" size={32} />
              <h3 className="font-semibold">Book for Later</h3>
              <p className="text-sm text-muted-foreground">Reserve in advance</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === "reservation-details") {
    // Get available times from venue settings
    const timeSlots = selectedVenueData?.settings?.business_hours && reservationDate
      ? getAvailableReservationTimes(
          reservationDate,
          selectedVenueData.settings.business_hours,
          selectedVenueData.settings.holiday_closures || [],
          15
        )
      : [];
    
    const hasNoAvailability = reservationDate && timeSlots.length === 0;

    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setStep("booking-type")}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Choose Date & Time</h1>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>{selectedVenue}</CardTitle>
            <p className="text-muted-foreground">Select your preferred date and time</p>
          </CardHeader>
          <CardContent className="space-y-6">
            {hasNoAvailability && (
              <Card className="shadow-card border-destructive">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                    <div>
                      <p className="font-semibold text-destructive">No Availability</p>
                      <p className="text-sm text-muted-foreground">
                        This venue is not accepting reservations on the selected date.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            <div>
              <Label>Select Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal mt-2",
                      !reservationDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {reservationDate ? format(reservationDate, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={reservationDate}
                    onSelect={setReservationDate}
                    disabled={(date) => date < new Date() || date > addDays(new Date(), 30)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Select Time</Label>
              <Select value={reservationTime} onValueChange={setReservationTime}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Choose time slot" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {timeSlots.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={() => setStep("party-details")}
              disabled={!reservationDate || !reservationTime || hasNoAvailability}
              className="w-full"
            >
              Continue to Party Details
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "party-details") {
    // Helper function to get today's business hours
    const getTodayHours = () => {
      if (!selectedVenueData?.settings?.business_hours) return null;
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const today = dayNames[new Date().getDay()];
      return selectedVenueData.settings.business_hours[today];
    };

    // Helper function to get active breaks
    const getTodayBreaks = () => {
      const todayHours = getTodayHours();
      return todayHours?.breaks || [];
    };

    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setStep("venue-select")}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Party Details</h1>
        </div>

        {selectedVenueData?.settings && (
          <Card className="shadow-card bg-muted/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Venue Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {getTodayHours() ? (
                <>
                  <div className="flex items-start justify-between">
                    <span className="text-muted-foreground">Today's Hours:</span>
                    <span className="font-medium text-right">
                      {getTodayHours()?.is_closed 
                        ? "Closed" 
                        : `${getTodayHours()?.open} - ${getTodayHours()?.close}`}
                    </span>
                  </div>
                  
                  {getTodayBreaks().length > 0 && (
                    <div className="flex items-start justify-between">
                      <span className="text-muted-foreground">Breaks:</span>
                      <div className="text-right space-y-1">
                        {getTodayBreaks().map((brk: any, idx: number) => (
                          <div key={idx} className="font-medium">
                            {brk.start} - {brk.end}
                            <span className="text-xs text-muted-foreground ml-1">
                              ({brk.reason})
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-muted-foreground">Hours not available</div>
              )}
              
              {selectedVenueData.settings.default_wait_time && (
                <div className="flex items-start justify-between pt-2 border-t">
                  <span className="text-muted-foreground">Typical Wait:</span>
                  <span className="font-medium">{selectedVenueData.settings.default_wait_time} min</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>{selectedVenue}</CardTitle>
            <p className="text-muted-foreground">Tell us about your party</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium">Party Name</label>
              <Input
                placeholder="e.g. Smith, John, Party of 4..."
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                className="h-12"
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                We'll use this name to call your party when your table is ready
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium">Party Size</label>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPartySize(Math.max(1, partySize - 1))}
                  disabled={partySize <= 1}
                >
                  -
                </Button>
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <Users size={20} />
                  <span>{partySize}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPartySize(Math.min(12, partySize + 1))}
                  disabled={partySize >= 12}
                >
                  +
                </Button>
              </div>
            </div>

            {/* Dynamic Seating Preferences - Based on Merchant Configuration */}
            {selectedVenueData?.waitlist_preferences?.options && 
             selectedVenueData.waitlist_preferences.options.filter((opt: any) => opt.enabled).length > 0 && (
              <div className="space-y-3">
                <label className="text-sm font-medium">Seating Preferences</label>
                
                {/* Show enabled preferences as a grid of buttons */}
                <div className="grid grid-cols-1 gap-2">
                  {selectedVenueData.waitlist_preferences.options
                    .filter((opt: any) => opt.enabled) // Only show enabled preferences
                    .map((opt: any) => {
                      const isSelected = preferences.includes(opt.label);
                      return (
                        <Button
                          key={opt.id}
                          variant={isSelected ? "default" : "outline"}
                          size="lg"
                          className="justify-start h-auto py-3"
                          onClick={() => togglePreference(opt.label)}
                        >
                          <div className="flex items-center gap-2">
                            {isSelected && <CheckCircle size={16} />}
                            <span>{opt.label}</span>
                          </div>
                        </Button>
                      );
                    })}
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Select any preferences that apply (optional)
                </p>
              </div>
            )}

            <Button 
              onClick={handleJoinWaitlist} 
              disabled={!partyName.trim() || isSubmitting}
              className="w-full h-12"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                "Join Waitlist"
              )}
            </Button>
            {!partyName.trim() && (
              <p className="text-xs text-muted-foreground text-center">
                Please enter your party name to continue
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "waiting" && waitlistEntry) {
    return (
      <div className="space-y-6 p-6 pb-24">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Waitlist Status</h1>
        </div>

        <Card className="shadow-card">
          <CardContent className="p-8 text-center space-y-6">
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="w-10 h-10 text-primary" />
                </div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-primary">#{waitlistEntry.position}</h2>
              <p className="text-lg text-muted-foreground">in line</p>
            </div>

            <div className="flex items-center justify-center gap-2 text-lg">
              <Clock size={20} />
              <span className="font-semibold">
                {waitlistEntry.eta ? Math.ceil((new Date(waitlistEntry.eta).getTime() - new Date().getTime()) / (1000 * 60)) : 0} minutes • ETA {waitlistEntry.eta ? new Date(waitlistEntry.eta).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--"}
              </span>
            </div>

            {waitlistEntry.notes && extractExtensionReason(waitlistEntry.notes) && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                      Wait Time Updated
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      {extractExtensionReason(waitlistEntry.notes)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="p-4 bg-muted rounded-xl">
              <div className="text-sm text-muted-foreground space-y-1">
                <div>📍 {waitlistEntry.venue}</div>
                <div>👥 Party of {waitlistEntry.party_size}</div>
                {waitlistEntry.preferences && waitlistEntry.preferences.length > 0 && (
                  <div>✨ {waitlistEntry.preferences.join(", ")}</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {partiesAhead.length > 0 && (
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Parties Ahead of You</CardTitle>
              <p className="text-sm text-muted-foreground">
                {partiesAhead.length} {partiesAhead.length === 1 ? 'party' : 'parties'} waiting
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {partiesAhead.map((party, index) => {
                  const estimatedWait = party.eta 
                    ? Math.ceil((new Date(party.eta).getTime() - new Date().getTime()) / (1000 * 60))
                    : 15;
                  
                  return (
                    <div key={party.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                        #{party.position}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Users size={14} className="text-muted-foreground" />
                          <span className="text-sm font-medium">Party of {party.party_size}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Clock size={12} />
                          <span>~{estimatedWait} min</span>
                        </div>
                      </div>
                      <Progress value={((index + 1) / (partiesAhead.length + 1)) * 100} className="w-16 h-2" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Live Updates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span>You joined the waitlist</span>
                <span className="text-muted-foreground ml-auto">Just now</span>
              </div>
              {waitlistEntry.position <= 2 && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-success"></div>
                  <span>Moved up in line</span>
                  <span className="text-muted-foreground ml-auto">2 min ago</span>
                </div>
              )}
              {waitlistEntry.position === 1 && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-warning"></div>
                  <span>Get ready! You're next</span>
                  <span className="text-muted-foreground ml-auto">Just now</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-4">
            <Button 
              variant="outline" 
              className="w-full h-12 text-destructive hover:bg-destructive/10"
              onClick={handleCancelBooking}
            >
              Cancel Booking
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show cancellation screen if entry is cancelled
  if (waitlistEntry?.status === "cancelled") {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Reservation Cancelled</h1>
        </div>

        <Card className="shadow-card border-destructive">
          <CardContent className="p-8 text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-destructive">Reservation Cancelled</h2>
              <p className="text-muted-foreground">{waitlistEntry.venue}</p>
            </div>

            {waitlistEntry.cancellation_reason && (
              <div className="p-4 bg-muted rounded-lg text-left">
                <p className="font-semibold text-sm mb-1">Reason:</p>
                <p className="text-muted-foreground">{waitlistEntry.cancellation_reason}</p>
              </div>
            )}

            {!waitlistEntry.cancellation_reason && (
              <p className="text-muted-foreground">
                This reservation has been cancelled by the restaurant.
              </p>
            )}

            <Button onClick={onBack} className="w-full">
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "ready" && waitlistEntry) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Table Ready!</h1>
        </div>

        <Card className="shadow-card">
          <CardContent className="p-8 text-center space-y-6">
            <div className="text-6xl">🎉</div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-primary">Your Table is Ready!</h2>
              <p className="text-muted-foreground">{waitlistEntry.venue}</p>
            </div>

            <div className="p-6 bg-primary/10 rounded-xl border border-primary/20">
              <p className="font-semibold text-primary">Please head to the host stand now</p>
              <p className="text-sm text-muted-foreground mt-1">Party of {waitlistEntry.party_size}</p>
              {waitlistEntry.ready_deadline && (
                <div className="mt-4 p-3 bg-background rounded-lg">
                  <p className="text-sm font-medium mb-1">Time Remaining:</p>
                  <p className="text-2xl font-bold text-primary">
                    {String(countdownMinutes).padStart(2, '0')}:{String(countdownSeconds).padStart(2, '0')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {waitlistEntry.patron_delayed 
                      ? "Final extension - please arrive soon" 
                      : "Your table will be released if you don't arrive"}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Button onClick={handleConfirmSeat} className="w-full h-12">
                I'm Here - Get Seated
              </Button>
              <Button 
                variant="outline" 
                className="w-full h-12"
                onClick={handleWait5Minutes}
                disabled={waitlistEntry.patron_delayed}
              >
                {waitlistEntry.patron_delayed ? "Extension Already Used" : "Need 5 More Minutes"}
              </Button>
              <Button 
                variant="outline" 
                className="w-full h-12 text-destructive hover:bg-destructive/10"
                onClick={handleCancelBooking}
              >
                Cancel Booking
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "delayed-countdown" && waitlistEntry) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setStep("ready")}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Delay Countdown</h1>
        </div>

        <Card className="shadow-card">
          <CardContent className="p-8 text-center space-y-6">
            <div className="text-6xl">⏱️</div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-primary">Time Remaining</h2>
              <p className="text-muted-foreground">{waitlistEntry.venue}</p>
            </div>

            <div className="p-8 bg-orange-50 dark:bg-orange-950 rounded-xl border border-orange-200 dark:border-orange-800">
              <p className="text-5xl font-bold text-orange-600 dark:text-orange-400">
                {String(countdownMinutes).padStart(2, '0')}:{String(countdownSeconds).padStart(2, '0')}
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-300 mt-2">
                Your table will be released if you don't arrive
              </p>
            </div>

            <div className="p-4 bg-muted rounded-xl">
              <p className="text-sm text-muted-foreground">
                📍 The restaurant has been notified you need 5 more minutes
              </p>
            </div>

            <div className="space-y-3">
              <Button onClick={handleConfirmArrivalAfterDelay} className="w-full h-12">
                I'm Here Now - Get Seated
              </Button>
              <Button 
                variant="outline" 
                className="w-full h-12 text-destructive hover:bg-destructive/10"
                onClick={handleCancelBooking}
              >
                Cancel Booking
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "awaiting-confirmation" && waitlistEntry) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setStep("ready")}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Confirmation Pending</h1>
        </div>

        <Card className="shadow-card">
          <CardContent className="p-8 text-center space-y-6">
            <div className="text-6xl animate-pulse">⏳</div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-primary">Host Notified</h2>
              <p className="text-muted-foreground">{waitlistEntry.venue}</p>
            </div>

            <div className="p-6 bg-blue-50 dark:bg-blue-950 rounded-xl border border-blue-200 dark:border-blue-800">
              <p className="font-semibold text-blue-900 dark:text-blue-100">
                Please wait at the host stand
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                The host will confirm your seating in just a moment
              </p>
            </div>

            <div className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full h-12 text-destructive hover:bg-destructive/10"
                onClick={handleCancelBooking}
              >
                Cancel Booking
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "feedback" && waitlistEntry) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleSkipRating}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Rate Your Experience</h1>
        </div>

        <Card className="shadow-card">
          <CardContent className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">How was your experience at {waitlistEntry.venue}?</h3>
              <p className="text-sm text-muted-foreground">Your feedback helps improve the service</p>
            </div>

            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    size={40}
                    className={cn(
                      "transition-colors",
                      (hoveredRating || rating) >= star
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    )}
                  />
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback">Additional Comments (Optional)</Label>
              <Textarea
                id="feedback"
                placeholder="Tell us more about your experience..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Button 
                onClick={handleRatingSubmit}
                disabled={!rating || isSubmittingRating}
                className="w-full h-12"
              >
                {isSubmittingRating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Rating"
                )}
              </Button>
              <Button 
                variant="ghost"
                onClick={handleSkipRating}
                disabled={isSubmittingRating}
                className="w-full"
              >
                Skip for now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}