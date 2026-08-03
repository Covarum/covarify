"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import {
  formatCategoryLabel,
  formatCategoryPath,
  type MoneyTransaction,
} from "@/lib/money-picture";
import {
  applySavedClassificationToTransaction,
  type SavedTransactionClassification,
  transactionCategoryView,
  type TransactionUnderstandingCompletedDetail,
  type TransactionIntent,
} from "@/lib/transaction-understanding";
import {
  accountCostDisplayLabel,
} from "@/lib/account-cost-classification";
import styles from "./transaction-understanding.module.css";
import type { ResolvedFinancialPeriod } from "@/lib/financial-periods";

type Candidate = Pick<MoneyTransaction, "id" | "name" | "amount" | "currency" | "date" | "pending" | "accountLabel"> & {
  sourceCategory: string;
};
type Result =
  | { kind: "clear"; message: string; transaction: Candidate; proposedCategory: string | null; parentCategory: { id: string; displayName: string }; sourceParentCategory: { id: string; displayName: string }; categoryOptions: Array<{ id: string; displayName: string; subcategories: Array<{ id: string; displayName: string }> }>; requestedSubcategory: string | null; suggestions: Array<{ id: string; displayName: string; match: "exact" | "alias" }>; parentSubcategories: Array<{ id: string; displayName: string }>; intent: TransactionIntent; sourceSignature: string }
  | { kind: "ambiguous"; message: string; candidates: Candidate[]; intent: TransactionIntent }
  | { kind: "no_match"; message: string }
  | { kind: "history_query"; message: string; merchant: string; transactionIds: string[]; periodStart: string | null; periodEnd: string | null; accounts: Array<{ label: string; count: number }> }
  | { kind: "intent_clarification"; message: string; merchant: string | null; requestedSubcategory: string | null; originalText: string; intent: TransactionIntent }
  | {
      kind: "merchant_rule";
      message: string;
      merchant: string;
      requestedSubcategory: string;
      parentCategory: { id: string; displayName: string };
      suggestions: Array<{ id: string; displayName: string; match: "exact" | "alias" }>;
      parentSubcategories: Array<{ id: string; displayName: string }>;
      breadth: "broad" | "narrow" | "unknown";
      activity: { count: number; firstDate: string | null; lastDate: string | null; categoryMix: string[] };
      existingRule: { kind: "identical" | "conflict" | "archived"; id: string; category: string } | null;
      intent: TransactionIntent;
    }
  | { kind: "merchant_rule_confirmed"; message: string; categoryPath?: string; merchantMemory: { scope: "transaction_only" | "future" | "past_and_future"; saved: boolean } }
  | {
      kind: "confirmed";
      message: string;
      savedClassification: SavedTransactionClassification | null;
      merchantMemory: { scope: "transaction_only" | "future" | "past_and_future"; saved: boolean };
      obligationPrompt: { type: "rent" | "mortgage"; transactionId: string; payee: string; actualPaymentAmount: number } | null;
    }
  | { kind: "obligation_saved"; obligationVersionId: string; message: string }
  | { kind: "obligation_unlinked"; message: string };

const money = (amount: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Math.abs(amount));
export function TransactionUnderstanding({ period }: { period: ResolvedFinancialPeriod }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [selected, setSelected] = useState<MoneyTransaction | null>(null);
  const [busy, setBusy] = useState(false);
  const [ruleScope, setRuleScope] = useState<"transaction_only" | "future" | "past_and_future">("transaction_only");
  const [showAllSubcategories, setShowAllSubcategories] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState("");
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState("");
  const [obligationRelationship, setObligationRelationship] = useState<"yes" | "no" | "unsure" | null>(null);
  const [expectedAmount, setExpectedAmount] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [paymentType, setPaymentType] = useState<"full" | "partial" | "catch_up" | "late" | "extra" | "unsure">("unsure");
  const [ongoingStatus, setOngoingStatus] = useState<"ongoing" | "ended" | "unsure">("unsure");
  const [remainingDue, setRemainingDue] = useState("");
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
      setSelectedParentId("");
      setSelectedSubcategoryId("");
      setObligationRelationship(null);
      setExpectedAmount("");
      setDueDay("");
      setPaymentType("unsure");
      setOngoingStatus("unsure");
      setRemainingDue("");
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

  async function interpret(selectedTransactionId?: string, statementOverride?: string) {
    const statement = (statementOverride || text).trim();
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
          activePeriod: period,
        }),
      });
      if (!response.ok) throw new Error();
      const payload = await response.json() as Result;
      if (payload.kind === "clear") {
        setSelectedParentId(payload.parentCategory.id);
        setSelectedSubcategoryId(payload.suggestions[0]?.id || "");
      }
      setResult(payload);
    } catch {
      setResult({ kind: "no_match", message: "Covarify couldn’t understand that request clearly. No transaction was changed." });
    } finally {
      setBusy(false);
    }
  }

  async function confirm(subcategoryDecision?: {
    action: "use_existing" | "create_new";
    parentCategoryId?: string;
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
          priorCategoryView: selected
            ? transactionCategoryView(selected)
            : {
                effectiveParentCategory: undefined,
                effectiveSubcategory: null,
                categorySource: "normalized_source",
                userConfirmedMeaning: null,
              },
          undoRequest: {
            transactionId: result.transaction.id,
            intent: result.intent,
            sourceSignature: result.sourceSignature,
          },
        };
        window.dispatchEvent(new CustomEvent("covarify:transaction-understanding-confirmed", { detail }));
        if (!confirmed.obligationPrompt) completionTimer.current = window.setTimeout(close, 900);
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

  async function saveHousingObligation(prompt: NonNullable<Extract<Result, { kind: "confirmed" }>["obligationPrompt"]>) {
    setBusy(true);
    try {
      const response = await fetch("/api/account/transaction-understanding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operation: "save_housing_obligation",
          obligation: {
            transactionId: prompt.transactionId,
            expectedAmount: expectedAmount ? Number(expectedAmount) : null,
            dueDay: dueDay ? Number(dueDay) : null,
            ongoingStatus,
            paymentType,
            remainingDue: remainingDue ? Number(remainingDue) : null,
          },
        }),
      });
      if (!response.ok) throw new Error();
      setResult(await response.json() as Result);
      router.refresh();
    } catch {
      setResult({ kind: "no_match", message: "The classification is saved, but the obligation details were not. You can safely try again." });
    } finally {
      setBusy(false);
    }
  }

  async function unlinkHousingObligation(transactionId: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/account/transaction-understanding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operation: "unlink_housing_obligation",
          obligationTransactionId: transactionId,
        }),
      });
      if (!response.ok) throw new Error();
      setSelected((current) => current ? { ...current, housingObligation: null } : current);
      setResult(await response.json() as Result);
      router.refresh();
    } catch {
      setResult({ kind: "no_match", message: "The obligation link was not changed. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  function editHousingObligation(transaction: MoneyTransaction) {
    const obligation = transaction.housingObligation;
    if (!obligation) return;
    setExpectedAmount(obligation.expectedAmount?.toString() || "");
    setDueDay(obligation.dueDay?.toString() || "");
    setPaymentType(obligation.paymentType);
    setOngoingStatus(obligation.ongoingStatus);
    setRemainingDue(obligation.remainingDue?.toString() || "");
    setObligationRelationship("yes");
    setResult({
      kind: "confirmed",
      message: "Update the obligation details while preserving the prior version.",
      savedClassification: {
        transactionId: transaction.id,
        sourceCategory: transaction.sourceCategory || transaction.category,
        effectiveParentCategory: transaction.effectiveParentCategory || "Housing",
        effectiveSubcategory: transaction.effectiveSubcategory || (obligation.type === "rent" ? "Rent" : "Mortgage"),
        assignmentSource: "user_transaction",
        merchantRuleId: null,
      },
      merchantMemory: { scope: "transaction_only", saved: false },
      obligationPrompt: {
        type: obligation.type,
        transactionId: transaction.id,
        payee: transaction.name,
        actualPaymentAmount: Math.abs(transaction.amount),
      },
    });
  }

  async function confirmMerchantRule(
    decision: {
      action: "use_existing" | "create_new";
      subcategoryId?: string;
      displayName?: string;
      reviewedSuggestionIds?: string[];
    },
  ) {
    if (!result || result.kind !== "merchant_rule") return;
    setBusy(true);
    try {
      const response = await fetch("/api/account/transaction-understanding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operation: "confirm_merchant_rule",
          intent: result.intent,
          subcategoryDecision: {
            ...decision,
            ruleScope,
            replaceExisting: result.existingRule?.kind === "conflict",
            reactivateArchived: result.existingRule?.kind === "archived",
          },
        }),
      });
      const payload = await response.json() as Result;
      if (!response.ok) throw new Error();
      setResult(payload);
      if (payload.kind === "merchant_rule_confirmed" && payload.merchantMemory.saved) {
        router.refresh();
        completionTimer.current = window.setTimeout(close, 900);
      }
    } catch {
      setResult({ ...result, message: "Nothing was saved. Your choices are still available; please try again." });
    } finally {
      setBusy(false);
    }
  }

  const body = (
    (result?.kind === "confirmed" && result.savedClassification) ||
    result?.kind === "merchant_rule_confirmed" ||
    result?.kind === "obligation_saved" ||
    result?.kind === "obligation_unlinked"
  ) ? (
    <div className={styles.completion} role="status" aria-live="polite">
      <strong>{result.kind !== "merchant_rule_confirmed" || result.merchantMemory.saved ? "Updated" : "No rule created"}</strong>
      <p>{result.kind === "confirmed" ? formatCategoryPath({
        parentCategory: result.savedClassification?.effectiveParentCategory,
        subcategory: result.savedClassification?.effectiveSubcategory,
        sourceCategory: result.savedClassification?.sourceCategory,
      }) : result.kind === "merchant_rule_confirmed" ? result.categoryPath || "Individual classification" : result.kind === "obligation_saved" ? "Recurring obligation recorded" : "Obligation link removed"}</p>
      <span>{result.kind === "confirmed" ? "This transaction has been updated." : result.message}</span>
      {result.kind === "confirmed" && result.obligationPrompt ? (
        <div className={styles.obligation}>
          <strong>Is {result.obligationPrompt.payee} your {result.obligationPrompt.type === "rent" ? "landlord or property manager" : "mortgage lender"}?</strong>
          <div className={styles.choiceActions}>
            {(["yes", "no", "unsure"] as const).map((choice) => <button key={choice} type="button" onClick={() => setObligationRelationship(choice)}>{choice === "yes" ? "Yes" : choice === "no" ? "No" : "Not sure"}</button>)}
          </div>
          {obligationRelationship === "yes" ? (
            <>
              <label>Expected monthly amount (optional)<input inputMode="decimal" value={expectedAmount} onChange={(event) => setExpectedAmount(event.target.value)} /></label>
              <label>Usual due day (optional)<input type="number" min="1" max="31" value={dueDay} onChange={(event) => setDueDay(event.target.value)} /></label>
              <label>What kind of payment was this?<select value={paymentType} onChange={(event) => setPaymentType(event.target.value as typeof paymentType)}><option value="unsure">Not sure</option><option value="full">Full payment</option><option value="partial">Partial payment</option><option value="catch_up">Catch-up payment</option><option value="late">Late payment</option><option value="extra">Extra payment</option></select></label>
              {paymentType === "partial" ? <label>Remaining due (optional)<input inputMode="decimal" value={remainingDue} onChange={(event) => setRemainingDue(event.target.value)} /></label> : null}
              <label>Is this ongoing?<select value={ongoingStatus} onChange={(event) => setOngoingStatus(event.target.value as typeof ongoingStatus)}><option value="unsure">Not sure</option><option value="ongoing">Yes</option><option value="ended">No</option></select></label>
              <button className={styles.primary} type="button" disabled={busy} onClick={() => void saveHousingObligation(result.obligationPrompt!)}>Save obligation details</button>
            </>
          ) : obligationRelationship ? <button type="button" onClick={close}>Done</button> : null}
        </div>
      ) : null}
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
        {busy ? "Understanding…" : "Understand this"}
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
          {result.kind === "history_query" ? <div className={styles.merchantRule}>
            {result.accounts.length > 1 ? <p><strong>Paid from:</strong> {result.accounts.map((account) => `${account.label}: ${account.count}`).join(" · ")}</p> : null}
            {result.transactionIds.length ? <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("covarify:category-filter", { detail: { transactionIds: result.transactionIds, periodStart: result.periodStart || undefined, periodEnd: result.periodEnd || undefined, search: result.merchant } }))}>View these payments</button> : null}
          </div> : null}
          {result.kind === "intent_clarification" ? (
            <div className={styles.scopeChoices}>
              <button type="button" onClick={() => setResult({
                kind: "no_match",
                message: `Tell me the date, amount, or account for the one ${result.merchant || "merchant"} purchase. Your original wording is still above.`,
              })}>One transaction</button>
              <button type="button" onClick={() => { setRuleScope("future"); void interpret(undefined, `Future ${result.merchant} purchases should be ${result.requestedSubcategory}.`); }}>Future {result.merchant} purchases</button>
              <button type="button" onClick={() => { setRuleScope("past_and_future"); void interpret(undefined, `Always categorize ${result.merchant} as ${result.requestedSubcategory}.`); }}>Past and future {result.merchant} purchases</button>
            </div>
          ) : null}
          {result.kind === "merchant_rule" ? (
            <div className={styles.merchantRule}>
              <p><strong>Requested classification:</strong> {formatCategoryPath({
                parentCategory: result.parentCategory.displayName,
                subcategory: result.suggestions[0]?.displayName || result.requestedSubcategory,
              })}</p>
              {result.activity.count ? (
                <p>
                  <strong>{result.merchant} found in your activity.</strong>{" "}
                  We found {result.activity.count} matching {result.activity.count === 1 ? "purchase" : "purchases"}
                  {result.activity.firstDate && result.activity.lastDate ? ` from ${result.activity.firstDate} to ${result.activity.lastDate}` : ""}
                  {result.activity.categoryMix.length ? ` across ${result.activity.categoryMix.join(", ")}` : ""}.
                </p>
              ) : (
                <p>I don’t see {result.merchant} in your connected activity yet. You can still create a rule for future {result.merchant} purchases.</p>
              )}
              {result.breadth === "broad" ? (
                <p className={styles.warning}>{result.merchant} may sell household items, clothing, electronics, and other products, so this rule may not be accurate for every purchase.</p>
              ) : result.breadth === "unknown" ? (
                <p className={styles.warning}>This merchant may include different types of purchases. Choose a blanket rule only if it should apply to every matching purchase.</p>
              ) : null}
              {result.existingRule?.kind === "identical" ? <p>You already have this rule.</p> : null}
              {result.existingRule?.kind === "conflict" ? <p>You currently classify {result.merchant} as {result.existingRule.category}. Replace that rule?</p> : null}
              {result.existingRule?.kind === "archived" ? <p>You previously archived this rule. Reactivate it?</p> : null}
              <fieldset className={styles.ruleScope}>
                <legend>Apply to:</legend>
                <label><input type="radio" name="merchant-rule-scope" checked={ruleScope === "future"} onChange={() => setRuleScope("future")} /> Future {result.merchant} purchases</label>
                <label><input type="radio" name="merchant-rule-scope" checked={ruleScope === "past_and_future"} onChange={() => setRuleScope("past_and_future")} /> Past and future {result.merchant} purchases</label>
                <label><input type="radio" name="merchant-rule-scope" checked={ruleScope === "transaction_only"} onChange={() => setRuleScope("transaction_only")} /> Let me classify {result.merchant} purchases individually</label>
              </fieldset>
              <div className={styles.choiceActions}>
                <button
                  className={styles.primary}
                  type="button"
                  disabled={busy}
                  onClick={() => void confirmMerchantRule(result.suggestions[0]
                    ? { action: "use_existing", subcategoryId: result.suggestions[0].id }
                    : { action: "create_new", displayName: result.requestedSubcategory, reviewedSuggestionIds: [] })}
                >
                  {result.existingRule?.kind === "conflict" ? "Replace rule" : result.existingRule?.kind === "archived" ? "Reactivate rule" : ruleScope === "transaction_only" ? "Keep individual" : "Create rule"}
                </button>
                <button type="button" onClick={() => setResult(null)}>Change</button>
              </div>
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
                <div><dt>Source category</dt><dd>{formatCategoryLabel(result.transaction.sourceCategory)}</dd></div>
                <div><dt>Requested detail</dt><dd>{result.requestedSubcategory || "No subcategory requested"}</dd></div>
              </dl>
              {result.requestedSubcategory ? <div ref={suggestionRegion} className={styles.suggestionResult} tabIndex={-1}>
                <div className={styles.categoryPicker}>
                  <label>Main category<select value={selectedParentId} onChange={(event) => { setSelectedParentId(event.target.value); setSelectedSubcategoryId(""); }}>{result.categoryOptions.map((option) => <option key={option.id} value={option.id}>{option.displayName}</option>)}</select></label>
                  <label>Subcategory<select value={selectedSubcategoryId} onChange={(event) => setSelectedSubcategoryId(event.target.value)}><option value="">Choose a subcategory</option>{result.categoryOptions.find((option) => option.id === selectedParentId)?.subcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.displayName}</option>)}</select></label>
                  <button className={styles.primary} type="button" disabled={busy || !selectedSubcategoryId} onClick={() => void confirm({ action: "use_existing", parentCategoryId: selectedParentId, subcategoryId: selectedSubcategoryId })}>Apply classification</button>
                </div>
                {result.suggestions.length ? <section className={styles.matches}>
                  <strong>You may already have a category for this.</strong>
                  {result.suggestions.map((suggestion) => <article key={suggestion.id}><span>Possible match</span><h3>{suggestion.displayName}</h3><p>Under {result.parentCategory.displayName}</p><button className={styles.primary} type="button" disabled={busy} onClick={() => void confirm({ action: "use_existing", parentCategoryId: result.parentCategory.id, subcategoryId: suggestion.id })}>Use {suggestion.displayName}</button></article>)}
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
              <div><dt>Source</dt><dd>{formatCategoryLabel(selected.sourceCategory || selected.category)}</dd></div>
              {accountCostDisplayLabel(selected) ? <div><dt>Account cost</dt><dd>{accountCostDisplayLabel(selected)}</dd></div> : null}
              <div><dt>Main category</dt><dd>{formatCategoryPath({ parentCategory: selected.effectiveParentCategory, sourceCategory: selected.sourceCategory || selected.category })}</dd></div>
              <div><dt>Subcategory</dt><dd>{formatCategoryLabel(selected.effectiveSubcategory) || "None"}</dd></div>
              <div><dt>Your classification</dt><dd>{selected.effectiveSubcategory ? formatCategoryPath({ parentCategory: selected.effectiveParentCategory, subcategory: selected.effectiveSubcategory, sourceCategory: selected.sourceCategory || selected.category }) : formatCategoryLabel(selected.userConfirmedMeaning?.category) || "None"}</dd></div>
              {selected.housingObligation ? <>
                <div><dt>Housing obligation</dt><dd>{selected.housingObligation.type === "rent" ? "Rent" : "Mortgage"}</dd></div>
                <div><dt>Payment type</dt><dd>{formatCategoryLabel(selected.housingObligation.paymentType) || "Not sure"}</dd></div>
                <div><dt>Expected monthly {selected.housingObligation.type}</dt><dd>{selected.housingObligation.expectedAmount == null ? "Not provided yet" : money(selected.housingObligation.expectedAmount, selected.currency)}</dd></div>
                {selected.housingObligation.remainingDue != null ? <div><dt>Remaining due</dt><dd>{money(selected.housingObligation.remainingDue, selected.currency)}</dd></div> : null}
              </> : null}
            </dl>
            {selected.housingObligation ? <div className={styles.choiceActions}><button type="button" disabled={busy} onClick={() => editHousingObligation(selected)}>Edit housing obligation</button><button type="button" disabled={busy} onClick={() => void unlinkHousingObligation(selected.id)}>Unlink from housing obligation</button></div> : null}
            {body}
          </section>
        </div>
      ) : null}
    </>
  );
}
