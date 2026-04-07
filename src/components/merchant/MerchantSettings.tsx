import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, X, ChevronDown, Clock, Calendar, AlertCircle, RotateCcw, Save, Settings, Utensils, Users, Timer, Building2, ClipboardList, ImageIcon, Upload, Trash2 } from "lucide-react";
import { TableConfigurationManager } from "./TableConfigurationManager";
import { VenueDiscoverySettings } from "./VenueDiscoverySettings";
import { BusinessHours, HolidayClosure } from "@/utils/businessHours";
import { TIMEZONE_OPTIONS, DEFAULT_TIMEZONE } from "@/utils/timezone";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { VenueLogo } from "@/components/VenueLogo";
import { LogoCropDialog } from "@/components/LogoCropDialog";

interface WaitlistPreference {
  id: string;
  label: string;
  enabled: boolean;
  custom?: boolean;
}

interface TableConfig {
  id: string;
  capacity: number;
  name: string;
}

interface MerchantSettingsProps {
  venue: string;
  venueId: string;
  serviceTypes?: string[];
  onUnsavedChangesChange?: (hasChanges: boolean) => void;
}

export const MerchantSettings = ({ 
  venue, 
  venueId, 
  serviceTypes = ["food_ready", "table_ready"],
  onUnsavedChangesChange
}: MerchantSettingsProps) => {
  const hasFoodReady = serviceTypes.includes("food_ready");
  const hasTableReady = serviceTypes.includes("table_ready");
  const [settings, setSettings] = useState({
    venueCapacity: "40",
    defaultPrepTime: "10",
    maxExtensionTime: "45",
    pickupInstructions: "Please collect your order from the main counter. Show your order number to staff.",
    autoNoShowTime: "15",
    orderNumberRefreshMinutes: "15",
    cobTime: "23:00",
    autoCleanupCancelledWaitlist: true,
    prepTimeMode: "analytics" as "fixed" | "analytics",
    minimumReservationLeadTime: "60"
  });

  const [waitlistPreferences, setWaitlistPreferences] = useState<WaitlistPreference[]>([]);
  const [newPreferenceLabel, setNewPreferenceLabel] = useState("");
  const [autoCleanupRejected, setAutoCleanupRejected] = useState(true);
  const [tableConfiguration, setTableConfiguration] = useState<TableConfig[]>([]);
  const [useClosingTimeForCleanup, setUseClosingTimeForCleanup] = useState(true);
  const [venueTimezone, setVenueTimezone] = useState(DEFAULT_TIMEZONE);
  
  // Business Hours State
  const [businessHours, setBusinessHours] = useState<BusinessHours>({
    monday: { open: "09:00", close: "22:00", is_closed: false, breaks: [] },
    tuesday: { open: "09:00", close: "22:00", is_closed: false, breaks: [] },
    wednesday: { open: "09:00", close: "22:00", is_closed: false, breaks: [] },
    thursday: { open: "09:00", close: "22:00", is_closed: false, breaks: [] },
    friday: { open: "09:00", close: "22:00", is_closed: false, breaks: [] },
    saturday: { open: "09:00", close: "22:00", is_closed: false, breaks: [] },
    sunday: { open: "09:00", close: "22:00", is_closed: true, breaks: [] }
  });
  const [holidayClosures, setHolidayClosures] = useState<HolidayClosure[]>([]);
  const [gracePeriods, setGracePeriods] = useState({
    last_reservation: 0,
    last_order: 15,
    last_waitlist_join: 30
  });
  
  // Dialog states
  const [breakDialogOpen, setBreakDialogOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [breakReason, setBreakReason] = useState("");
  const [breakStart, setBreakStart] = useState("");
  const [breakEnd, setBreakEnd] = useState("");
  const [holidayDialogOpen, setHolidayDialogOpen] = useState(false);
  const [holidayDate, setHolidayDate] = useState<Date | undefined>(undefined);
  const [holidayReason, setHolidayReason] = useState("");
  const [holidayFullyClosed, setHolidayFullyClosed] = useState(true);
  const [holidayOpen, setHolidayOpen] = useState("09:00");
  const [holidayClose, setHolidayClose] = useState("22:00");
  const [holidayOvernight, setHolidayOvernight] = useState(false);

  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const initialSettingsRef = useRef<typeof settings | null>(null);
  const initialBusinessHoursRef = useRef<BusinessHours | null>(null);
  const initialWaitlistPreferencesRef = useRef<WaitlistPreference[] | null>(null);
  const initialHolidayClosuresRef = useRef<HolidayClosure[] | null>(null);
  const initialGracePeriodsRef = useRef<typeof gracePeriods | null>(null);
  const initialAutoCleanupRejectedRef = useRef<boolean | null>(null);
  const initialTableConfigurationRef = useRef<TableConfig[] | null>(null);
  const initialUseClosingTimeForCleanupRef = useRef<boolean | null>(null);
  const initialVenueTimezoneRef = useRef<string | null>(null);

  const { toast } = useToast();

  // Browser beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Track changes after initial load and notify parent
  useEffect(() => {
    if (!isInitialLoad) {
      setHasUnsavedChanges(true);
    }
  }, [settings, businessHours, waitlistPreferences, holidayClosures, gracePeriods, autoCleanupRejected, tableConfiguration, useClosingTimeForCleanup, venueTimezone]);

  // Notify parent of unsaved changes state
  useEffect(() => {
    onUnsavedChangesChange?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onUnsavedChangesChange]);

  useEffect(() => {
    const fetchVenueSettings = async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("waitlist_preferences, settings, timezone")
        .eq("id", venueId)
        .single();

      if (error) {
        console.error("Error fetching venue settings:", error);
        return;
      }

      // Load timezone
      if (data?.timezone) {
        setVenueTimezone(data.timezone);
        initialVenueTimezoneRef.current = data.timezone;
      } else {
        initialVenueTimezoneRef.current = DEFAULT_TIMEZONE;
      }

      if (data?.settings) {
        const settings = data.settings as any || {};
        
        // Load business hours
        if (settings.business_hours) {
          setBusinessHours(settings.business_hours);
        }
        
        // Load holiday closures
        if (settings.holiday_closures) {
          setHolidayClosures(settings.holiday_closures);
        }
        
        // Load grace periods
        if (settings.grace_periods) {
          setGracePeriods(settings.grace_periods);
        }
        
        // Load auto cleanup setting
        if (settings.auto_cleanup_rejected !== undefined) {
          setAutoCleanupRejected(settings.auto_cleanup_rejected);
        }
        
        // Load table configuration
        if (settings.table_configuration) {
          setTableConfiguration(settings.table_configuration);
        }
        
        // Load use_closing_time_for_cleanup setting
        if (settings.use_closing_time_for_cleanup !== undefined) {
          setUseClosingTimeForCleanup(settings.use_closing_time_for_cleanup);
        }
        
        // Load kitchen/food and waitlist/table settings
        setSettings({
          venueCapacity: settings.venue_capacity?.toString() || "40",
          defaultPrepTime: settings.default_prep_time?.toString() || "10",
          maxExtensionTime: settings.max_extension_time?.toString() || "45",
          pickupInstructions: settings.pickup_instructions || "Please collect your order from the main counter. Show your order number to staff.",
          autoNoShowTime: settings.auto_no_show_time?.toString() || "15",
          orderNumberRefreshMinutes: settings.order_number_refresh_minutes?.toString() || "15",
          cobTime: settings.cob_time || "23:00",
          autoCleanupCancelledWaitlist: settings.auto_cleanup_cancelled_waitlist !== false,
          prepTimeMode: settings.prep_time_mode || "analytics",
          minimumReservationLeadTime: settings.minimum_reservation_lead_time?.toString() || "60"
        });
      }

      if (data?.waitlist_preferences) {
        const prefs = data.waitlist_preferences as { options?: WaitlistPreference[] };
        if (prefs.options) {
          setWaitlistPreferences(prefs.options);
          initialWaitlistPreferencesRef.current = prefs.options;
        } else {
          // Set default preferences if none exist
          const defaultPrefs = [
            { id: "indoor", label: "Indoor Seating", enabled: true },
            { id: "outdoor", label: "Outdoor Seating", enabled: true },
            { id: "smoking", label: "Smoking Area", enabled: false }
          ];
          setWaitlistPreferences(defaultPrefs);
          initialWaitlistPreferencesRef.current = defaultPrefs;
        }
      }

      // Store initial values for comparison
      initialSettingsRef.current = {
        venueCapacity: (data?.settings as any)?.venue_capacity?.toString() || "40",
        defaultPrepTime: (data?.settings as any)?.default_prep_time?.toString() || "10",
        maxExtensionTime: (data?.settings as any)?.max_extension_time?.toString() || "45",
        pickupInstructions: (data?.settings as any)?.pickup_instructions || "Please collect your order from the main counter. Show your order number to staff.",
        autoNoShowTime: (data?.settings as any)?.auto_no_show_time?.toString() || "15",
        orderNumberRefreshMinutes: (data?.settings as any)?.order_number_refresh_minutes?.toString() || "15",
        cobTime: (data?.settings as any)?.cob_time || "23:00",
        autoCleanupCancelledWaitlist: (data?.settings as any)?.auto_cleanup_cancelled_waitlist !== false,
        prepTimeMode: (data?.settings as any)?.prep_time_mode || "analytics",
        minimumReservationLeadTime: (data?.settings as any)?.minimum_reservation_lead_time?.toString() || "60"
      };
      initialBusinessHoursRef.current = (data?.settings as any)?.business_hours || businessHours;
      initialHolidayClosuresRef.current = (data?.settings as any)?.holiday_closures || [];
      initialGracePeriodsRef.current = (data?.settings as any)?.grace_periods || gracePeriods;
      initialAutoCleanupRejectedRef.current = (data?.settings as any)?.auto_cleanup_rejected !== false;
      initialTableConfigurationRef.current = (data?.settings as any)?.table_configuration || [];
      initialUseClosingTimeForCleanupRef.current = (data?.settings as any)?.use_closing_time_for_cleanup !== false;

      // Mark initial load as complete after a short delay
      setTimeout(() => setIsInitialLoad(false), 100);
    };

    fetchVenueSettings();
  }, [venueId]);

  const handleSaveAll = async () => {
    console.log("Saving all venue settings");
    
    // Validation for business hours
    for (const [day, hours] of Object.entries(businessHours)) {
      if (!hours.is_closed) {
        // Validate overnight hours
        if (hours.is_overnight) {
          if (hours.open <= hours.close) {
            toast({
              title: "Invalid Overnight Hours",
              description: `${day}: When overnight is enabled, opening time must be later than closing time (e.g., open at 18:00, close at 02:00)`,
              variant: "destructive"
            });
            return;
          }
          if (hours.close >= "12:00") {
            toast({
              title: "Invalid Overnight Hours",
              description: `${day}: Overnight closing time should be before noon (e.g., 02:00, not 14:00)`,
              variant: "destructive"
            });
            return;
          }
        } else {
          // Validate regular hours
          if (hours.open >= hours.close) {
            toast({
              title: "Invalid Hours",
              description: `${day}: Closing time must be after opening time, or enable "Overnight Hours" checkbox`,
              variant: "destructive"
            });
            return;
          }
        }
        
        // Validate breaks are within business hours (skip for overnight)
        if (!hours.is_overnight) {
          for (const breakTime of hours.breaks || []) {
            if (breakTime.start < hours.open || breakTime.end > hours.close) {
              toast({
                title: "Invalid Break",
                description: `${day}: Break times must be within business hours`,
                variant: "destructive"
              });
              return;
            }
          }
        }
      }
    }
    
    // Check at least one day is open
    const allClosed = Object.values(businessHours).every(h => h.is_closed);
    if (allClosed) {
      toast({
        title: "Error",
        description: "At least one day must be open",
        variant: "destructive"
      });
      return;
    }

    // Get current settings to merge with
    const { data: currentVenue } = await supabase
      .from("venues")
      .select("settings")
      .eq("id", venueId)
      .single();
    
    // Build complete settings object with all configurations
    const currentSettings = (currentVenue?.settings as Record<string, any>) || {};
    const updatedSettings = {
      // Business hours & scheduling
      business_hours: businessHours,
      holiday_closures: holidayClosures,
      grace_periods: gracePeriods,
      auto_cleanup_rejected: autoCleanupRejected,
      auto_cleanup_cancelled_waitlist: settings.autoCleanupCancelledWaitlist,
      cob_time: useClosingTimeForCleanup ? null : settings.cobTime,
      use_closing_time_for_cleanup: useClosingTimeForCleanup,
      
      // Kitchen/Food settings
      default_prep_time: parseInt(settings.defaultPrepTime) || 10,
      max_extension_time: parseInt(settings.maxExtensionTime) || 45,
      pickup_instructions: settings.pickupInstructions,
      order_number_refresh_minutes: parseInt(settings.orderNumberRefreshMinutes) || 15,
      prep_time_mode: settings.prepTimeMode,
      
      // Waitlist/Table settings
      venue_capacity: parseInt(settings.venueCapacity) || 40,
      auto_no_show_time: parseInt(settings.autoNoShowTime) || 15,
      
      // Booking & Timing settings
      minimum_reservation_lead_time: parseInt(settings.minimumReservationLeadTime) || 60,
      
      // Table configuration
      table_configuration: tableConfiguration,
    };
    
    // Save everything in one transaction - include timezone in venues table directly
    const { error } = await supabase
      .from("venues")
      .update({
        settings: updatedSettings as any,
        waitlist_preferences: { options: waitlistPreferences } as any,
        timezone: venueTimezone
      })
      .eq("id", venueId);

    if (error) {
      toast({
        title: "Error",
        description: "Could not save settings",
        variant: "destructive"
      });
      return;
    }

    // Update initial refs to match saved state
    initialSettingsRef.current = { ...settings };
    initialBusinessHoursRef.current = { ...businessHours };
    initialWaitlistPreferencesRef.current = [...waitlistPreferences];
    initialHolidayClosuresRef.current = [...holidayClosures];
    initialGracePeriodsRef.current = { ...gracePeriods };
    initialAutoCleanupRejectedRef.current = autoCleanupRejected;
    initialTableConfigurationRef.current = [...tableConfiguration];
    initialUseClosingTimeForCleanupRef.current = useClosingTimeForCleanup;
    initialVenueTimezoneRef.current = venueTimezone;
    
    setHasUnsavedChanges(false);

    toast({
      title: "All Settings Saved",
      description: "Venue settings have been updated successfully",
    });
  };

  const handleDiscardChanges = useCallback(() => {
    if (initialSettingsRef.current) setSettings(initialSettingsRef.current);
    if (initialBusinessHoursRef.current) setBusinessHours(initialBusinessHoursRef.current);
    if (initialWaitlistPreferencesRef.current) setWaitlistPreferences(initialWaitlistPreferencesRef.current);
    if (initialHolidayClosuresRef.current) setHolidayClosures(initialHolidayClosuresRef.current);
    if (initialGracePeriodsRef.current) setGracePeriods(initialGracePeriodsRef.current);
    if (initialAutoCleanupRejectedRef.current !== null) setAutoCleanupRejected(initialAutoCleanupRejectedRef.current);
    if (initialTableConfigurationRef.current) setTableConfiguration(initialTableConfigurationRef.current);
    if (initialUseClosingTimeForCleanupRef.current !== null) setUseClosingTimeForCleanup(initialUseClosingTimeForCleanupRef.current);
    if (initialVenueTimezoneRef.current) setVenueTimezone(initialVenueTimezoneRef.current);
    setHasUnsavedChanges(false);
    
    toast({
      title: "Changes Discarded",
      description: "Settings have been reverted to their last saved state",
    });
  }, [toast]);


  const handleInputChange = (key: string, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const togglePreference = (id: string) => {
    setWaitlistPreferences(prev =>
      prev.map(pref =>
        pref.id === id ? { ...pref, enabled: !pref.enabled } : pref
      )
    );
  };

  const addCustomPreference = () => {
    if (!newPreferenceLabel.trim()) {
      toast({
        title: "Label Required",
        description: "Please enter a label for the preference",
        variant: "destructive"
      });
      return;
    }

    const newPref: WaitlistPreference = {
      id: newPreferenceLabel.toLowerCase().replace(/\s+/g, '_'),
      label: newPreferenceLabel.trim(),
      enabled: true,
      custom: true
    };

    setWaitlistPreferences(prev => [...prev, newPref]);
    setNewPreferenceLabel("");
    
    toast({
      title: "Preference Added",
      description: "Don't forget to click 'Save Settings' to apply changes",
    });
  };

  const removeCustomPreference = (id: string) => {
    setWaitlistPreferences(prev => prev.filter(pref => pref.id !== id));
  };
  
  const addBreakToDay = () => {
    if (!breakReason.trim() || !breakStart || !breakEnd || !selectedDay) return;
    
    if (breakStart >= breakEnd) {
      toast({
        title: "Invalid Break Times",
        description: "Break end time must be after start time",
        variant: "destructive"
      });
      return;
    }
    
    setBusinessHours(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        breaks: [...(prev[selectedDay].breaks || []), { start: breakStart, end: breakEnd, reason: breakReason }]
      }
    }));
    
    setBreakDialogOpen(false);
    setBreakReason("");
    setBreakStart("");
    setBreakEnd("");
    setSelectedDay("");
  };
  
  const removeBreak = (day: string, index: number) => {
    setBusinessHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        breaks: prev[day].breaks?.filter((_, i) => i !== index) || []
      }
    }));
  };
  
  const addHolidayClosure = () => {
    if (!holidayDate || !holidayReason.trim()) return;
    
    const newHoliday: HolidayClosure = {
      date: format(holidayDate, "yyyy-MM-dd"),
      is_closed: holidayFullyClosed,
      reason: holidayReason,
      special_hours: !holidayFullyClosed ? { 
        open: holidayOpen, 
        close: holidayClose,
        is_overnight: holidayOvernight 
      } : undefined,
      breaks: []
    };
    
    setHolidayClosures(prev => [...prev, newHoliday].sort((a, b) => a.date.localeCompare(b.date)));
    setHolidayDialogOpen(false);
    setHolidayDate(undefined);
    setHolidayReason("");
    setHolidayFullyClosed(true);
    setHolidayOvernight(false);
  };
  
  const removeHoliday = (date: string) => {
    setHolidayClosures(prev => prev.filter(h => h.date !== date));
  };
  
  const copyToAllDays = (sourceDay: string) => {
    const sourceHours = businessHours[sourceDay];
    const updated: BusinessHours = {};
    Object.keys(businessHours).forEach(day => {
      updated[day] = { ...sourceHours };
    });
    setBusinessHours(updated);
    toast({
      title: "Hours Copied",
      description: `${sourceDay}'s hours copied to all days`,
    });
  };

  // Build accordion default values based on service types
  const getDefaultAccordionValues = () => {
    const values = ["discovery"];
    if (hasTableReady) values.push("tables");
    if (hasFoodReady) values.push("kitchen");
    return values;
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Venue Settings</h2>

      <Accordion type="multiple" defaultValue={getDefaultAccordionValues()} className="space-y-4">
        {/* Venue Discovery Profile - Available for all venues */}
        <AccordionItem value="discovery" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="text-lg font-semibold hover:no-underline">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Venue Discovery Profile
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4">
            <VenueDiscoverySettings venueId={venueId} />
          </AccordionContent>
        </AccordionItem>

        {/* Table Configuration - Only for table_ready */}
        {hasTableReady && (
          <AccordionItem value="tables" className="border rounded-lg px-4 bg-card">
            <AccordionTrigger className="text-lg font-semibold hover:no-underline">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Table Configuration
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4">
              <TableConfigurationManager 
                tables={tableConfiguration}
                onChange={setTableConfiguration}
              />
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Kitchen Settings - Only for food_ready */}
        {hasFoodReady && (
          <AccordionItem value="kitchen" className="border rounded-lg px-4 bg-card">
            <AccordionTrigger className="text-lg font-semibold hover:no-underline">
              <div className="flex items-center gap-2">
                <Utensils className="h-5 w-5 text-primary" />
                Kitchen Settings
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 space-y-6">
              {/* Prep Time Mode Toggle */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Prep Time Mode</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleInputChange("prepTimeMode", "fixed")}
                    className={cn(
                      "p-4 rounded-lg border-2 text-left transition-all",
                      settings.prepTimeMode === "fixed" 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="font-medium">Fixed Time</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Simple, predictable prep times
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInputChange("prepTimeMode", "analytics")}
                    className={cn(
                      "p-4 rounded-lg border-2 text-left transition-all",
                      settings.prepTimeMode === "analytics" 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="font-medium flex items-center gap-2">
                      Smart ETA
                      <Badge variant="secondary" className="text-xs">Analytics</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      ML-powered dynamic predictions
                    </p>
                  </button>
                </div>
              </div>

              {/* Smart ETA Explanation - Only show when analytics mode is selected */}
              {settings.prepTimeMode === "analytics" && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-3 border">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    How Smart ETA Works
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      <span><strong>Historical Learning:</strong> Uses 30 days of your order data to understand typical prep times</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      <span><strong>Kitchen Load:</strong> Adjusts ETA based on current orders (1.0x when quiet, up to 1.6x when busy)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      <span><strong>Order Complexity:</strong> Larger orders get 10-20% more time automatically</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold">•</span>
                      <span><strong>Time-Aware:</strong> Considers day of week and hour patterns from your history</span>
                    </li>
                  </ul>
                  <p className="text-xs text-muted-foreground border-t pt-3 mt-3">
                    💡 Confidence improves with more data. You need ~30 completed orders for reliable predictions.
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="prepTime" className="flex items-center gap-2">
                  {settings.prepTimeMode === "fixed" ? "Prep Time" : "Default Prep Time (fallback)"}
                  {settings.prepTimeMode === "analytics" && (
                    <Badge variant="outline" className="text-xs font-normal">Used when no historical data</Badge>
                  )}
                </Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    id="prepTime"
                    type="number"
                    value={settings.defaultPrepTime}
                    onChange={(e) => handleInputChange("defaultPrepTime", e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1.5">
                  {settings.prepTimeMode === "fixed" 
                    ? "All orders will show this prep time"
                    : "Starting point for new venues until enough historical data is collected"
                  }
                </p>
              </div>

              <div>
                <Label htmlFor="maxExtension">Maximum Extension Time (minutes)</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    id="maxExtension"
                    type="number"
                    value={settings.maxExtensionTime}
                    onChange={(e) => handleInputChange("maxExtensionTime", e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1.5">
                  Maximum time an order ETA can be extended
                </p>
              </div>

              <div>
                <Label htmlFor="orderRefresh" className="flex items-center gap-2">
                  Order Number Refresh Time
                  <Badge variant="outline" className="text-xs font-normal">Duplicate prevention</Badge>
                </Label>
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    id="orderRefresh"
                    type="number"
                    value={settings.orderNumberRefreshMinutes}
                    onChange={(e) => handleInputChange("orderNumberRefreshMinutes", e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">minutes</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1.5">
                  After this many minutes, the same order number can be used again.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}


        {/* Waitlist Preferences - Only for table_ready */}
        {hasTableReady && (
          <AccordionItem value="waitlist" className="border rounded-lg px-4 bg-card">
            <AccordionTrigger className="text-lg font-semibold hover:no-underline">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Waitlist Preferences
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Choose which seating preferences to display to customers when they join the waitlist
              </p>
              
              {waitlistPreferences.map((pref) => (
                <div key={pref.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex-1">
                    <Label htmlFor={pref.id}>{pref.label}</Label>
                    {pref.custom && (
                      <p className="text-xs text-muted-foreground">Custom option</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={pref.id}
                      checked={pref.enabled}
                      onCheckedChange={() => togglePreference(pref.id)}
                    />
                    {pref.custom && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeCustomPreference(pref.id)}
                      >
                        <X size={16} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              <Separator className="my-4" />

              <div className="space-y-2">
                <Label htmlFor="newPreference">Add Custom Preference</Label>
                <div className="flex gap-2">
                  <Input
                    id="newPreference"
                    placeholder="e.g., Kids Area, Window Seat"
                    value={newPreferenceLabel}
                    onChange={(e) => setNewPreferenceLabel(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addCustomPreference()}
                  />
                  <Button onClick={addCustomPreference} size="sm">
                    <Plus size={16} />
                  </Button>
                </div>
              </div>
              
              <Separator className="my-4" />
              
              <div className="space-y-2">
                <Label htmlFor="venueCapacity">Venue Capacity (guests)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="venueCapacity"
                    type="number"
                    value={settings.venueCapacity}
                    onChange={(e) => handleInputChange("venueCapacity", e.target.value)}
                    className="w-24"
                    min="1"
                  />
                  <span className="text-sm text-muted-foreground">guests</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Maximum number of guests your venue can accommodate. Used for capacity status calculations.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Pickup Instructions - Only for food_ready */}
        {hasFoodReady && (
          <AccordionItem value="pickup" className="border rounded-lg px-4 bg-card">
            <AccordionTrigger className="text-lg font-semibold hover:no-underline">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Pickup Instructions
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 space-y-4">
              <div>
                <Label htmlFor="instructions">Instructions for Customers</Label>
                <Textarea
                  id="instructions"
                  value={settings.pickupInstructions}
                  onChange={(e) => handleInputChange("pickupInstructions", e.target.value)}
                  placeholder="Enter pickup instructions..."
                  className="min-h-[100px] mt-2"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  These instructions will be shown to customers when their order is ready
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Business Hours Management */}
        <AccordionItem value="hours" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="text-lg font-semibold hover:no-underline">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Business Hours & Schedule
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4 space-y-6">
            {/* Venue Timezone */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <Label className="text-base font-medium">Venue Timezone</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Set the timezone for your venue. This affects business hours, reservations, and analytics.
              </p>
              <Select value={venueTimezone} onValueChange={setVenueTimezone}>
                <SelectTrigger className="w-full md:w-80">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Regular Business Hours */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted rounded-lg">
                <h3 className="font-semibold">Regular Business Hours</h3>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-3">
                {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day) => {
                  const hours = businessHours[day];
                  const dayName = day.charAt(0).toUpperCase() + day.slice(1);
                  const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() === day;
                  
                  return (
                    <div key={day} className={cn("p-4 border rounded-lg", isToday && "bg-primary/5 border-primary")}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{dayName}</span>
                          {isToday && <Badge variant="outline" className="text-xs">Today</Badge>}
                        </div>
                        <div className="flex items-center gap-3">
                          <Label htmlFor={`${day}-closed`} className="text-sm">Closed All Day</Label>
                          <Switch
                            id={`${day}-closed`}
                            checked={hours.is_closed}
                            onCheckedChange={(checked) => 
                              setBusinessHours(prev => ({
                                ...prev,
                                [day]: { ...prev[day], is_closed: checked }
                              }))
                            }
                          />
                        </div>
                      </div>
                      
                      {!hours.is_closed && (
                        <>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <Label htmlFor={`${day}-open`} className="text-xs">Opening Time</Label>
                              <Input
                                id={`${day}-open`}
                                type="time"
                                value={hours.open}
                                onChange={(e) => 
                                  setBusinessHours(prev => ({
                                    ...prev,
                                    [day]: { ...prev[day], open: e.target.value }
                                  }))
                                }
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor={`${day}-close`} className="text-xs">
                                Closing Time
                                {hours.is_overnight && <span className="text-primary ml-1">(+1 day)</span>}
                              </Label>
                              <Input
                                id={`${day}-close`}
                                type="time"
                                value={hours.close}
                                onChange={(e) => 
                                  setBusinessHours(prev => ({
                                    ...prev,
                                    [day]: { ...prev[day], close: e.target.value }
                                  }))
                                }
                                className="mt-1"
                              />
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 mb-3">
                            <Checkbox
                              id={`${day}-overnight`}
                              checked={hours.is_overnight || false}
                              onCheckedChange={(checked) => 
                                setBusinessHours(prev => ({
                                  ...prev,
                                  [day]: { ...prev[day], is_overnight: !!checked }
                                }))
                              }
                            />
                            <Label htmlFor={`${day}-overnight`} className="text-xs text-muted-foreground cursor-pointer">
                              Overnight hours (closes after midnight)
                            </Label>
                          </div>
                          
                          {hours.breaks && hours.breaks.length > 0 && (
                            <div className="mb-3 space-y-2">
                              <Label className="text-xs text-muted-foreground">Breaks:</Label>
                              {hours.breaks.map((breakTime, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-muted/50 p-2 rounded text-sm">
                                  <span>{breakTime.reason}: {breakTime.start} - {breakTime.end}</span>
                                  <Button variant="ghost" size="sm" onClick={() => removeBreak(day, idx)}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedDay(day);
                                setBreakDialogOpen(true);
                              }}
                              className="text-xs"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Break
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToAllDays(day)}
                              className="text-xs"
                            >
                              Copy to All Days
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
            
            {/* Holiday Closures */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted rounded-lg">
                <h3 className="font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Holiday Closures & Special Dates
                </h3>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-3">
                {holidayClosures.length > 0 ? (
                  <div className="space-y-2">
                    {holidayClosures.map((holiday) => (
                      <div key={holiday.date} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{format(new Date(holiday.date + 'T12:00:00'), "EEEE, MMMM d, yyyy")}</div>
                          <div className="text-sm text-muted-foreground">{holiday.reason}</div>
                          {!holiday.is_closed && holiday.special_hours && (
                            <div className="text-xs text-primary mt-1">
                              Special Hours: {holiday.special_hours.open} - {holiday.special_hours.close}{holiday.special_hours.is_overnight ? ' (+1 day)' : ''}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={holiday.is_closed ? "secondary" : "outline"}>
                            {holiday.is_closed ? "Closed" : "Special Hours"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeHoliday(holiday.date)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No holiday closures configured
                  </p>
                )}
                
                <Button
                  variant="outline"
                  onClick={() => setHolidayDialogOpen(true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Holiday Closure
                </Button>
              </CollapsibleContent>
            </Collapsible>
            
            {/* Operations & Cleanup */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted rounded-lg">
                <h3 className="font-semibold flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Operations & Cleanup
                </h3>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-4">
                <div className="space-y-4">
                  <Label className="text-base font-medium">Run cleanup at Close of Business?</Label>
                  <RadioGroup 
                    value={useClosingTimeForCleanup ? "yes" : "no"}
                    onValueChange={(val) => setUseClosingTimeForCleanup(val === "yes")}
                    className="space-y-2"
                  >
                    <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value="yes" id="cob-yes" />
                      <Label htmlFor="cob-yes" className="flex-1 cursor-pointer">
                        <div className="font-medium">Yes - Use business closing time</div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Cleanup runs automatically when your venue closes for the day
                        </p>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <RadioGroupItem value="no" id="cob-no" />
                      <Label htmlFor="cob-no" className="flex-1 cursor-pointer">
                        <div className="font-medium">No - Use custom time</div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Set a specific time for cleanup regardless of business hours
                        </p>
                      </Label>
                    </div>
                  </RadioGroup>
                  
                  {!useClosingTimeForCleanup && (
                    <div className="ml-6 mt-3 p-4 bg-muted/50 rounded-lg border">
                      <Label htmlFor="cob-time" className="text-sm font-medium">Cleanup Time</Label>
                      <Input
                        id="cob-time"
                        type="time"
                        value={settings.cobTime}
                        onChange={(e) => handleInputChange('cobTime', e.target.value)}
                        className="w-32 mt-2"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Daily cleanup will run at this specific time
                      </p>
                    </div>
                  )}
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <Label className="text-sm font-medium text-muted-foreground">Cleanup Actions</Label>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="space-y-0.5">
                      <Label>Auto-cleanup cancelled waitlist entries</Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically remove cancelled/no-show entries
                      </p>
                    </div>
                    <Switch
                      checked={settings.autoCleanupCancelledWaitlist}
                      onCheckedChange={(checked) => handleInputChange('autoCleanupCancelledWaitlist', checked)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="space-y-0.5">
                      <Label>Auto-cleanup rejected orders</Label>
                      <p className="text-xs text-muted-foreground">
                        Automatically remove rejected orders at cleanup time
                      </p>
                    </div>
                    <Switch
                      checked={autoCleanupRejected}
                      onCheckedChange={setAutoCleanupRejected}
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
            
          </AccordionContent>
        </AccordionItem>

        {/* Booking & Timing Rules - NEW SECTION */}
        {hasTableReady && (
          <AccordionItem value="booking-rules" className="border rounded-lg px-4 bg-card">
            <AccordionTrigger className="text-lg font-semibold hover:no-underline">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                Booking & Timing Rules
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 space-y-6">
              {/* Minimum Reservation Lead Time */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Minimum Reservation Lead Time</Label>
                <p className="text-sm text-muted-foreground">
                  How far in advance must reservations be made?
                </p>
                <div className="flex items-center gap-4">
                  <Slider
                    min={0}
                    max={180}
                    step={15}
                    value={[parseInt(settings.minimumReservationLeadTime)]}
                    onValueChange={(value) => handleInputChange("minimumReservationLeadTime", value[0].toString())}
                    className="flex-1"
                  />
                  <Badge variant="outline" className="min-w-[80px] justify-center">
                    {settings.minimumReservationLeadTime === "0" 
                      ? "No minimum" 
                      : `${settings.minimumReservationLeadTime} min`}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Set to 0 to allow last-minute reservations. 60 min = 1 hour notice required.
                </p>
              </div>

              <Separator />

              {/* Grace Periods */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Grace Periods (Before Closing)</Label>
                <div className="p-3 bg-secondary/50 rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    Grace periods determine how long before closing time you stop accepting new reservations, orders, and waitlist joins.
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="reservation-grace">Last Reservation ({gracePeriods.last_reservation} min before close)</Label>
                  <Slider
                    id="reservation-grace"
                    min={0}
                    max={60}
                    step={5}
                    value={[gracePeriods.last_reservation]}
                    onValueChange={(value) => setGracePeriods(prev => ({ ...prev, last_reservation: value[0] }))}
                    className="mt-2"
                  />
                </div>
                
                <div>
                  <Label htmlFor="order-grace">Last Food Order ({gracePeriods.last_order} min before close)</Label>
                  <Slider
                    id="order-grace"
                    min={0}
                    max={60}
                    step={5}
                    value={[gracePeriods.last_order]}
                    onValueChange={(value) => setGracePeriods(prev => ({ ...prev, last_order: value[0] }))}
                    className="mt-2"
                  />
                </div>
                
                <div>
                  <Label htmlFor="waitlist-grace">Last Waitlist Join ({gracePeriods.last_waitlist_join} min before close)</Label>
                  <Slider
                    id="waitlist-grace"
                    min={0}
                    max={60}
                    step={5}
                    value={[gracePeriods.last_waitlist_join]}
                    onValueChange={(value) => setGracePeriods(prev => ({ ...prev, last_waitlist_join: value[0] }))}
                    className="mt-2"
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* Auto No-Show Settings */}
        <AccordionItem value="noshow" className="border rounded-lg px-4 bg-card">
          <AccordionTrigger className="text-lg font-semibold hover:no-underline">
            <div className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-primary" />
              Auto No-Show Settings
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-2 pb-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hasTableReady && (
                <div className="p-4 border rounded-lg">
                  <Label htmlFor="waitlistNoShow">Waitlist No-Show (minutes)</Label>
                  <Input
                    id="waitlistNoShow"
                    type="number"
                    value={settings.autoNoShowTime}
                    onChange={(e) => handleInputChange("autoNoShowTime", e.target.value)}
                    className="mt-2"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Automatically mark as no-show after table is ready
                  </p>
                </div>
              )}
              {hasFoodReady && (
                <div className="p-4 border rounded-lg">
                  <Label>Food Orders No-Show</Label>
                  <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground mt-2">
                    Food orders are automatically marked as no-show at end of day if not collected
                  </div>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Break Dialog */}
      <Dialog open={breakDialogOpen} onOpenChange={setBreakDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Break/Special Hours</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="break-reason">Reason</Label>
              <Input
                id="break-reason"
                placeholder="e.g., Prayer Time, Lunch Break, Cleaning"
                value={breakReason}
                onChange={(e) => setBreakReason(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="break-start">Start Time</Label>
                <Input
                  id="break-start"
                  type="time"
                  value={breakStart}
                  onChange={(e) => setBreakStart(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="break-end">End Time</Label>
                <Input
                  id="break-end"
                  type="time"
                  value={breakEnd}
                  onChange={(e) => setBreakEnd(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={addBreakToDay} className="w-full">
              Add Break
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Holiday Dialog */}
      <Dialog open={holidayDialogOpen} onOpenChange={setHolidayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Holiday Closure</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start mt-1">
                    {holidayDate ? format(holidayDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <CalendarComponent
                    mode="single"
                    selected={holidayDate}
                    onSelect={setHolidayDate}
                    disabled={(date) => date < new Date()}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label htmlFor="holiday-reason">Reason</Label>
              <Input
                id="holiday-reason"
                placeholder="e.g., Christmas, Eid al-Fitr, Private Event"
                value={holidayReason}
                onChange={(e) => setHolidayReason(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="fully-closed">Closed All Day</Label>
              <Switch
                id="fully-closed"
                checked={holidayFullyClosed}
                onCheckedChange={setHolidayFullyClosed}
              />
            </div>
            {!holidayFullyClosed && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="holiday-open">Opening Time</Label>
                    <Input
                      id="holiday-open"
                      type="time"
                      value={holidayOpen}
                      onChange={(e) => setHolidayOpen(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="holiday-close">
                      Closing Time
                      {holidayOvernight && <span className="text-primary ml-1">(+1 day)</span>}
                    </Label>
                    <Input
                      id="holiday-close"
                      type="time"
                      value={holidayClose}
                      onChange={(e) => setHolidayClose(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="holiday-overnight"
                    checked={holidayOvernight}
                    onCheckedChange={(checked) => setHolidayOvernight(!!checked)}
                  />
                  <Label htmlFor="holiday-overnight" className="text-xs text-muted-foreground cursor-pointer">
                    Overnight hours (closes after midnight on the next day)
                  </Label>
                </div>
              </>
            )}
            <Button onClick={addHolidayClosure} className="w-full">
              Add Holiday
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Spacer for sticky footer */}
      <div className={hasUnsavedChanges ? "h-24" : "h-0"} />

      {/* Sticky Save Footer */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg z-50">
          <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">You have unsaved changes</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleDiscardChanges} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Discard
              </Button>
              <Button onClick={handleSaveAll} className="gap-2">
                <Save className="h-4 w-4" />
                Save All Settings
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
