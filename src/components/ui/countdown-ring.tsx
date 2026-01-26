import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CountdownRingProps {
  minutes: number;
  seconds: number;
  totalSeconds: number;
  size?: "sm" | "md" | "lg";
  showPulse?: boolean;
  className?: string;
  label?: string;
}

const sizeConfig = {
  sm: { dimension: 80, strokeWidth: 4, fontSize: "text-lg", labelSize: "text-xs" },
  md: { dimension: 120, strokeWidth: 6, fontSize: "text-2xl", labelSize: "text-sm" },
  lg: { dimension: 160, strokeWidth: 8, fontSize: "text-4xl", labelSize: "text-base" },
};

export function CountdownRing({
  minutes,
  seconds,
  totalSeconds,
  size = "md",
  showPulse = true,
  className,
  label = "remaining",
}: CountdownRingProps) {
  const config = sizeConfig[size];
  const radius = (config.dimension - config.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate remaining time as percentage
  const currentSeconds = minutes * 60 + seconds;
  const progress = totalSeconds > 0 ? currentSeconds / totalSeconds : 0;
  const strokeDashoffset = circumference * (1 - progress);
  
  // Color transitions based on time remaining
  const getColor = () => {
    if (progress > 0.5) return "stroke-success"; // Green - plenty of time
    if (progress > 0.25) return "stroke-amber-500"; // Yellow - getting low
    return "stroke-destructive"; // Red - urgent
  };

  const getGlowColor = () => {
    if (progress > 0.5) return "drop-shadow-[0_0_8px_hsl(var(--success))]";
    if (progress > 0.25) return "drop-shadow-[0_0_8px_theme(colors.amber.500)]";
    return "drop-shadow-[0_0_8px_hsl(var(--destructive))]";
  };

  // Format display
  const displayMinutes = String(minutes).padStart(2, "0");
  const displaySeconds = String(seconds).padStart(2, "0");

  // Determine if we should pulse (last 60 seconds)
  const shouldPulse = showPulse && currentSeconds <= 60 && currentSeconds > 0;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      {/* Background circle */}
      <svg
        width={config.dimension}
        height={config.dimension}
        className="transform -rotate-90"
      >
        {/* Track */}
        <circle
          cx={config.dimension / 2}
          cy={config.dimension / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={config.strokeWidth}
          className="text-muted/30"
        />
        
        {/* Progress */}
        <motion.circle
          cx={config.dimension / 2}
          cy={config.dimension / 2}
          r={radius}
          fill="none"
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          className={cn(getColor(), getGlowColor())}
          style={{
            strokeDasharray: circumference,
          }}
          initial={{ strokeDashoffset: circumference }}
          animate={{ 
            strokeDashoffset,
            scale: shouldPulse ? [1, 1.02, 1] : 1,
          }}
          transition={{
            strokeDashoffset: { duration: 0.5, ease: "easeOut" },
            scale: shouldPulse ? { 
              repeat: Infinity, 
              duration: 1,
              ease: "easeInOut"
            } : undefined,
          }}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          key={`${minutes}:${seconds}`}
          initial={{ scale: 1.1, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 1 }}
          className={cn("font-bold tabular-nums", config.fontSize)}
        >
          {displayMinutes}:{displaySeconds}
        </motion.span>
        <span className={cn("text-muted-foreground", config.labelSize)}>
          {label}
        </span>
      </div>

      {/* Pulse effect when urgent */}
      {shouldPulse && (
        <motion.div
          initial={{ scale: 1, opacity: 0.5 }}
          animate={{ scale: 1.3, opacity: 0 }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="absolute inset-0 rounded-full border-2 border-destructive"
        />
      )}
    </div>
  );
}
