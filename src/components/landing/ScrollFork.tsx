import { motion, useScroll, useTransform } from "framer-motion";
import silverFork from "@/assets/silver-fork.png";

export const ScrollFork = () => {
  const { scrollYProgress } = useScroll();

  // Continuous rotation across the full page
  const rotate = useTransform(scrollYProgress, [0, 1], [-15, 360]);

  // Side-to-side weave: drifts left → right → left → right as you scroll
  const x = useTransform(
    scrollYProgress,
    [0, 0.12, 0.25, 0.38, 0.5, 0.62, 0.75, 0.88, 1],
    ["30vw", "-28vw", "32vw", "-30vw", "28vw", "-32vw", "30vw", "-28vw", "32vw"]
  );

  // Scale breathes
  const scale = useTransform(scrollYProgress, [0, 0.2, 0.5, 0.8, 1], [0.85, 1.0, 1.1, 1.0, 0.9]);

  // 3D perspective tilts
  const rotateY = useTransform(scrollYProgress, [0, 0.5, 1], [0, 15, -10]);
  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [5, -5, 10]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center pointer-events-none z-10"
      style={{ perspective: "1200px" }}
    >
      <motion.div
        style={{ x, rotate, scale, rotateY, rotateX }}
        className="w-[220px] h-[420px] sm:w-[260px] sm:h-[500px] md:w-[320px] md:h-[600px] will-change-transform"
      >
        <img
          src={silverFork}
          alt=""
          className="w-full h-full object-contain drop-shadow-[0_20px_60px_rgba(120,120,130,0.4)]"
          width={512}
          height={1024}
        />
      </motion.div>
    </div>
  );
};
