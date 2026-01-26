import { useEffect, useMemo, useState } from "react";
import { format, subDays, startOfDay, endOfDay, isBefore, isSameDay, startOfToday } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  venueCreatedAt?: Date | string;
  startDate: Date;
  endDate: Date;
  onDateChange: (start: Date, end: Date) => void;
  className?: string;
}

type PresetKey = "today" | "7days" | "30days" | "90days" | "all";

const presets: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7days", label: "Last 7 Days" },
  { key: "30days", label: "Last 30 Days" },
  { key: "90days", label: "Last 90 Days" },
  { key: "all", label: "All Time" },
];

export function DateRangePicker({
  venueCreatedAt,
  startDate,
  endDate,
  onDateChange,
  className,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Draft selection allows choosing a range without immediately updating parent state
  // (which can trigger fetches / re-renders that feel like a "refresh").
  const [draftRange, setDraftRange] = useState<DateRange>({
    from: startDate,
    to: endDate,
  });

  const today = startOfToday();
  const minDate = venueCreatedAt
    ? startOfDay(new Date(venueCreatedAt))
    : subDays(today, 365);

  // Sync draft with committed range when opening (or when parent changes the range).
  useEffect(() => {
    if (isOpen) {
      setDraftRange({ from: startDate, to: endDate });
    }
  }, [isOpen, startDate, endDate]);

  // Derive the active preset from the actual dates (source of truth)
  const activePreset = useMemo((): PresetKey | null => {
    const endIsToday = isSameDay(startOfDay(endDate), today);
    if (!endIsToday) return null;

    const startNormalized = startOfDay(startDate);
    
    if (isSameDay(startNormalized, today)) return "today";
    if (isSameDay(startNormalized, subDays(today, 7))) return "7days";
    if (isSameDay(startNormalized, subDays(today, 30))) return "30days";
    if (isSameDay(startNormalized, subDays(today, 90))) return "90days";
    if (isSameDay(startNormalized, minDate)) return "all";
    
    return null;
  }, [startDate, endDate, today, minDate]);

  const handlePresetClick = (preset: PresetKey) => {
    const end = endOfDay(today);
    let start: Date;

    switch (preset) {
      case "today":
        start = startOfDay(today);
        break;
      case "7days":
        start = startOfDay(subDays(today, 7));
        break;
      case "30days":
        start = startOfDay(subDays(today, 30));
        break;
      case "90days":
        start = startOfDay(subDays(today, 90));
        break;
      case "all":
        start = minDate;
        break;
      default:
        start = startOfDay(subDays(today, 30));
    }

    // Ensure start date isn't before venue creation
    if (isBefore(start, minDate)) {
      start = minDate;
    }

    onDateChange(start, end);
    setDraftRange({ from: start, to: end });
    setIsOpen(false);
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    // Always update draft so the UI reflects the user's selection immediately.
    setDraftRange(range ?? { from: undefined, to: undefined });

    // Only commit once the range is complete.
    if (range?.from && range?.to) {
      const start = startOfDay(range.from);
      const end = endOfDay(range.to);
      onDateChange(start, end);
      setIsOpen(false);
    }
  };

  const disabledDays = [
    { before: minDate },
    { after: today },
  ];

  // Display label derived from actual dates
  const displayLabel = useMemo(() => {
    if (activePreset) {
      const preset = presets.find((p) => p.key === activePreset);
      if (preset) return preset.label;
    }
    
    if (isSameDay(startDate, endDate)) {
      return format(startDate, "MMM d, yyyy");
    }
    
    return `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`;
  }, [startDate, endDate, activePreset]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-[260px] justify-start text-left font-normal",
              !startDate && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {displayLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            {/* Presets sidebar */}
            <div className="flex flex-col gap-1 p-2 border-r bg-muted/30">
              {presets.map((preset) => (
                <Button
                  key={preset.key}
                  variant={activePreset === preset.key ? "default" : "ghost"}
                  size="sm"
                  className="justify-start w-full text-xs"
                  onClick={() => handlePresetClick(preset.key)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            {/* Calendar */}
            <Calendar
              mode="range"
              defaultMonth={startDate}
              selected={draftRange}
              onSelect={handleDateRangeChange}
              disabled={disabledDays}
              numberOfMonths={1}
              className="p-3 pointer-events-auto"
              footer={
                venueCreatedAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Venue created: {format(new Date(venueCreatedAt), "MMM d, yyyy")}
                  </p>
                )
              }
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
