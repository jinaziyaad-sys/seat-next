import { motion, useScroll, useTransform } from "framer-motion";
import silverFork from "@/assets/silver-fork.png";

export const ScrollFork = () => {
  // Track scroll across the ENTIRE page
  const { scrollYProgress } = useScroll();

  // Gucci key motion: continuous rotation across the full page scroll
  const rotate = useTransform(scrollYProgress, [0, 1], [-15, 360]);
  // Scale breathes in and out as you scroll
  const scale = useTransform(scrollYProgress, [0, 0.2, 0.5, 0.8, 1], [0.85, 1.0, 1.1, 1.0, 0.9]);
  // 3D perspective tilt for depth
  const rotateY = useTransform(scrollYProgress, [0, 0.5, 1], [0, 15, -10]);
  const rotateX = useTransform(scrollYProgress, [0, 0.5, 1], [5, -5, 10]);

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-10" style={{ perspective: "1200px" }}>
      <motion.div
        style={{
          rotate,
          scale,
          rotateY,
          rotateX,
        }}
        className="w-[280px] h-[520px] sm:w-[320px] sm:h-[600px] md:w-[380px] md:h-[700px] will-change-transform"
      >
        <img
          src={silverFork}
          alt="Silver fork"
          className="w-full h-full object-contain drop-shadow-[0_20px_60px_rgba(120,120,130,0.4)]"
          width={512}
          height={1024}
        />
      </motion.div>
    </div>
  );
};
