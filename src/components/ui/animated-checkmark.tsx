import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface AnimatedCheckmarkProps {
  size?: "sm" | "md" | "lg";
  color?: "success" | "primary" | "default";
  className?: string;
  delay?: number;
  onComplete?: () => void;
}

const sizeConfig = {
  sm: { dimension: 32, strokeWidth: 3, circleRadius: 12 },
  md: { dimension: 56, strokeWidth: 4, circleRadius: 22 },
  lg: { dimension: 80, strokeWidth: 5, circleRadius: 32 },
};

const colorConfig = {
  success: {
    circle: "stroke-success",
    check: "stroke-success",
    bg: "fill-success/10",
  },
  primary: {
    circle: "stroke-primary",
    check: "stroke-primary",
    bg: "fill-primary/10",
  },
  default: {
    circle: "stroke-foreground",
    check: "stroke-foreground",
    bg: "fill-muted",
  },
};

export function AnimatedCheckmark({
  size = "md",
  color = "success",
  className,
  delay = 0,
  onComplete,
}: AnimatedCheckmarkProps) {
  const config = sizeConfig[size];
  const colors = colorConfig[color];
  const center = config.dimension / 2;
  
  // Checkmark path - positioned relative to center
  const checkPath = `M ${center - 8} ${center} L ${center - 2} ${center + 6} L ${center + 10} ${center - 6}`;

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ 
        type: "spring", 
        damping: 15, 
        stiffness: 200,
        delay
      }}
      className={cn("relative inline-flex", className)}
    >
      <svg
        width={config.dimension}
        height={config.dimension}
        viewBox={`0 0 ${config.dimension} ${config.dimension}`}
        className="overflow-visible"
      >
        {/* Background circle */}
        <motion.circle
          cx={center}
          cy={center}
          r={config.circleRadius}
          className={colors.bg}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: delay + 0.1 }}
        />

        {/* Circle outline - draws in */}
        <motion.circle
          cx={center}
          cy={center}
          r={config.circleRadius}
          fill="none"
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          className={colors.circle}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ 
            duration: 0.4, 
            delay: delay + 0.2,
            ease: "easeOut"
          }}
        />

        {/* Checkmark - draws in after circle */}
        <motion.path
          d={checkPath}
          fill="none"
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={colors.check}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ 
            duration: 0.3, 
            delay: delay + 0.5,
            ease: "easeOut"
          }}
          onAnimationComplete={onComplete}
        />
      </svg>
    </motion.div>
  );
}

// Success celebration variant with particles
export function AnimatedCheckmarkSuccess({
  size = "lg",
  className,
  delay = 0,
}: AnimatedCheckmarkProps) {
  return (
    <div className={cn("relative", className)}>
      {/* Particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0, opacity: 1 }}
          animate={{ 
            scale: 1.5,
            opacity: 0,
            x: Math.cos((i * 60 * Math.PI) / 180) * 40,
            y: Math.sin((i * 60 * Math.PI) / 180) * 40,
          }}
          transition={{ 
            duration: 0.6, 
            delay: delay + 0.6,
            ease: "easeOut"
          }}
          className="absolute left-1/2 top-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-success"
        />
      ))}
      
      <AnimatedCheckmark size={size} color="success" delay={delay} />
    </div>
  );
}
