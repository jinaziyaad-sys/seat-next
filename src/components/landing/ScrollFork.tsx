import { motion, useScroll, useTransform } from "framer-motion";
import silverFork from "@/assets/silver-fork.png";

export const ScrollFork = () => {
  const { scrollYProgress } = useScroll();

  // Continuous rotation across the full page
  const rotate = useTransform(scrollYProgress, [0, 1], [-15, 360]);

  // Side-to-side weave — stays in the far margins, never over center content
  const x = useTransform(
    scrollYProgress,
    [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
    ["42vw", "-42vw", "44vw", "-40vw", "42vw", "-44vw", "40vw", "-42vw", "44vw", "-40vw", "42vw"]
  );

  // Scale breathes
  const scale = useTransform(scrollYProgress, [0, 0.2, 0.5, 0.8, 1], [0.75, 0.9, 1.0, 0.9, 0.8]);

  // 3D perspective tilts
  const rotateY = useTransform(scrollYProgress, [0, 0.5, 1], [0, 15, -10]);
  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [5, -5, 10]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center pointer-events-none z-10 overflow-hidden"
      style={{ perspective: "1200px" }}
    >
      <motion.div
        style={{ x, rotate, scale, rotateY, rotateX }}
        className="w-[180px] h-[360px] sm:w-[220px] sm:h-[440px] md:w-[280px] md:h-[540px] will-change-transform opacity-90"
      >
        <img
          src={silverFork}
          alt=""
          className="w-full h-full object-contain drop-shadow-[0_20px_60px_rgba(120,120,130,0.35)]"
          width={512}
          height={1024}
        />
      </motion.div>
    </div>
  );
};
