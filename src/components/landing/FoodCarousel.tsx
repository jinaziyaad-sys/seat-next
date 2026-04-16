import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import foodBurger from "@/assets/food-burger.png";
import foodFries from "@/assets/food-fries.png";
import foodMilkshake from "@/assets/food-milkshake.png";
import foodPizza from "@/assets/food-pizza.png";
import foodBowl from "@/assets/food-bowl.png";

const foods = [
  { image: foodBurger, label: "Burgers", emoji: "🍔", color: "from-amber-500/20 to-orange-500/20" },
  { image: foodPizza, label: "Pizza", emoji: "🍕", color: "from-red-500/20 to-orange-400/20" },
  { image: foodFries, label: "Fries", emoji: "🍟", color: "from-yellow-400/20 to-amber-500/20" },
  { image: foodMilkshake, label: "Milkshakes", emoji: "🥤", color: "from-pink-400/20 to-rose-400/20" },
  { image: foodBowl, label: "Poké Bowls", emoji: "🥗", color: "from-green-400/20 to-emerald-500/20" },
];

export const FoodCarousel = ({ className }: { className?: string }) => {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const goTo = (index: number) => {
    setDirection(index > current ? 1 : -1);
    setCurrent(index);
    resetTimer();
  };

  const resetTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setDirection(1);
      setCurrent((p) => (p + 1) % foods.length);
    }, 3500);
  };

  useEffect(() => {
    resetTimer();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const food = foods[current];

  const variants = {
    enter: (d: number) => ({
      x: d > 0 ? 200 : -200,
      opacity: 0,
      scale: 0.8,
      rotateY: d > 0 ? 25 : -25,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      rotateY: 0,
    },
    exit: (d: number) => ({
      x: d > 0 ? -200 : 200,
      opacity: 0,
      scale: 0.8,
      rotateY: d > 0 ? -25 : 25,
    }),
  };

  return (
    <section className={className}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-6">
          <p className="text-sm font-medium uppercase tracking-widest text-primary mb-2">
            Track Any Order
          </p>
          <h2 className="text-2xl md:text-4xl font-bold">
            From <span className="text-primary">{food.emoji} {food.label}</span> to your table
          </h2>
        </div>

        <div className="relative flex items-center justify-center h-[280px] md:h-[360px] overflow-hidden">
          {/* Background glow */}
          <motion.div
            className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${food.color} transition-colors duration-700`}
            key={`bg-${current}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          />

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={current}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 25,
                duration: 0.5,
              }}
              className="absolute"
            >
              <motion.img
                src={food.image}
                alt={food.label}
                width={512}
                height={512}
                className="w-48 h-48 md:w-64 md:h-64 object-contain drop-shadow-2xl"
                animate={{
                  y: [0, -8, 0],
                }}
                transition={{
                  y: { repeat: Infinity, duration: 3, ease: "easeInOut" },
                }}
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dots + labels */}
        <div className="flex items-center justify-center gap-3 mt-6">
          {foods.map((f, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${
                i === current
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-105"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <span>{f.emoji}</span>
              <span className="hidden sm:inline">{f.label}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
