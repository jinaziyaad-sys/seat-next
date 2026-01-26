import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { VolumeX, Volume2 } from "lucide-react";
import { 
  snoozeSounds, 
  cancelSnooze, 
  isSnoozed, 
  getSnoozeRemaining,
  subscribeToSnooze 
} from "@/utils/notificationSound";

const SNOOZE_DURATION_MINUTES = 2;

const formatRemainingTime = (ms: number): string => {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  
  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  
  return `0:${seconds.toString().padStart(2, '0')}`;
};

interface SoundSnoozeButtonProps {
  'data-tour'?: string;
}

export const SoundSnoozeButton = (props: SoundSnoozeButtonProps) => {
  const { 'data-tour': dataTour } = props;
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

  const handleSnooze = () => {
    snoozeSounds(SNOOZE_DURATION_MINUTES);
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
        className="gap-2"
        title="Click to unmute sounds"
        data-tour={dataTour}
      >
        <VolumeX size={16} className="text-destructive" />
        <span className="text-xs font-mono">{formatRemainingTime(remainingMs)}</span>
      </Button>
    );
  }

  return (
    <Button 
      variant="outline" 
      size="sm"
      onClick={handleSnooze}
      className="gap-2"
      title="Mute notification sounds for 2 minutes"
      data-tour={dataTour}
    >
      <Volume2 size={16} />
      <span className="text-sm">Snooze</span>
    </Button>
  );
};