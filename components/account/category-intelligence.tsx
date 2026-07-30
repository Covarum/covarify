"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import type {
  CategoryInsight,
  CategoryIntelligencePayload,
} from "@/lib/category-intelligence";
import { displaySeparated } from "@/lib/presentation-separators";
import styles from "./money-picture.module.css";

const money = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);

const changeCopy = (category: CategoryInsight) => {
  if (category.comparison === "new")
    return "This category newly appeared in the selected period.";
  if (category.comparison === "insufficient")
    return "There is not enough prior activity for a reliable comparison.";
  if (category.comparison === "similar")
    return `Spending remained similar to the prior period (${money(category.priorAmount)}).`;
  const direction = category.comparison === "increased" ? "increased" : "decreased";
  const percentage =
    category.changePercentage === null
      ? ""
      : ` (${Math.abs(category.changePercentage).toFixed(0)}%)`;
  return `Spending ${direction} by ${money(Math.abs(category.changeAmount))}${percentage} from ${money(category.priorAmount)}.`;
};

const answerFor = (category: CategoryInsight, prompt: string) => {
  if (prompt === "What drove this category?") {
    return category.largestContributor
      ? `${category.largestContributor.label} represented approximately ${category.largestContributor.share.toFixed(0)}% of identified ${category.displayLabel} spending.`
      : "The total was spread across multiple identified purchases; no single merchant met the reliable-contributor threshold.";
  }
  if (prompt === "Show me the largest purchases.")
    return category.largestContributor
      ? `The largest reliable merchant contribution was ${money(category.largestContributor.amount)}.`
      : "No single merchant contribution is strong enough to highlight reliably.";
  if (prompt === "Compare with the previous period.") return changeCopy(category);
  if (prompt === "Which account did I use most?") {
    const account = category.accountDistribution[0];
    return account
      ? `${account.accountLabel} represented approximately ${account.share.toFixed(0)}% of this category.`
      : "Account-level evidence is not available.";
  }
  if (prompt === "Was this mostly recurring or one-time spending?")
    return category.relatedEventCount
      ? `${category.relatedEventCount} related Financial Event${category.relatedEventCount === 1 ? "" : "s"} may provide recurring or grouped context. Covarify does not classify the remaining activity as recurring without reliable evidence.`
      : "No related Financial Event currently establishes a recurring pattern.";
  return category.relatedEventCount
    ? `${category.relatedEventCount} related Financial Event${category.relatedEventCount === 1 ? "" : "s"} supports this category.`
    : "No related Financial Events were identified for this category.";
};

const prompts = [
  "What drove this category?",
  "Show me the largest purchases.",
  "Compare with the previous period.",
  "Which account did I use most?",
  "Was this mostly recurring or one-time spending?",
  "Show related Financial Events.",
];

export function CategoryIntelligence({
  payload,
  periodLabel,
}: {
  payload: CategoryIntelligencePayload;
  periodLabel: string;
}) {
  const [selected, setSelected] = useState<CategoryInsight | null>(null);
  const [answer, setAnswer] = useState<{ prompt: string; body: string } | null>(
    null,
  );
  const triggers = useRef(new Map<string, HTMLButtonElement>());

  function close() {
    const categoryId = selected?.categoryId;
    setSelected(null);
    setAnswer(null);
    if (categoryId) {
      window.setTimeout(() => triggers.current.get(categoryId)?.focus(), 0);
    }
  }

  function filterCategory(category: CategoryInsight | null) {
    window.dispatchEvent(
      new CustomEvent("covarify:category-filter", {
        detail: category
          ? {
              categoryId: category.categoryId,
              periodStart: category.activePeriod.start,
              periodEnd: category.activePeriod.end,
              transactionIds: category.supportingTransactionIds,
            }
          : { categoryId: null },
      }),
    );
    if (category) close();
    window.setTimeout(
      () =>
        document
          .getElementById("recent-activity-heading")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  }

  return (
    <>
      <article className={`${styles.wide} ${styles.categoryCard}`}>
        <header>
          <div>
            <h3>Spending by category</h3>
            <p>
              {displaySeparated(
                periodLabel,
                "Transfers and pending activity excluded",
              )}
            </p>
          </div>
          <div className={styles.categoryTotal}>
            <span>Total identified spending</span>
            <strong>{money(payload.totalIdentifiedSpending)}</strong>
            <button type="button" onClick={() => filterCategory(null)}>
              Show all categories
            </button>
          </div>
        </header>
        {payload.interpretation ? (
          <p className={styles.categoryInterpretation}>
            {payload.interpretation}
          </p>
        ) : null}
        {payload.categories.length ? (
          <ul className={styles.categories}>
            {payload.categories.slice(0, 6).map((category) => (
              <li key={category.categoryId}>
                <button
                  ref={(node) => {
                    if (node) triggers.current.set(category.categoryId, node);
                  }}
                  type="button"
                  className={styles.categoryTrigger}
                  aria-label={`${category.displayLabel}: ${money(category.currentAmount)}, ${category.currentShare.toFixed(0)}% of identified spending. Understand this`}
                  onClick={() => {
                    setSelected(category);
                    setAnswer(null);
                  }}
                >
                  <span>
                    <span>{category.displayLabel}</span>
                    <strong>
                      {displaySeparated(
                        money(category.currentAmount),
                        `${category.currentShare.toFixed(0)}%`,
                      )}
                    </strong>
                  </span>
                  <i aria-hidden="true">
                    <b style={{ width: `${category.currentShare}%` }} />
                  </i>
                  <em>Understand this</em>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>
            There is not enough categorized spending in this period.
          </p>
        )}
      </article>
      {selected ? (
        <div
          className={styles.categoryBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section
            className={styles.categoryPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-panel-title"
          >
            <header>
              <div>
                <p>Category understanding</p>
                <h2 id="category-panel-title">{selected.displayLabel}</h2>
                <span>{selected.activePeriod.label}</span>
              </div>
              <button
                type="button"
                className={styles.categoryClose}
                aria-label="Close category explanation"
                onClick={close}
              >
                <X size={20} />
              </button>
            </header>
            <div className={styles.categoryPanelBody}>
              <section>
                <h3>Evidence</h3>
                <dl className={styles.categoryEvidence}>
                  <div>
                    <dt>Total category spending</dt>
                    <dd>{money(selected.currentAmount)}</dd>
                  </div>
                  <div>
                    <dt>Share of identified spending</dt>
                    <dd>{selected.currentShare.toFixed(0)}%</dd>
                  </div>
                  <div>
                    <dt>Transactions</dt>
                    <dd>{selected.transactionCount}</dd>
                  </div>
                  <div>
                    <dt>Prior equivalent period</dt>
                    <dd>{money(selected.priorAmount)}</dd>
                  </div>
                </dl>
                <p>{changeCopy(selected)}</p>
                {selected.accountDistribution.length ? (
                  <div className={styles.accountEvidence}>
                    <h4>Account distribution</h4>
                    {selected.accountDistribution.map((account) => (
                      <p key={account.accountLabel}>
                        <span>{account.accountLabel}</span>
                        <strong>
                          {displaySeparated(
                            money(account.amount),
                            `${account.share.toFixed(0)}%`,
                          )}
                        </strong>
                      </p>
                    ))}
                  </div>
                ) : null}
                {selected.subcategories.length ? (
                  <div className={styles.accountEvidence}>
                    <h4>Detailed category breakdown</h4>
                    {selected.subcategories.map((subcategory) => (
                      <p key={subcategory.label}>
                        <span>
                          {subcategory.inferred ? "Estimated " : ""}
                          {subcategory.label}
                        </span>
                        <strong>{money(subcategory.amount)}</strong>
                      </p>
                    ))}
                  </div>
                ) : null}
                <p className={styles.categoryContext}>
                  <strong>Category:</strong> {selected.displayLabel}
                  <br />
                  <strong>Related event:</strong>{" "}
                  {selected.relatedEventCount
                    ? `${selected.relatedEventCount} supporting Financial Event${selected.relatedEventCount === 1 ? "" : "s"}`
                    : "None identified"}
                  <br />
                  <strong>User context:</strong> No separate confirmed context
                  is applied to this category.
                </p>
              </section>
              <section>
                <h3>Meaning</h3>
                <p>{selected.meaning}</p>
              </section>
              <section>
                <h3>Possible actions</h3>
                <ul>
                  <li>Review the largest purchases.</li>
                  <li>Compare this category with the prior period.</li>
                  <li>See which account was used most.</li>
                  <li>Review recurring activity in this category.</li>
                  <li>Confirm whether purchases belong to a Financial Event.</li>
                </ul>
                <button
                  type="button"
                  className={styles.categoryFilterAction}
                  onClick={() => filterCategory(selected)}
                >
                  Show these transactions
                </button>
              </section>
              <section>
                <h3>Conversation</h3>
                <div className={styles.categoryPrompts}>
                  {prompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() =>
                        setAnswer({
                          prompt,
                          body: answerFor(selected, prompt),
                        })
                      }
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
                {answer ? (
                  <div className={styles.categoryAnswer} aria-live="polite">
                    <strong>{answer.prompt}</strong>
                    <p>{answer.body}</p>
                  </div>
                ) : null}
              </section>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
