import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CelebrationOverlayProps {
  open: boolean;
  type: "table-ready" | "food-ready";
  title: string;
  subtitle?: string;
  actionLabel: string;
  onAction: () => void;
  onDismiss: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  autoDismissSeconds?: number;
}

// Simple confetti particle component
const ConfettiParticle = ({ delay, x }: { delay: number; x: number }) => (
  <motion.div
    initial={{ y: -20, x, opacity: 1, rotate: 0 }}
    animate={{ 
      y: 400, 
      x: x + (Math.random() - 0.5) * 100,
      opacity: 0,
      rotate: Math.random() * 720 - 360
    }}
    transition={{ 
      duration: 3 + Math.random() * 2,
      delay,
      ease: "easeOut"
    }}
    className={cn(
      "absolute w-2 h-3 rounded-sm",
      [
        "bg-primary",
        "bg-amber-400",
        "bg-emerald-400",
        "bg-pink-400",
        "bg-sky-400",
      ][Math.floor(Math.random() * 5)]
    )}
  />
);

export function CelebrationOverlay({
  open,
  type,
  title,
  subtitle,
  actionLabel,
  onAction,
  onDismiss,
  secondaryActionLabel,
  onSecondaryAction,
  autoDismissSeconds = 30,
}: CelebrationOverlayProps) {
  const [confetti, setConfetti] = React.useState<{ id: number; x: number; delay: number }[]>([]);
  const [countdown, setCountdown] = React.useState(autoDismissSeconds);

  // Generate confetti on mount
  React.useEffect(() => {
    if (open) {
      const particles = Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: Math.random() * (typeof window !== "undefined" ? window.innerWidth : 400),
        delay: Math.random() * 0.5,
      }));
      setConfetti(particles);
      setCountdown(autoDismissSeconds);
    }
  }, [open, autoDismissSeconds]);

  // Auto-dismiss countdown
  React.useEffect(() => {
    if (!open || countdown <= 0) return;
    
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [open, countdown]);

  const emoji = type === "table-ready" ? "🍽️" : "🍔";
  const bgGradient = type === "table-ready" 
    ? "from-primary/20 via-background to-amber-500/10"
    : "from-primary/20 via-background to-orange-500/10";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={onDismiss}
        >
          {/* Backdrop with blur */}
          <motion.div 
            initial={{ backdropFilter: "blur(0px)" }}
            animate={{ backdropFilter: "blur(12px)" }}
            exit={{ backdropFilter: "blur(0px)" }}
            className="absolute inset-0 bg-black/60"
          />

          {/* Confetti */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {confetti.map((particle) => (
              <ConfettiParticle 
                key={particle.id} 
                x={particle.x} 
                delay={particle.delay} 
              />
            ))}
          </div>

          {/* Content Card */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 10 }}
            transition={{ 
              type: "spring", 
              damping: 20, 
              stiffness: 300,
              delay: 0.1
            }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "relative bg-gradient-to-br rounded-3xl p-8 m-4 text-center shadow-2xl max-w-sm w-full border border-border/50",
              bgGradient
            )}
          >
            {/* Pulsing emoji */}
            <motion.div
              animate={{ 
                scale: [1, 1.15, 1],
              }}
              transition={{ 
                repeat: Infinity, 
                duration: 2,
                ease: "easeInOut"
              }}
              className="text-7xl mb-6"
            >
              {emoji}
            </motion.div>

            {/* Title with entrance animation */}
            <motion.h2 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-bold text-foreground"
            >
              {title}
            </motion.h2>

            {/* Subtitle */}
            {subtitle && (
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-muted-foreground mt-2 text-lg"
              >
                {subtitle}
              </motion.p>
            )}

            {/* Primary Action */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-8"
            >
              <Button 
                onClick={onAction} 
                size="lg"
                className="w-full h-14 text-lg font-semibold shadow-lg"
              >
                {actionLabel}
              </Button>
            </motion.div>

            {/* Secondary Action */}
            {secondaryActionLabel && onSecondaryAction && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-3"
              >
                <Button 
                  onClick={onSecondaryAction} 
                  variant="ghost"
                  className="w-full"
                >
                  {secondaryActionLabel}
                </Button>
              </motion.div>
            )}

            {/* Tap to dismiss hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ delay: 0.6 }}
              className="text-xs text-muted-foreground mt-6"
            >
              Tap outside to dismiss
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
