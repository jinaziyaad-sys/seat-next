import { motion, useInView } from "framer-motion";
import { useRef } from "react";

interface AnimatedTextProps {
  children: string;
  className?: string;
  delay?: number;
}

export const AnimatedText = ({ children, className = "", delay = 0 }: AnimatedTextProps) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const words = children.split(" ");

  return (
    <span ref={ref} className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block mr-[0.25em]"
          initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
          animate={isInView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
          transition={{
            delay: delay + i * 0.05,
            duration: 0.5,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
};

interface HighlightTextProps {
  children: React.ReactNode;
  className?: string;
}

export const HighlightText = ({ children, className = "" }: HighlightTextProps) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.span
      ref={ref}
      className={`relative inline-block ${className}`}
    >
      <span className="relative z-10">{children}</span>
      <motion.span
        className="absolute bottom-0 left-0 h-[35%] bg-primary/20 rounded-sm -z-0"
        initial={{ width: "0%" }}
        animate={isInView ? { width: "100%" } : {}}
        transition={{ delay: 0.5, duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
      />
    </motion.span>
  );
};

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "left" | "right" | "scale";
}

export const ScrollReveal = ({ children, className = "", delay = 0, direction = "up" }: ScrollRevealProps) => {
  const initial = {
    up: { opacity: 0, y: 60 },
    left: { opacity: 0, x: -60 },
    right: { opacity: 0, x: 60 },
    scale: { opacity: 0, scale: 0.85 },
  }[direction];

  const animate = {
    up: { opacity: 1, y: 0 },
    left: { opacity: 1, x: 0 },
    right: { opacity: 1, x: 0 },
    scale: { opacity: 1, scale: 1 },
  }[direction];

  return (
    <motion.div
      className={className}
      initial={initial}
      whileInView={animate}
      viewport={{ once: true, margin: "-80px" }}
      transition={{
        delay,
        duration: 0.7,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    >
      {children}
    </motion.div>
  );
};

export const CountUp = ({ target, duration = 2, suffix = "" }: { target: number; duration?: number; suffix?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <motion.span
      ref={ref}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
    >
      {isInView ? (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Counter from={0} to={target} duration={duration} />
          {suffix}
        </motion.span>
      ) : "0" + suffix}
    </motion.span>
  );
};

const Counter = ({ from, to, duration }: { from: number; to: number; duration: number }) => {
  const nodeRef = useRef<HTMLSpanElement>(null);

  return (
    <motion.span
      ref={nodeRef}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      onUpdate={() => {}}
    >
      <motion.span
        // Use framer-motion's animate to count up
      >
        {(() => {
          // Simple counter using CSS animation hack via motion values
          return <AnimatedCounter from={from} to={to} duration={duration} />;
        })()}
      </motion.span>
    </motion.span>
  );
};

const AnimatedCounter = ({ from, to, duration }: { from: number; to: number; duration: number }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  
  // Using useFrame-like approach with requestAnimationFrame
  const valueRef = useRef(from);
  
  if (isInView && ref.current) {
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease out cubic
      valueRef.current = Math.round(from + (to - from) * eased);
      if (ref.current) ref.current.textContent = valueRef.current.toString();
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }
  
  return <span ref={ref}>{from}</span>;
};
