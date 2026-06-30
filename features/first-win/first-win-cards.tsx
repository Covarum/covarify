"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import { ChevronDown, CircleHelp } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { defaultFinancialStory, discoveryReasonLines, firstWinExamples } from "./first-win-data";

const cardMotion: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: index * 0.16,
      duration: 0.64,
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
      <Card className={cn("overflow-hidden p-7 sm:p-9", className)}>{children}</Card>
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
    <MotionCard index={0} className="relative bg-white/82 shadow-[0_32px_90px_rgba(64,43,128,0.16)]">
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#b9a7ff] to-transparent" />
      <div className="max-w-3xl">
        <p className="text-sm font-semibold text-[#7c5cff]">First signal</p>
        <h1 className="mt-4 font-serif text-5xl font-semibold leading-[1.02] text-[#16131d] sm:text-6xl">
          🎉 Your First Win
        </h1>
        <p className="mt-5 text-xl leading-8 text-[#5f586b] sm:text-2xl">You&apos;re already doing better than you think.</p>
      </div>
      <div className="mt-9 rounded-[26px] border border-[#e8defd] bg-[#f7f3ff] p-5 sm:p-6">
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
      </div>
    </MotionCard>
  );
}

export function DiscoveryCard({
  discovery = "You spend more investing in your future than you spend on yourself.",
  supportingCopy = "Most financial apps show transactions. Covarify looks for patterns. This is one of the first things we noticed.",
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
          className="w-fit shrink-0"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
        >
          <CircleHelp size={17} />
          Why?
          <ChevronDown className={cn("transition-transform duration-300", expanded && "rotate-180")} size={17} />
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

export function OpportunityCard({
  opportunity = "Reducing your highest-interest credit card first would likely have the greatest impact.",
  supportingCopy = "Small improvements made consistently create meaningful progress over time.",
}: {
  opportunity?: string;
  supportingCopy?: string;
}) {
  return (
    <MotionCard index={2} className="bg-white/76">
      <p className="text-sm font-semibold text-[#7c5cff]">Next best move</p>
      <h2 className="mt-3 font-serif text-4xl font-semibold leading-tight text-[#16131d] sm:text-5xl">
        🎯 Biggest Opportunity
      </h2>
      <p className="mt-6 max-w-3xl text-2xl font-semibold leading-snug text-[#262036]">{opportunity}</p>
      <p className="mt-5 max-w-2xl text-base leading-7 text-[#5f586b]">{supportingCopy}</p>
    </MotionCard>
  );
}

export function FinancialStoryCard({
  story = defaultFinancialStory,
}: {
  story?: string;
}) {
  return (
    <MotionCard index={3} className="bg-[#16131d] text-white shadow-[0_28px_80px_rgba(22,19,29,0.2)]">
      <p className="text-sm font-semibold text-[#c8baff]">Your financial story</p>
      <h2 className="mt-3 font-serif text-4xl font-semibold leading-tight sm:text-5xl">Financial Story</h2>
      <p className="mt-6 max-w-3xl text-xl leading-8 text-white/78">{story}</p>
    </MotionCard>
  );
}
