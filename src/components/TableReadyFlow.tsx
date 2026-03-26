import { useState, useEffect, useRef } from "react";
import { VenueLogo } from "@/components/VenueLogo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users, Clock, CheckCircle, Search, MapPin, Loader2, Star, Calendar as CalendarIcon, XCircle, Navigation, Pencil, Compass } from "lucide-react";
import { ExploreVenues } from "@/components/ExploreVenues";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, addDays, differenceInHours, parseISO, formatDistanceToNow } from "date-fns";
import { cn, formatTimeUntil } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { sendBrowserNotification, vibratePhone, initializePushNotifications } from "@/utils/notifications";
import { checkVenueStatus, getAvailableReservationTimes } from "@/utils/businessHours";
import { calculateDistance, formatDistance, getUserLocation, type UserLocation } from "@/utils/geolocation";
import { playTableReadySound, stopSoundForId, isSoundActive } from "@/utils/notificationSound";
import { EditReservationDialog } from "@/components/EditReservationDialog";
import { CelebrationOverlay } from "@/components/ui/celebration-overlay";
import { CountdownRing } from "@/components/ui/countdown-ring";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  position: number | null;
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
  created_at: string;
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
  const [step, setStep] = useState<"entry-select" | "venue-select" | "booking-type" | "reservation-details" | "party-details" | "waiting" | "ready" | "awaiting-confirmation" | "delayed-countdown" | "feedback" | "cancelled-details">("entry-select");
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
  const [customerPhone, setCustomerPhone] = useState("");
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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [existingBooking, setExistingBooking] = useState<{
    time: string;
    partySize: number;
  } | null>(null);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const celebrationShownRef = useRef(false);
  
  // New state for tabbed interface
  const [activeTableTab, setActiveTableTab] = useState<"waitlist" | "reservations">("waitlist");
  const [showExploreView, setShowExploreView] = useState(false);
  
  // State for time slot availability checking
  const [slotAvailability, setSlotAvailability] = useState<Record<string, { available: boolean; reason?: string }>>({});
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  
  // Ref to track ready_deadline for stable access in countdown interval
  const readyDeadlineRef = useRef<string | null>(null);

  const soundStartedRef = useRef(false);
  
  // Ref to track previous status - prevents real-time subscription from overriding manual step changes
  const prevStatusRef = useRef<string | null>(null);

  // Play sound when table is ready (on mount or status change)
  // Stop sound when patron confirms arrival (awaiting_merchant_confirmation = true)
  useEffect(() => {
    const isReady = waitlistEntry?.status === 'ready';
    const hasConfirmedArrival = waitlistEntry?.awaiting_merchant_confirmation === true;
    
    if (isReady && waitlistEntry.id && !hasConfirmedArrival) {
      if (!isSoundActive('tableReady', waitlistEntry.id) && !soundStartedRef.current) {
        soundStartedRef.current = true;
        playTableReadySound(waitlistEntry.id);
      }
    } else {
      soundStartedRef.current = false;
      if (waitlistEntry?.id) {
        stopSoundForId('tableReady', waitlistEntry.id);
      }
    }
  }, [waitlistEntry?.status, waitlistEntry?.id, waitlistEntry?.awaiting_merchant_confirmation]);

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (waitlistEntry?.id) {
        stopSoundForId('tableReady', waitlistEntry.id);
      }
    };
  }, [waitlistEntry?.id]);

  // Get authenticated user and initialize notifications
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
      
      // Initialize push notifications if user is logged in
      if (user?.id) {
        const FIREBASE_PROJECT_ID = 'cuoqjgahpfymxqrdlzlf'; // Use your Supabase project ID
        await initializePushNotifications(FIREBASE_PROJECT_ID);
        
        // Fetch user's phone from profile to pre-fill
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', user.id)
          .single();
        
        if (profile?.phone) {
          setCustomerPhone(profile.phone);
        }
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

  // Sync ref whenever ready_deadline changes - this ensures the interval always reads the latest value
  useEffect(() => {
    readyDeadlineRef.current = waitlistEntry?.ready_deadline || null;
  }, [waitlistEntry?.ready_deadline]);

  // Immediately sync countdown when deadline arrives/changes (don't wait for interval)
  // This fixes the issue where the timer shows stale values when viewing the card
  useEffect(() => {
    if (waitlistEntry?.status === 'ready' && waitlistEntry?.ready_deadline) {
      const deadline = new Date(waitlistEntry.ready_deadline).getTime();
      const timeLeft = deadline - Date.now();
      if (timeLeft > 0) {
        setCountdownMinutes(Math.floor(timeLeft / 60000));
        setCountdownSeconds(Math.floor((timeLeft % 60000) / 1000));
      }
    }
  }, [waitlistEntry?.ready_deadline, waitlistEntry?.status]);

  // Countdown timer - calculate from server-side deadline
  // Use status-based triggering instead of step-based to ensure timer starts immediately
  // when table becomes ready via real-time update, even if user is viewing the card
  useEffect(() => {
    // Stop timer if patron confirmed arrival
    if (waitlistEntry?.awaiting_merchant_confirmation) {
      setCountdownMinutes(0);
      setCountdownSeconds(0);
      return;
    }

    // Use status check instead of step check to decouple from async UI state
    const isReadyStatus = waitlistEntry?.status === 'ready';
    
    // Don't run if entry is cancelled or we're past the confirmation step
    if (step === "awaiting-confirmation" || step === "feedback") return;
    
    if (!isReadyStatus) return;

    const updateCountdown = async () => {
      // Read from ref for stable access to the latest deadline value
      const deadline = readyDeadlineRef.current;
      if (!deadline) return;
      
      const now = Date.now();
      const deadlineMs = new Date(deadline).getTime();
      const timeLeft = deadlineMs - now;

      if (timeLeft <= 0) {
        // Time expired - auto cancel the entry
        const { error } = await supabase
          .from('waitlist_entries')
          .update({
            status: 'no_show',
            cancellation_reason: 'Time expired - patron did not arrive within allocated time',
            cancelled_by: 'system'
          })
          .eq('id', waitlistEntry!.id);

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

    // Check if we have a deadline before starting the interval
    if (!readyDeadlineRef.current) return;

    // Update immediately
    updateCountdown();
    
    // Then update every second
    const timer = setInterval(updateCountdown, 1000);

    return () => clearInterval(timer);
  }, [step, waitlistEntry?.status, waitlistEntry?.id, waitlistEntry?.awaiting_merchant_confirmation, toast]);

  // Handle initial entry from home page
  useEffect(() => {
    if (initialEntry) {
      const entry: WaitlistEntry = {
        id: initialEntry.id,
        venue: initialEntry.venues?.name || "",
        venue_id: initialEntry.venue_id,
        party_size: initialEntry.party_size,
        position: initialEntry.position ?? null,
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
        created_at: initialEntry.created_at,
        updated_at: initialEntry.updated_at,
        notes: initialEntry.notes,
        reservation_type: initialEntry.reservation_type,
        reservation_time: initialEntry.reservation_time,
      };
      setWaitlistEntry(entry);
      
      // Check if entry is cancelled and show details view
      if (entry.status === 'cancelled') {
        setStep("cancelled-details");
      } else if (entry.status === 'seated') {
        // Patron is already seated - show feedback/rating screen
        setStep("feedback");
      } else {
        // Set appropriate step based on status
        if (initialEntry.status === "ready") {
          // Check if patron already confirmed arrival
          if (initialEntry.awaiting_merchant_confirmation) {
            setStep("awaiting-confirmation");
          } else {
            setStep("ready");
          }
        } else if (initialEntry.status === "cancelled" || initialEntry.status === "no_show") {
          // Don't set step - let the component render based on status check
          // The cancelled screen is shown via: if (waitlistEntry?.status === "cancelled")
        } else {
          setStep("waiting");
        }
      }

      // Initialize prevStatusRef with initial status
      prevStatusRef.current = initialEntry.status;
      
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
            const newAwaitingConfirmation = payload.new.awaiting_merchant_confirmation;
            const newStatus = payload.new.status;
            
            // Always update the entry data
            setWaitlistEntry(prev => prev ? {
              ...prev,
              status: mapDatabaseStatus(newStatus),
              eta: payload.new.eta,
              position: payload.new.position,
              cancellation_reason: payload.new.cancellation_reason || undefined,
              ready_at: payload.new.ready_at,
              ready_deadline: payload.new.ready_deadline,
              patron_delayed: payload.new.patron_delayed,
              cancelled_by: payload.new.cancelled_by,
              updated_at: payload.new.updated_at,
              notes: payload.new.notes,
              awaiting_merchant_confirmation: newAwaitingConfirmation,
            } : null);
            
            // Only change step if status actually changed to prevent race conditions
            // This ensures manual step transitions (like handleConfirmSeat) aren't overridden
            if (newStatus !== prevStatusRef.current) {
              if (newStatus === "ready") {
                // Only set to "ready" step if patron hasn't confirmed arrival yet
                if (newAwaitingConfirmation) {
                  setStep("awaiting-confirmation");
                } else {
                  setStep("ready");
                  // Send browser notification and vibrate only when first becoming ready
                  sendBrowserNotification(
                    "🍽️ Your Table is Ready!",
                    "Please proceed to the venue to be seated",
                    { tag: 'table-ready', requireInteraction: true }
                  );
                  vibratePhone([200, 100, 200, 100, 200]);
                }
              } else if (newStatus === "seated") {
                setStep("feedback");
              } else if (newStatus === "cancelled" || newStatus === "no_show") {
                setStep("cancelled-details");
              }
              prevStatusRef.current = newStatus;
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
        .select("id, name, address, display_address, service_types, settings, waitlist_preferences, latitude, longitude, logo_url")
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

  // Effect to check time slot availability when date or party size changes
  // Moved to top level to satisfy React hooks rules
  useEffect(() => {
    // Only run when on reservation-details step
    if (step !== "reservation-details") {
      return;
    }
    
    // Get minimum lead time from venue settings (default 60 minutes)
    const minimumLeadTime = selectedVenueData?.settings?.minimum_reservation_lead_time ?? 60;
    
    // Get available times from venue settings
    const timeSlots = selectedVenueData?.settings?.business_hours && reservationDate
      ? getAvailableReservationTimes(
          reservationDate,
          selectedVenueData.settings.business_hours,
          selectedVenueData.settings.holiday_closures || [],
          15,
          minimumLeadTime
        )
      : [];

    if (!reservationDate || !selectedVenueData?.id || timeSlots.length === 0) {
      setSlotAvailability({});
      return;
    }
    
    const checkAvailability = async () => {
      setIsCheckingAvailability(true);
      
      const dateStr = format(reservationDate, 'yyyy-MM-dd');
      
      // Convert time slots to ISO timestamps to fix timezone mismatch
      // The edge function was parsing local time strings as UTC, causing wrong availability checks
      // Also apply overnight correction: early-morning slots (before opening time) belong to the NEXT calendar day
      const _bizHours = selectedVenueData?.settings?.business_hours as Record<string, { open?: string; close?: string; is_overnight?: boolean; is_closed?: boolean }> | undefined;
      const _dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
      const _dayKey = _dayNames[reservationDate.getDay()];
      const _dayHours = _bizHours?.[_dayKey];
      const _openingMinutes = _dayHours?.is_overnight && _dayHours.open
        ? parseInt(_dayHours.open.split(':')[0], 10) * 60 + parseInt(_dayHours.open.split(':')[1] ?? '0', 10)
        : null;

      const timeSlotsWithISO = timeSlots.map(time => {
        const [hours, minutes] = time.split(':').map(Number);
        const slotDate = new Date(reservationDate);
        slotDate.setHours(hours, minutes, 0, 0);
        // Overnight correction: early-morning slots belong to next calendar day
        if (_openingMinutes !== null && (hours * 60 + minutes) < _openingMinutes) {
          slotDate.setDate(slotDate.getDate() + 1);
        }
        return {
          time: time,  // Keep original for display/keying
          iso: slotDate.toISOString()  // Correct UTC time for database query
        };
      });
      
      try {
        const { data, error } = await supabase.functions.invoke('check-time-slot-availability', {
          body: {
            venue_id: selectedVenueData.id,
            date: dateStr,
            party_size: partySize,
            time_slots: timeSlotsWithISO
          }
        });
        
        if (!error && data) {
          setSlotAvailability(data);
          // Clear selected time if it's no longer available
          if (reservationTime && data[reservationTime]?.available === false) {
            setReservationTime("");
          }
        }
      } catch (err) {
        console.error('Error checking availability:', err);
      }
      setIsCheckingAvailability(false);
    };
    
    checkAvailability();
  }, [step, reservationDate, partySize, selectedVenueData?.id, selectedVenueData?.settings]);

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
      
      // Only show warnings for walk-in (waitlist tab)
      if (activeTableTab === 'waitlist') {
        if (!status.is_open) {
          toast({
            title: "Venue Closed",
            description: status.message,
            variant: "destructive"
          });
        } else if (status.message.includes('Closing soon')) {
          toast({
            title: "Notice",
            description: status.message,
          });
        }
        
        setSelectedVenue(venue.name);
        setSelectedVenueData(venue);
        setBookingType("now");
        setStep("party-details");
      } else {
        // Reservations tab - go to date/time selection
        setSelectedVenue(venue.name);
        setSelectedVenueData(venue);
        setBookingType("later");
        setStep("reservation-details");
      }
    }
  };

  // Handle venue selection from ExploreVenues
  const handleExploreVenueSelect = (venueId: string) => {
    setShowExploreView(false);
    const venue = venues.find(v => v.id === venueId);
    if (venue) {
      setSelectedVenue(venue.name);
      setSelectedVenueData(venue);
      setBookingType("later");
      setStep("reservation-details");
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
        customer_phone: customerPhone.trim() || null,
        party_size: partySize,
        preferences: finalPreferences,
        status: "waiting",
        user_id: userId
      };

      if (bookingType === "later" && reservationDate && reservationTime) {
        const [hours, minutes] = reservationTime.split(':').map(Number);
        const reservationDateTime = new Date(reservationDate);
        reservationDateTime.setHours(hours, minutes, 0, 0);

        // Overnight correction: early-morning slots (before opening time) belong to the NEXT calendar day
        const _bizHoursJoin = selectedVenueData?.settings?.business_hours as Record<string, { open?: string; is_overnight?: boolean }> | undefined;
        const _dayNamesJoin = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
        const _dayKeyJoin = _dayNamesJoin[reservationDate.getDay()];
        const _dayHoursJoin = _bizHoursJoin?.[_dayKeyJoin];
        if (_dayHoursJoin?.is_overnight && _dayHoursJoin.open) {
          const [openH, openM] = _dayHoursJoin.open.split(':').map(Number);
          const slotTotalMinutes = hours * 60 + minutes;
          const openTotalMinutes = openH * 60 + (openM ?? 0);
          if (slotTotalMinutes < openTotalMinutes) {
            reservationDateTime.setDate(reservationDateTime.getDate() + 1);
          }
        }

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
          setExistingBooking({
            time: existingTime,
            partySize: existingReservations[0].party_size
          });
          setPendingReservationData({
            venue,
            reservationDateTime,
            finalPreferences,
            partyName: partyName.trim(),
            partySize,
            skipDuplicateCheck: true // Flag to skip duplicate check on confirmation
          });
          setShowDuplicateWarning(true);
          setIsSubmitting(false);
          return; // Stop and show confirmation dialog
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
          created_at: newEntry.created_at,
          updated_at: newEntry.created_at,
          reservation_type: newEntry.reservation_type,
          reservation_time: newEntry.reservation_time,
        };
        setWaitlistEntry(entry);
        
        toast({
          title: "Added to Waitlist!",
          description: `You've been added to the waitlist at ${selectedVenue}.`
        });
        
        setStep("waiting");

        // Initialize prevStatusRef for new entries
        prevStatusRef.current = newEntry.status;
        
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
              const newStatus = payload.new.status;
              const newAwaitingConfirmation = payload.new.awaiting_merchant_confirmation;
              
              // Always update the entry data
              setWaitlistEntry(prev => prev ? {
                ...prev,
                status: mapDatabaseStatus(newStatus),
                eta: payload.new.eta,
                position: payload.new.position,
                cancellation_reason: payload.new.cancellation_reason || undefined,
                cancelled_by: payload.new.cancelled_by,
                updated_at: payload.new.updated_at,
                notes: payload.new.notes,
                ready_deadline: payload.new.ready_deadline,
                ready_at: payload.new.ready_at,
                patron_delayed: payload.new.patron_delayed,
                awaiting_merchant_confirmation: newAwaitingConfirmation,
              } : null);
              
              // Only change step if status actually changed to prevent race conditions
              if (newStatus !== prevStatusRef.current) {
                if (newStatus === "ready") {
                  if (newAwaitingConfirmation) {
                    setStep("awaiting-confirmation");
                  } else {
                    setStep("ready");
                    // Send browser notification and vibrate
                    sendBrowserNotification(
                      "🍽️ Your Table is Ready!",
                      "Please proceed to the venue to be seated",
                      { tag: 'table-ready', requireInteraction: true }
                    );
                    vibratePhone([200, 100, 200, 100, 200]);
                  }
                } else if (newStatus === "seated") {
                  setStep("feedback");
                } else if (newStatus === "cancelled" || newStatus === "no_show") {
                  setStep("cancelled-details");
                }
                prevStatusRef.current = newStatus;
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
        customer_phone: customerPhone.trim() || null,
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
          position: null,
          eta: newEntries[0].eta,
          preferences: newEntries[0].preferences || [],
          status: mapDatabaseStatus(newEntries[0].status),
          customer_name: newEntries[0].customer_name,
          created_at: newEntries[0].created_at,
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

  const handleConfirmDuplicateBooking = async () => {
    if (!pendingReservationData) return;
    
    setShowDuplicateWarning(false);
    setExistingBooking(null);
    
    // Re-trigger the join waitlist flow, skipping the duplicate check
    setIsSubmitting(true);
    
    try {
      const { venue, reservationDateTime, finalPreferences, partyName, partySize } = pendingReservationData;
      
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
        setTablesNeeded(availabilityData.tables_needed);
        // Keep pendingReservationData for multi-table confirmation
        setRequiresMultipleTables(true);
        return;
      }

      // Create the reservation
      const insertData = {
        venue_id: venue.id,
        customer_name: partyName,
        customer_phone: customerPhone.trim() || null,
        party_size: partySize,
        preferences: finalPreferences,
        status: "waiting" as const,
        user_id: userId,
        reservation_type: 'reservation',
        reservation_time: reservationDateTime.toISOString(),
        eta: reservationDateTime.toISOString(),
        assigned_table_id: availabilityData.matched_table.id
      };

      const { data: newEntry, error } = await supabase
        .from("waitlist_entries")
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error("Error creating reservation:", error);
        toast({
          title: "Booking Failed",
          description: error.message || "Unable to create your reservation. Please try again.",
          variant: "destructive"
        });
        return;
      }

      if (newEntry) {
        const entry: WaitlistEntry = {
          id: newEntry.id,
          venue: venue.name,
          venue_id: newEntry.venue_id,
          party_size: newEntry.party_size,
          position: newEntry.position || null,
          eta: newEntry.eta,
          preferences: newEntry.preferences || [],
          status: mapDatabaseStatus(newEntry.status),
          customer_name: newEntry.customer_name,
          created_at: newEntry.created_at,
          updated_at: newEntry.created_at,
          reservation_type: newEntry.reservation_type,
          reservation_time: newEntry.reservation_time,
        };
        setWaitlistEntry(entry);
        
        toast({
          title: "Reservation Confirmed!",
          description: `Your reservation at ${venue.name} has been confirmed.`
        });
        
        setPendingReservationData(null);
        setStep("waiting");
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelDuplicateBooking = () => {
    setShowDuplicateWarning(false);
    setExistingBooking(null);
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
          
          <Button onClick={onBack} className="w-full">Back to Home</Button>
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
      setShowCancelConfirmation(false);
      toast({
        title: "Reservation Cancelled",
        description: "Your reservation has been cancelled.",
      });
      onBack();
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
        title: "Notified Restaurant",
        description: "We have notified the restaurant that you are here.",
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
      // Update state - the countdown will automatically extend via the immediate sync effect
      setWaitlistEntry(prev => prev ? { 
        ...prev, 
        patron_delayed: true,
        ready_deadline: newDeadline.toISOString()
      } : null);
      
      // Stay on "ready" screen - don't transition to "delayed-countdown"
      // This keeps UI consistent while the timer updates automatically
      
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
        title: "Notified Restaurant",
        description: "We have notified the restaurant that you are here.",
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
    // Mark the waitlist entry as dismissed so it disappears from the patron's list
    if (waitlistEntry?.id) {
      await supabase
        .from('waitlist_entries')
        .update({ patron_dismissed: true })
        .eq('id', waitlistEntry.id);
    }
    onBack();
  };

  // Debug render state
  console.log('🔍 TableReadyFlow render state:', {
    step,
    requiresMultipleTables,
    tablesNeededLength: tablesNeeded.length,
    hasWaitlistEntry: !!waitlistEntry,
    venueId: selectedVenue
  });

  // PRIORITY 1: Duplicate booking warning dialog
  if (showDuplicateWarning && existingBooking && pendingReservationData) {
    const newReservationTimeStr = pendingReservationData.reservationDateTime 
      ? format(new Date(pendingReservationData.reservationDateTime), 'h:mm a')
      : '';
    const newReservationDateStr = pendingReservationData.reservationDateTime 
      ? format(new Date(pendingReservationData.reservationDateTime), 'MMM d, yyyy')
      : '';
    
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={handleCancelDuplicateBooking}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Existing Booking Found</h1>
        </div>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              ⚠️ You already have a reservation at this venue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Your existing reservation:
              </p>
              
              <div className="p-4 bg-muted/50 rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={16} className="text-muted-foreground" />
                  <span className="font-medium">Today at {existingBooking.time}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Users size={16} className="text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Party of {existingBooking.partySize}</span>
                </div>
              </div>

              <p className="text-sm text-muted-foreground pt-2">
                You're about to book another table:
              </p>
              
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={16} className="text-primary" />
                  <span className="font-medium">{newReservationDateStr} at {newReservationTimeStr}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Users size={16} className="text-primary" />
                  <span className="text-sm text-muted-foreground">Party of {pendingReservationData.partySize}</span>
                </div>
              </div>

              <div className="p-4 bg-accent/50 rounded-lg border border-accent">
                <p className="text-sm text-foreground">
                  ℹ️ Both bookings will be active. You can manage them from your profile.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Button 
                onClick={handleConfirmDuplicateBooking}
                disabled={isSubmitting}
                className="w-full h-12"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Booking...
                  </>
                ) : (
                  "Book Anyway"
                )}
              </Button>
              <Button 
                variant="outline"
                onClick={handleCancelDuplicateBooking}
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

  // PRIORITY 2: Multi-table confirmation dialog (must render first)
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

  // Render ExploreVenues if active
  if (showExploreView) {
    return (
      <ExploreVenues 
        onBack={() => setShowExploreView(false)}
        onSelectVenue={handleExploreVenueSelect}
      />
    );
  }

  // Entry selection screen - choose Waitlist or Reservations
  if (step === "entry-select") {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Table Ready</h1>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Waitlist Card */}
          <Card 
            className="cursor-pointer shadow-card transition-all hover:scale-105 hover:shadow-floating active:scale-95"
            onClick={() => {
              setActiveTableTab("waitlist");
              setStep("venue-select");
            }}
          >
            <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Users size={28} />
              </div>
              <div>
                <h3 className="font-semibold">Waitlist</h3>
                <p className="text-sm text-muted-foreground">Get seated today</p>
              </div>
            </CardContent>
          </Card>

          {/* Reservations Card */}
          <Card 
            className="cursor-pointer shadow-card transition-all hover:scale-105 hover:shadow-floating active:scale-95"
            onClick={() => {
              setActiveTableTab("reservations");
              setStep("venue-select");
            }}
          >
            <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <CalendarIcon size={28} />
              </div>
              <div>
                <h3 className="font-semibold">Reservations</h3>
                <p className="text-sm text-muted-foreground">Book in advance</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === "venue-select") {
    // Venue list component
    const VenueList = () => (
      <>
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
                  className="group cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => handleVenueSelect(venue.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex items-center gap-3 flex-1">
                        <VenueLogo logoUrl={(venue as any).logo_url} name={venue.name} size="md" />
                        <div className="flex flex-col gap-1 flex-1">
                        {(venue.display_address || venue.address) && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground group-hover:text-accent-foreground transition-colors">
                            <MapPin size={14} />
                            <span>{venue.display_address || venue.address}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-sm text-muted-foreground group-hover:text-accent-foreground transition-colors">
                          <Clock size={14} />
                          <span>Wait: {venue.waitTime}</span>
                        </div>
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
      </>
    );

    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setStep("entry-select")}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">
            {activeTableTab === "waitlist" ? "Join Waitlist" : "Make a Reservation"}
          </h1>
        </div>

        {/* Show Explore Venues button only for reservations */}
        {activeTableTab === "reservations" && (
          <Button
            variant="outline"
            className="w-full h-14 border-dashed border-2"
            onClick={() => setShowExploreView(true)}
          >
            <Compass className="mr-2 h-5 w-5" />
            Explore Venues
          </Button>
        )}

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>
              {activeTableTab === "waitlist" ? "Join Waitlist" : "Make a Reservation"}
            </CardTitle>
            <p className="text-muted-foreground">
              {activeTableTab === "waitlist" 
                ? "Get seated today - no reservation needed" 
                : "Book a table in advance"}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <VenueList />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "reservation-details") {
    // Get minimum lead time from venue settings (default 60 minutes)
    const minimumLeadTime = selectedVenueData?.settings?.minimum_reservation_lead_time ?? 60;
    
    // Check if selected date is today
    const isToday = reservationDate?.toDateString() === new Date().toDateString();
    
    // Get available times from venue settings
    const timeSlots = selectedVenueData?.settings?.business_hours && reservationDate
      ? getAvailableReservationTimes(
          reservationDate,
          selectedVenueData.settings.business_hours,
          selectedVenueData.settings.holiday_closures || [],
          15,
          minimumLeadTime
        )
      : [];

    const hasNoAvailability = reservationDate && timeSlots.length === 0;
    const isNoSameDaySlots = isToday && hasNoAvailability;

    // Check if venue has no tables configured
    const hasNoTablesConfigured = !selectedVenueData?.settings?.table_configuration || 
                                  selectedVenueData?.settings?.table_configuration?.length === 0;

    // Count available slots
    const availableSlotCount = Object.values(slotAvailability).filter(s => s.available !== false).length;
    const allSlotsBooked = timeSlots.length > 0 && availableSlotCount === 0 && !isCheckingAvailability;

    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setStep("venue-select")}>
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
            {/* Party Size Selector - First to enable availability check */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Party Size</Label>
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
              <p className="text-xs text-muted-foreground">
                Party size affects available time slots
              </p>
            </div>

            {(hasNoAvailability || allSlotsBooked || hasNoTablesConfigured) && (
              <Card className="shadow-card border-destructive">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <XCircle className="h-5 w-5 text-destructive mt-0.5" />
                    <div>
                      <p className="font-semibold text-destructive">No Availability</p>
                      <p className="text-sm text-muted-foreground">
                        {hasNoTablesConfigured
                          ? "This venue has not configured their seating yet. Please contact them directly or try another venue."
                          : isNoSameDaySlots 
                            ? `No same-day slots available. Reservations require at least ${Math.round(minimumLeadTime / 60)} hour${minimumLeadTime >= 120 ? 's' : ''} notice. Please select a future date.`
                            : allSlotsBooked
                              ? `All time slots are fully booked for a party of ${partySize}. Try a different date or party size.`
                              : "This venue is not accepting reservations on the selected date."
                        }
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
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const compareDate = new Date(date);
                      compareDate.setHours(0, 0, 0, 0);
                      return compareDate < today || date > addDays(new Date(), 30);
                    }}
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
                  <SelectValue placeholder={isCheckingAvailability ? "Checking availability..." : "Choose time slot"} />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {isCheckingAvailability ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span className="text-sm text-muted-foreground">Checking availability...</span>
                    </div>
                  ) : (
                    timeSlots.map((time) => {
                      const availability = slotAvailability[time];
                      const isAvailable = availability?.available !== false;
                      
                      return (
                        <SelectItem 
                          key={time} 
                          value={time}
                          disabled={!isAvailable}
                          className={cn(
                            !isAvailable && "opacity-50"
                          )}
                        >
                          <div className="flex items-center justify-between w-full gap-2">
                            <span>{time}</span>
                            {!isAvailable && (
                              <Badge variant="secondary" className="text-xs">
                                Fully booked
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })
                  )}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={() => setStep("party-details")}
              disabled={!reservationDate || !reservationTime || hasNoAvailability || allSlotsBooked || isCheckingAvailability || hasNoTablesConfigured}
              className="w-full"
            >
              {isCheckingAvailability ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking availability...
                </>
              ) : (
                "Continue to Party Details"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "party-details") {
    // Helper function to get today's business hours (checks overnight from previous day)
    const getTodayHours = () => {
      if (!selectedVenueData?.settings?.business_hours) return null;
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const now = new Date();
      const today = dayNames[now.getDay()];
      const currentHour = now.getHours();
      
      // If it's early morning, check previous day's overnight hours
      if (currentHour < 12) {
        const prevDayIndex = (now.getDay() - 1 + 7) % 7;
        const previousDay = dayNames[prevDayIndex];
        const prevDayHours = selectedVenueData.settings.business_hours[previousDay];
        
        if (prevDayHours && !prevDayHours.is_closed && prevDayHours.is_overnight) {
          const currentTime = `${String(currentHour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
          if (currentTime <= prevDayHours.close) {
            return prevDayHours;
          }
        }
      }
      
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
                        : `${getTodayHours()?.open} - ${getTodayHours()?.close}${getTodayHours()?.is_overnight ? ' (+1 day)' : ''}`}
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
              <label className="text-sm font-medium">Contact Number (optional)</label>
              <Input
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="h-12"
              />
              <p className="text-xs text-muted-foreground">
                So the restaurant can contact you if needed
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
                  {activeTableTab === "reservations" ? "Booking..." : "Joining..."}
                </>
              ) : (
                activeTableTab === "reservations" ? "Make Reservation" : "Join Waitlist"
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
    const isReservation = !!waitlistEntry.reservation_time || waitlistEntry.reservation_type === "reservation";
    return (
      <div className="space-y-6 p-6 pb-24" data-tour="table-content">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">{isReservation ? "Reservation" : "Waitlist"} Status</h1>
        </div>

        <Card className="shadow-card">
          <CardContent className="p-8 text-center space-y-6">
            {isReservation ? (
              <>
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <CalendarIcon className="w-10 h-10 text-primary" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-primary">
                    {waitlistEntry.reservation_time 
                      ? format(new Date(waitlistEntry.reservation_time), 'MMM d')
                      : 'Scheduled'}
                  </h2>
                  <p className="text-lg text-muted-foreground">
                    at {waitlistEntry.reservation_time 
                      ? format(new Date(waitlistEntry.reservation_time), 'HH:mm')
                      : '--:--'}
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2 text-lg">
                  <Clock size={20} />
                  <span className="font-semibold">
                    {waitlistEntry.reservation_time 
                      ? formatTimeUntil(new Date(waitlistEntry.reservation_time))
                      : 'Calculating...'}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <Clock className="w-10 h-10 text-primary" />
                </div>
                
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold text-primary">#{waitlistEntry.position ?? "-"}</h2>
                  <p className="text-lg text-muted-foreground">in line</p>
                </div>

                <div className="flex items-center justify-center gap-2 text-lg">
                  <Clock size={20} />
                  <span className="font-semibold">
                    {waitlistEntry.eta 
                      ? formatTimeUntil(new Date(waitlistEntry.eta))
                      : 'Calculating...'} • ETA {waitlistEntry.eta ? new Date(waitlistEntry.eta).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--"}
                  </span>
                </div>
              </>
            )}

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

        {!isReservation && partiesAhead.length > 0 && (
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
                    ? formatTimeUntil(new Date(party.eta))
                    : '~15 min';
                  
                  return (
                    <div key={party.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                          #{party.position ?? "-"}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Users size={14} className="text-muted-foreground" />
                          <span className="text-sm font-medium">Party of {party.party_size}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Clock size={12} />
                          <span>{estimatedWait}</span>
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
              {/* When entry was created */}
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span>
                  {waitlistEntry.reservation_type === 'reservation' 
                    ? 'Reservation confirmed' 
                    : 'You joined the waitlist'}
                </span>
                <span className="text-muted-foreground ml-auto">
                  {formatDistanceToNow(new Date(waitlistEntry.created_at), { addSuffix: true })}
                </span>
              </div>
              
              {/* Position update (if updated after creation) */}
              {waitlistEntry.position !== null && 
               waitlistEntry.position <= 3 && 
               waitlistEntry.updated_at !== waitlistEntry.created_at &&
               !waitlistEntry.ready_at && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-success"></div>
                  <span>Position updated to #{waitlistEntry.position}</span>
                  <span className="text-muted-foreground ml-auto">
                    {formatDistanceToNow(new Date(waitlistEntry.updated_at), { addSuffix: true })}
                  </span>
                </div>
              )}
              
              {/* Table ready notification */}
              {waitlistEntry.ready_at && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-warning"></div>
                  <span>Your table is ready!</span>
                  <span className="text-muted-foreground ml-auto">
                    {formatDistanceToNow(new Date(waitlistEntry.ready_at), { addSuffix: true })}
                  </span>
                </div>
              )}
              
              {/* Next in line indicator */}
              {waitlistEntry.position === 1 && !waitlistEntry.ready_at && (
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-warning animate-pulse"></div>
                  <span className="font-medium">Get ready! You're next</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-4 space-y-3">
            {isReservation && (
              <>
                {(() => {
                  const hoursUntil = waitlistEntry.reservation_time 
                    ? differenceInHours(parseISO(waitlistEntry.reservation_time), new Date())
                    : Infinity;
                  const canEdit = hoursUntil > 2;
                  
                  return (
                    <Button 
                      variant="outline" 
                      className="w-full h-12"
                      onClick={() => setIsEditDialogOpen(true)}
                      disabled={!canEdit}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      {canEdit ? "Edit Reservation" : "Edit unavailable (< 2 hours)"}
                    </Button>
                  );
                })()}
              </>
            )}
            <Button 
              variant="outline" 
              className="w-full h-12 text-destructive hover:bg-destructive/10"
              onClick={() => setShowCancelConfirmation(true)}
            >
              Cancel Booking
            </Button>

            {/* Cancel Booking Confirmation Dialog */}
            <AlertDialog open={showCancelConfirmation} onOpenChange={setShowCancelConfirmation}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Reservation?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel your reservation at {waitlistEntry?.venue}? 
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Don't Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleCancelBooking}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Confirm Cancellation
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Edit Reservation Dialog */}
        {isReservation && waitlistEntry && (
          <EditReservationDialog
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            entry={{
              id: waitlistEntry.id,
              venue: waitlistEntry.venue,
              venue_id: waitlistEntry.venue_id,
              party_size: waitlistEntry.party_size,
              reservation_time: waitlistEntry.reservation_time || null,
              preferences: waitlistEntry.preferences,
              notes: waitlistEntry.notes,
              customer_name: waitlistEntry.customer_name,
            }}
            venueSettings={selectedVenueData?.settings}
            onSuccess={(updatedEntry) => {
              setWaitlistEntry(prev => prev ? {
                ...prev,
                party_size: updatedEntry.party_size,
                reservation_time: updatedEntry.reservation_time,
                eta: updatedEntry.reservation_time,
                preferences: updatedEntry.preferences,
                notes: updatedEntry.notes,
              } : null);
            }}
          />
        )}
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
    // Calculate total seconds for countdown ring (5 minutes = 300 seconds default)
    const totalCountdownSeconds = waitlistEntry.ready_deadline 
      ? Math.max(0, Math.floor((new Date(waitlistEntry.ready_deadline).getTime() - (waitlistEntry.ready_at ? new Date(waitlistEntry.ready_at).getTime() : Date.now())) / 1000))
      : 300;

    // Show celebration overlay on first render of ready state
    if (!celebrationShownRef.current && !showCelebration) {
      celebrationShownRef.current = true;
      // Small delay to let the component mount properly
      setTimeout(() => setShowCelebration(true), 100);
    }

    return (
      <div className="space-y-6 p-6">
        {/* Celebration Overlay */}
        <CelebrationOverlay
          open={showCelebration}
          type="table-ready"
          title="Your Table is Ready!"
          subtitle={`Party of ${waitlistEntry.party_size} at ${waitlistEntry.venue}`}
          actionLabel="I'm Here - Get Seated"
          onAction={() => {
            setShowCelebration(false);
            handleConfirmSeat();
          }}
          onDismiss={() => setShowCelebration(false)}
          secondaryActionLabel={waitlistEntry.patron_delayed ? undefined : "Need 5 More Minutes"}
          onSecondaryAction={waitlistEntry.patron_delayed ? undefined : () => {
            setShowCelebration(false);
            handleWait5Minutes();
          }}
        />

        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Table Ready!</h1>
        </div>

        <Card className="shadow-card">
          <CardContent className="p-8 text-center space-y-6">
            <div className="text-5xl">🍽️</div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-primary">Your Table is Ready!</h2>
              <p className="text-muted-foreground">{waitlistEntry.venue}</p>
            </div>

            <div className="p-6 bg-primary/10 rounded-xl border border-primary/20">
              <p className="font-semibold text-primary">Please head to the host stand now</p>
              <p className="text-sm text-muted-foreground mt-1">Party of {waitlistEntry.party_size}</p>
              {waitlistEntry.ready_deadline && (
                <div className="mt-6 flex justify-center">
                  <CountdownRing
                    minutes={countdownMinutes}
                    seconds={countdownSeconds}
                    totalSeconds={totalCountdownSeconds}
                    size="lg"
                    showPulse={true}
                    label={waitlistEntry.patron_delayed ? "final" : "remaining"}
                  />
                </div>
              )}
              {waitlistEntry.patron_delayed && (
                <p className="text-xs text-muted-foreground mt-3">
                  Final extension - please arrive soon
                </p>
              )}
            </div>

            {/* Only show action buttons if patron hasn't confirmed arrival yet */}
            {!waitlistEntry.awaiting_merchant_confirmation ? (
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
                  onClick={() => setShowCancelConfirmation(true)}
                >
                  Cancel Booking
                </Button>
              </div>
            ) : (
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-xl border border-blue-200 dark:border-blue-800">
                <p className="font-semibold text-blue-900 dark:text-blue-100">
                  ⏳ Notifying the host...
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Please wait at the host stand
                </p>
              </div>
            )}

            {/* Cancel Booking Confirmation Dialog */}
            <AlertDialog open={showCancelConfirmation} onOpenChange={setShowCancelConfirmation}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel your table at {waitlistEntry?.venue}? 
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Don't Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleCancelBooking}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Confirm Cancellation
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
                onClick={() => setShowCancelConfirmation(true)}
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
                Skip
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}