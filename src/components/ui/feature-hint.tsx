import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FeatureHintProps {
  id: string;
  children: React.ReactNode;
  hint: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

const STORAGE_KEY = 'feature-hints-seen';

function getSeenHints(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function markHintSeen(id: string) {
  const seen = getSeenHints();
  if (!seen.includes(id)) {
    seen.push(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
  }
}

export function FeatureHint({ 
  id, 
  children, 
  hint, 
  position = 'bottom',
  delay = 1000,
  className 
}: FeatureHintProps) {
  const [showHint, setShowHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const seenHints = getSeenHints();
    if (seenHints.includes(id)) {
      return;
    }

    const timer = setTimeout(() => {
      setShowHint(true);
    }, delay);

    // Auto-dismiss after 8 seconds
    const autoDismiss = setTimeout(() => {
      handleDismiss();
    }, delay + 8000);

    return () => {
      clearTimeout(timer);
      clearTimeout(autoDismiss);
    };
  }, [id, delay]);

  const handleDismiss = () => {
    setDismissed(true);
    markHintSeen(id);
    setTimeout(() => setShowHint(false), 300);
  };

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-primary',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-primary',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-primary',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-primary',
  };

  return (
    <div className={cn("relative inline-block", className)}>
      {children}
      
      <AnimatePresence>
        {showHint && !dismissed && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "absolute z-50 pointer-events-auto",
              positionClasses[position]
            )}
          >
            <div className="relative bg-primary text-primary-foreground px-3 py-2 rounded-lg shadow-lg max-w-[200px]">
              <button
                onClick={handleDismiss}
                className="absolute -top-1 -right-1 bg-primary-foreground text-primary rounded-full p-0.5 hover:bg-primary-foreground/80 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
              <p className="text-xs font-medium leading-relaxed">{hint}</p>
              {/* Arrow */}
              <div 
                className={cn(
                  "absolute w-0 h-0 border-[6px]",
                  arrowClasses[position]
                )} 
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper to reset all hints (useful for testing)
export function resetFeatureHints() {
  localStorage.removeItem(STORAGE_KEY);
}
