"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import type { MoneyTransaction } from "@/lib/money-picture";
import {
  applySavedClassificationToTransaction,
  type SavedTransactionClassification,
  type TransactionUnderstandingCompletedDetail,
  type TransactionIntent,
} from "@/lib/transaction-understanding";
import styles from "./transaction-understanding.module.css";

type Candidate = Pick<MoneyTransaction, "id" | "name" | "amount" | "currency" | "date" | "pending" | "accountLabel"> & {
  sourceCategory: string;
};
type Result =
  | { kind: "clear"; message: string; transaction: Candidate; proposedCategory: string | null; parentCategory: { id: string; displayName: string }; requestedSubcategory: string | null; suggestions: Array<{ id: string; displayName: string; match: "exact" | "alias" }>; parentSubcategories: Array<{ id: string; displayName: string }>; intent: TransactionIntent; sourceSignature: string }
  | { kind: "ambiguous"; message: string; candidates: Candidate[]; intent: TransactionIntent }
  | { kind: "no_match"; message: string }
  | {
      kind: "confirmed";
      message: string;
      savedClassification: SavedTransactionClassification | null;
      merchantMemory: { scope: "transaction_only" | "future" | "past_and_future"; saved: boolean };
    };

const money = (amount: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Math.abs(amount));
const categoryLabel = (value: string) => value === "FOOD_AND_DRINK"
  ? "Food & Drink"
  : value.toLowerCase().split("_").map((word) => `${word[0]?.toUpperCase() || ""}${word.slice(1)}`).join(" ");

export function TransactionUnderstanding() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [selected, setSelected] = useState<MoneyTransaction | null>(null);
  const [busy, setBusy] = useState(false);
  const [ruleScope, setRuleScope] = useState<"transaction_only" | "future" | "past_and_future">("transaction_only");
  const [showAllSubcategories, setShowAllSubcategories] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const panel = useRef<HTMLElement>(null);
  const resultRegion = useRef<HTMLDivElement>(null);
  const suggestionRegion = useRef<HTMLDivElement>(null);
  const completionTimer = useRef<number | null>(null);

  useEffect(() => {
    const open = (event: Event) => {
      const detail = (event as CustomEvent<{ transaction?: MoneyTransaction; trigger?: HTMLElement }>).detail;
      trigger.current = detail.trigger || null;
      setSelected(detail.transaction || null);
      setResult(null);
      setText("");
      setRuleScope("transaction_only");
      setShowAllSubcategories(false);
      window.setTimeout(() => input.current?.focus(), 0);
    };
    window.addEventListener("covarify:understand-transaction", open);
    return () => {
      window.removeEventListener("covarify:understand-transaction", open);
      if (completionTimer.current) window.clearTimeout(completionTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!result || result.kind === "confirmed") return;
    const region = result.kind === "clear" ? suggestionRegion.current || resultRegion.current : resultRegion.current;
    const scrollContainer = panel.current;
    if (!region || !scrollContainer) return;
    region.focus({ preventScroll: true });
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const panelTop = scrollContainer.getBoundingClientRect().top;
    const regionTop = region.getBoundingClientRect().top;
    scrollContainer.scrollTo({
      top: Math.max(0, scrollContainer.scrollTop + regionTop - panelTop - 20),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [result]);

  async function interpret(selectedTransactionId?: string) {
    const statement = text.trim();
    if (!statement) return;
    setBusy(true);
    try {
      const response = await fetch("/api/account/transaction-understanding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operation: "interpret",
          text: statement,
          modality: selectedTransactionId || selected ? "selected_transaction" : "typed",
          selectedTransactionId: selectedTransactionId || selected?.id || null,
        }),
      });
      if (!response.ok) throw new Error();
      setResult(await response.json());
    } catch {
      setResult({ kind: "no_match", message: "Covarify couldn’t safely interpret that request. No transaction was changed." });
    } finally {
      setBusy(false);
    }
  }

  async function confirm(subcategoryDecision?: {
    action: "use_existing" | "create_new";
    subcategoryId?: string;
    displayName?: string;
    reviewedSuggestionIds?: string[];
  }) {
    if (!result || result.kind !== "clear") return;
    setBusy(true);
    try {
      const response = await fetch("/api/account/transaction-understanding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operation: result.intent.action === "remove_label" ? "undo" : "confirm",
          confirmationId: crypto.randomUUID(),
          transactionId: result.transaction.id,
          intent: result.intent,
          sourceSignature: result.sourceSignature,
          subcategoryDecision: subcategoryDecision ? { ...subcategoryDecision, ruleScope } : undefined,
        }),
      });
      if (!response.ok) throw new Error();
      const confirmed = await response.json() as Result;
      if (confirmed.kind !== "confirmed") throw new Error();
      const savedClassification = confirmed.savedClassification;
      if (savedClassification) {
        setSelected((current) => current
          ? applySavedClassificationToTransaction(current, savedClassification)
          : current);
        const detail: TransactionUnderstandingCompletedDetail = {
          transactionName: result.transaction.name,
          savedClassification,
          undoRequest: {
            transactionId: result.transaction.id,
            intent: result.intent,
            sourceSignature: result.sourceSignature,
          },
        };
        window.dispatchEvent(new CustomEvent("covarify:transaction-understanding-confirmed", { detail }));
        completionTimer.current = window.setTimeout(close, 900);
      }
      setResult(confirmed);
      router.refresh();
    } catch {
      setResult({ kind: "no_match", message: "Nothing was saved. Refresh and try again." });
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (completionTimer.current) {
      window.clearTimeout(completionTimer.current);
      completionTimer.current = null;
    }
    setSelected(null);
    setResult(null);
    setText("");
    setRuleScope("transaction_only");
    setShowAllSubcategories(false);
    window.setTimeout(() => {
      if (trigger.current?.isConnected) trigger.current.focus();
    }, 0);
  }

  const body = result?.kind === "confirmed" && result.savedClassification ? (
    <div className={styles.completion} role="status" aria-live="polite">
      <strong>Updated</strong>
      <p>{result.savedClassification.effectiveParentCategory} → {result.savedClassification.effectiveSubcategory}</p>
      <span>This transaction has been updated.</span>
    </div>
  ) : (
    <>
      <label>
        What would you like Covarify to understand?
        <textarea
          ref={input}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={selected ? `Tell Covarify what this ${selected.name} transaction meant.` : "That Walmart charge for $148.72 was groceries."}
        />
      </label>
      {selected ? (
        <div className={styles.quick}>
          {["Groceries", "Business expense", "Personal care", "Receipt needed for taxes", ...(selected?.userConfirmedMeaning ? ["Undo classification"] : [])].map((label) => (
            <button key={label} type="button" onClick={() => setText(label === "Receipt needed for taxes" ? "Add a note that I need the receipt for taxes." : label === "Undo classification" ? "Remove my classification." : `That was ${label.toLowerCase()}.`)}>
              {label}
            </button>
          ))}
        </div>
      ) : null}
      <button className={styles.primary} type="button" disabled={busy || !text.trim()} onClick={() => void interpret()}>
        {busy ? "Checking…" : "Interpret safely"}
      </button>
      {result ? (
        <div ref={resultRegion} className={styles.response} role="status" tabIndex={-1}>
          <strong>Covarify</strong>
          <p>{result.message}</p>
          {result.kind === "ambiguous" ? (
            <div className={styles.candidates}>
              {result.candidates.map((candidate) => (
                <button key={candidate.id} type="button" onClick={() => void interpret(candidate.id)}>
                  <strong>{candidate.name}</strong>
                  <span>{money(candidate.amount, candidate.currency)} · {candidate.date} · {candidate.accountLabel}</span>
                </button>
              ))}
            </div>
          ) : null}
          {result.kind === "clear" ? (
            <div className={styles.confirmation}>
              {result.requestedSubcategory ? <div className={styles.hierarchy}>
                <div><span>Main category</span><strong>{result.parentCategory.displayName}</strong></div>
                <div><span>User request</span><strong>{result.requestedSubcategory}</strong></div>
              </div> : null}
              <dl>
                <div><dt>Merchant</dt><dd>{result.transaction.name}</dd></div>
                <div><dt>Amount</dt><dd>{money(result.transaction.amount, result.transaction.currency)}</dd></div>
                <div><dt>Date</dt><dd>{result.transaction.date}</dd></div>
                <div><dt>Account</dt><dd>{result.transaction.accountLabel}</dd></div>
                <div><dt>Source category</dt><dd>{result.parentCategory.displayName}</dd></div>
                <div><dt>Requested detail</dt><dd>{result.requestedSubcategory || "No subcategory requested"}</dd></div>
              </dl>
              {result.requestedSubcategory ? <div ref={suggestionRegion} className={styles.suggestionResult} tabIndex={-1}>
                {result.suggestions.length ? <section className={styles.matches}>
                  <strong>You may already have a category for this.</strong>
                  {result.suggestions.map((suggestion) => <article key={suggestion.id}><span>Possible match</span><h3>{suggestion.displayName}</h3><p>Under {result.parentCategory.displayName}</p><button className={styles.primary} type="button" disabled={busy} onClick={() => void confirm({ action: "use_existing", subcategoryId: suggestion.id })}>Use {suggestion.displayName}</button></article>)}
                </section> : <p className={styles.noMatch}>No similar existing subcategory was found under {result.parentCategory.displayName}.</p>}
                <fieldset className={styles.ruleScope}>
                  <legend>Should Covarify remember this for {result.transaction.name}?</legend>
                  <label><input type="radio" name="rule-scope" checked={ruleScope === "transaction_only"} onChange={() => setRuleScope("transaction_only")} /> This transaction only</label>
                  <label><input type="radio" name="rule-scope" checked={ruleScope === "future"} onChange={() => setRuleScope("future")} /> Future purchases from {result.transaction.name}</label>
                  <label><input type="radio" name="rule-scope" checked={ruleScope === "past_and_future"} onChange={() => setRuleScope("past_and_future")} /> Past and future purchases from {result.transaction.name}</label>
                </fieldset>
                <div className={styles.choiceActions}>
                  {result.suggestions.every((suggestion) => suggestion.match !== "exact") ? <button type="button" disabled={busy} onClick={() => void confirm({ action: "create_new", displayName: result.requestedSubcategory || "", reviewedSuggestionIds: result.suggestions.map((suggestion) => suggestion.id) })}>Create {result.requestedSubcategory} instead</button> : null}
                  <button type="button" onClick={() => setShowAllSubcategories((value) => !value)}>{showAllSubcategories ? "Hide subcategories" : `View all ${result.parentCategory.displayName} subcategories`}</button>
                </div>
                {showAllSubcategories ? <div className={styles.allSubcategories}>{result.parentSubcategories.map((subcategory) => <button key={subcategory.id} type="button" disabled={busy} onClick={() => void confirm({ action: "use_existing", subcategoryId: subcategory.id })}>{subcategory.displayName}</button>)}</div> : null}
              </div> : null}
              <div>
                {!result.requestedSubcategory ? <button className={styles.primary} type="button" disabled={busy} onClick={() => void confirm()}>Confirm</button> : null}
                <button type="button" onClick={() => setResult(null)}>Change</button>
                <button type="button" onClick={close}>Cancel</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );

  return (
    <>
      <section id="talk-to-covarify" className={styles.entry} aria-labelledby="transaction-understanding-heading">
        <span><MessageCircle size={20} /></span>
        <div>
          <small>Talk to Covarify</small>
          <h2 id="transaction-understanding-heading">Teach Covarify what a transaction meant.</h2>
          <p>Source bank data stays unchanged. Covarify asks before saving your meaning.</p>
          {selected ? null : body}
        </div>
      </section>
      {selected ? (
        <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
          <section ref={panel} className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="transaction-detail-title">
            <header>
              <div><small>Transaction detail</small><h2 id="transaction-detail-title">{selected.name}</h2></div>
              <button type="button" aria-label="Close transaction detail" onClick={close}><X size={20} /></button>
            </header>
            <dl className={styles.detail}>
              <div><dt>Amount</dt><dd>{money(selected.amount, selected.currency)}</dd></div>
              <div><dt>Date</dt><dd>{selected.date}</dd></div>
              <div><dt>Account</dt><dd>{selected.accountLabel}</dd></div>
              <div><dt>Source</dt><dd>{categoryLabel(selected.sourceCategory || selected.category)}</dd></div>
              <div><dt>Main category</dt><dd>{selected.effectiveParentCategory || selected.category}</dd></div>
              <div><dt>Subcategory</dt><dd>{selected.effectiveSubcategory || "None"}</dd></div>
              <div><dt>Your classification</dt><dd>{selected.effectiveSubcategory ? `${selected.effectiveParentCategory || selected.category} → ${selected.effectiveSubcategory}` : selected.userConfirmedMeaning?.category || "None"}</dd></div>
            </dl>
            {body}
          </section>
        </div>
      ) : null}
    </>
  );
}
