"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronRight, Clock3, ShieldCheck, Sparkles } from "lucide-react";
import { saveFinancialEventReview } from "@/app/account/events/review/actions";
import type { FinancialEventReviewCard } from "@/lib/financial-event-review-server";
import styles from "./financial-events-review.module.css";

const recurringOptions = [
  ["subscription", "Subscription"],
  ["utility_bill", "Utility bill"],
  ["insurance_premium", "Insurance premium"],
  ["loan_payment", "Loan payment"],
  ["credit_card_payment", "Credit-card payment"],
  ["membership", "Membership"],
  ["recurring_service", "Recurring service"],
  ["other_recurring_bill", "Other recurring bill"],
  ["not_recurring", "Not recurring"],
  ["unsure", "Unsure"],
] as const;

const groupingOptions = [
  ["related", "Yes"],
  ["separate", "No"],
  ["unsure", "I’m not sure"],
] as const;
const contextSuggestions = [
  "Prescription or medication",
  "Medical supplies",
  "Personal care",
  "Household purchase",
  "One-time shopping",
  "Other",
] as const;
const recurringContextSuggestions = [
  "Business software",
  "Personal membership",
  "Household bill",
  "Child-related expense",
  "Travel",
  "Other",
] as const;

const inferredLabels: Record<string, string> = {
  unresolved_recurring_payment: "Recurring payment — needs your input",
  insurance_premium: "Insurance premium",
  medical_expense: "Prior broad-category inference",
  related_purchases: "Possible related purchases",
};
const decisionLabels = Object.fromEntries([
  ...recurringOptions,
  ...groupingOptions,
]);

const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
const friendlyDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );

function Evidence({ card }: { card: FinancialEventReviewCard }) {
  if (card.kind === "recurring") {
    return (
      <dl className={styles.evidence}>
        <div><dt>Typical amount</dt><dd>{money(card.typicalAmount)}</dd></div>
        <div><dt>Observed cadence</dt><dd>{card.cadence}</dd></div>
        <div><dt>First observed</dt><dd>{friendlyDate(card.firstObserved)}</dd></div>
        <div><dt>Most recent</dt><dd>{friendlyDate(card.lastObserved)}</dd></div>
        <div><dt>Occurrences</dt><dd>{card.occurrenceCount}</dd></div>
        <div><dt>Amount variation</dt><dd>{(card.amountVariation * 100).toFixed(0)}%</dd></div>
      </dl>
    );
  }
  return (
    <dl className={styles.evidence}>
      <div><dt>Date range</dt><dd>{card.dateRange}</dd></div>
      <div><dt>Transactions</dt><dd>{card.transactionCount}</dd></div>
      <div><dt>Combined amount</dt><dd>{money(card.aggregateAmount)}</dd></div>
      <div><dt>Confidence</dt><dd>{card.confidence}</dd></div>
    </dl>
  );
}

export function FinancialEventsReview({
  cards,
  preview = false,
  mobilePreview = false,
  initialIndex,
}: {
  cards: FinancialEventReviewCard[];
  preview?: boolean;
  mobilePreview?: boolean;
  initialIndex?: number;
}) {
  const primaryIndices = cards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => card.reviewTier === "primary")
    .map(({ index }) => index);
  const initialPrimaryIndex = primaryIndices[0] ?? -1;
  const [activeIndex, setActiveIndex] = useState(
    initialIndex ?? initialPrimaryIndex,
  );
  const active = cards[activeIndex];
  const primaryCards = primaryIndices.map((index) => cards[index]);
  const laterCards = cards.filter((card) => card.reviewTier === "later");
  const historyCards = cards.filter((card) => card.reviewTier === "history");
  const reviewed = primaryCards.filter(
    (card) => card.reviewed && !card.stale,
  ).length;
  const sections = {
    recurring: primaryCards.filter((card) => card.kind === "recurring").length,
    grouped: primaryCards.filter((card) => card.kind === "grouped").length,
  };
  const saveAndContinue = async (formData: FormData) => {
    await saveFinancialEventReview(formData);
    const currentPosition = primaryIndices.indexOf(activeIndex);
    const nextIndex =
      primaryIndices[(currentPosition + 1) % primaryIndices.length];
    if (nextIndex !== undefined && nextIndex !== activeIndex) {
      setActiveIndex(nextIndex);
    }
  };

  return (
    <main
      className={`${styles.page} ${mobilePreview ? styles.mobilePreview : ""}`}
      style={{ overflowX: "clip" }}
    >
      <header className={styles.topbar}>
        <Link href="/account" aria-label="Return to Money Picture">covarify</Link>
        <span><ShieldCheck size={16} /> Founder review</span>
      </header>
      <div className={styles.shell}>
        <section className={styles.intro}>
          <p className={styles.eyebrow}><Sparkles size={14} /> Financial Events</p>
          <h1>Help Covarify understand these patterns</h1>
          <p>
            Review a small set of patterns from your connected activity. Your
            answers add context without changing the original transactions.
          </p>
          <div className={styles.progress}>
            <div>
              <strong>{reviewed} of {primaryCards.length} reviewed</strong>
              <span>{sections.recurring} recurring · {sections.grouped} possible groups</span>
            </div>
            <i><b style={{ width: `${primaryCards.length ? (reviewed / primaryCards.length) * 100 : 0}%` }} /></i>
          </div>
        </section>

        {!active ? (
          <section className={styles.complete}>
            <Check size={24} />
            <h2>Nothing needs review right now</h2>
            <p>Covarify will bring patterns back here when your input is useful.</p>
            <Link href="/account">Return to your Money Picture</Link>
          </section>
        ) : (
          <section className={styles.reviewGrid}>
            <aside aria-label="Review queue">
              <h2>Review queue</h2>
              {primaryIndices.map((index, position) => {
                const card = cards[index];
                return (
                <button
                  key={card.eventId}
                  onClick={() => setActiveIndex(index)}
                  className={index === activeIndex ? styles.activeItem : undefined}
                >
                  <span>{position + 1}</span>
                  <div><strong>{card.displayName}</strong><small>{card.kind === "recurring" ? "Recurring payment" : "Possible related purchases"}</small></div>
                  {card.reviewed && !card.stale ? <Check size={16} /> : <ChevronRight size={16} />}
                </button>
                );
              })}
              {laterCards.length > 0 && (
                <details className={styles.secondaryQueue}>
                  <summary>Review later ({laterCards.length})</summary>
                  {laterCards.map((card) => {
                    const index = cards.indexOf(card);
                    return (
                      <button key={card.eventId} onClick={() => setActiveIndex(index)}>
                        <span>·</span>
                        <div><strong>{card.displayName}</strong><small>Available when useful</small></div>
                        <ChevronRight size={16} />
                      </button>
                    );
                  })}
                </details>
              )}
              {historyCards.length > 0 && (
                <details className={styles.secondaryQueue}>
                  <summary>Confirmation history ({historyCards.length})</summary>
                  {historyCards.map((card) => {
                    const index = cards.indexOf(card);
                    return (
                      <button key={card.eventId} onClick={() => setActiveIndex(index)}>
                        <span><Check size={13} /></span>
                        <div><strong>{card.displayName}</strong><small>Prior answer preserved</small></div>
                        <ChevronRight size={16} />
                      </button>
                    );
                  })}
                </details>
              )}
            </aside>

            <article className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <span className={styles.kind}>{active.kind === "recurring" ? "Recurring payment" : "Possible related purchases"}</span>
                  <h2 style={{ overflowWrap: "anywhere" }}>{active.displayName}</h2>
                  <p style={{ overflowWrap: "anywhere" }}>{active.accountLabel}</p>
                </div>
                <span className={styles.confidence}>{active.confidence} confidence</span>
              </div>
              {active.stale && (
                <div className={styles.stale}>
                  <Clock3 size={18} />
                  Covarify noticed this pattern changed. Please confirm whether this label still fits.
                </div>
              )}
              {active.reReviewReason === "inference_model_refined" && (
                <div className={styles.stale}>
                  <Clock3 size={18} />
                  This item is back for review because Covarify refined how it
                  interprets mixed-use merchants. Earlier history is preserved.
                </div>
              )}
              {active.reviewed && !active.stale && (
                <div className={styles.explanation}>
                  <strong>Latest founder confirmation</strong>
                  <p>
                    {decisionLabels[active.latestDecision || ""] || "Reviewed"}
                    {active.latestLabel ? ` · ${active.latestLabel}` : ""}
                  </p>
                  <small>
                    {active.reviewCount} confirmation record
                    {active.reviewCount === 1 ? "" : "s"} retained in history
                  </small>
                </div>
              )}
              <Evidence card={active} />
              <div className={styles.explanation}>
                <strong>{active.kind === "recurring" ? "Covarify noticed this payment repeats" : "Why Covarify noticed this"}</strong>
                <p>{active.kind === "recurring" ? "This charge has appeared on a regular pattern." : active.reason}</p>
                <small>
                  Current inference: {inferredLabels[active.inferredType] || active.inferredType.replaceAll("_", " ")}
                  {" · "}Queue priority {active.priorityScore}: {active.priorityReason}
                </small>
              </div>
              <form action={preview ? undefined : saveAndContinue}>
                <input type="hidden" name="eventId" value={active.eventId} />
                <input type="hidden" name="conditionSignature" value={active.conditionSignature} />
                <fieldset>
                  <legend>{active.kind === "recurring" ? "What kind of recurring payment is this?" : "Are these purchases related?"}</legend>
                  <div className={styles.choices}>
                    {(active.kind === "recurring" ? recurringOptions : groupingOptions).map(([value, label]) => (
                      <label key={value}>
                        <input
                          type="radio"
                          name="decision"
                          value={value}
                          required
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {active.kind === "recurring" && (
                  <fieldset className={styles.optionalContext}>
                    <legend>What do you use this for? <small>Optional</small></legend>
                    <div className={styles.choices}>
                      {recurringContextSuggestions.map((label) => (
                        <label key={label}>
                          <input type="radio" name="contextSuggestion" value={label} />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                    <label className={styles.label}>
                      <span>Or add your own label</span>
                      <input name="context" maxLength={120} placeholder="Use your own words" />
                    </label>
                  </fieldset>
                )}
                {active.kind === "grouped" && (
                    <fieldset className={styles.contextStep}>
                      <legend>What would you call this? <small>Optional</small></legend>
                      <div className={styles.choices}>
                        {contextSuggestions.map((label) => (
                          <label key={label}>
                            <input type="radio" name="contextSuggestion" value={label} />
                            <span>{label}</span>
                          </label>
                        ))}
                      </div>
                      <label className={styles.label}>
                        <span>Or add your own label</span>
                        <input name="context" maxLength={120} placeholder="Use your own words" />
                      </label>
                    </fieldset>
                )}
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.skip}
                    onClick={() => {
                      const position = primaryIndices.indexOf(activeIndex);
                      const next = primaryIndices[(position + 1) % primaryIndices.length];
                      if (next !== undefined) setActiveIndex(next);
                    }}
                  >
                    Skip for now
                  </button>
                  <button type={preview ? "button" : "submit"} className={styles.save}>Save and continue <ChevronRight size={17} /></button>
                </div>
              </form>
            </article>
          </section>
        )}
      </div>
    </main>
  );
}
