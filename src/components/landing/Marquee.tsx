import { motion } from "framer-motion";

const items = [
  "Real-Time Tracking",
  "✦",
  "Smart Waitlists",
  "✦",
  "Loyalty Rewards",
  "✦",
  "QR Check-In",
  "✦",
  "Kitchen Updates",
  "✦",
  "Table Reservations",
  "✦",
  "25+ Languages",
  "✦",
  "Instant Notifications",
  "✦",
];

export const Marquee = () => {
  const content = [...items, ...items];

  return (
    <div className="py-6 overflow-hidden border-y bg-primary/5">
      <motion.div
        className="flex whitespace-nowrap gap-8"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 25, ease: "linear", repeat: Infinity }}
      >
        {content.map((item, i) => (
          <span
            key={i}
            className={`text-sm font-medium shrink-0 ${
              item === "✦"
                ? "text-primary/40"
                : "text-muted-foreground uppercase tracking-[0.2em]"
            }`}
          >
            {item}
          </span>
        ))}
      </motion.div>
    </div>
  );
};
