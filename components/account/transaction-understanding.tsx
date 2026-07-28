"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import type { MoneyTransaction } from "@/lib/money-picture";
import type { TransactionIntent } from "@/lib/transaction-understanding";
import styles from "./transaction-understanding.module.css";

type Candidate = Pick<MoneyTransaction, "id" | "name" | "amount" | "currency" | "date" | "pending" | "accountLabel"> & {
  sourceCategory: string;
};
type Result =
  | { kind: "clear"; message: string; transaction: Candidate; proposedCategory: string | null; intent: TransactionIntent; sourceSignature: string }
  | { kind: "ambiguous"; message: string; candidates: Candidate[]; intent: TransactionIntent }
  | { kind: "no_match"; message: string }
  | { kind: "confirmed"; message: string };

const money = (amount: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Math.abs(amount));

export function TransactionUnderstanding() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [selected, setSelected] = useState<MoneyTransaction | null>(null);
  const [busy, setBusy] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const open = (event: Event) => {
      const detail = (event as CustomEvent<{ transaction?: MoneyTransaction; trigger?: HTMLElement }>).detail;
      trigger.current = detail.trigger || null;
      setSelected(detail.transaction || null);
      setResult(null);
      setText("");
      window.setTimeout(() => input.current?.focus(), 0);
    };
    window.addEventListener("covarify:understand-transaction", open);
    return () => window.removeEventListener("covarify:understand-transaction", open);
  }, []);

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

  async function confirm() {
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
        }),
      });
      if (!response.ok) throw new Error();
      const confirmed = await response.json();
      setResult(confirmed);
      window.dispatchEvent(new Event("covarify:transaction-understanding-confirmed"));
      router.refresh();
    } catch {
      setResult({ kind: "no_match", message: "Nothing was saved. Refresh and try again." });
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setSelected(null);
    setResult(null);
    setText("");
    window.setTimeout(() => trigger.current?.focus(), 0);
  }

  const body = (
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
        <div className={styles.response} role="status">
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
              <dl>
                <div><dt>Merchant</dt><dd>{result.transaction.name}</dd></div>
                <div><dt>Amount</dt><dd>{money(result.transaction.amount, result.transaction.currency)}</dd></div>
                <div><dt>Date</dt><dd>{result.transaction.date}</dd></div>
                <div><dt>Account</dt><dd>{result.transaction.accountLabel}</dd></div>
                <div><dt>Source category</dt><dd>{result.transaction.sourceCategory}</dd></div>
                <div><dt>Proposed effective category</dt><dd>{result.proposedCategory || result.transaction.sourceCategory}</dd></div>
              </dl>
              <div>
                <button className={styles.primary} type="button" disabled={busy} onClick={() => void confirm()}>Confirm</button>
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
          <section className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="transaction-detail-title">
            <header>
              <div><small>Transaction detail</small><h2 id="transaction-detail-title">{selected.name}</h2></div>
              <button type="button" aria-label="Close transaction detail" onClick={close}><X size={20} /></button>
            </header>
            <dl className={styles.detail}>
              <div><dt>Amount</dt><dd>{money(selected.amount, selected.currency)}</dd></div>
              <div><dt>Date</dt><dd>{selected.date}</dd></div>
              <div><dt>Account</dt><dd>{selected.accountLabel}</dd></div>
              <div><dt>Source category</dt><dd>{selected.sourceCategory || selected.category}</dd></div>
              <div><dt>Effective category</dt><dd>{selected.category}</dd></div>
              <div><dt>User-confirmed meaning</dt><dd>{selected.userConfirmedMeaning?.category || "None"}</dd></div>
            </dl>
            {body}
          </section>
        </div>
      ) : null}
    </>
  );
}
