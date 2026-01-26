import { useState, useEffect } from "react";
import { format, subDays, startOfDay, endOfDay, isBefore, isAfter, startOfToday } from "date-fns";
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
  const [activePreset, setActivePreset] = useState<PresetKey | null>("30days");

  const today = startOfToday();
  const minDate = venueCreatedAt
    ? startOfDay(new Date(venueCreatedAt))
    : subDays(today, 365);

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

    setActivePreset(preset);
    onDateChange(start, end);
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    if (range?.from) {
      const start = startOfDay(range.from);
      const end = range.to ? endOfDay(range.to) : endOfDay(range.from);
      setActivePreset(null);
      onDateChange(start, end);
    }
  };

  const disabledDays = [
    { before: minDate },
    { after: today },
  ];

  // Determine the display label
  const getDisplayLabel = () => {
    if (activePreset) {
      const preset = presets.find((p) => p.key === activePreset);
      return preset?.label || "Select date range";
    }
    
    if (format(startDate, "yyyy-MM-dd") === format(endDate, "yyyy-MM-dd")) {
      return format(startDate, "MMM d, yyyy");
    }
    
    return `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`;
  };

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
            {getDisplayLabel()}
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
                  onClick={() => {
                    handlePresetClick(preset.key);
                    setIsOpen(false);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            {/* Calendar */}
            <Calendar
              mode="range"
              defaultMonth={startDate}
              selected={{ from: startDate, to: endDate }}
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
