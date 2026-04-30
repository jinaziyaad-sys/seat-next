import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HelpButtonProps {
  onClick: () => void;
  showPulse?: boolean;
  className?: string;
}

export function HelpButton({ onClick, showPulse = false, className }: HelpButtonProps) {
  return (
    <Button
      data-tour="help-button"
      onClick={onClick}
      size="icon"
      className={cn(
        'fixed right-4 z-50 h-12 w-12 rounded-full shadow-floating',
        // Sit above the bottom tab nav (~80px) on mobile, lower on desktop
        'bottom-[6.5rem] md:bottom-24',
        'bg-primary text-primary-foreground hover:bg-primary/90',
        'transition-all duration-300 hover:scale-105',
        showPulse && 'animate-pulse',
        className
      )}
      aria-label="Open help center"
    >
      <HelpCircle className="h-5 w-5" />
    </Button>
  );
}
