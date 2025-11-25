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

  // Debug render state
  console.log('🔍 Render state:', { 
    step, 
    requiresMultipleTables, 
    tablesNeededLength: tablesNeeded.length 
  });

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

  // Multi-table confirmation dialog - MUST render before other steps
  // Multi-table dialog moved earlier in render chain (see line ~880)

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

  return null;
}