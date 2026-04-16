import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import forkImage from "@/assets/fork.png";

export const ScrollFork = ({ className }: { className?: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // Fork rotates from -45deg to +180deg as you scroll through the section
  const rotate = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [-60, 0, 120, 180]);
  // Moves downward
  const y = useTransform(scrollYProgress, [0, 1], [-100, 100]);
  // Scale: grows slightly then returns
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.85, 1.1, 0.9]);
  // Opacity: fades in and out
  const opacity = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0, 1, 1, 0]);

  return (
    <section ref={containerRef} className={`relative ${className}`}>
      <div className="h-[70vh] md:h-[80vh] flex items-center justify-center overflow-hidden">
        {/* Subtle radial glow behind the fork */}
        <motion.div
          className="absolute w-[300px] h-[300px] md:w-[500px] md:h-[500px] rounded-full"
          style={{
            opacity: useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 0.15, 0.15, 0]),
            background: "radial-gradient(circle, hsl(var(--primary) / 0.3) 0%, transparent 70%)",
            scale,
          }}
        />

        <motion.div
          style={{ rotate, y, scale, opacity }}
          className="relative z-10 will-change-transform"
        >
          <img
            src={forkImage}
            alt="Fork"
            width={512}
            height={1024}
            className="w-32 h-auto md:w-48 lg:w-56 drop-shadow-[0_20px_40px_rgba(0,0,0,0.15)] dark:drop-shadow-[0_20px_40px_rgba(255,255,255,0.08)]"
            loading="lazy"
          />
        </motion.div>

        {/* Text overlays that appear as fork rotates */}
        <motion.p
          className="absolute top-[15%] left-1/2 -translate-x-1/2 text-sm font-medium uppercase tracking-[0.3em] text-muted-foreground"
          style={{
            opacity: useTransform(scrollYProgress, [0.1, 0.25, 0.45, 0.55], [0, 1, 1, 0]),
          }}
        >
          Track Any Order
        </motion.p>

        <motion.h2
          className="absolute bottom-[18%] left-1/2 -translate-x-1/2 text-2xl md:text-4xl font-bold text-center whitespace-nowrap"
          style={{
            opacity: useTransform(scrollYProgress, [0.5, 0.65, 0.8, 0.92], [0, 1, 1, 0]),
          }}
        >
          From kitchen to <span className="text-primary">your table</span>
        </motion.h2>
      </div>
    </section>
  );
};
