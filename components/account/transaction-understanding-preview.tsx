"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, ChevronRight, MessageCircle, RotateCcw, ShieldCheck, Sparkles, X } from "lucide-react";
import {
  buildConfirmedUnderstandingRecord,
  effectiveTransactionState,
  parseTransactionIntent,
  resolveTransactionIntent,
  type TransactionIntent,
  type TransactionUnderstandingRecord,
} from "@/lib/transaction-understanding";
import type { MoneyTransaction } from "@/lib/money-picture";
import styles from "./transaction-understanding-preview.module.css";

const fixtures: MoneyTransaction[] = [
  { id: "walmart-148", plaidAccountId: "checking", accountLabel: "TD Beyond Checking • 9214", name: "Walmart", amount: 148.72, currency: "USD", date: "2026-07-24", pending: false, pendingTransactionId: null, category: "GENERAL_MERCHANDISE", detailedCategory: "GENERAL_MERCHANDISE_SUPERSTORES", direction: "outflow", transferRelationship: null },
  { id: "walmart-74", plaidAccountId: "checking", accountLabel: "TD Beyond Checking • 9214", name: "Walmart Supercenter", amount: 74.18, currency: "USD", date: "2026-07-22", pending: false, pendingTransactionId: null, category: "GENERAL_MERCHANDISE", detailedCategory: "GENERAL_MERCHANDISE_SUPERSTORES", direction: "outflow", transferRelationship: null },
  { id: "cvs-41", plaidAccountId: "checking", accountLabel: "TD Beyond Checking • 9214", name: "CVS Pharmacy", amount: 41.26, currency: "USD", date: "2026-07-27", pending: false, pendingTransactionId: null, category: "GENERAL_MERCHANDISE", detailedCategory: "GENERAL_MERCHANDISE_PHARMACIES", direction: "outflow", transferRelationship: null },
  { id: "home-200", plaidAccountId: "checking", accountLabel: "TD Beyond Checking • 9214", name: "Home Depot", amount: 200, currency: "USD", date: "2026-07-20", pending: false, pendingTransactionId: null, category: "HOME_IMPROVEMENT", detailedCategory: "HOME_IMPROVEMENT_HARDWARE", direction: "outflow", transferRelationship: null },
  { id: "venmo-75", plaidAccountId: "checking", accountLabel: "TD Beyond Checking • 9214", name: "Venmo", amount: -75, currency: "USD", date: "2026-07-19", pending: false, pendingTransactionId: null, category: "TRANSFER_IN", detailedCategory: "TRANSFER_IN_ACCOUNT_TRANSFER", direction: "inflow", transferRelationship: "external" },
];

const examples = [
  ["Clear match", "That Walmart charge for $148.72 was groceries."],
  ["Ambiguous", "That Walmart charge was groceries."],
  ["No match", "That Walmart charge for $999.00 was groceries."],
  ["Split", "Split the $200 at Home Depot equally between business and personal."],
  ["Context + note", "The $41.26 at CVS was personal care for my child. Add a note that I need the receipt for taxes."],
] as const;

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Math.abs(value));
const friendlyDate = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));

export function TransactionUnderstandingPreview() {
  const [text, setText] = useState<string>(examples[0][1]);
  const [intent, setIntent] = useState<TransactionIntent | null>(null);
  const [resolution, setResolution] = useState<ReturnType<typeof resolveTransactionIntent> | null>(null);
  const [selected, setSelected] = useState<MoneyTransaction | null>(null);
  const [history, setHistory] = useState<TransactionUnderstandingRecord[]>([]);
  const [message, setMessage] = useState("Tell Covarify what a transaction meant.");
  const [filter, setFilter] = useState("All");

  const walmart = fixtures[0];
  const effective = effectiveTransactionState(walmart, null, history);
  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const transaction of fixtures.filter((row) => row.amount > 0)) {
      const category = transaction.id === walmart.id ? effective.effectiveCategory : transaction.category;
      totals.set(category, (totals.get(category) || 0) + transaction.amount);
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [effective.effectiveCategory, walmart.id]);

  function interpret(nextText: string = text, selectedTransactionId?: string) {
    const parsed = parseTransactionIntent(nextText, {
      modality: selectedTransactionId ? "selected_transaction" : "typed",
      selectedTransactionId,
      now: new Date("2026-07-28T12:00:00Z"),
    });
    const matched = resolveTransactionIntent(parsed, fixtures);
    setIntent(parsed);
    setResolution(matched);
    if (matched.kind === "clear") {
      setSelected(matched.candidate.transaction);
      setMessage(`I found the ${matched.candidate.transaction.name} transaction for ${money(matched.candidate.transaction.amount)} on ${friendlyDate(matched.candidate.transaction.date)}. Treat it as ${parsed.category || "the requested meaning"}?`);
    } else if (matched.kind === "ambiguous") {
      setSelected(null);
      setMessage(`I found ${matched.candidates.length} transactions that could match. Which one did you mean?`);
    } else {
      setSelected(null);
      setMessage("I couldn’t find that transaction in your connected activity. Try adding the date or account.");
    }
  }

  function chooseCandidate(transaction: MoneyTransaction) {
    setSelected(transaction);
    setMessage(`Use ${transaction.name} • ${money(transaction.amount)} • ${friendlyDate(transaction.date)}?`);
  }

  function confirm() {
    if (!intent || !selected) return;
    const priorState = effectiveTransactionState(selected, null, history);
    const active = history.find((record) => record.id === priorState.activeRecordId);
    const record = buildConfirmedUnderstandingRecord({
      id: `preview-${history.length + 1}`,
      userId: "founder-preview",
      confirmedBy: "founder-preview",
      transaction: selected,
      intent: { ...intent, selectedTransactionId: selected.id },
      priorState,
      supersedesRecordId: active?.id || null,
      confirmedAt: new Date(Date.UTC(2026, 6, 28, 16, history.length)).toISOString(),
      matchConfidence: "high",
    });
    setHistory((current) => [...current, record]);
    setMessage(`Got it. Covarify will treat that ${selected.name} purchase as ${intent.category || "confirmed context"} while preserving the original bank category.`);
    setResolution(null);
  }

  function undo() {
    const priorState = effectiveTransactionState(walmart, null, history);
    if (!priorState.activeRecordId) return;
    const undoIntent = parseTransactionIntent("Remove my label.", { modality: "typed", selectedTransactionId: walmart.id });
    const record = buildConfirmedUnderstandingRecord({
      id: `preview-${history.length + 1}`,
      userId: "founder-preview",
      confirmedBy: "founder-preview",
      transaction: walmart,
      intent: undoIntent,
      priorState,
      supersedesRecordId: priorState.activeRecordId,
      confirmedAt: new Date(Date.UTC(2026, 6, 28, 17, history.length)).toISOString(),
      matchConfidence: "high",
    });
    setHistory((current) => [...current, record]);
    setMessage("Reverted. Covarify is using the prior classification again.");
  }

  function openDetail(transaction: MoneyTransaction) {
    setSelected(transaction);
    setIntent(null);
    setResolution(null);
  }

  return <main className={styles.page}>
    <header className={styles.topbar}>
      <Link href="/account">covarify</Link>
      <span><ShieldCheck size={16} /> Founder-only preview • no production writes</span>
    </header>
    <div className={styles.shell}>
      <section className={styles.intro}>
        <p><Sparkles size={14} /> Transaction Understanding v1</p>
        <h1>Teach Covarify through conversation.</h1>
        <div>Ordinary language becomes a constrained intent, a deterministic match, and a confirmation—never a direct mutation.</div>
      </section>

      <section className={styles.previewGrid}>
        <div className={styles.conversation}>
          <header><MessageCircle size={18} /><div><strong>Talk to Covarify</strong><small>Typed, spoken, or selected-transaction context</small></div></header>
          <div className={styles.examples}>{examples.map(([label, example]) => <button key={label} onClick={() => { setText(example); interpret(example); }}>{label}</button>)}</div>
          <label>What would you like Covarify to understand?<textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} /></label>
          <button className={styles.primary} onClick={() => interpret()}>Interpret safely</button>
          <div className={styles.response} role="status"><span>Covarify</span><p>{message}</p></div>
          {resolution?.kind === "ambiguous" ? <div className={styles.candidates}>{resolution.candidates.map(({ transaction }) => <button key={transaction.id} onClick={() => chooseCandidate(transaction)}><strong>{transaction.name}</strong><span>{friendlyDate(transaction.date)} • {money(transaction.amount)}</span><small>{transaction.accountLabel} • {transaction.pending ? "Pending" : "Posted"}</small></button>)}</div> : null}
          {resolution?.kind === "no_match" ? <div className={styles.noMatch}><button>Expand date range</button><button>Search another account</button><button>Review similar transactions</button></div> : null}
          {selected && intent ? <section className={styles.confirmation}>
            <p>Confirm intended update</p><h2>{selected.name} • {money(selected.amount)} • {friendlyDate(selected.date)}</h2>
            <dl><div><dt>Source category</dt><dd>{selected.category}</dd></div><div><dt>Covarify will treat this as</dt><dd>{intent.category || "Context only"}</dd></div></dl>
            {intent.split ? <ul>{intent.split.map((part) => <li key={part.treatment}><strong>{part.treatment}</strong><span>{part.percentage}% • {money(selected.amount * part.percentage / 100)}</span></li>)}</ul> : null}
            {intent.contextLabel || intent.note ? <p>{[intent.contextLabel, intent.note].filter(Boolean).join(" • ")}</p> : null}
            <div><button className={styles.primary} onClick={confirm}><Check size={14} /> Confirm</button><button onClick={() => setMessage("Tell me what to change.")}>Change</button><button onClick={() => { setSelected(null); setResolution(null); setMessage("Cancelled. Nothing was saved."); }}><X size={14} /> Cancel</button></div>
          </section> : null}
        </div>

        <aside className={styles.audit}>
          <p>Deterministic safety</p>
          <h2>Source truth stays separate.</h2>
          <dl><div><dt>Source category</dt><dd>{walmart.category}</dd></div><div><dt>Effective category</dt><dd>{effective.effectiveCategory}</dd></div><div><dt>Category source</dt><dd>{effective.categorySource.replace("_", " ")}</dd></div><div><dt>Append-only records</dt><dd>{history.length}</dd></div></dl>
          <div className={styles.auditChecks}><span><Check /> Confirmation required</span><span><Check /> Source fields unchanged</span><span><Check /> Exact founder allowlist</span><span><Check /> No Plaid calls</span></div>
          <button disabled={!effective.activeRecordId} onClick={undo}><RotateCcw size={14} /> Undo with supersession</button>
        </aside>
      </section>

      <section className={styles.detailSection}>
        <div className={styles.sectionHeading}><div><p>Secondary path</p><h2>Transaction detail uses the same intent pipeline.</h2></div><span>Click or press Enter on a row</span></div>
        <div className={styles.rows}>{fixtures.slice(0, 3).map((transaction) => <button key={transaction.id} onClick={() => openDetail(transaction)}><div><strong>{transaction.name}</strong><span>{friendlyDate(transaction.date)} • {transaction.category}</span><small>{transaction.accountLabel}</small></div><b>{money(transaction.amount)}</b><ChevronRight /></button>)}</div>
        {selected && !intent ? <div className={styles.drawer} role="dialog" aria-modal="false" aria-labelledby="detail-title"><button aria-label="Close transaction detail" onClick={() => setSelected(null)}><X /></button><p>Transaction detail</p><h2 id="detail-title">{selected.name}</h2><dl><div><dt>Amount</dt><dd>{money(selected.amount)}</dd></div><div><dt>Date</dt><dd>{friendlyDate(selected.date)}</dd></div><div><dt>Source category</dt><dd>{selected.category}</dd></div><div><dt>Effective category</dt><dd>{effectiveTransactionState(selected, null, history).effectiveCategory}</dd></div></dl><div className={styles.quickActions}><button onClick={() => { const next = "That was groceries."; setText(next); interpret(next, selected.id); }}>Groceries</button><button onClick={() => { const next = "That was for my business."; setText(next); interpret(next, selected.id); }}>Business</button><button onClick={() => { const next = "Add a note that I need the receipt for taxes."; setText(next); interpret(next, selected.id); }}>Receipt note</button></div></div> : null}
      </section>

      <section className={styles.impact}>
        <div className={styles.sectionHeading}><div><p>Downstream preview</p><h2>Effective meaning updates the picture.</h2></div><span>Fixture-only recalculation</span></div>
        <div className={styles.impactGrid}>
          <article><h3>Category filter</h3><div className={styles.filterButtons}>{["All", "Groceries", "General Merchandise"].map((item) => <button aria-pressed={filter === item} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div><strong>{filter === "All" ? fixtures.length : fixtures.filter((row) => (row.id === walmart.id ? effective.effectiveCategory : row.category).toLowerCase().includes(filter.toLowerCase().replace("general merchandise", "general_merchandise"))).length} matching transactions</strong></article>
          <article><h3>Category Intelligence</h3>{categoryTotals.slice(0, 3).map(([category, amount]) => <div className={styles.bar} key={category}><span>{category}</span><i><b style={{ width: `${Math.min(100, amount / categoryTotals[0][1] * 100)}%` }} /></i><strong>{money(amount)}</strong></div>)}</article>
          <article><h3>Financial Event provenance</h3><p>Source evidence retains the original transaction ID, amount, date, account, and Plaid category. User context is consumed only during the next deterministic evaluation.</p></article>
        </div>
      </section>
    </div>
  </main>;
}
