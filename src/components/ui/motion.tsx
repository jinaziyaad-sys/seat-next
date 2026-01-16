import * as React from "react";
import { motion, type HTMLMotionProps, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

// Animation variants for reuse
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0 },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

// Subtle hover/tap animations for interactive elements
export const buttonTap = {
  scale: 0.98,
  transition: { duration: 0.1 },
};

export const buttonHover = {
  scale: 1.02,
  transition: { duration: 0.2 },
};

export const cardHover = {
  y: -2,
  transition: { duration: 0.2 },
};

// Motion wrapper for any element with fade-in animation
interface MotionFadeProps extends HTMLMotionProps<"div"> {
  delay?: number;
}

export const MotionFade = React.forwardRef<HTMLDivElement, MotionFadeProps>(
  ({ delay = 0, className, children, ...props }, ref) => (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: "easeOut" }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
);
MotionFade.displayName = "MotionFade";

// Motion wrapper for cards with hover effect
interface MotionCardProps extends HTMLMotionProps<"div"> {
  hoverEffect?: boolean;
}

export const MotionCard = React.forwardRef<HTMLDivElement, MotionCardProps>(
  ({ hoverEffect = true, className, children, ...props }, ref) => (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      whileHover={hoverEffect ? { y: -3, boxShadow: "0 8px 30px -12px hsl(20 30% 30% / 0.15)" } : undefined}
      className={cn("rounded-lg border bg-card text-card-foreground shadow-card", className)}
      {...props}
    >
      {children}
    </motion.div>
  )
);
MotionCard.displayName = "MotionCard";

// Motion button wrapper with tap/hover effects
interface MotionButtonWrapperProps extends HTMLMotionProps<"div"> {
  disabled?: boolean;
}

export const MotionButtonWrapper = React.forwardRef<HTMLDivElement, MotionButtonWrapperProps>(
  ({ disabled = false, className, children, ...props }, ref) => (
    <motion.div
      ref={ref}
      whileHover={disabled ? undefined : { scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.15 }}
      className={cn("inline-block", className)}
      {...props}
    >
      {children}
    </motion.div>
  )
);
MotionButtonWrapper.displayName = "MotionButtonWrapper";

// Stagger children animation container
interface MotionListProps extends HTMLMotionProps<"div"> {
  staggerDelay?: number;
}

export const MotionList = React.forwardRef<HTMLDivElement, MotionListProps>(
  ({ staggerDelay = 0.05, className, children, ...props }, ref) => (
    <motion.div
      ref={ref}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
);
MotionList.displayName = "MotionList";

// List item for use inside MotionList
export const MotionListItem = React.forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  ({ className, children, ...props }, ref) => (
    <motion.div
      ref={ref}
      variants={fadeInUp}
      transition={{ duration: 0.3 }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
);
MotionListItem.displayName = "MotionListItem";

// Pulse animation for attention-grabbing elements
export const MotionPulse = React.forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  ({ className, children, ...props }, ref) => (
    <motion.div
      ref={ref}
      animate={{ scale: [1, 1.02, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
);
MotionPulse.displayName = "MotionPulse";

// Subtle shake animation for errors/alerts
export const MotionShake = React.forwardRef<HTMLDivElement, HTMLMotionProps<"div"> & { trigger?: boolean }>(
  ({ trigger = false, className, children, ...props }, ref) => (
    <motion.div
      ref={ref}
      animate={trigger ? { x: [0, -4, 4, -4, 4, 0] } : {}}
      transition={{ duration: 0.4 }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
);
MotionShake.displayName = "MotionShake";

// Icon button with rotation on hover
export const MotionIconButton = React.forwardRef<HTMLDivElement, HTMLMotionProps<"div">>(
  ({ className, children, ...props }, ref) => (
    <motion.div
      ref={ref}
      whileHover={{ rotate: 15, scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className={cn("inline-flex", className)}
      {...props}
    >
      {children}
    </motion.div>
  )
);
MotionIconButton.displayName = "MotionIconButton";

// Export motion from framer-motion for custom usage
export { motion, type Variants } from "framer-motion";
