import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format, addDays, differenceInHours, parseISO } from "date-fns";
import { Calendar as CalendarIcon, Loader2, Users, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getAvailableReservationTimes, BusinessHours, HolidayClosure } from "@/utils/businessHours";
import { invokeSupabaseFunctionWithTimeout } from "@/utils/invokeWithTimeout";

interface EditReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: {
    id: string;
    venue: string;
    venue_id: string;
    party_size: number;
    reservation_time: string | null;
    preferences?: string[];
    notes?: string;
    customer_name: string;
  };
  venueSettings?: {
    business_hours?: BusinessHours;
    holiday_closures?: HolidayClosure[];
  };
  onSuccess: (updatedEntry: any) => void;
}

export function EditReservationDialog({
  open,
  onOpenChange,
  entry,
  venueSettings,
  onSuccess,
}: EditReservationDialogProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [partySize, setPartySize] = useState(entry.party_size);
  const [reservationDate, setReservationDate] = useState<Date | undefined>(
    entry.reservation_time ? parseISO(entry.reservation_time) : undefined
  );
  const [reservationTime, setReservationTime] = useState<string>(
    entry.reservation_time ? format(parseISO(entry.reservation_time), "HH:mm") : ""
  );
  const [seatingPreference, setSeatingPreference] = useState<"indoor" | "outdoor" | "no-preference">(
    entry.preferences?.includes("outdoor") ? "outdoor" :
    entry.preferences?.includes("indoor") ? "indoor" : "no-preference"
  );
  const [notes, setNotes] = useState(entry.notes || "");
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [isLoadingTimes, setIsLoadingTimes] = useState(false);
  const [fetchedSettings, setFetchedSettings] = useState<{
    business_hours?: BusinessHours;
    holiday_closures?: HolidayClosure[];
  } | null>(null);

  // Use provided venueSettings or fetch them
  const effectiveSettings = venueSettings || fetchedSettings;

  // Fetch venue settings if not provided
  useEffect(() => {
    if (open && !venueSettings && entry.venue_id) {
      const fetchSettings = async () => {
        const { data } = await supabase
          .from("venues")
          .select("settings")
          .eq("id", entry.venue_id)
          .single();
        
        if (data?.settings) {
          setFetchedSettings(data.settings as any);
        }
      };
      fetchSettings();
    }
  }, [open, venueSettings, entry.venue_id]);

  // Reset state when dialog opens with new entry data
  useEffect(() => {
    if (open) {
      setPartySize(entry.party_size);
      setReservationDate(entry.reservation_time ? parseISO(entry.reservation_time) : undefined);
      setReservationTime(entry.reservation_time ? format(parseISO(entry.reservation_time), "HH:mm") : "");
      setSeatingPreference(
        entry.preferences?.includes("outdoor") ? "outdoor" :
        entry.preferences?.includes("indoor") ? "indoor" : "no-preference"
      );
      setNotes(entry.notes || "");
    }
  }, [open, entry]);

  // Fetch available times when date changes
  useEffect(() => {
    if (!reservationDate) return;

    setIsLoadingTimes(true);
    try {
      if (effectiveSettings) {
        const businessHours = effectiveSettings.business_hours || {};
        const holidayClosures = effectiveSettings.holiday_closures || [];
        const times = getAvailableReservationTimes(reservationDate, businessHours, holidayClosures, 15, 0);
        
        // Include current reservation time if not in list
        const currentTime = entry.reservation_time ? format(parseISO(entry.reservation_time), "HH:mm") : "";
        if (currentTime && !times.includes(currentTime)) {
          times.push(currentTime);
          times.sort();
        }
        
        setAvailableTimes(times);
      } else {
        // No settings - generate default time slots (every 15 min from 09:00 to 22:00)
        const defaultTimes: string[] = [];
        for (let h = 9; h <= 22; h++) {
          for (let m = 0; m < 60; m += 15) {
            if (h === 22 && m > 0) break;
            defaultTimes.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
          }
        }
        setAvailableTimes(defaultTimes);
      }
    } catch (err) {
      console.error("Error fetching available times:", err);
    } finally {
      setIsLoadingTimes(false);
    }
  }, [reservationDate, effectiveSettings, entry.reservation_time]);

  const hoursUntilReservation = entry.reservation_time 
    ? differenceInHours(parseISO(entry.reservation_time), new Date())
    : Infinity;
  
  const canEdit = hoursUntilReservation > 2;

  const handleSave = async () => {
    if (!canEdit) return;
    
    setIsLoading(true);
    try {
      // Build the new reservation datetime
      let newReservationTime = entry.reservation_time;
      if (reservationDate && reservationTime) {
        const [hours, minutes] = reservationTime.split(":").map(Number);
        const newDateTime = new Date(reservationDate);
        newDateTime.setHours(hours, minutes, 0, 0);
        newReservationTime = newDateTime.toISOString();
      }

      // Build preferences array
      const newPreferences: string[] = [];
      if (seatingPreference === "indoor") newPreferences.push("indoor");
      if (seatingPreference === "outdoor") newPreferences.push("outdoor");

      // Check table availability if party size changed or time changed
      const partySizeChanged = partySize !== entry.party_size;
      const timeChanged = newReservationTime !== entry.reservation_time;
      const preferencesChanged = JSON.stringify(newPreferences.sort()) !== JSON.stringify((entry.preferences || []).sort());

      // Build edit summary for merchant notification
      const changes: string[] = [];
      if (partySizeChanged) {
        changes.push(`Party size: ${entry.party_size}→${partySize}`);
      }
      // Always compare old vs new date/time when possible (covers date-only moves reliably)
      if (entry.reservation_time && newReservationTime) {
        const oldDateTime = parseISO(entry.reservation_time);
        const nextDateTime = parseISO(newReservationTime);

        const oldDateStr = format(oldDateTime, "yyyy-MM-dd");
        const nextDateStr = format(nextDateTime, "yyyy-MM-dd");
        if (oldDateStr !== nextDateStr) {
          changes.push(`Date: ${format(oldDateTime, "MMM d")}→${format(nextDateTime, "MMM d")}`);
        }

        const oldTimeStr = format(oldDateTime, "HH:mm");
        const nextTimeStr = format(nextDateTime, "HH:mm");
        if (oldTimeStr !== nextTimeStr) {
          changes.push(`Time: ${oldTimeStr}→${nextTimeStr}`);
        }
      }
      if (preferencesChanged) {
        const oldPrefs = (entry.preferences || []).join(", ") || "none";
        const newPrefs = newPreferences.join(", ") || "none";
        changes.push(`Seating: ${oldPrefs}→${newPrefs}`);
      }
      const editSummary = changes.length > 0 ? changes.join(", ") : "Notes updated";

      // Debug aid: helps confirm date/time diffs were computed (remove later if noisy)
      console.log("[EditReservationDialog] edit_summary", {
        entryId: entry.id,
        oldReservationTime: entry.reservation_time,
        newReservationTime,
        partySizeChanged,
        timeChanged,
        preferencesChanged,
        editSummary,
      });

      if (partySizeChanged || timeChanged) {
        // Call find-available-table to check availability
        const { data: tableResult, error: tableError } = await invokeSupabaseFunctionWithTimeout<{
          available: boolean;
          reason?: string;
          tables?: Array<{ id: string; name: string; capacity: number }>;
        }>(
          "find-available-table",
          {
            venue_id: entry.venue_id,
            reservation_time: newReservationTime,
            party_size: partySize,
          },
          15000
        );

        if (tableError) {
          toast({
            title: t("editReservation.errorCheckingAvailability"),
            description: t("editReservation.unableToVerify"),
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        if (!tableResult?.available) {
          toast({
            title: t("editReservation.timeSlotUnavailable"),
            description: tableResult?.reason || t("editReservation.noTablesAvailable"),
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        // Handle multi-table case - for now, show error and require cancel/rebook
        if (tableResult?.tables && tableResult.tables.length > 1) {
          toast({
            title: t("editReservation.multipleTablesRequired"),
            description: t("editReservation.multipleTablesDesc"),
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        // Update with new table assignment and edit tracking
        const { error: updateError } = await supabase
          .from("waitlist_entries")
          .update({
            party_size: partySize,
            reservation_time: newReservationTime,
            eta: newReservationTime,
            preferences: newPreferences,
            notes: notes.trim() || null,
            assigned_table_id: tableResult?.tables?.[0]?.id || null,
            last_edited_at: new Date().toISOString(),
            edit_summary: editSummary,
          })
          .eq("id", entry.id);

        if (updateError) throw updateError;
      } else {
        // Just update preferences and notes
        const { error: updateError } = await supabase
          .from("waitlist_entries")
          .update({
            preferences: newPreferences,
            notes: notes.trim() || null,
            last_edited_at: new Date().toISOString(),
            edit_summary: editSummary,
          })
          .eq("id", entry.id);

        if (updateError) throw updateError;
      }

      toast({
        title: t("editReservation.reservationUpdated"),
        description: t("editReservation.changesSaved"),
      });

      onSuccess({
        ...entry,
        party_size: partySize,
        reservation_time: newReservationTime,
        preferences: newPreferences,
        notes: notes.trim() || null,
      });

      onOpenChange(false);
    } catch (err) {
      console.error("Error updating reservation:", err);
      toast({
        title: t("editReservation.updateFailed"),
        description: t("editReservation.unableToSave"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("editReservation.title")}</DialogTitle>
          <DialogDescription>
            {entry.venue}
          </DialogDescription>
        </DialogHeader>

        {!canEdit ? (
          <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
            <p className="text-sm text-destructive">
              {t("editReservation.cannotEdit")}
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Party Size */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {t("editReservation.partySize")}
              </Label>
              <Select value={partySize.toString()} onValueChange={(v) => setPartySize(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size} {size === 1 ? t("editReservation.guest") : t("editReservation.guests")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                {t("editReservation.date")}
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !reservationDate && "text-muted-foreground"
                    )}
                  >
                    {reservationDate ? format(reservationDate, "PPP") : t("editReservation.selectDate")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={reservationDate}
                    onSelect={setReservationDate}
                    disabled={(date) => date < new Date() || date > addDays(new Date(), 30)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Time */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {t("editReservation.time")}
              </Label>
              <Select 
                value={reservationTime} 
                onValueChange={setReservationTime}
                disabled={isLoadingTimes || availableTimes.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingTimes ? t("editReservation.loadingTimes") : t("editReservation.selectTime")} />
                </SelectTrigger>
                <SelectContent>
                  {availableTimes.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seating Preference */}
            <div className="space-y-2">
              <Label>{t("editReservation.seatingPreference")}</Label>
              <ToggleGroup 
                type="single" 
                value={seatingPreference}
                onValueChange={(v) => v && setSeatingPreference(v as "indoor" | "outdoor" | "no-preference")}
                className="justify-start"
              >
                <ToggleGroupItem value="indoor" variant="outline">
                  {t("editReservation.indoor")}
                </ToggleGroupItem>
                <ToggleGroupItem value="outdoor" variant="outline">
                  {t("editReservation.outdoor")}
                </ToggleGroupItem>
                <ToggleGroupItem value="no-preference" variant="outline">
                  {t("editReservation.noPreference")}
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Special Requests */}
            <div className="space-y-2">
              <Label>Special Requests (Optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special requests or notes..."
                className="resize-none"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground text-right">
                {notes.length}/500
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canEdit || isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
