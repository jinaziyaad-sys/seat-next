import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import goldenFork from "@/assets/golden-fork.png";

export const ScrollFork = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  // Replicate the Gucci key motion: rotation from ~-15° to ~195° as you scroll
  const rotate = useTransform(scrollYProgress, [0, 1], [-15, 195]);
  // Slight scale pulse
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [0.9, 1.05, 0.95]);
  // Subtle Y movement
  const y = useTransform(scrollYProgress, [0, 1], [0, 60]);

  return (
    <div ref={containerRef} className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      <motion.div
        style={{ rotate, scale, y }}
        className="w-[280px] h-[520px] sm:w-[320px] sm:h-[600px] md:w-[380px] md:h-[700px] will-change-transform"
      >
        <img
          src={goldenFork}
          alt="Golden fork"
          className="w-full h-full object-contain drop-shadow-[0_20px_60px_rgba(201,168,76,0.35)]"
          width={512}
          height={1024}
        />
      </motion.div>
    </div>
  );
};
