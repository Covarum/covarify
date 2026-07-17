"use client";

import { useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { TalkToCovarify, type PaymentScenario, type TalkMerchant } from "./talk-to-covarify";
import type { DecisionAction, DecisionDraft, DecisionRecord, DecisionRequestResult, DecisionScope } from "./decision-ledger-types";

type Account = { id: string; name: string; type: string; currentBalance: number | null };
type Transaction = { id: string; name: string; amount: number; date: string; category: string };
type DebtStrategy = { detected_credit_accounts: number; estimated_total_credit_balance: number; estimated_available_credit: number | null; estimated_credit_utilization_if_available: number | null; minimum_payment_data_status: string; apr_data_status: string; payment_strategy_note: string };
type Lever = { category: string; current_30_day_spend: number; estimated_savings: number; suggested_reduction: string };
type Debt = { id: string; manual: boolean; name: string; balance: string; minimum: string; statement: string; apr: string; due: string; planned: string };
type TxChoice = "none" | "skip" | "reduce" | "protect";
type MerchantChoice = "pause" | "reduce" | "protect";
type PlanSnapshot = { scenario: PaymentScenario; customPayment: string; reductions: Record<string, number>; merchantPlans: Record<string, Record<string, number>>; merchantChoices: Record<string, MerchantChoice>; txPlans: Record<string, { choice: TxChoice; amount: number }> };

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const number = (value: string) => Math.max(0, Number(value) || 0);
const categoryLabel = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const scenarioNames: Record<PaymentScenario, string> = { minimums: "Minimums only this cycle", full: "Full / statement balance", custom: "Custom payment", flexible: "Flexible spending plan", consolidation: "Consolidation review" };
const close = (a: number, b: number) => Math.abs(a - b) < 1;

export function DecisionStudio({ accounts, debt, cashGap, totalCash, levers, transactions }: { accounts: Account[]; debt: DebtStrategy; cashGap: number; totalCash: number; levers: Lever[]; transactions: Transaction[] }) {
  const detected = accounts.filter((account) => account.type === "credit");
  const [debts, setDebts] = useState<Debt[]>(() => detected.map((account) => ({ id: account.id, manual: false, name: account.name, balance: String(account.currentBalance || ""), minimum: "", statement: "", apr: "", due: "", planned: "" })));
  const [scenario, setScenario] = useState<PaymentScenario>(cashGap > 0 ? "minimums" : "flexible");
  const [customPayment, setCustomPayment] = useState("");
  const [reductions, setReductions] = useState<Record<string, number>>(() => Object.fromEntries(levers.map((lever) => [lever.category, lever.estimated_savings])));
  const [expanded, setExpanded] = useState<string | null>(null);
  const [merchantPlans, setMerchantPlans] = useState<Record<string, Record<string, number>>>({});
  const [merchantChoices, setMerchantChoices] = useState<Record<string, MerchantChoice>>({});
  const [txPlans, setTxPlans] = useState<Record<string, { choice: TxChoice; amount: number }>>({});
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const decisionActions = useRef(new Map<string, DecisionAction>());
  const decisionSnapshots = useRef(new Map<string, PlanSnapshot>());
  const decisionSequence = useRef(0);
  const [highlightedCategory, setHighlightedCategory] = useState("");

  const snapshotPlan = (): PlanSnapshot => ({ scenario, customPayment, reductions, merchantPlans, merchantChoices, txPlans });
  const restorePlan = (snapshot: PlanSnapshot) => { setScenario(snapshot.scenario); setCustomPayment(snapshot.customPayment); setReductions(snapshot.reductions); setMerchantPlans(snapshot.merchantPlans); setMerchantChoices(snapshot.merchantChoices); setTxPlans(snapshot.txPlans); };

  const updateDebt = (id: string, key: keyof Debt, value: string) => setDebts((current) => current.map((item) => item.id === id ? { ...item, [key]: value } : item));
  const addDebt = () => setDebts((current) => [...current, { id: `manual-${Date.now()}`, manual: true, name: "Manual debt", balance: "", minimum: "", statement: "", apr: "", due: "", planned: "" }]);
  const setReduction = (category: string, amount: number) => {
    const currentSpend = levers.find((lever) => lever.category === category)?.current_30_day_spend || 0;
    setReductions((current) => ({ ...current, [category]: Math.min(currentSpend, Math.max(0, amount)) }));
  };
  const categoryTransactions = (category: string) => transactions.filter((transaction) => categoryLabel(transaction.category) === category && transaction.amount > 0);
  const merchantsFor = (category: string) => {
    const map = new Map<string, { amount: number; count: number }>();
    for (const tx of categoryTransactions(category)) { const current = map.get(tx.name) || { amount: 0, count: 0 }; map.set(tx.name, { amount: current.amount + tx.amount, count: current.count + 1 }); }
    return [...map.entries()].map(([name, data]) => ({ name, ...data })).sort((a, b) => b.amount - a.amount);
  };
  const merchantKey = (category: string, merchant: string) => `${category}::${merchant}`;
  const applyMerchant = (category: string, merchant: string, amount: number, choice: MerchantChoice) => {
    const previousAmount = merchantPlans[category]?.[merchant] || 0;
    const next = { ...(merchantPlans[category] || {}), [merchant]: amount };
    setMerchantPlans((current) => ({ ...current, [category]: next }));
    setMerchantChoices((current) => ({ ...current, [merchantKey(category, merchant)]: choice }));
    const transactionPlan = categoryTransactions(category).filter((tx) => txPlans[tx.id]?.choice !== "protect").reduce((sum, tx) => sum + (txPlans[tx.id]?.amount || 0), 0);
    setReduction(category, Math.max(0, (reductions[category] || 0) - previousAmount + amount, Object.values(next).reduce((sum, value) => sum + value, 0), transactionPlan));
  };
  const protectMerchant = (category: string, merchant: string) => {
    const selectedAmount = merchantPlans[category]?.[merchant] || 0;
    const nextCategory = { ...(merchantPlans[category] || {}) };
    delete nextCategory[merchant];
    setMerchantPlans((current) => ({ ...current, [category]: nextCategory }));
    setMerchantChoices((current) => ({ ...current, [merchantKey(category, merchant)]: "protect" }));
    const matching = transactions.filter((tx) => tx.name.toLowerCase() === merchant.toLowerCase());
    setTxPlans((current) => ({ ...current, ...Object.fromEntries(matching.map((tx) => [tx.id, { choice: "protect" as const, amount: 0 }])) }));
    setReduction(category, Math.max(0, (reductions[category] || 0) - selectedAmount));
  };
  const applyTransaction = (category: string, tx: Transaction, choice: TxChoice) => {
    const amount = choice === "skip" ? tx.amount : choice === "reduce" ? tx.amount * .5 : 0;
    const next = { ...txPlans, [tx.id]: { choice, amount } };
    setTxPlans(next);
    const txTotal = categoryTransactions(category).reduce((sum, item) => sum + (next[item.id]?.amount || 0), 0);
    const merchantTotal = Object.values(merchantPlans[category] || {}).reduce((sum, value) => sum + value, 0);
    setReduction(category, Math.max(reductions[category] || 0, txTotal, merchantTotal));
  };
  const setPayment = (nextScenario: PaymentScenario, amount?: number) => { setScenario(nextScenario); if (nextScenario === "custom" && amount !== undefined) setCustomPayment(String(amount)); };

  const executeDecision = (action: DecisionAction) => {
    if (action.kind === "set_reduction") setReduction(action.category, action.amount);
    if (action.kind === "pause_merchant") applyMerchant(action.category, action.merchant, action.amount, action.choice || "pause");
    if (action.kind === "protect_merchant") protectMerchant(action.category, action.merchant);
    if (action.kind === "set_payment") setPayment(action.scenario, action.amount);
    if (action.kind === "apply_suggestion") action.items.forEach((item) => setReduction(item.category, item.amount));
    if (action.kind === "set_transaction") applyTransaction(action.category, action.transaction, action.choice);
  };

  const requestDecision = (draft: DecisionDraft, action: DecisionAction): DecisionRequestResult => {
    const now = new Date().toISOString();
    decisionSequence.current += 1;
    const id = `decision-${now.replace(/\D/g, "")}-${decisionSequence.current}`;
    const status = draft.preferred_status || (draft.requires_confirmation ? "pending_confirmation" : "applied");
    const record: DecisionRecord = { ...draft, id, created_at: now, updated_at: now, status, scope_start: now.slice(0, 10), scope_end: "This billing cycle", undo_available: status === "applied" };
    decisionActions.current.set(id, action);
    if (status === "applied") { decisionSnapshots.current.set(id, snapshotPlan()); executeDecision(action); }
    setDecisions((current) => [record, ...current]);
    return { applied: status === "applied", record };
  };

  const confirmDecision = (id: string) => { const action = decisionActions.current.get(id); if (!action) return; decisionSnapshots.current.set(id, snapshotPlan()); executeDecision(action); const now = new Date().toISOString(); setDecisions((current) => current.map((record) => record.id === id ? { ...record, status: "applied", updated_at: now, requires_confirmation: false, undo_available: true, explanation: `${record.explanation} Applied to your working plan. You can undo this.` } : record)); };
  const undoDecision = (id: string) => { const snapshot = decisionSnapshots.current.get(id); if (!snapshot) return; restorePlan(snapshot); const now = new Date().toISOString(); setDecisions((current) => current.map((record) => record.id === id ? { ...record, status: "reversed", updated_at: now, undo_available: false, explanation: `${record.explanation} Reversed at ${new Date(now).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.` } : record)); };
  const updateDecisionStatus = (id: string, status: DecisionRecord["status"]) => setDecisions((current) => current.map((record) => record.id === id ? { ...record, status, updated_at: new Date().toISOString(), undo_available: false } : record));
  const updateDecisionScope = (id: string, scope: DecisionScope, customDate?: string) => setDecisions((current) => current.map((record) => record.id === id ? { ...record, scope_end: customDate || scope, updated_at: new Date().toISOString() } : record));
  const reviewDecision = (record: DecisionRecord) => { if (record.affected_category) { const category = record.affected_category.split(",")[0].trim(); setExpanded(category); setHighlightedCategory(category); window.setTimeout(() => { document.getElementById(`decision-category-${category.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 0); window.setTimeout(() => setHighlightedCategory(""), 1800); } };

  const manualReduction = (category: string, amount: number) => { const currentSpend = levers.find((lever) => lever.category === category)?.current_30_day_spend || 0; const previous = reductions[category] || 0; const impact = amount - previous; requestDecision({ title: `Reduce ${category} by ${money(amount)}`, interpreted_command: `Manual ${category} reduction`, source: "manual_control", profile_name: "Current user", decision_type: "category_reduction", affected_category: category, affected_merchant: "", affected_debt: "", estimated_cash_impact: impact, estimated_gap_impact: Math.min(Math.max(0, impact), remainingGap), confidence: 1, requires_confirmation: amount >= 500 || amount >= currentSpend * .5 || impact >= remainingGap * .8, explanation: `Set the ${category} reduction target to ${money(amount)}.`, previous_value: money(previous), new_value: money(amount) }, { kind: "set_reduction", category, amount }); };
  const previewPayment = (nextScenario: PaymentScenario) => requestDecision({ title: `Preview ${scenarioNames[nextScenario]}`, interpreted_command: `Preview ${scenarioNames[nextScenario]}`, source: "manual_control", profile_name: "Current user", decision_type: "payment_strategy", affected_category: "", affected_merchant: "", affected_debt: "All modeled debts", estimated_cash_impact: 0, estimated_gap_impact: 0, confidence: 1, requires_confirmation: true, preferred_status: "scenario_only", explanation: "Preview this payment strategy without changing the working plan.", previous_value: scenarioNames[scenario], new_value: scenarioNames[nextScenario] }, { kind: "set_payment", scenario: nextScenario });
  const manualMerchant = (category: string, merchant: string, amount: number, choice: MerchantChoice) => requestDecision({ title: choice === "protect" ? `Protect ${merchant}` : `${choice === "pause" ? "Pause" : "Reduce"} ${merchant}`, interpreted_command: `Manual ${choice} ${merchant}`, source: "manual_control", profile_name: "Current user", decision_type: choice === "protect" ? "protected_obligation" : "merchant_pause", affected_category: category, affected_merchant: merchant, affected_debt: "", estimated_cash_impact: choice === "protect" ? 0 : amount, estimated_gap_impact: Math.min(choice === "protect" ? 0 : amount, remainingGap), confidence: 1, requires_confirmation: choice === "protect" || amount >= remainingGap * .8, explanation: choice === "protect" ? `${merchant} will be excluded from savings calculations.` : `Model ${choice === "pause" ? "pausing" : "reducing"} ${merchant} for the selected scope.`, previous_value: merchantChoices[merchantKey(category, merchant)] || "No merchant decision", new_value: choice }, choice === "protect" ? { kind: "protect_merchant", category, merchant } : { kind: "pause_merchant", category, merchant, amount, choice });
  const manualTransaction = (category: string, tx: Transaction, choice: TxChoice) => requestDecision({ title: `${choice === "protect" ? "Protect" : choice === "skip" ? "Skip next time" : choice === "reduce" ? "Reduce" : "Use as clue"}: ${tx.name}`, interpreted_command: `Manual transaction choice for ${tx.name}`, source: "manual_control", profile_name: "Current user", decision_type: choice === "protect" ? "protected_obligation" : "category_reduction", affected_category: category, affected_merchant: tx.name, affected_debt: "", estimated_cash_impact: choice === "skip" ? tx.amount : choice === "reduce" ? tx.amount * .5 : 0, estimated_gap_impact: Math.min(choice === "skip" ? tx.amount : choice === "reduce" ? tx.amount * .5 : 0, remainingGap), confidence: 1, requires_confirmation: choice === "protect", explanation: `Trace this transaction-level choice to the working plan.`, previous_value: txPlans[tx.id]?.choice || "none", new_value: choice }, { kind: "set_transaction", category, transaction: tx, choice });

  const totals = useMemo(() => debts.reduce((sum, item) => ({ minimum: sum.minimum + number(item.minimum), full: sum.full + number(item.statement || item.balance), planned: sum.planned + number(item.planned), aprs: [...sum.aprs, ...(item.apr ? [number(item.apr)] : [])] }), { minimum: 0, full: 0, planned: 0, aprs: [] as number[] }), [debts]);
  const selectedSavings = Object.values(reductions).reduce((sum, amount) => sum + amount, 0);
  const modeledPayment = scenario === "minimums" ? totals.minimum : scenario === "full" ? totals.full : scenario === "custom" ? number(customPayment) : totals.planned;
  const paymentCashChange = totals.planned - modeledPayment;
  const cashFreed = paymentCashChange + selectedSavings;
  const remainingGap = Math.max(0, cashGap - cashFreed);
  const gapCovered = cashGap > 0 ? Math.max(0, Math.min(100, cashFreed / cashGap * 100)) : 100;
  const activeDecisions = decisions.filter((record) => record.status === "applied");
  const protectedItems = Object.entries(merchantChoices).filter(([, choice]) => choice === "protect").map(([key]) => key.split("::")[1]);
  const mode = cashGap > 0 ? "Catch-Up Mode" : totalCash < 1000 ? "Stability Mode" : "Progress Mode";
  const allMerchants = useMemo<TalkMerchant[]>(() => {
    const map = new Map<string, TalkMerchant>();
    for (const tx of transactions.filter((item) => item.amount > 0)) { const category = categoryLabel(tx.category); const key = `${category}::${tx.name.toLowerCase()}`; const current = map.get(key); map.set(key, { name: tx.name, category, amount: (current?.amount || 0) + tx.amount, count: (current?.count || 0) + 1 }); }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, [transactions]);
  const talkCategories = levers.map((lever) => ({ name: lever.category, currentSpend: lever.current_30_day_spend, currentReduction: reductions[lever.category] || 0, merchants: merchantsFor(lever.category) }));
  const firstWin = scenario === "full" && cashFreed < 0 ? "Paying the full balance may reduce interest, but it could increase short-term cash pressure in this sandbox history." : scenario === "minimums" ? "Paying minimums only this cycle may be a temporary catch-up move. It protects cash flow now but may increase interest if balances carry." : gapCovered >= 80 ? "Your first win may be to follow this plan for the next seven days before making extra debt payments." : `You selected changes that could cover ${Math.round(gapCovered)}% of the gap. Covarify would next look at bill timing, money in, or one more flexible category.`;

  return <div className="decision-studio v1">
    <div className="mode-card"><div><p className="eyebrow plain">Current mode</p><h3>{mode}</h3><p>Based on available sandbox history, Covarify would look at net cash flow and the estimated cash gap before optimizing longer-term progress.</p></div><span>Protect essentials first.</span></div>
    <TalkToCovarify categories={talkCategories} merchants={allMerchants} cashGap={cashGap} cashFreed={cashFreed} decisions={decisions} onDecisionRequest={requestDecision} onDecisionConfirm={confirmDecision} onDecisionSuggest={(id) => updateDecisionStatus(id, "suggestion")} onDecisionDismiss={(id) => updateDecisionStatus(id, "expired")} onDecisionUndo={undoDecision} onDecisionReview={reviewDecision} onDecisionScope={updateDecisionScope} />
    <section className="plan-drivers" aria-labelledby="plan-drivers-title"><div><p className="eyebrow plain">What’s affecting my plan?</p><h3 id="plan-drivers-title">Current working-plan drivers</h3></div><div className="driver-grid"><span>Payment strategy<strong>{scenarioNames[scenario]}</strong></span><span>Category reductions<strong>{levers.filter((lever) => (reductions[lever.category] || 0) > 0).map((lever) => `${lever.category} ${money(reductions[lever.category])}`).join(", ") || "None"}</strong></span><span>Merchant pauses<strong>{Object.entries(merchantChoices).filter(([, choice]) => choice === "pause" || choice === "reduce").map(([key]) => key.split("::")[1]).join(", ") || "None"}</strong></span><span>Protected items<strong>{protectedItems.join(", ") || "None"}</strong></span><span>Total estimated cash freed<strong>{money(Math.max(0, cashFreed))}</strong></span><span>Remaining gap<strong>{money(remainingGap)}</strong></span></div><p className="driver-trace">Driven by: {activeDecisions.length ? activeDecisions.map((record) => <button type="button" onClick={() => reviewDecision(record)} key={record.id}>{record.title} · {record.scope_end}</button>) : <span>Current sandbox defaults and manual assumptions. New changes will be traced in the Decision Ledger.</span>}</p></section>
    <section className="debt-assumptions">
      <div className="decision-heading"><div><p className="eyebrow plain">Debt Assumptions</p><h3>Model every card or debt in the decision.</h3></div><button className="add-debt" onClick={addDebt}><Plus size={14} />Add manual debt</button></div>
      <p className="helper-copy">Manual inputs are used only for sandbox decision modeling. Covarify needs minimums, APRs, statement balances, and due dates to compare payment strategies more accurately.</p>
      <div className="debt-card-grid">{debts.map((item) => <article className="debt-card" key={item.id}><div className="debt-card-title"><input aria-label="Debt nickname" value={item.name} onChange={(event) => updateDebt(item.id, "name", event.target.value)} />{item.manual && <button aria-label="Remove manual debt" onClick={() => setDebts((current) => current.filter((debtItem) => debtItem.id !== item.id))}><Trash2 size={14} /></button>}</div><div>{(["balance", "minimum", "statement", "apr", "due", "planned"] as const).map((key) => <label key={key}><span>{{ balance: "Current balance", minimum: "Minimum due", statement: "Statement balance", apr: "APR %", due: "Due date", planned: "Planned this cycle" }[key]}</span><input type={key === "due" ? "date" : "number"} min="0" step="0.01" value={item[key]} onChange={(event) => updateDebt(item.id, key, event.target.value)} placeholder={key === "minimum" || key === "apr" ? "Needed" : "Optional"} /></label>)}</div></article>)}</div>
    </section>
    <section>
      <div className="decision-heading"><div><p className="eyebrow plain">Decision Studio v1</p><h3>Build one combined working plan.</h3></div><p>You choose what feels realistic. These are levers, not instructions.</p></div>
      <div className="scenario-tabs">{(Object.keys(scenarioNames) as PaymentScenario[]).map((item) => <button className={scenario === item ? "active" : ""} aria-pressed={scenario === item} onClick={() => previewPayment(item)} key={item}>{scenario === item && <Check size={12} />}{scenarioNames[item]} <small>Preview impact</small></button>)}</div>
      <p className="selected-plan-summary">Selected: {scenarioNames[scenario]}{scenario === "custom" && customPayment ? ` · ${money(number(customPayment))}` : ""}</p>
      {scenario === "custom" && <label className="custom-payment">Custom payment amount<input type="number" min="0" value={customPayment} onChange={(event) => setCustomPayment(event.target.value)} /></label>}
      <div className="category-plans">{levers.map((lever) => {
        const reduction = reductions[lever.category] || 0;
        const txs = categoryTransactions(lever.category);
        const merchants = merchantsFor(lever.category);
        const choices = [{ label: "$50", amount: 50 }, { label: "$100", amount: 100 }, { label: "15%", amount: lever.current_30_day_spend * .15 }, { label: "25%", amount: lever.current_30_day_spend * .25 }];
        return <article id={`decision-category-${lever.category.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`} className={`category-plan ${highlightedCategory === lever.category ? "decision-highlight" : ""}`} key={lever.category}>
          <button className="category-toggle" onClick={() => setExpanded(expanded === lever.category ? null : lever.category)}><div><strong>{lever.category}</strong><span>{money(lever.current_30_day_spend)} across {txs.length} transactions</span></div><ChevronDown className={expanded === lever.category ? "open" : ""} size={18} /></button>
          <div className="reduction-controls"><span>Choose a reduction</span><div className="quick-buttons">{choices.map((choice) => { const selected = close(reduction, Math.min(lever.current_30_day_spend, choice.amount)); return <button className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => manualReduction(lever.category, choice.amount)} key={choice.label}>{selected && <Check size={11} />}{choice.label}</button>; })}</div><label>$<input aria-label={`${lever.category} custom reduction`} type="number" min="0" max={lever.current_30_day_spend} value={Math.round(reduction)} onChange={(event) => manualReduction(lever.category, number(event.target.value))} /></label></div>
          <p className="selected-category-summary"><Check size={12} /> Selected: Reduce {lever.category} by {money(reduction)}</p>
          <div className="category-impact"><span>New target <strong>{money(lever.current_30_day_spend - reduction)}</strong></span><span>Estimated cash freed <strong>{money(reduction)}</strong></span><span>{cashGap > 0 ? `Closes ${Math.min(100, Math.round(reduction / cashGap * 100))}% of gap` : `Could free ${money(reduction)} for savings, debt, or goals`}</span></div>
          <p className="prospective">This models future choices if similar spending repeats. It could free up approximately {money(reduction)}.</p>
          {expanded === lever.category && <div className="category-detail"><p>Use transactions as clues. Covarify is showing tradeoffs, not judging spending.</p><h4>Merchant summary</h4>{merchants.slice(0, 6).map((merchant) => { const selected = merchantChoices[merchantKey(lever.category, merchant.name)]; return <div className="merchant-row" key={merchant.name}><span><strong>{merchant.name}</strong>{money(merchant.amount)} across {merchant.count} transactions{selected && <small className="merchant-selected"><Check size={10} /> Selected: {selected === "pause" ? `Pause ${merchant.name} next month` : selected === "reduce" ? `Reduce ${merchant.name} by 50%` : `Protect ${merchant.name}`}</small>}</span><div><button className={selected === "pause" ? "selected" : ""} aria-pressed={selected === "pause"} onClick={() => manualMerchant(lever.category, merchant.name, merchant.amount, "pause")}>{selected === "pause" && <Check size={10} />}Pause next month</button><button className={selected === "reduce" ? "selected" : ""} aria-pressed={selected === "reduce"} onClick={() => manualMerchant(lever.category, merchant.name, merchant.amount * .5, "reduce")}>{selected === "reduce" && <Check size={10} />}Reduce by 50%</button><button className={selected === "protect" ? "selected protect" : ""} aria-pressed={selected === "protect"} onClick={() => manualMerchant(lever.category, merchant.name, 0, "protect")}>{selected === "protect" && <Check size={10} />}Protect</button></div></div>; })}<h4>Transaction examples</h4>{txs.slice(0, 10).map((tx) => <div className="tx-plan" key={tx.id}><span><strong>{tx.name}</strong>{tx.date} · {money(tx.amount)}</span><select value={txPlans[tx.id]?.choice || "none"} onChange={(event) => manualTransaction(lever.category, tx, event.target.value as TxChoice)}><option value="none">Use as clue</option><option value="skip">Would skip next time</option><option value="reduce">Would reduce 50%</option><option value="protect">Protect / not a cut</option></select></div>)}</div>}
        </article>;
      })}</div>
      <div className="scorecard"><article><span>Estimated cash freed</span><strong className={cashFreed >= 0 ? "positive" : "negative"}>{cashFreed >= 0 ? "+" : "−"}{money(Math.abs(cashFreed))}</strong><small>Driven by: {activeDecisions.map((record) => record.title).join(", ") || "sandbox defaults"}</small></article><article><span>Estimated cash gap remaining</span><strong>{money(remainingGap)}</strong></article><article><span>Gap closed</span><strong>{Math.round(gapCovered)}%</strong></article><article><span>Risk</span><strong>{scenario === "full" && cashFreed < 0 ? "High" : "Low / Medium"}</strong></article><article><span>Confidence</span><strong>{totals.minimum || scenario !== "minimums" ? "Medium" : "Low"}</strong></article><article><span>Tradeoff</span><strong>{scenario === "minimums" ? "Cash now / interest later" : scenario === "full" ? "Interest / cash pressure" : "Flexibility / pace"}</strong></article></div>
      {scenario === "consolidation" && <div className="consolidation-review"><h4>May be worth reviewing</h4><p>Total credit balance: {money(debt.estimated_total_credit_balance)} · Estimated minimums: {totals.minimum ? money(totals.minimum) : "missing"} · APRs: {totals.aprs.length ? totals.aprs.map((apr) => `${apr}%`).join(", ") : "missing"}</p><p>Possible benefit: lower monthly pressure or a simpler structure. Review fees, promotional expiration, approval, credit inquiry, extended repayment, and balance re-use risk.</p></div>}
    </section>
    <section className="working-plan"><p className="eyebrow plain">My Working Plan</p><h3>{scenarioNames[scenario]}</h3><div><span>Flexible changes<strong>{levers.filter((lever) => (reductions[lever.category] || 0) > 0).map((lever) => `${lever.category} − ${money(reductions[lever.category])}`).join(", ") || "None selected"}</strong></span><span>Estimated cash freed<strong>{money(Math.max(0, cashFreed))}</strong></span><span>Remaining gap<strong>{money(remainingGap)}</strong></span><span>Gap covered<strong>{Math.round(gapCovered)}%</strong></span></div><p>{firstWin}</p><div className="plan-checklist"><span><Check size={14} />Make required minimum payments only if selected.</span><span><Check size={14} />Protect essential bills first.</span><span><Check size={14} />Cap selected flexible categories this week.</span><span><Check size={14} />Pause or reduce selected merchants.</span><span><Check size={14} />Recheck after new transactions post.</span></div></section>
    <section className="protect-card"><ShieldCheck /><div><p className="eyebrow plain">Protect / review first</p><p>IRS · Mathnasium · medical · insurance · rent · utilities · minimum debt payments · childcare · transportation needed for work</p><small>Covarify protects required or important obligations from default savings suggestions. You can review them, but they are not first-cut items.</small></div></section>
  </div>;
}

// TODO: Add saved user plans after authentication, encrypted user data storage,
// recurring merchant detection, Plaid Liabilities, and compliance/legal review.
