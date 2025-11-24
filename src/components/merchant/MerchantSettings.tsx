import { useState, useEffect } from "react";
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
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, X, ChevronDown, Clock, Calendar, AlertCircle } from "lucide-react";
import { TableConfigurationManager } from "./TableConfigurationManager";
import { BusinessHours, HolidayClosure } from "@/utils/businessHours";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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

export const MerchantSettings = ({ 
  venue, 
  venueId, 
  serviceTypes = ["food_ready", "table_ready"] 
}: { 
  venue: string; 
  venueId: string;
  serviceTypes?: string[];
}) => {
  const hasFoodReady = serviceTypes.includes("food_ready");
  const hasTableReady = serviceTypes.includes("table_ready");
  const [settings, setSettings] = useState({
    venueCapacity: "40",
    tablesPerInterval: "4",
    defaultPrepTime: "10",
    maxExtensionTime: "45",
    pickupInstructions: "Please collect your order from the main counter. Show your order number to staff.",
    autoNoShowTime: "15",
    orderNumberRefreshMinutes: "15"
  });

  const [waitlistPreferences, setWaitlistPreferences] = useState<WaitlistPreference[]>([]);
  const [newPreferenceLabel, setNewPreferenceLabel] = useState("");
  const [autoCleanupRejected, setAutoCleanupRejected] = useState(true);
  const [tableConfiguration, setTableConfiguration] = useState<TableConfig[]>([]);
  
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

  const { toast } = useToast();

  useEffect(() => {
    const fetchVenueSettings = async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("waitlist_preferences, settings")
        .eq("id", venueId)
        .single();

      if (error) {
        console.error("Error fetching venue settings:", error);
        return;
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
        
        // Load kitchen/food and waitlist/table settings
        setSettings({
          venueCapacity: settings.venue_capacity?.toString() || "40",
          tablesPerInterval: settings.tables_per_interval?.toString() || "4",
          defaultPrepTime: settings.default_prep_time?.toString() || "10",
          maxExtensionTime: settings.max_extension_time?.toString() || "45",
          pickupInstructions: settings.pickup_instructions || "Please collect your order from the main counter. Show your order number to staff.",
          autoNoShowTime: settings.auto_no_show_time?.toString() || "15",
          orderNumberRefreshMinutes: settings.order_number_refresh_minutes?.toString() || "15"
        });
      }

      if (data?.waitlist_preferences) {
        const prefs = data.waitlist_preferences as { options?: WaitlistPreference[] };
        if (prefs.options) {
          setWaitlistPreferences(prefs.options);
        } else {
          // Set default preferences if none exist
          setWaitlistPreferences([
            { id: "indoor", label: "Indoor Seating", enabled: true },
            { id: "outdoor", label: "Outdoor Seating", enabled: true },
            { id: "smoking", label: "Smoking Area", enabled: false }
          ]);
        }
      }
    };

    fetchVenueSettings();
  }, [venueId]);

  const handleSaveAll = async () => {
    console.log("Saving all venue settings");
    
    // Validation for business hours
    for (const [day, hours] of Object.entries(businessHours)) {
      if (!hours.is_closed) {
        if (hours.open >= hours.close && !(hours.open > "12:00" && hours.close < "12:00")) {
          toast({
            title: "Invalid Hours",
            description: `${day}: Closing time must be after opening time (unless overnight hours)`,
            variant: "destructive"
          });
          return;
        }
        
        // Validate breaks are within business hours
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
      timezone: "America/New_York",
      
      // Kitchen/Food settings
      default_prep_time: parseInt(settings.defaultPrepTime) || 10,
      max_extension_time: parseInt(settings.maxExtensionTime) || 45,
      pickup_instructions: settings.pickupInstructions,
      order_number_refresh_minutes: parseInt(settings.orderNumberRefreshMinutes) || 15,
      
      // Waitlist/Table settings
      venue_capacity: parseInt(settings.venueCapacity) || 40,
      tables_per_interval: parseInt(settings.tablesPerInterval) || 4,
      auto_no_show_time: parseInt(settings.autoNoShowTime) || 15,
      
      // Table configuration
      table_configuration: tableConfiguration,
    };
    
    // Save everything in one transaction
    const { error } = await supabase
      .from("venues")
      .update({
        settings: updatedSettings as any,
        waitlist_preferences: { options: waitlistPreferences } as any
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

    toast({
      title: "All Settings Saved",
      description: "Venue settings have been updated successfully",
    });
  };

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
      special_hours: !holidayFullyClosed ? { open: holidayOpen, close: holidayClose } : undefined,
      breaks: []
    };
    
    setHolidayClosures(prev => [...prev, newHoliday].sort((a, b) => a.date.localeCompare(b.date)));
    setHolidayDialogOpen(false);
    setHolidayDate(undefined);
    setHolidayReason("");
    setHolidayFullyClosed(true);
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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Venue Settings</h2>

      <div className="space-y-6">
        {/* Table Configuration - Only for table_ready */}
        {hasTableReady && (
          <TableConfigurationManager 
            tables={tableConfiguration}
            onChange={setTableConfiguration}
          />
        )}

        {/* Kitchen Settings - Only for food_ready */}
        {hasFoodReady && (
          <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Kitchen Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Card className="bg-muted/50 border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  How Smart ETA Works
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-3">
                <div>
                  <strong className="text-foreground">1. Historical Data (Primary):</strong>
                  <p className="text-muted-foreground mt-0.5">System analyzes last 30 days of similar orders (same day/time window) to predict accurate prep times.</p>
                </div>
                <div>
                  <strong className="text-foreground">2. Default Fallback:</strong>
                  <p className="text-muted-foreground mt-0.5">When you're starting out or have limited data, the system uses your configured default prep time below.</p>
                </div>
                <div>
                  <strong className="text-foreground">3. Real-Time Adjustments:</strong>
                  <ul className="list-disc pl-5 mt-1 text-xs text-muted-foreground space-y-1">
                    <li>Kitchen Load: Adds 0-60% based on current order volume</li>
                    <li>Order Complexity: Adds 0-20% based on number of items</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <div>
              <Label htmlFor="prepTime" className="flex items-center gap-2">
                Default Prep Time (fallback)
                <Badge variant="outline" className="text-xs font-normal">Used when no historical data</Badge>
              </Label>
              <Input
                id="prepTime"
                type="number"
                value={settings.defaultPrepTime}
                onChange={(e) => handleInputChange("defaultPrepTime", e.target.value)}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1.5">
                Starting point for new venues. Once you have 30+ completed orders, the system automatically uses real historical averages.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                💡 <strong>Final ETA =</strong> Historical Avg × Kitchen Load (1.0-1.6x) × Order Complexity (1.0-1.2x)
              </p>
            </div>

            <div>
              <Label htmlFor="maxExtension">Maximum Extension Time (minutes)</Label>
              <Input
                id="maxExtension"
                type="number"
                value={settings.maxExtensionTime}
                onChange={(e) => handleInputChange("maxExtensionTime", e.target.value)}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1.5">
                Maximum time an order ETA can be extended
              </p>
            </div>

            <div>
              <Label htmlFor="orderRefresh" className="flex items-center gap-2">
                Order Number Refresh Time
                <Badge variant="outline" className="text-xs font-normal">Duplicate prevention</Badge>
              </Label>
              <Input
                id="orderRefresh"
                type="number"
                value={settings.orderNumberRefreshMinutes}
                onChange={(e) => handleInputChange("orderNumberRefreshMinutes", e.target.value)}
                className="mt-2"
              />
              <p className="text-sm text-muted-foreground mt-1.5">
                After this many minutes, the same order number can be used again. Prevents duplicate tracking while allowing number reuse.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                💡 Set to 15-30 minutes for busy restaurants, or 60+ for venues that reset daily
              </p>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Waitlist Preferences - Only for table_ready */}
        {hasTableReady && (
          <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Waitlist Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground mb-4">
              Choose which seating preferences to display to customers when they join the waitlist
            </p>
            
            {waitlistPreferences.map((pref) => (
              <div key={pref.id} className="flex items-center justify-between">
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
          </CardContent>
        </Card>
        )}

        {/* Pickup Instructions - Only for food_ready */}
        {hasFoodReady && (
          <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Pickup Instructions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="instructions">Instructions for Customers</Label>
              <Textarea
                id="instructions"
                value={settings.pickupInstructions}
                onChange={(e) => handleInputChange("pickupInstructions", e.target.value)}
                placeholder="Enter pickup instructions..."
                className="min-h-[100px]"
              />
              <p className="text-sm text-muted-foreground mt-1">
                These instructions will be shown to customers when their order is ready
              </p>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Business Hours Management */}
        <Card className="shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Business Hours & Operating Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Regular Business Hours */}
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted rounded-lg">
                <h3 className="font-semibold">Regular Business Hours</h3>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-3">
                {Object.entries(businessHours).map(([day, hours]) => {
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
                              <Label htmlFor={`${day}-close`} className="text-xs">Closing Time</Label>
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
                          
                          {/* Breaks/Special Hours */}
                          {hours.breaks && hours.breaks.length > 0 && (
                            <div className="space-y-2 mb-2">
                              {hours.breaks.map((breakTime, index) => (
                                <div key={index} className="flex items-center justify-between bg-secondary/50 p-2 rounded text-sm">
                                  <div>
                                    <span className="font-medium">{breakTime.reason}</span>
                                    <span className="text-muted-foreground ml-2">
                                      {breakTime.start} - {breakTime.end}
                                    </span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeBreak(day, index)}
                                  >
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
                              Special Hours: {holiday.special_hours.open} - {holiday.special_hours.close}
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
            
            {/* Grace Periods & Auto-Cleanup */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted rounded-lg">
                <h3 className="font-semibold">Grace Periods & Auto-Cleanup</h3>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4 space-y-4">
                <div className="p-3 bg-secondary/50 rounded-lg flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    Grace periods determine how long before closing time you stop accepting new orders, reservations, and waitlist joins. Auto-cleanup runs at your daily closing time.
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
                
                <div className="flex items-center justify-between pt-2">
                  <div>
                    <Label htmlFor="auto-cleanup">Auto-Cleanup Rejected Orders</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Automatically remove rejected orders at closing time
                    </p>
                  </div>
                  <Switch
                    id="auto-cleanup"
                    checked={autoCleanupRejected}
                    onCheckedChange={setAutoCleanupRejected}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
            
          </CardContent>
        </Card>

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
                    <Label htmlFor="holiday-close">Closing Time</Label>
                    <Input
                      id="holiday-close"
                      type="time"
                      value={holidayClose}
                      onChange={(e) => setHolidayClose(e.target.value)}
                    />
                  </div>
                </div>
              )}
              <Button onClick={addHolidayClosure} className="w-full">
                Add Holiday
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Auto No-Show Settings */}
        <Card className="shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle>Auto No-Show Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hasTableReady && (
                <div>
                  <Label htmlFor="waitlistNoShow">Waitlist No-Show (minutes)</Label>
                  <Input
                    id="waitlistNoShow"
                    type="number"
                    value={settings.autoNoShowTime}
                    onChange={(e) => handleInputChange("autoNoShowTime", e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    Automatically mark as no-show after table is ready
                  </p>
                </div>
              )}
              {hasFoodReady && (
                <div>
                  <Label>Food Orders No-Show</Label>
                  <div className="p-3 bg-muted rounded-md text-sm text-muted-foreground">
                    Food orders are automatically marked as no-show at end of day if not collected
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSaveAll} className="px-8 py-6 text-lg">
          Save All Settings
        </Button>
      </div>
    </div>
  );
};