"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatCategoryPath,
  formatTransactionCategoryPath,
  formatTransactionDisplayAmount,
  type FilteredTransactionSummary,
  type MoneyTransaction,
  type TransactionFilters,
  type TransactionSort,
} from "@/lib/money-picture";
import type { ResolvedFinancialPeriod } from "@/lib/financial-periods";
import { displaySeparated } from "@/lib/presentation-separators";
import {
  applySavedClassificationToTransaction,
  restoreTransactionCategoryView,
  type TransactionUnderstandingCompletedDetail,
} from "@/lib/transaction-understanding";
import styles from "./money-picture.module.css";

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount,
  );

function TransactionAmount({ transaction }: { transaction: MoneyTransaction }) {
  const amount = formatTransactionDisplayAmount(transaction);
  return (
    <strong
      className={styles[`mp-amount-${amount.tone}`]}
      title={amount.semanticLabel}
    >
      <span className="sr-only">{amount.accessibleText}</span>
      <span aria-hidden="true">{amount.displayAmount}</span>
    </strong>
  );
}

const countLabel = (summary: FilteredTransactionSummary) => {
  const noun =
    summary.kind === "inflow"
      ? "income transaction"
      : summary.kind === "spending"
        ? "spending transaction"
        : summary.kind === "transfer"
          ? "transfer"
          : summary.kind === "refund"
            ? "refund"
            : "transaction";
  return `${summary.count} ${noun}${summary.count === 1 ? "" : "s"}`;
};

const amountLabel = (summary: FilteredTransactionSummary) =>
  summary.kind === "inflow"
    ? "Total identified inflow"
    : summary.kind === "spending"
      ? "Total identified spending"
      : summary.kind === "transfer"
        ? "Total transferred"
        : summary.kind === "refund"
          ? "Total refunds"
          : "Net transaction amount";

function FilteredSummary({
  summary,
}: {
  summary: FilteredTransactionSummary;
}) {
  return (
    <aside
      className={styles["mp-filtered-summary"]}
      aria-label="Filtered summary"
    >
      <p>Filtered summary</p>
      <div>
        <span>{countLabel(summary)}</span>
        <span>
          {amountLabel(summary)}:{" "}
          <strong>{money(summary.aggregateAmount, summary.currency)}</strong>
        </span>
      </div>
      {summary.kind === "mixed" ? (
        <dl>
          <div>
            <dt>Identified inflows</dt>
            <dd>{money(summary.identifiedInflows, summary.currency)}</dd>
          </div>
          <div>
            <dt>Identified outflows</dt>
            <dd>{money(summary.identifiedOutflows, summary.currency)}</dd>
          </div>
        </dl>
      ) : null}
    </aside>
  );
}

export function RecentActivity({
  initial,
  initialSummary,
  total,
  accounts,
  categories,
  initialCursor,
  period,
}: {
  initial: MoneyTransaction[];
  initialSummary: FilteredTransactionSummary;
  total: number;
  accounts: Array<{ id: string; name: string }>;
  categories: string[];
  initialCursor: string | null;
  period: ResolvedFinancialPeriod;
}) {
  const [rows, setRows] = useState(initial);
  const [count, setCount] = useState(total);
  const [summary, setSummary] = useState(initialSummary);
  const [cursor, setCursor] = useState(initialCursor);
  const [filters, setFilters] = useState<TransactionFilters>({
    periodStart: period.start,
    periodEnd: period.end,
    sort: "newest",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [classificationNotice, setClassificationNotice] = useState<{
    detail: TransactionUnderstandingCompletedDetail;
    state: "saved" | "undoing" | "undone" | "error";
  } | null>(null);
  const requestSequence = useRef(0);
  const filtersRef = useRef(filters);
  const periodIdentity = `${period.start}:${period.end}`;
  const [dataPeriodIdentity, setDataPeriodIdentity] = useState(periodIdentity);

  async function request(
    nextCursor: string | null,
    nextFilters = filters,
    replace = false,
    requestedPeriodIdentity = dataPeriodIdentity,
  ) {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/account/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cursor: nextCursor, filters: nextFilters }),
      });
      if (!response.ok) throw new Error("request failed");
      const payload = await response.json();
      if (sequence !== requestSequence.current) return;
      setRows((current) =>
        replace
          ? payload.transactions
          : [
              ...new Map(
                [...current, ...payload.transactions].map((row) => [
                  row.id,
                  row,
                ]),
              ).values(),
            ],
      );
      setCount(payload.total);
      setSummary(payload.summary);
      setCursor(payload.cursor);
      setDataPeriodIdentity(requestedPeriodIdentity);
    } catch {
      if (sequence === requestSequence.current) setError(true);
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }

  function change(patch: Partial<TransactionFilters>) {
    const next = { ...filters, ...patch };
    filtersRef.current = next;
    setFilters(next);
    void request(null, next, true);
  }

  const requestRef = useRef(request);
  useEffect(() => {
    requestRef.current = request;
  });

  useEffect(() => {
    if (dataPeriodIdentity === periodIdentity) return;
    const timer = window.setTimeout(() => {
      const next = {
        ...filtersRef.current,
        category: categories.includes(filtersRef.current.category || "")
          ? filtersRef.current.category
          : undefined,
        transactionIds: undefined,
        periodStart: period.start,
        periodEnd: period.end,
      };
      filtersRef.current = next;
      setFilters(next);
      setRows([]);
      setCount(0);
      setCursor(null);
      void requestRef.current(null, next, true, periodIdentity);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [categories, period.end, period.start, periodIdentity, dataPeriodIdentity]);

  useEffect(() => {
    const handleCategoryFilter = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          categoryId: string | null;
          periodStart?: string;
          periodEnd?: string;
          transactionIds?: string[];
          search?: string;
        }>
      ).detail;
      change({
        category: detail.categoryId || undefined,
        periodStart: detail.periodStart || period.start,
        periodEnd: detail.periodEnd || period.end,
        transactionIds: detail.transactionIds?.length
          ? detail.transactionIds
          : undefined,
        search: detail.search || undefined,
      });
    };
    window.addEventListener("covarify:category-filter", handleCategoryFilter);
    const refreshEffectiveCategories = (event: Event) => {
      const detail = (event as CustomEvent<TransactionUnderstandingCompletedDetail>).detail;
      if (detail?.savedClassification) {
        setRows((current) => current.map((transaction) =>
          applySavedClassificationToTransaction(transaction, detail.savedClassification)));
        setClassificationNotice({ detail, state: "saved" });
      }
      void request(null, filters, true);
    };
    window.addEventListener(
      "covarify:transaction-understanding-confirmed",
      refreshEffectiveCategories,
    );
    return () =>
      {
        window.removeEventListener(
        "covarify:category-filter",
        handleCategoryFilter,
        );
        window.removeEventListener(
          "covarify:transaction-understanding-confirmed",
          refreshEffectiveCategories,
        );
      };
  });

  useEffect(() => {
    if (!classificationNotice || classificationNotice.state === "undoing") return;
    const timeout = window.setTimeout(() => setClassificationNotice(null), 10000);
    return () => window.clearTimeout(timeout);
  }, [classificationNotice]);

  async function undoClassification() {
    if (!classificationNotice || classificationNotice.state !== "saved") return;
    const { detail } = classificationNotice;
    setClassificationNotice({ detail, state: "undoing" });
    try {
      const response = await fetch("/api/account/transaction-understanding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operation: "undo",
          confirmationId: crypto.randomUUID(),
          transactionId: detail.undoRequest.transactionId,
          intent: detail.undoRequest.intent,
          sourceSignature: detail.undoRequest.sourceSignature,
        }),
      });
      if (!response.ok) throw new Error("undo failed");
      setRows((current) => current.map((transaction) =>
        restoreTransactionCategoryView(
          transaction,
          detail.undoRequest.transactionId,
          detail.priorCategoryView,
        )));
      setClassificationNotice({ detail, state: "undone" });
      void request(null, filters, true);
    } catch {
      setClassificationNotice({ detail, state: "error" });
    }
  }

  const sectionFiltered = Boolean(
    filters.accountId ||
    filters.category ||
    filters.search?.trim() ||
    filters.transactionIds?.length,
  );
  const periodRefreshing = dataPeriodIdentity !== periodIdentity;
  const resultCount = count === 0
    ? "No matching transactions"
    : rows.length >= count
      ? `Showing all ${count}${sectionFiltered ? " matching" : ""} transaction${count === 1 ? "" : "s"}`
      : `Showing ${rows.length} of ${count}${sectionFiltered ? " matching" : ""} transactions`;

  return (
    <section
      className={styles["mp-section"]}
      aria-labelledby="recent-activity-heading"
    >
      <div className={styles["mp-heading"]}>
        <div>
          <p>Supporting context</p>
          <h2 id="recent-activity-heading">Recent activity</h2>
        </div>
        <span aria-live="polite">
          {periodRefreshing ? "Updating activity…" : resultCount}
        </span>
      </div>
      <div className={styles["mp-filters"]}>
        <label>
          Account
          <select
            value={filters.accountId || ""}
            onChange={(event) =>
              change({ accountId: event.target.value || undefined })
            }
          >
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select
            value={filters.category || ""}
            onChange={(event) =>
              change({ category: event.target.value || undefined })
            }
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>
        <label>
          Search
          <input
            type="search"
            value={filters.search || ""}
            placeholder="Merchant or description"
            onChange={(event) => {
              const next = { ...filters, search: event.target.value };
              filtersRef.current = next;
              setFilters(next);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                change({ search: event.currentTarget.value });
              }
            }}
          />
        </label>
        <label>
          Sort by
          <select
            value={filters.sort || "newest"}
            onChange={(event) =>
              change({ sort: event.target.value as TransactionSort })
            }
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="highest">Highest amount</option>
            <option value="lowest">Lowest amount</option>
          </select>
        </label>
      </div>
      {classificationNotice ? (
        <aside className={styles["mp-classification-notice"]} role="status" aria-live="polite">
          <span>
            {classificationNotice.state === "undone"
              ? `${classificationNotice.detail.transactionName} restored to ${formatCategoryPath({
                  parentCategory: classificationNotice.detail.priorCategoryView.effectiveParentCategory,
                  subcategory: classificationNotice.detail.priorCategoryView.effectiveSubcategory,
                  sourceCategory: classificationNotice.detail.savedClassification.sourceCategory,
                })}.`
              : classificationNotice.state === "error"
                ? "The classification was saved, but Undo could not be completed."
                : `${classificationNotice.detail.transactionName} updated to ${formatCategoryPath({
                    parentCategory: classificationNotice.detail.savedClassification.effectiveParentCategory,
                    subcategory: classificationNotice.detail.savedClassification.effectiveSubcategory,
                    sourceCategory: classificationNotice.detail.savedClassification.sourceCategory,
                  })}.`}
          </span>
          {classificationNotice.state === "saved" || classificationNotice.state === "undoing" ? (
            <button type="button" disabled={classificationNotice.state === "undoing"} onClick={() => void undoClassification()}>
              {classificationNotice.state === "undoing" ? "Undoing…" : "Undo"}
            </button>
          ) : null}
          <button type="button" aria-label="Dismiss classification notice" onClick={() => setClassificationNotice(null)}>Dismiss</button>
        </aside>
      ) : null}
      {periodRefreshing ? (
        <p className={styles["mp-empty"]} role="status">
          Updating activity for {period.label}…
        </p>
      ) : rows.length ? (
        <ul className={styles["mp-transaction-list"]}>
          {rows.map((transaction) => (
            <li key={transaction.id}>
              <button
                type="button"
                className={styles["mp-transaction-trigger"]}
                aria-label={`Understand ${transaction.name}, ${money(Math.abs(transaction.amount), transaction.currency)}, ${transaction.date}`}
                onClick={(event) =>
                  window.dispatchEvent(
                    new CustomEvent("covarify:understand-transaction", {
                      detail: {
                        transaction,
                        trigger: event.currentTarget,
                      },
                    }),
                  )
                }
              >
              <div>
                <strong>{transaction.name}</strong>
                <span>
                  {displaySeparated(
                    new Intl.DateTimeFormat("en-US", {
                      dateStyle: "medium",
                      timeZone: "UTC",
                    }).format(new Date(`${transaction.date}T00:00:00Z`)),
                    formatTransactionCategoryPath(transaction),
                    transaction.pending ? "Pending" : null,
                  )}
                </span>
                <span>{transaction.accountLabel}</span>
              </div>
              <TransactionAmount transaction={transaction} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles["mp-empty"]}>
          {sectionFiltered
            ? "No matching transactions"
            : `No transactions in ${period.label}`}
        </p>
      )}
      {rows.length ? <FilteredSummary summary={summary} /> : null}
      {error ? (
        <p className={styles["mp-error"]} role="alert">
          Activity could not load. Your connection is unchanged. Please try
          again.
        </p>
      ) : null}
      <div className={styles["mp-load"]}>
        <button
          type="button"
          disabled={loading || !cursor}
          onClick={() => void request(cursor)}
        >
          {loading
            ? "Loading activity…"
            : cursor
              ? "View more activity"
              : "All transactions shown"}
        </button>
      </div>
    </section>
  );
}
