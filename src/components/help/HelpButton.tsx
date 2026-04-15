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
        'fixed bottom-40 right-4 z-50 h-14 w-14 rounded-full shadow-floating',
        'bg-primary text-primary-foreground hover:bg-primary/90',
        'transition-all duration-300 hover:scale-105',
        showPulse && 'animate-pulse',
        className
      )}
      aria-label="Open help center"
    >
      <HelpCircle className="h-6 w-6" />
    </Button>
  );
}
