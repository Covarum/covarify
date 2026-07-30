"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Sparkles, X } from "lucide-react";
import Link from "next/link";

import type {
  InsightCandidate,
  IntelligenceResult,
} from "@/lib/money-picture-intelligence";
import {
  answerObservationQuestion,
  type ConversationAnswer,
  type ObservationExplanationPayload,
} from "@/lib/money-picture-explanations";
import styles from "./money-picture-observations.module.css";

type MoneyPictureObservationsProps = {
  intelligence: Pick<
    IntelligenceResult,
    "observations" | "criticalAlert" | "stableMessage" | "dataQualityStatus"
  >;
  explanations: ObservationExplanationPayload[];
};

function ObservationCard({
  observation,
  dismiss,
  explain,
  error,
}: {
  observation: InsightCandidate;
  dismiss: (observationId: string) => void;
  explain: (observationId: string, trigger: HTMLButtonElement) => void;
  error: string | null;
}) {
  const connectionHealth = observation.ruleId === "stability.connection_action";
  return (
    <article
      className={styles.card}
      aria-labelledby={`${observation.observationId}-title`}
    >
      <button
        className={styles.dismiss}
        type="button"
        onClick={() => dismiss(observation.observationId)}
        aria-label={`${connectionHealth ? "Not now" : "Dismiss"} ${observation.title} for this session`}
      >
        <X size={15} aria-hidden="true" />
      </button>
      <p className={styles.period}>{observation.period}</p>
      <h3 id={`${observation.observationId}-title`}>{observation.title}</h3>
      <p className={styles.observed}>{observation.observed}</p>
      <p className={styles.meaning}>{observation.meaning}</p>
      <p className={styles.support}>{observation.support}</p>
      {observation.recoveryAction === "update_mode" ? (
        <Link className={styles.question} href="/account/connection/refresh">
          <strong>Refresh connection</strong>
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      ) : observation.recoveryAction === "passive" ? (
        <p className={styles.passiveAction}>We&apos;ll keep checking</p>
      ) : (
        <button
          className={styles.question}
          type="button"
          onClick={(event) =>
            explain(observation.observationId, event.currentTarget)
          }
        >
          <strong>Understand this</strong>
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      )}
      {error ? <p className={styles.actionError} role="alert">{error}</p> : null}
    </article>
  );
}

const money = (value: number) =>
  `${value < 0 ? "−" : ""}${new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.abs(value))}`;

function GuidedExplanation({
  payload,
}: {
  payload: ObservationExplanationPayload;
}) {
  const metric = (key: string) =>
    payload.supportingMetrics.find((item) => item.key === key);

  if (payload.ruleId === "cashflow.material_change") {
    const net = metric("net_cash_flow");
    const inflows = metric("inflows");
    const outflows = metric("outflows");
    const largest = payload.signals.largestExpense;
    const incomeIsDriver =
      Math.abs(inflows?.change || 0) > Math.abs(outflows?.change || 0);
    const netChange = net?.change || 0;
    return (
      <div className={styles.guided}>
        <section>
          <p className={styles.sectionLabel}>Evidence</p>
          <h3>What changed</h3>
          <p>
            Your identified net cash flow moved from approximately{" "}
            <strong>{money(net?.prior || 0)}</strong> in the previous period to
            approximately <strong>{money(net?.current || 0)}</strong> in the
            current period.
          </p>
          <p>
            That is a {netChange < 0 ? "decrease" : "increase"} of approximately{" "}
            <strong>{money(Math.abs(netChange))}</strong>.
          </p>
        </section>
        <section>
          <h3>What drove it</h3>
          <p>
            The primary driver was{" "}
            {incomeIsDriver ? "lower identified inflows" : "identified outflows"}.
          </p>
          <p>
            Identified inflows{" "}
            {(inflows?.change || 0) >= 0 ? "increased" : "decreased"} by
            approximately <strong>{money(Math.abs(inflows?.change || 0))}</strong>.
          </p>
          <p>
            Identified outflows also{" "}
            {(outflows?.change || 0) >= 0 ? "increased" : "decreased"} by
            approximately <strong>{money(Math.abs(outflows?.change || 0))}</strong>
            {incomeIsDriver && (outflows?.change || 0) < 0
              ? ", so increased overall spending was not the cause."
              : "."}
          </p>
          {largest != null && (
            <p>
              No single purchase explains the full change. The largest
              identified expense was approximately{" "}
              <strong>{money(largest)}</strong>.
            </p>
          )}
        </section>
        <section>
          <p className={styles.sectionLabel}>Meaning</p>
          <h3>What this may mean</h3>
          <p>
            The change appears to reflect{" "}
            {incomeIsDriver
              ? "less money coming in rather than more money going out"
              : "a change in identified spending rather than money coming in"}
            .
          </p>
          <p>
            Understanding whether the lower inflows were expected, temporary,
            or part of a changing income pattern may help you plan with greater
            clarity.
          </p>
        </section>
        <section>
          <p className={styles.sectionLabel}>Possible actions</p>
          <h3>What may be worth reviewing</h3>
          <ul>
            <li>Confirm whether any expected income was delayed or missing.</li>
            <li>Compare the deposits received during each period.</li>
            <li>Review which spending categories changed most.</li>
            <li>Identify whether the change appears temporary or recurring.</li>
          </ul>
        </section>
      </div>
    );
  }

  if (payload.ruleId === "spending.large_expense") {
    const largest = metric("largest_expense")?.current || 0;
    const total = metric("total_outflow")?.current || 0;
    const remaining = Math.max(0, total - largest);
    return (
      <div className={styles.guided}>
        <section>
          <p className={styles.sectionLabel}>Evidence</p>
          <h3>How the expense affected the period</h3>
          <p>
            The largest identified expense was approximately{" "}
            <strong>{money(largest)}</strong>, compared with approximately{" "}
            <strong>{money(total)}</strong> of estimated outflow.
          </p>
          {total > 0 && (
            <p>
              That is about <strong>{Math.round((largest / total) * 100)}%</strong>{" "}
              of identified outflow for the period.
            </p>
          )}
        </section>
        <section>
          <p className={styles.sectionLabel}>Context</p>
          <h3>What the period looks like without it</h3>
          <p>
            The remaining identified outflow would be approximately{" "}
            <strong>{money(remaining)}</strong>.
          </p>
          <p>
            This is an explanation of connected activity, not a judgment about
            whether the purchase was necessary or affordable.
          </p>
        </section>
      </div>
    );
  }

  const primary = payload.supportingAccounts[0];
  return (
    <div className={styles.guided}>
      <section>
        <p className={styles.sectionLabel}>Evidence</p>
        <h3>What Covarify sees</h3>
        <p className={styles.leadMetric}>
          <strong>{Math.round((primary?.outflowShare || 0) * 100)}%</strong>{" "}
          <span>of identified outflow</span>
        </p>
        <p>
          Approximately {Math.round((primary?.outflowShare || 0) * 100)}% of
          identified outflow and{" "}
          {Math.round((primary?.inflowShare || 0) * 100)}% of identified inflow
          during the period flowed through one connected account.
        </p>
        <p>
          {primary?.recurringBillCount || 0} recurring-payment patterns were
          also identified from this account.
        </p>
      </section>
      <section>
        <p className={styles.sectionLabel}>Meaning</p>
        <h3>What it may mean</h3>
        <p>
          This account appears to function as your primary operating account.
          This is an inferred pattern, not a permanent account role and not a
          recommendation to switch accounts.
        </p>
      </section>
      <section>
        <h3>Why it matters</h3>
        <p>
          Understanding what flows through this account may help clarify where
          income arrives, where predictable payments leave, and whether your
          account setup is working the way you intend.
        </p>
      </section>
      <section>
        <p className={styles.sectionLabel}>Possible actions</p>
        <h3>What may be worth reviewing</h3>
        <p>
          Explore which identified income and recurring payments use this
          account before considering any change.
        </p>
      </section>
    </div>
  );
}

export function MoneyPictureObservations({
  intelligence,
  explanations,
}: MoneyPictureObservationsProps) {
  const initial = [
    ...(intelligence.criticalAlert ? [intelligence.criticalAlert] : []),
    ...intelligence.observations,
  ];
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [activeExplanation, setActiveExplanation] =
    useState<ObservationExplanationPayload | null>(null);
  const [answer, setAnswer] = useState<ConversationAnswer | null>(null);
  const [explanationError, setExplanationError] = useState<{ observationId: string; message: string } | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef(false);
  const visible = initial.filter(
    (observation) => !dismissed.has(observation.observationId),
  );
  const dismiss = (observationId: string) =>
    setDismissed((current) => new Set(current).add(observationId));
  const explain = (observationId: string, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setAnswer(null);
    const explanation = explanations.find(
      (candidate) => candidate.observationId === observationId,
    );
    if (!explanation) {
      setExplanationError({
        observationId,
        message: "Supporting detail is temporarily unavailable. The observation remains open.",
      });
      return;
    }
    setExplanationError(null);
    setActiveExplanation(explanation);
  };
  const closeExplanation = () => {
    restoreFocusRef.current = true;
    setActiveExplanation(null);
    setAnswer(null);
  };

  useEffect(() => {
    if (!activeExplanation) {
      if (restoreFocusRef.current) {
        restoreFocusRef.current = false;
        requestAnimationFrame(() => triggerRef.current?.focus());
      }
      return;
    }
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeExplanation();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [
        ...panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeExplanation]);

  return (
    <section
      className={styles.section}
      aria-labelledby="money-picture-observations-heading"
    >
      <div className={styles.heading}>
        <div>
          <p>
            <Sparkles size={14} aria-hidden="true" />
            Explainable observations
          </p>
          <h2 id="money-picture-observations-heading">What matters today</h2>
        </div>
        <span>Based on connected account activity</span>
      </div>

      {visible.length > 0 ? (
        <div className={styles.grid}>
          {visible.map((observation) => (
            <ObservationCard
              key={observation.observationId}
              observation={observation}
              dismiss={dismiss}
              explain={explain}
              error={explanationError?.observationId === observation.observationId
                ? explanationError.message
                : null}
            />
          ))}
        </div>
      ) : initial.length > 0 ? (
        <div className={styles.stable}>
          <h3>Observations dismissed for this session</h3>
          <p>They will return when you start a new session.</p>
        </div>
      ) : (
        <div className={styles.stable}>
          <h3>Your financial picture is stable today</h3>
          <p>
            No meaningful changes were detected based on your connected account
            activity.
          </p>
        </div>
      )}

      {intelligence.dataQualityStatus && (
        <aside className={styles.dataQuality}>
          <strong>{intelligence.dataQualityStatus.title}</strong>
          <span>{intelligence.dataQualityStatus.body}</span>
        </aside>
      )}

      {activeExplanation && (
        <div className={styles.backdrop}>
          <section
            ref={panelRef}
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="money-picture-explanation-heading"
          >
            <button
              ref={closeRef}
              className={styles.close}
              type="button"
              onClick={closeExplanation}
              aria-label="Close Money Picture explanation"
            >
              <X size={18} aria-hidden="true" />
            </button>
            <p className={styles.panelEyebrow}>Understand your Money Picture</p>
            <h2 id="money-picture-explanation-heading">
              {initial.find(
                (item) =>
                  item.observationId === activeExplanation.observationId,
              )?.title || "Observation explanation"}
            </h2>
            <p className={styles.panelPeriod}>
              {activeExplanation.period.split(", compared with ").map(
                (period, index) => (
                  <span key={period}>
                    {index === 1 && <em>compared with</em>}
                    {period}
                  </span>
                ),
              )}
            </p>
            <GuidedExplanation payload={activeExplanation} />

            {answer && (
              <div className={styles.answer} aria-live="polite">
                <h3>{answer.heading}</h3>
                <p>{answer.answer}</p>
                {answer.evidence.length > 0 && (
                  <ul>
                    {answer.evidence.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
                <small>{answer.qualification}</small>
              </div>
            )}

            <div className={styles.prompts}>
              <p className={styles.sectionLabel}>Conversation</p>
              <h3>Explore further</h3>
              {activeExplanation.supportedQuestions.map((question) => (
                <button
                  key={question.id}
                  type="button"
                  onClick={() =>
                    setAnswer(
                      answerObservationQuestion(
                        activeExplanation,
                        question.id,
                      ),
                    )
                  }
                >
                  {question.label}
                </button>
              ))}
            </div>
            <p className={styles.safety}>
              Covarify explains your connected financial activity and supports
              more informed decisions. It does not provide investment, tax,
              insurance, borrowing, or legal advice.
            </p>
          </section>
        </div>
      )}
    </section>
  );
}
