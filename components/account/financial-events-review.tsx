"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  ["confirm_group", "Confirm as one medical event"],
  ["separate", "Separate into individual transactions"],
  ["rename", "Rename event"],
  ["unsure", "Unsure"],
] as const;

const inferredLabels: Record<string, string> = {
  unresolved_recurring_payment: "Recurring payment — needs your input",
  insurance_premium: "Insurance premium",
  medical_expense: "Medical event grouping",
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
}: {
  cards: FinancialEventReviewCard[];
  preview?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(
    Math.max(0, cards.findIndex((card) => !card.reviewed || card.stale)),
  );
  const active = cards[activeIndex];
  const reviewed = cards.filter((card) => card.reviewed && !card.stale).length;
  const sections = useMemo(
    () => ({
      recurring: cards.filter((card) => card.kind === "recurring").length,
      grouped: cards.filter((card) => card.kind === "grouped").length,
    }),
    [cards],
  );

  return (
    <main className={styles.page}>
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
              <strong>{reviewed} of {cards.length} reviewed</strong>
              <span>{sections.recurring} recurring · {sections.grouped} grouped</span>
            </div>
            <i><b style={{ width: `${cards.length ? (reviewed / cards.length) * 100 : 0}%` }} /></i>
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
              {cards.map((card, index) => (
                <button
                  key={card.eventId}
                  onClick={() => setActiveIndex(index)}
                  className={index === activeIndex ? styles.activeItem : undefined}
                >
                  <span>{index + 1}</span>
                  <div><strong>{card.displayName}</strong><small>{card.kind === "recurring" ? "Recurring payment" : "Grouped event"}</small></div>
                  {card.reviewed && !card.stale ? <Check size={16} /> : <ChevronRight size={16} />}
                </button>
              ))}
            </aside>

            <article className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <span className={styles.kind}>{active.kind === "recurring" ? "Recurring payment" : "Grouped event"}</span>
                  <h2>{active.displayName}</h2>
                  <p>{active.accountLabel}</p>
                </div>
                <span className={styles.confidence}>{active.confidence} confidence</span>
              </div>
              {active.stale && (
                <div className={styles.stale}>
                  <Clock3 size={18} />
                  Covarify noticed this pattern changed. Please confirm whether this label still fits.
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
                <strong>Why Covarify noticed this</strong>
                <p>{active.reason}</p>
                <small>Current inference: {inferredLabels[active.inferredType] || active.inferredType.replaceAll("_", " ")}</small>
              </div>
              <form action={preview ? undefined : saveFinancialEventReview}>
                <input type="hidden" name="eventId" value={active.eventId} />
                <input type="hidden" name="conditionSignature" value={active.conditionSignature} />
                <fieldset>
                  <legend>{active.kind === "recurring" ? "What kind of recurring payment is this?" : "Do these charges belong to the same financial event?"}</legend>
                  <div className={styles.choices}>
                    {(active.kind === "recurring" ? recurringOptions : groupingOptions).map(([value, label]) => (
                      <label key={value}>
                        <input type="radio" name="decision" value={value} required />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className={styles.label}>
                  <span>Optional label</span>
                  <input name="title" maxLength={80} placeholder={active.kind === "recurring" ? "Example: Phone bill" : "Example: Medical visit"} />
                </label>
                <div className={styles.actions}>
                  <button type="button" className={styles.skip} onClick={() => setActiveIndex((activeIndex + 1) % cards.length)}>Skip for now</button>
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
