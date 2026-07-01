"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Transition } from "framer-motion";
import { ArrowRight, Check, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageLayout } from "@/components/layout/page-layout";
import { SectionHeader } from "@/components/layout/section-header";
import { Button } from "@/components/ui/button";
import { Card, SelectableCard } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Eyebrow, Heading, Subheading } from "@/components/ui/typography";
import { useAutoAdvance } from "@/hooks/use-auto-advance";
import { analysisAreas, analysisQuestions, intentionOptions, lifeIcons, lifeOptions, trustStatements } from "./onboarding-data";

type Step = "welcome" | "intentions" | "life" | "connect" | "analysis" | "ready";

const steps: Step[] = ["welcome", "intentions", "life", "connect", "analysis", "ready"];

const calmTransition: Transition = { duration: 0.42, ease: [0.22, 1, 0.36, 1] };
const analysisStatuses = ["Understanding your financial life...", "Finding patterns...", "Looking for opportunities...", "Almost ready..."];

const previewItems = [
  {
    title: "Today's Bright Spot",
    body: "You're already doing more right than you think.",
  },
  {
    title: "Today's Discovery",
    body: "Your spending has a story. Covarify helps you understand it.",
  },
  {
    title: "Next Best Move",
    body: "We'll help you find the next smart move.",
  },
];

const pageMotion = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -14 },
  transition: calmTransition,
};

export function OnboardingExperience() {
  const [step, setStep] = useState<Step>("welcome");
  const [intentions, setIntentions] = useState<string[]>([]);
  const [life, setLife] = useState<string[]>([]);
  const [analysisAnswers, setAnalysisAnswers] = useState<Record<number, string>>({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  const stepIndex = steps.indexOf(step);
  const progress = step === "welcome" ? 8 : ((stepIndex + 1) / steps.length) * 100;

  const next = useCallback(() => {
    setStep((current) => steps[Math.min(steps.indexOf(current) + 1, steps.length - 1)]);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [step]);

  useAutoAdvance(step === "analysis", 9000, () => setStep("ready"));

  const toggle = (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter((selected) => (selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]));
  };

  const answeredAnalysisCount = useMemo(() => Object.keys(analysisAnswers).length, [analysisAnswers]);

  return (
    <PageLayout>
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-7xl flex-col">
        <nav className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#16131d] text-white">
              <Sparkles size={18} />
            </div>
            <span className="text-sm font-semibold text-[#262036]">Covarify</span>
          </div>
          <div className="hidden w-56 sm:block">
            <ProgressBar value={progress} />
          </div>
        </nav>

        <AnimatePresence mode="wait">
          {step === "welcome" && (
            <motion.section key="welcome" className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1fr_0.82fr]" {...pageMotion}>
              <div className="max-w-3xl">
                <Eyebrow>Financial clarity, finally calm</Eyebrow>
                <Heading className="mt-5">Clarity changes everything.</Heading>
                <div className="mt-6 grid max-w-lg gap-2 text-base font-semibold text-[#262036] sm:grid-cols-2">
                  {["No budgets.", "No spreadsheets.", "No judgment.", "Just clarity."].map((line) => (
                    <span key={line} className="rounded-full bg-white/68 px-4 py-2 shadow-[0_8px_22px_rgba(54,36,99,0.06)]">
                      {line}
                    </span>
                  ))}
                </div>
                <Subheading className="mt-7 max-w-2xl">
                  Let&apos;s build the clearest picture of your financial life&mdash;where you stand today, what matters most,
                  and the path to where you want to be.
                </Subheading>
                <p className="mt-5 text-sm font-medium text-[#726b7c]">It takes about 10 minutes.</p>
                <Button className="mt-9" size="lg" onClick={next}>
                  Get Started
                  <ArrowRight size={18} />
                </Button>
                <div className="mt-5">
                  <Button asChild variant="ghost" size="sm" className="text-[#726b7c]">
                    <Link href="/first-win">Preview First Win</Link>
                  </Button>
                </div>
              </div>
              <Card className="relative overflow-hidden p-6 sm:p-8">
                <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#c8baff] to-transparent" />
                <div className="rounded-[24px] border border-[#eee7f5] bg-[#fbfaf8] p-5">
                  <p className="text-sm font-semibold text-[#5f586b]">A preview of what clarity can feel like</p>
                  <div className="mt-6 space-y-4">
                    {previewItems.map((item, index) => (
                      <motion.div
                        key={item.title}
                        className="rounded-[22px] bg-white p-4 shadow-[0_10px_30px_rgba(54,36,99,0.07)]"
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.12 * index }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ede7ff] text-[#4d31c7]">
                            <Check size={16} />
                          </span>
                          <span className="text-sm font-semibold text-[#262036]">{item.title}</span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[#5f586b]">{item.body}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </Card>
            </motion.section>
          )}

          {step === "intentions" && (
            <ChoiceStep
              key="intentions"
              title="What brought you to Covarify today?"
              eyebrow="Discovery"
              body="Choose what feels true right now. We'll use this to shape your first view."
              options={intentionOptions}
              selected={intentions}
              onToggle={(value) => toggle(value, setIntentions)}
              onNext={next}
              canContinue={intentions.length > 0}
            />
          )}

          {step === "life" && (
            <ChoiceStep
              key="life"
              title="Tell us a little about your financial life."
              eyebrow="Financial life"
              body="A few details help Covarify understand the shape of your money, not just the numbers."
              options={lifeOptions}
              selected={life}
              icons={lifeIcons}
              onToggle={(value) => toggle(value, setLife)}
              onNext={next}
              canContinue={life.length > 0}
            />
          )}

          {step === "connect" && (
            <motion.section key="connect" className="flex flex-1 items-center py-12" {...pageMotion}>
              <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[0.92fr_1fr]">
                <SectionHeader
                  className="text-left"
                  eyebrow="Account connection"
                  title="Let's connect your accounts."
                  body={
                    <>
                      In just a few minutes, you&apos;ll get a personalized view of where you stand today, what&apos;s driving
                      your finances, and where your biggest opportunities may be.
                    </>
                  }
                />
                <Card className="p-6 sm:p-8">
                  <div className="flex items-center gap-3 rounded-3xl bg-[#f5f1ff] p-4 text-[#4d31c7]">
                    <LockKeyhole size={20} />
                    <span className="text-sm font-semibold">Secure, read-only connection</span>
                  </div>
                  <h3 className="mt-8 text-lg font-semibold text-[#16131d]">What we&apos;ll analyze</h3>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    {analysisAreas.map(({ label, icon: Icon }) => (
                      <div key={label} className="flex items-center gap-3 rounded-2xl border border-[#eee7f5] bg-white/72 p-4">
                        <Icon className="text-[#7c5cff]" size={18} />
                        <span className="text-sm font-medium text-[#262036]">{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-7 grid gap-3 sm:grid-cols-2">
                    {trustStatements.map((statement) => (
                      <div key={statement} className="flex items-center gap-3 rounded-2xl bg-[#fbfaf8] p-3 text-sm font-semibold text-[#4f4859]">
                        <ShieldCheck size={17} className="text-[#2f8f77]" />
                        <span>{statement}</span>
                      </div>
                    ))}
                  </div>
                  <Button className="mt-8 w-full" size="lg" onClick={next}>
                    Build My Financial Picture
                    <ArrowRight size={18} />
                  </Button>
                </Card>
              </div>
            </motion.section>
          )}

          {step === "analysis" && (
            <motion.section key="analysis" className="flex flex-1 items-center py-12" {...pageMotion}>
              <Card className="mx-auto grid w-full max-w-5xl gap-8 p-6 sm:p-8 lg:grid-cols-[0.8fr_1fr]">
                <div>
                  <Eyebrow>Understanding your financial life</Eyebrow>
                  <h2 className="mt-4 font-serif text-4xl font-semibold leading-tight text-[#16131d]">
                    Let&apos;s see what we find.
                  </h2>
                  <p className="mt-5 text-base leading-7 text-[#5f586b]">
                    Covarify is organizing the signals that can explain where you stand, what&apos;s changing, and what may
                    deserve your attention next.
                  </p>
                  <div className="mt-8 rounded-[24px] border border-[#eee7f5] bg-white/72 p-4">
                    <ProgressBar value={42 + answeredAnalysisCount * 18} />
                    <div className="mt-4 grid gap-3">
                      {analysisStatuses.map((status, index) => {
                        const active = index <= Math.min(answeredAnalysisCount + 1, analysisStatuses.length - 1);

                        return (
                          <motion.div
                            key={status}
                            className="flex items-center gap-3 text-sm font-medium text-[#5f586b]"
                            animate={shouldReduceMotion ? undefined : { opacity: active ? 1 : 0.45 }}
                            transition={{ duration: 0.4 }}
                          >
                            <motion.span
                              className={active ? "h-2.5 w-2.5 rounded-full bg-[#7c5cff]" : "h-2.5 w-2.5 rounded-full bg-[#d9d1e4]"}
                              animate={shouldReduceMotion || !active ? undefined : { scale: [1, 1.25, 1] }}
                              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                            />
                            {status}
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="rounded-[24px] border border-[#eee7f5] bg-[#fbfaf8] p-5">
                  {analysisQuestions.map((question, index) => {
                    const Icon = question.icon;
                    const active = index === questionIndex;
                    const answered = analysisAnswers[index];

                    return (
                      <motion.div
                        key={question.prompt}
                        className={active ? "block" : "hidden"}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#ede7ff] text-[#4d31c7]">
                            <Icon size={18} />
                          </span>
                        <p className="text-sm font-semibold text-[#726b7c]">Question {index + 1} of 3</p>
                      </div>
                        <h3 className="mt-5 text-2xl font-semibold leading-snug text-[#16131d]">{question.prompt}</h3>
                        <div className="mt-5 grid gap-3">
                          {question.options.map((option) => (
                            <SelectableCard
                              key={option}
                              selected={answered === option}
                              className="min-h-16 rounded-2xl"
                              onClick={() => {
                                setAnalysisAnswers((current) => ({ ...current, [index]: option }));
                                if (index < analysisQuestions.length - 1) {
                                  setQuestionIndex(index + 1);
                                } else {
                                  setStep("ready");
                                }
                              }}
                            >
                              {option}
                            </SelectableCard>
                          ))}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </Card>
            </motion.section>
          )}

          {step === "ready" && (
            <motion.section key="ready" className="flex flex-1 items-center py-12 text-center" {...pageMotion}>
              <Card className="mx-auto max-w-3xl p-8 sm:p-12">
                <motion.div
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#ede7ff] text-[#4d31c7]"
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={calmTransition}
                >
                  <Check size={24} />
                </motion.div>
                <Eyebrow className="mt-6">Sample preview</Eyebrow>
                <h2 className="mt-4 font-serif text-4xl font-semibold leading-tight text-[#16131d] sm:text-5xl">
                  See what your first financial picture could feel like.
                </h2>
                <p className="mt-5 text-lg leading-8 text-[#5f586b]">
                  This preview uses sample data while real account analysis is still being built.
                </p>
                <Button asChild className="mt-8" size="lg">
                  <Link href="/first-win">Preview Example Financial Picture</Link>
                </Button>
                <p className="mt-4 text-sm font-medium text-[#726b7c]">Example preview using sample data.</p>
              </Card>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </PageLayout>
  );
}

function ChoiceStep({
  eyebrow,
  title,
  body,
  options,
  selected,
  icons,
  onToggle,
  onNext,
  canContinue,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  options: string[];
  selected: string[];
  icons?: React.ElementType[];
  onToggle: (value: string) => void;
  onNext: () => void;
  canContinue: boolean;
}) {
  return (
    <motion.section className="flex flex-1 flex-col justify-center py-10" {...pageMotion}>
      <SectionHeader eyebrow={eyebrow} title={title} body={body} />
      <div className="mx-auto mt-9 grid w-full max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((option, index) => {
          const Icon = icons?.[index];
          return (
            <SelectableCard key={option} selected={selected.includes(option)} onClick={() => onToggle(option)}>
              <div className="flex h-full flex-col justify-between gap-5">
                <div className="flex items-center justify-between">
                  {Icon ? (
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f1ecff] text-[#7c5cff]">
                      <Icon size={20} />
                    </span>
                  ) : (
                    <span className="h-2 w-10 rounded-full bg-[#d8cdfd]" />
                  )}
                  {selected.includes(option) ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7c5cff] text-white">
                      <Check size={14} />
                    </span>
                  ) : null}
                </div>
                <span>{option}</span>
              </div>
            </SelectableCard>
          );
        })}
      </div>
      <div className="mx-auto mt-9 flex w-full max-w-5xl justify-end">
        <Button onClick={onNext} disabled={!canContinue}>
          Continue
          <ArrowRight size={18} />
        </Button>
      </div>
    </motion.section>
  );
}
