"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";
import { ArrowRight, ChevronDown, CircleHelp, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { defaultFinancialStory, discoveryReasonLines, firstWinExamples, planStrategies } from "./first-win-data";

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
  const shouldReduceMotion = useReducedMotion();

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
    <MotionCard
      index={0}
      className="relative bg-[#fffdf8]/88 p-8 shadow-[0_40px_120px_rgba(92,63,178,0.2)] ring-1 ring-[#efe4ff] sm:p-12"
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[#d9ccff]/52 blur-3xl" />
      <div className="pointer-events-none absolute bottom-8 right-12 hidden h-16 w-16 rounded-full border border-[#d8cdfd] bg-white/42 sm:block" />
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#b9a7ff] to-transparent" />
      <div className="relative max-w-3xl">
        <p className="text-sm font-semibold text-[#7c5cff]">Start with what is working</p>
        <h1 className="mt-4 flex flex-wrap items-center gap-3 font-serif text-5xl font-semibold leading-[1.02] text-[#16131d] sm:text-6xl">
          <motion.span
            aria-hidden="true"
            className="inline-flex"
            animate={shouldReduceMotion ? undefined : { rotate: [0, -4, 3, 0], scale: [1, 1.04, 1] }}
            transition={{ duration: 3.8, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" }}
          >
            🎉
          </motion.span>
          <span>Your First Win</span>
        </h1>
        <p className="mt-5 text-xl leading-8 text-[#5f586b] sm:text-2xl">You&apos;re already doing better than you think.</p>
      </div>
      <div className="relative mt-10 rounded-[28px] border border-[#e8defd] bg-[#f7f3ff]/86 p-6 shadow-[0_18px_50px_rgba(124,92,255,0.1)] sm:p-7">
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
          <p className="text-sm font-semibold text-[#7c5cff]">One thing we noticed...</p>
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
  supportingCopy = "Paying this card first could reduce the amount of interest you pay while freeing up cash sooner.",
}: {
  nextBestMove?: string;
  supportingCopy?: string;
}) {
  const [planOpen, setPlanOpen] = useState(false);

  return (
    <MotionCard index={2} className="bg-white/76">
      <p className="text-sm font-semibold text-[#7c5cff]">Momentum step</p>
      <h2 className="mt-3 font-serif text-4xl font-semibold leading-tight text-[#16131d] sm:text-5xl">
        🎯 Next Best Move
      </h2>
      <p className="mt-6 max-w-3xl text-2xl font-semibold leading-snug text-[#262036]">{nextBestMove}</p>
      <p className="mt-5 max-w-2xl text-base leading-7 text-[#5f586b]">{supportingCopy}</p>
      <Button className="mt-8" size="lg" onClick={() => setPlanOpen(true)} aria-haspopup="dialog">
        Show Me the Plan
        <ArrowRight size={18} />
      </Button>
      <PlanPreviewModal open={planOpen} onClose={() => setPlanOpen(false)} />
    </MotionCard>
  );
}

export function PlanPreviewModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#16131d]/42 p-4 backdrop-blur-sm sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
        >
          <motion.section
            aria-modal="true"
            role="dialog"
            aria-labelledby="plan-preview-title"
            className="relative max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[30px] border border-white/72 bg-[#fffdf8] p-6 shadow-[0_34px_110px_rgba(22,19,29,0.24)] sm:p-8 lg:p-10"
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              type="button"
              aria-label="Close plan preview"
              className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full border border-[#e7e1ee] bg-white/78 text-[#5f586b] transition hover:bg-white hover:text-[#262036] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
              onClick={onClose}
            >
              <X size={18} />
            </button>
            <div className="max-w-3xl pr-10">
              <p className="text-sm font-semibold text-[#7c5cff]">Sample planning preview</p>
              <h2 id="plan-preview-title" className="mt-3 font-serif text-4xl font-semibold leading-tight text-[#16131d] sm:text-5xl">
                Your Plan Preview
              </h2>
              <p className="mt-4 text-lg leading-8 text-[#5f586b]">
                Here&apos;s how Covarify would help you compare options before you decide.
              </p>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-3">
              {planStrategies.map((strategy) => (
                <StrategyCard key={strategy.title} {...strategy} />
              ))}
            </div>
            <div className="mt-8 rounded-[24px] border border-[#e8defd] bg-[#f7f3ff] p-5 text-sm leading-6 text-[#5f586b]">
              Example preview using sample data. Covarify will personalize this once your real accounts are connected.
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={onClose}>
                Compare Later
              </Button>
              <Button type="button" onClick={onClose}>
                Got it
              </Button>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function StrategyCard({
  title,
  label,
  details,
}: {
  title: string;
  label: string;
  details: string[];
}) {
  return (
    <article className="rounded-[24px] border border-[#e8defd] bg-white/82 p-5 shadow-[0_16px_46px_rgba(54,36,99,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-normal text-[#7c5cff]">{label}</p>
      <h3 className="mt-3 text-xl font-semibold leading-tight text-[#16131d]">{title}</h3>
      <ul className="mt-5 space-y-3 text-sm leading-6 text-[#5f586b]">
        {details.map((detail) => (
          <li key={detail} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7c5cff]" />
            <span>{detail}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function FinancialStoryCard({
  story = defaultFinancialStory,
}: {
  story?: string;
}) {
  return (
    <MotionCard index={3} className="bg-[#332b44] text-white shadow-[0_28px_80px_rgba(51,43,68,0.18)]">
      <p className="text-sm font-semibold text-[#dfd6ff]">Pulling the signals together</p>
      <h2 className="mt-3 font-serif text-4xl font-semibold leading-tight sm:text-5xl">📖 Your Financial Story</h2>
      <p className="mt-6 max-w-3xl text-xl leading-8 text-white/78">{story}</p>
    </MotionCard>
  );
}
