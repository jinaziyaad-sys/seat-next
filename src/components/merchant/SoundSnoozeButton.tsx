import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { BellOff, Bell, Clock } from "lucide-react";
import { 
  snoozeSounds, 
  cancelSnooze, 
  isSnoozed, 
  getSnoozeRemaining,
  subscribeToSnooze 
} from "@/utils/notificationSound";

const SNOOZE_OPTIONS = [
  { label: "15 minutes", minutes: 15 },
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "2 hours", minutes: 120 },
];

const formatRemainingTime = (ms: number): string => {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  
  return `${seconds}s`;
};

export const SoundSnoozeButton = () => {
  const [snoozed, setSnoozed] = useState(isSnoozed());
  const [remainingMs, setRemainingMs] = useState<number | null>(getSnoozeRemaining());

  useEffect(() => {
    // Subscribe to snooze state changes
    const unsubscribe = subscribeToSnooze((newSnoozed, remaining) => {
      setSnoozed(newSnoozed);
      setRemainingMs(remaining);
    });

    // Update countdown every second when snoozed
    const interval = setInterval(() => {
      if (isSnoozed()) {
        const remaining = getSnoozeRemaining();
        setRemainingMs(remaining);
        if (remaining === null || remaining <= 0) {
          setSnoozed(false);
        }
      }
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleSnooze = (minutes: number) => {
    snoozeSounds(minutes);
  };

  const handleCancelSnooze = () => {
    cancelSnooze();
  };

  if (snoozed && remainingMs !== null) {
    return (
      <Button 
        variant="outline" 
        size="sm"
        onClick={handleCancelSnooze}
        className="gap-2 text-muted-foreground hover:text-foreground"
        title="Click to re-enable sounds"
      >
        <BellOff size={16} className="text-destructive" />
        <Clock size={14} />
        <span className="text-xs font-mono">{formatRemainingTime(remainingMs)}</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" title="Snooze notification sounds">
          <Bell size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
          Snooze Sounds
        </div>
        <DropdownMenuSeparator />
        {SNOOZE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.minutes}
            onClick={() => handleSnooze(option.minutes)}
            className="cursor-pointer"
          >
            <BellOff size={14} className="mr-2" />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};