"use client";

import { useState } from "react";
import { ArrowRight, Check, MessageCircle } from "lucide-react";

export type TalkCategory = {
  name: string;
  currentSpend: number;
  currentReduction: number;
  merchants: { name: string; amount: number; count: number }[];
};

export type TalkMerchant = { name: string; category: string; amount: number; count: number };
export type PaymentScenario = "minimums" | "full" | "custom" | "flexible" | "consolidation";
type ResponseState = { command: string; understood: string; changed: string; impact: number; remaining: number; caution: string; noMatch?: boolean };
type Suggestion = { category: string; amount: number };

type Props = {
  categories: TalkCategory[];
  merchants: TalkMerchant[];
  cashGap: number;
  cashFreed: number;
  onSetReduction: (category: string, amount: number) => void;
  onPauseMerchant: (category: string, merchant: string, amount: number) => void;
  onProtectMerchant: (category: string, merchant: string) => void;
  onSetPayment: (scenario: PaymentScenario, amount?: number) => void;
  onApplySuggestion: (suggestion: Suggestion[]) => void;
};

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const normalize = (value: string) => value.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const aliases: Record<string, string[]> = { "Food And Drink": ["food", "food and drink", "dining", "restaurants"], "General Merchandise": ["shopping", "merchandise", "general merchandise"], Entertainment: ["entertainment", "recreation"], Travel: ["travel"], "Personal Care": ["personal care"], Subscriptions: ["subscriptions", "subscription"] };

function findCategory(command: string, categories: TalkCategory[]) {
  const clean = normalize(command);
  return categories.find((category) => [category.name, ...(aliases[category.name] || [])].some((name) => clean.includes(normalize(name))));
}

function findMerchant(command: string, merchants: TalkMerchant[]) {
  const clean = normalize(command);
  return [...merchants].sort((a, b) => b.name.length - a.name.length).find((merchant) => {
    const name = normalize(merchant.name);
    const meaningful = name.split(" ").filter((word) => word.length > 2);
    const acronym = meaningful.map((word) => word[0]).join("");
    return clean.includes(name) || (acronym.length > 1 && clean.split(" ").includes(acronym)) || (meaningful.length > 0 && meaningful.every((word) => clean.includes(word)));
  });
}

export function TalkToCovarify({ categories, merchants, cashGap, cashFreed, onSetReduction, onPauseMerchant, onProtectMerchant, onSetPayment, onApplySuggestion }: Props) {
  const [command, setCommand] = useState("");
  const [response, setResponse] = useState<ResponseState | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion[] | null>(null);
  const examples = ["Cut out Uber Eats this month", "Reduce Food and Drink by $100", "Pay minimums this cycle"];

  const reply = (input: string, understood: string, changed: string, impact = 0, caution = "This models future choices if similar spending repeats. It does not judge past spending.") => setResponse({ command: input, understood, changed, impact, remaining: Math.max(0, cashGap - Math.max(0, cashFreed + impact)), caution });

  const apply = (raw = command) => {
    const input = raw.trim();
    const clean = normalize(input);
    setCommand(input);
    setSuggestion(null);
    if (!clean) { reply(input, "I can help with that.", "Try telling Covarify a merchant, category, payment amount, or goal.", 0); return; }

    const protectedIntent = /\b(protect|do not count|dont count|dont cut|mark .* required)\b/.test(clean);
    if (protectedIntent) {
      const merchant = findMerchant(input, merchants);
      if (merchant) { onProtectMerchant(merchant.category, merchant.name); reply(input, `${merchant.name} · ${merchant.category}`, `${merchant.name} has been marked as protected/review-first and will not be counted as savings.`, 0, "Protect essentials first. You can review this choice at any time."); return; }
    }

    const goalMatch = clean.match(/(?:free up|save)\s*\$?\s*(\d+(?:\.\d+)?)/);
    if (goalMatch || clean.includes("close the gap") || clean.includes("back to neutral")) {
      const target = goalMatch ? Number(goalMatch[1]) : Math.max(0, cashGap - cashFreed);
      let remaining = target;
      const plan = [...categories].sort((a, b) => b.currentSpend - a.currentSpend).flatMap((category) => {
        if (remaining <= 0) return [];
        const amount = Math.min(remaining, Math.max(50, category.currentSpend * .2), category.currentSpend);
        remaining -= amount;
        return [{ category: category.name, amount }];
      });
      setSuggestion(plan);
      const names = plan.slice(0, 2).map((item) => item.category).join(" and ");
      reply(input, `A goal of about ${money(target)}.`, `Covarify would look first at ${names || "the largest flexible categories"} because they are flexible and high-impact. Review the suggestion before applying it.`, 0, "You choose what feels realistic. Covarify is showing tradeoffs, not judging spending.");
      return;
    }

    if (/\b(minimum|min payments|minimum payments)\b/.test(clean)) { onSetPayment("minimums"); reply(input, "Pay minimums only this cycle.", "The payment strategy is now Minimums only this cycle.", 0, "This may protect cash now but can increase interest if balances carry."); return; }
    if (/\b(full statement|statement balance|pay full)\b/.test(clean)) { onSetPayment("full"); reply(input, "Pay the full statement balance.", "The payment strategy is now Full / statement balance.", 0, "Review the cash-flow tradeoff before applying a larger payment."); return; }
    const paymentMatch = clean.match(/(?:pay|payment)\s*\$?\s*(\d+(?:\.\d+)?)/);
    if (paymentMatch) { const amount = Number(paymentMatch[1]); onSetPayment("custom", amount); reply(input, `A custom payment of ${money(amount)}.`, `The payment strategy and custom amount were updated.`, 0, "Protect essential bills and required minimums first."); return; }

    const category = findCategory(input, categories);
    const percentMatch = clean.match(/(\d+(?:\.\d+)?)\s*%/);
    const amountMatch = clean.match(/(?:by\s*)?\$\s*(\d+(?:\.\d+)?)|(?:by\s+)(\d+(?:\.\d+)?)/);
    if (category && (percentMatch || amountMatch)) {
      const amount = Math.min(category.currentSpend, percentMatch ? category.currentSpend * Number(percentMatch[1]) / 100 : Number(amountMatch?.[1] || amountMatch?.[2]));
      onSetReduction(category.name, amount);
      reply(input, `${category.name} · ${percentMatch ? `${percentMatch[1]}%` : money(amount)}`, `${category.name} reduction set to ${money(amount)}.`, amount - category.currentReduction);
      return;
    }

    const pauseIntent = /\b(cut out|pause|stop|no)\b/.test(clean);
    if (pauseIntent) {
      const merchant = findMerchant(input, merchants);
      if (merchant) { onPauseMerchant(merchant.category, merchant.name, merchant.amount); const categoryState = categories.find((item) => item.name === merchant.category); const impact = Math.max(0, merchant.amount - (categoryState?.currentReduction || 0)); reply(input, `${merchant.name} · ${merchant.category} · ${money(merchant.amount)} across ${merchant.count} transactions.`, `Pausing similar ${merchant.name} spending next month could free up about ${money(merchant.amount)}.`, impact); return; }
    }

    const tooBroad = clean.split(" ").length < 4 || /^(help|what can i do|make a plan|save money)$/.test(clean);
    setResponse({ command: input, understood: tooBroad ? "I can help with that." : "I could not find that merchant or category in this sandbox history.", changed: tooBroad ? "Try telling Covarify a merchant, category, payment amount, or goal." : "Try a merchant from the transaction list, a category like Food and Drink, Shopping, or Entertainment, or “reduce Food and Drink by $100.”", impact: 0, remaining: Math.max(0, cashGap - cashFreed), caution: "Covarify is showing tradeoffs, not judging spending.", noMatch: true });
  };

  const applySuggested = () => { if (!suggestion) return; onApplySuggestion(suggestion); const impact = suggestion.reduce((sum, item) => sum + item.amount, 0); reply(command, `A suggested flexible-spending plan totaling about ${money(impact)}.`, "The suggested category reductions were applied to My Working Plan.", impact); setSuggestion(null); };

  return <section className="talk-covarify" aria-labelledby="talk-covarify-title">
    <div className="talk-heading"><span><MessageCircle size={20} /></span><div><p className="eyebrow plain">Conversational plan builder</p><h3 id="talk-covarify-title">Talk to Covarify</h3><p>Tell Covarify what you want to try. It will update the plan so you can see the tradeoff.</p></div></div>
    <form onSubmit={(event) => { event.preventDefault(); apply(); }}><label htmlFor="covarify-command">Try a plan change</label><div><input id="covarify-command" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Try: “Cut out Uber Eats this month” or “Reduce Food and Drink by $100”" /><button type="submit">Apply to my plan <ArrowRight size={15} /></button></div></form>
    <div className="command-chips" aria-label="Example commands">{examples.map((example) => <button type="button" key={example} onClick={() => apply(example)}>{example}</button>)}</div>
    {response && <div className={`command-response ${response.noMatch ? "no-match" : ""}`} aria-live="polite"><p><strong>You said:</strong> “{response.command}”</p><div><span><small>What Covarify understood</small><strong>{response.understood}</strong></span><span><small>What changed in the plan</small><strong>{response.changed}</strong></span><span><small>Estimated impact</small><strong>{money(response.impact)}</strong></span><span><small>Remaining gap</small><strong>{money(response.remaining)}</strong></span></div><p className="command-caution"><strong>Note:</strong> {response.caution}</p>{suggestion && <button type="button" className="apply-suggestion" onClick={applySuggested}><Check size={14} /> Apply suggested plan</button>}</div>}
  </section>;
}

// TODO: Add real AI-assisted command understanding, saved plans after authentication,
// encrypted user data storage, recurring merchant detection, Plaid Liabilities integration,
// compliance/legal review, and user confirmation before larger recommendations.
