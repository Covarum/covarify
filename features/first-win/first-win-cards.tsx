"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import { ArrowRight, ChevronDown, CircleHelp } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { defaultFinancialStory, discoveryReasonLines, firstWinExamples, planPreviewCopy } from "./first-win-data";

const cardMotion: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: index * 0.18,
      duration: 0.68,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};

function MotionCard({
  index,
  className,
  children,
}: {
  index: number;
  className?: string;
  children: React.ReactNode;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      custom={index}
      initial={shouldReduceMotion ? false : "hidden"}
      animate="visible"
      variants={cardMotion}
    >
      <Card className={cn("overflow-hidden p-7 sm:p-10", className)}>{children}</Card>
    </motion.div>
  );
}

export function FirstWinCard({
  examples = firstWinExamples,
}: {
  examples?: string[];
}) {
  const [exampleIndex, setExampleIndex] = useState(0);

  useEffect(() => {
    if (examples.length < 2) {
      return;
    }

    const interval = window.setInterval(() => {
      setExampleIndex((current) => (current + 1) % examples.length);
    }, 4200);

    return () => window.clearInterval(interval);
  }, [examples.length]);

  return (
    <MotionCard index={0} className="relative bg-white/84 p-8 shadow-[0_36px_100px_rgba(64,43,128,0.18)] sm:p-12">
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#b9a7ff] to-transparent" />
      <div className="max-w-3xl">
        <p className="text-sm font-semibold text-[#7c5cff]">Start with what is working</p>
        <h1 className="mt-4 font-serif text-5xl font-semibold leading-[1.02] text-[#16131d] sm:text-6xl">
          🎉 Your First Win
        </h1>
        <p className="mt-5 text-xl leading-8 text-[#5f586b] sm:text-2xl">You&apos;re already doing better than you think.</p>
      </div>
      <div className="mt-10 rounded-[28px] border border-[#e8defd] bg-[#f7f3ff] p-6 sm:p-7">
        <AnimatePresence mode="wait">
          <motion.p
            key={examples[exampleIndex]}
            className="text-lg font-semibold leading-8 text-[#2d1c78] sm:text-xl"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
          >
            {examples[exampleIndex]}
          </motion.p>
        </AnimatePresence>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[#5f586b]">
          That kind of consistency matters. Covarify starts by recognizing what is already working.
        </p>
      </div>
    </MotionCard>
  );
}

export function DiscoveryCard({
  discovery = "You spend more investing in your future than you spend on yourself.",
  supportingCopy = "Most financial apps show transactions. Covarify looks for patterns.",
  reasonLines = discoveryReasonLines,
}: {
  discovery?: string;
  supportingCopy?: string;
  reasonLines?: string[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <MotionCard index={1} className="bg-white/78">
      <div className="flex flex-col gap-7 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold text-[#7c5cff]">Pattern found</p>
          <h2 className="mt-3 font-serif text-4xl font-semibold leading-tight text-[#16131d] sm:text-5xl">
            💡 Today&apos;s Discovery
          </h2>
          <p className="mt-6 text-2xl font-semibold leading-snug text-[#262036]">{discovery}</p>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#5f586b]">{supportingCopy}</p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="h-auto w-fit shrink-0 whitespace-normal py-3 text-left leading-5"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          <CircleHelp size={17} />
          How did you figure that out?
          <ChevronDown className={cn("shrink-0 transition-transform duration-300", expanded && "rotate-180")} size={17} />
        </Button>
      </div>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            className="mt-7 rounded-[24px] border border-[#e8defd] bg-[#fbf9ff] p-5 sm:p-6"
            initial={{ opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -6 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-sm font-semibold text-[#4d31c7]">I noticed this because...</p>
            <div className="mt-4 space-y-3 text-base leading-7 text-[#5f586b]">
              {reasonLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </MotionCard>
  );
}

export function NextBestMoveCard({
  nextBestMove = "Reducing your highest-interest credit card first would likely have the greatest impact.",
  supportingCopy = "Small improvements made consistently create meaningful progress over time.",
  planCopy = planPreviewCopy,
}: {
  nextBestMove?: string;
  supportingCopy?: string;
  planCopy?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <MotionCard index={2} className="bg-white/76">
      <p className="text-sm font-semibold text-[#7c5cff]">Momentum step</p>
      <h2 className="mt-3 font-serif text-4xl font-semibold leading-tight text-[#16131d] sm:text-5xl">
        🎯 Next Best Move
      </h2>
      <p className="mt-6 max-w-3xl text-2xl font-semibold leading-snug text-[#262036]">{nextBestMove}</p>
      <p className="mt-5 max-w-2xl text-base leading-7 text-[#5f586b]">{supportingCopy}</p>
      <Button className="mt-8" size="lg" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded}>
        Show Me the Plan
        <ArrowRight size={18} />
      </Button>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            className="mt-7 rounded-[24px] border border-[#e8defd] bg-[#fbf9ff] p-5 sm:p-6"
            initial={{ opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -6 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="max-w-3xl text-base leading-7 text-[#5f586b]">{planCopy}</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </MotionCard>
  );
}

export function FinancialStoryCard({
  story = defaultFinancialStory,
}: {
  story?: string;
}) {
  return (
    <MotionCard index={3} className="bg-[#2a2633] text-white shadow-[0_28px_80px_rgba(42,38,51,0.18)]">
      <p className="text-sm font-semibold text-[#d8cdfd]">Pulling the signals together</p>
      <h2 className="mt-3 font-serif text-4xl font-semibold leading-tight sm:text-5xl">📖 Your Financial Story</h2>
      <p className="mt-6 max-w-3xl text-xl leading-8 text-white/78">{story}</p>
    </MotionCard>
  );
}
