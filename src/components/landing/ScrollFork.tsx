import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import forkImage from "@/assets/fork.png";

export const ScrollFork = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Track scroll progress across the ENTIRE page
  const { scrollYProgress } = useScroll();

  // Fork starts tilted left, rotates clockwise as user scrolls the full page
  const rotate = useTransform(scrollYProgress, [0, 1], [-30, 360]);

  // Fork translates vertically — starts near top, ends near bottom
  const y = useTransform(scrollYProgress, [0, 1], ["5vh", "75vh"]);

  // Slight horizontal sway
  const x = useTransform(
    scrollYProgress,
    [0, 0.25, 0.5, 0.75, 1],
    ["0vw", "8vw", "-6vw", "5vw", "0vw"]
  );

  // Scale: subtle breathing
  const scale = useTransform(
    scrollYProgress,
    [0, 0.3, 0.6, 1],
    [0.75, 1, 1.05, 0.85]
  );

  // Fade in after hero, fade out near footer
  const opacity = useTransform(
    scrollYProgress,
    [0, 0.05, 0.85, 0.95],
    [0, 0.9, 0.9, 0]
  );

  return (
    <motion.div
      className="fixed top-0 left-1/2 -translate-x-1/2 z-30 pointer-events-none will-change-transform"
      style={{ y, x, opacity }}
    >
      <motion.div style={{ rotate, scale }}>
        <img
          src={forkImage}
          alt=""
          width={512}
          height={1024}
          className="w-24 h-auto md:w-36 lg:w-44 drop-shadow-[0_25px_50px_rgba(0,0,0,0.2)] dark:drop-shadow-[0_25px_50px_rgba(255,255,255,0.1)]"
          draggable={false}
        />
      </motion.div>
    </motion.div>
  );
};
