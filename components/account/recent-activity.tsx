"use client";

import { useState } from "react";
import type { FilteredTransactionSummary, MoneyTransaction, TransactionFilters } from "@/lib/money-picture";
import styles from "./money-picture.module.css";

const money = (amount: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
const countLabel = (summary: FilteredTransactionSummary) => {
  const noun = summary.kind === "inflow" ? "income transaction" : summary.kind === "spending" ? "spending transaction" : summary.kind === "transfer" ? "transfer" : summary.kind === "refund" ? "refund" : "transaction";
  return `${summary.count} ${noun}${summary.count === 1 ? "" : "s"}`;
};
const amountLabel = (summary: FilteredTransactionSummary) => summary.kind === "inflow" ? "Total identified inflow" : summary.kind === "spending" ? "Total identified spending" : summary.kind === "transfer" ? "Total transferred" : summary.kind === "refund" ? "Total refunds" : "Net transaction amount";

function FilteredSummary({ summary }: { summary: FilteredTransactionSummary }) {
  return <aside className={styles["mp-filtered-summary"]} aria-label="Filtered summary">
    <p>Filtered summary</p>
    <div><span>{countLabel(summary)}</span><span>{amountLabel(summary)}: <strong>{money(summary.aggregateAmount, summary.currency)}</strong></span></div>
    {summary.kind === "mixed" ? <dl><div><dt>Identified inflows</dt><dd>{money(summary.identifiedInflows, summary.currency)}</dd></div><div><dt>Identified outflows</dt><dd>{money(summary.identifiedOutflows, summary.currency)}</dd></div></dl> : null}
  </aside>;
}

export function RecentActivity({ initial, initialSummary, total, accounts, categories, initialCursor }: { initial: MoneyTransaction[]; initialSummary: FilteredTransactionSummary; total: number; accounts: Array<{ id: string; name: string }>; categories: string[]; initialCursor: string | null }) {
  const [rows, setRows] = useState(initial);
  const [count, setCount] = useState(total);
  const [summary, setSummary] = useState(initialSummary);
  const [cursor, setCursor] = useState(initialCursor);
  const [filters, setFilters] = useState<TransactionFilters>({ dateRange: "all" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  async function request(nextCursor: string | null, nextFilters = filters, replace = false) {
    if (loading) return;
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/account/transactions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ cursor: nextCursor, filters: nextFilters }) });
      if (!response.ok) throw new Error("request failed");
      const payload = await response.json();
      setRows((current) => replace ? payload.transactions : [...new Map([...current, ...payload.transactions].map((row) => [row.id, row])).values()]);
      setCount(payload.total);
      setSummary(payload.summary);
      setCursor(payload.cursor);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  function change(patch: Partial<TransactionFilters>) { const next = { ...filters, ...patch }; setFilters(next); void request(null, next, true); }
  return <section className={styles["mp-section"]} aria-labelledby="recent-activity-heading">
    <div className={styles["mp-heading"]}><div><p>Recent activity</p><h2 id="recent-activity-heading">Your latest transactions</h2></div><span>Showing {rows.length} of {count} transactions</span></div>
    <div className={styles["mp-filters"]}><label>Account<select value={filters.accountId || ""} onChange={(event) => change({ accountId: event.target.value || undefined })}><option value="">All accounts</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label>Date range<select value={filters.dateRange} onChange={(event) => change({ dateRange: event.target.value as TransactionFilters["dateRange"] })}><option value="all">All dates</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label><label>Category<select value={filters.category || ""} onChange={(event) => change({ category: event.target.value || undefined })}><option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label>Search<input type="search" value={filters.search || ""} placeholder="Merchant or description" onChange={(event) => setFilters({ ...filters, search: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") void request(null, { ...filters, search: event.currentTarget.value }, true); }} /></label></div>
    {rows.length ? <ul className={styles["mp-transaction-list"]}>{rows.map((transaction) => <li key={transaction.id}><div><strong>{transaction.name}</strong><span>{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${transaction.date}T00:00:00Z`))} · {transaction.category}{transaction.pending ? " · Pending" : ""}</span><span>{transaction.accountLabel}</span></div><strong>{money(transaction.amount, transaction.currency)}</strong></li>)}</ul> : <p className={styles["mp-empty"]}>No transactions match these filters</p>}
    {rows.length ? <FilteredSummary summary={summary} /> : null}
    {error ? <p className={styles["mp-error"]} role="alert">Activity could not load. Your connection is unchanged. Please try again.</p> : null}
    <div className={styles["mp-load"]}><button type="button" disabled={loading || !cursor} onClick={() => void request(cursor)}>{loading ? "Loading activity…" : cursor ? "Load more" : "All transactions shown"}</button></div>
  </section>;
}
