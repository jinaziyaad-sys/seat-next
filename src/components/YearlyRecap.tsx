import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Sparkles, Calendar, MapPin, Clock, Star, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { YearlyRecapData } from "@/hooks/useYearlyRecap";

interface YearlyRecapProps {
  data: YearlyRecapData;
  onClose: () => void;
  onComplete: () => void;
}

const TOTAL_SLIDES = 7;

function CountUp({ value, duration = 2000 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (value === 0) return;
    
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * value));
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{count}</span>;
}

function SlideWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
    >
      {children}
    </motion.div>
  );
}

export function YearlyRecap({ data, onClose, onComplete }: YearlyRecapProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    if (currentSlide < TOTAL_SLIDES - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1);
    }
  };

  const handleTap = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) {
      prevSlide();
    } else {
      nextSlide();
    }
  };

  const { stats, patron_name, year, member_since } = data;

  const slides = [
    // Slide 0: Welcome
    <SlideWrapper key="welcome">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
      >
        <Sparkles className="w-16 h-16 text-amber-400 mb-6" />
      </motion.div>
      <motion.h1 
        className="text-4xl font-bold text-white mb-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        Hey {patron_name}!
      </motion.h1>
      <motion.p 
        className="text-xl text-white/80"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        Your {year} in Review
      </motion.p>
      {member_since && (
        <motion.p 
          className="text-sm text-white/50 mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          Member since {new Date(member_since).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </motion.p>
      )}
    </SlideWrapper>,

    // Slide 1: Total Activity
    <SlideWrapper key="activity">
      <Calendar className="w-12 h-12 text-emerald-400 mb-6" />
      <h2 className="text-2xl font-semibold text-white/70 mb-4">This year you made</h2>
      <div className="space-y-4">
        {stats.total_orders > 0 && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <span className="text-6xl font-bold text-white">
              <CountUp value={stats.total_orders} />
            </span>
            <p className="text-xl text-white/70">food orders</p>
          </motion.div>
        )}
        {(stats.total_waitlist_joins > 0 || stats.total_reservations > 0) && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
          >
            <span className="text-5xl font-bold text-emerald-400">
              <CountUp value={stats.total_waitlist_joins + stats.total_reservations} />
            </span>
            <p className="text-lg text-white/70">
              table {stats.total_reservations > 0 ? "reservations & waitlist joins" : "waitlist joins"}
            </p>
          </motion.div>
        )}
      </div>
      <motion.p 
        className="text-white/60 mt-8 italic"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        {stats.total_orders + stats.total_waitlist_joins + stats.total_reservations >= 20 
          ? "You were quite the regular! 🌟" 
          : stats.total_orders + stats.total_waitlist_joins + stats.total_reservations >= 5
            ? "Great to see you out and about!"
            : "Every visit counts! 🎉"}
      </motion.p>
    </SlideWrapper>,

    // Slide 2: Favorite Venue
    <SlideWrapper key="venue">
      <MapPin className="w-12 h-12 text-rose-400 mb-6" />
      {stats.favorite_venue ? (
        <>
          <h2 className="text-2xl font-semibold text-white/70 mb-4">Your go-to spot</h2>
          <motion.h1 
            className="text-4xl font-bold text-white mb-4"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
          >
            {stats.favorite_venue.name}
          </motion.h1>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <span className="text-5xl font-bold text-rose-400">
              <CountUp value={stats.favorite_venue.visits} />
            </span>
            <p className="text-lg text-white/70">visits this year</p>
          </motion.div>
          {stats.venues_visited > 1 && (
            <motion.p 
              className="text-white/50 mt-6 text-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              You also explored {stats.venues_visited - 1} other venue{stats.venues_visited > 2 ? "s" : ""}
            </motion.p>
          )}
        </>
      ) : (
        <>
          <h2 className="text-2xl font-semibold text-white/70">No favorite yet</h2>
          <p className="text-white/50 mt-4">Start exploring venues in the new year!</p>
        </>
      )}
    </SlideWrapper>,

    // Slide 3: Time Stats
    <SlideWrapper key="time">
      <Clock className="w-12 h-12 text-sky-400 mb-6" />
      <h2 className="text-2xl font-semibold text-white/70 mb-6">Your rhythm</h2>
      <div className="space-y-6">
        {stats.busiest_day && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <span className="text-4xl font-bold text-white">{stats.busiest_day.day_name}s</span>
            <p className="text-white/70">were your thing</p>
          </motion.div>
        )}
        {stats.busiest_month && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <span className="text-3xl font-bold text-sky-400">{stats.busiest_month.month_name}</span>
            <p className="text-white/70">was your busiest month</p>
          </motion.div>
        )}
      </div>
    </SlideWrapper>,

    // Slide 4: Speed Stats
    <SlideWrapper key="speed">
      <motion.div
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="mb-6"
      >
        ⏱️
      </motion.div>
      <h2 className="text-2xl font-semibold text-white/70 mb-6">Speed check</h2>
      <div className="space-y-6">
        {stats.avg_order_wait_minutes && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <span className="text-5xl font-bold text-white">
              <CountUp value={stats.avg_order_wait_minutes} />
            </span>
            <span className="text-2xl text-white/70 ml-2">min</span>
            <p className="text-white/70">average food wait</p>
          </motion.div>
        )}
        {stats.avg_table_wait_minutes && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            <span className="text-4xl font-bold text-amber-400">
              <CountUp value={stats.avg_table_wait_minutes} />
            </span>
            <span className="text-xl text-white/70 ml-2">min</span>
            <p className="text-white/70">average table wait</p>
          </motion.div>
        )}
        {!stats.avg_order_wait_minutes && !stats.avg_table_wait_minutes && (
          <p className="text-white/50">No wait time data yet</p>
        )}
      </div>
    </SlideWrapper>,

    // Slide 5: Rating Summary
    <SlideWrapper key="ratings">
      <Star className="w-12 h-12 text-yellow-400 mb-6" />
      <h2 className="text-2xl font-semibold text-white/70 mb-6">Your feedback</h2>
      {stats.ratings_given > 0 ? (
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            <span className="text-6xl font-bold text-white">
              <CountUp value={stats.ratings_given} />
            </span>
            <p className="text-lg text-white/70">ratings given</p>
          </motion.div>
          {stats.avg_rating_given && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
            >
              <div className="flex items-center justify-center gap-1 mt-4">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star
                    key={star}
                    className={`w-8 h-8 ${star <= Math.round(stats.avg_rating_given!) ? "text-yellow-400 fill-yellow-400" : "text-white/30"}`}
                  />
                ))}
              </div>
              <p className="text-white/70 mt-2">{stats.avg_rating_given} average</p>
              <p className="text-white/50 text-sm mt-2">
                {stats.avg_rating_given >= 4.5
                  ? "You're a generous rater! 😊"
                  : stats.avg_rating_given >= 3.5
                    ? "Fair and balanced!"
                    : "You have high standards! 💪"}
              </p>
            </motion.div>
          )}
        </div>
      ) : (
        <motion.p 
          className="text-white/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          No ratings yet — your feedback helps venues improve!
        </motion.p>
      )}
    </SlideWrapper>,

    // Slide 6: Thank You
    <SlideWrapper key="thanks">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200 }}
      >
        <Heart className="w-16 h-16 text-rose-500 mb-6" />
      </motion.div>
      <motion.h1 
        className="text-4xl font-bold text-white mb-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        Thanks for an amazing {year}!
      </motion.h1>
      <motion.p 
        className="text-xl text-white/70 mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        Here's to more great experiences in {year + 1}
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
      >
        <Button
          onClick={onComplete}
          className="bg-white text-black hover:bg-white/90 px-8 py-3 text-lg font-semibold"
        >
          Done
        </Button>
      </motion.div>
    </SlideWrapper>,
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 overflow-hidden"
      onClick={handleTap}
    >
      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 z-10 p-2 text-white/60 hover:text-white transition-colors"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Navigation hints */}
      {currentSlide > 0 && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
          <ChevronLeft className="w-8 h-8" />
        </div>
      )}
      {currentSlide < TOTAL_SLIDES - 1 && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30">
          <ChevronRight className="w-8 h-8" />
        </div>
      )}

      {/* Slides */}
      <AnimatePresence mode="wait">
        {slides[currentSlide]}
      </AnimatePresence>

      {/* Progress dots */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
        {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentSlide(i);
            }}
            className={`w-2 h-2 rounded-full transition-all ${
              i === currentSlide 
                ? "bg-white w-6" 
                : "bg-white/30 hover:bg-white/50"
            }`}
          />
        ))}
      </div>
    </motion.div>
  );
}
