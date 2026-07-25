"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";

type Observation = {
  accent: string;
  headline: string;
  explanation: string;
  action: string;
};

const observations: readonly Observation[] = [
  {
    accent: "SPENDING CHANGE",
    headline: "Youth sports spending is higher this month.",
    explanation: "You spent $184 more than usual, driven by two equipment purchases at Dick’s Sporting Goods.",
    action: "Understand this",
  },
  {
    accent: "RECURRING COST",
    headline: "Your car insurance payment increased.",
    explanation: "This month’s payment was $46 higher than the previous six-month average.",
    action: "Show me why",
  },
  {
    accent: "POSITIVE CHANGE",
    headline: "Dining out is down 18% this month.",
    explanation: "You spent $126 less than last month, mostly from fewer weekday purchases.",
    action: "See the details",
  },
  {
    accent: "CASH FLOW",
    headline: "Your checking balance is lower than usual.",
    explanation: "Your annual homeowners insurance payment cleared yesterday.",
    action: "Understand this",
  },
];

const rotationInterval = 4500;

export function RotatingObservationCard() {
  const reduceMotion = Boolean(useReducedMotion());
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const isPaused = isManuallyPaused || isHovered || hasFocus;
  const observation = observations[activeIndex];

  const toggleManualPause = () => {
    setIsManuallyPaused((paused) => !paused);
  };

  useEffect(() => {
    if (reduceMotion || isPaused) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % observations.length);
    }, rotationInterval);

    return () => window.clearInterval(timer);
  }, [isPaused, reduceMotion]);

  return (
    <div
      className="clarity-card"
      aria-label={isManuallyPaused ? "Resume rotating financial observations" : "Pause rotating financial observations"}
      aria-pressed={isManuallyPaused}
      data-observation-index={activeIndex}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHasFocus(false);
      }}
      onClick={() => {
        setHasFocus(false);
        toggleManualPause();
      }}
      onFocus={() => setHasFocus(true)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        toggleManualPause();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={0}
    >
      <div className="card-top"><span>YOUR MONEY PICTURE</span><span className={`status-dot${isManuallyPaused ? " is-paused" : ""}`} /></div>
      <div className="clarity-icon"><Check size={24} /></div>
      <div className="observation-stage" aria-live="off" aria-atomic="true">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            className="observation-content"
            key={activeIndex}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: reduceMotion ? 0 : 0.45, ease: "easeOut" }}
          >
            <p className="card-kicker">{observation.accent}</p>
            <h2>{observation.headline}</h2>
            <p className="observation-explanation">{observation.explanation}</p>
            <span className="observation-action">{observation.action}</span>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="soft-lines" aria-hidden="true"><i /><i /><i /></div>
    </div>
  );
}
