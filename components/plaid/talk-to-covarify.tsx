"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, MessageCircle, Mic, Square } from "lucide-react";
import { DecisionLedger } from "./decision-ledger";
import type { DecisionAction, DecisionDraft, DecisionRecord, DecisionRequestResult, DecisionScope, DecisionSource } from "./decision-ledger-types";

type SpeechResultEvent = { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string; confidence: number } }> };
type SpeechRecognizer = { continuous: boolean; interimResults: boolean; lang: string; onresult: ((event: SpeechResultEvent) => void) | null; onerror: ((event: { error: string }) => void) | null; onend: (() => void) | null; start: () => void; stop: () => void };
type SpeechRecognizerConstructor = new () => SpeechRecognizer;

declare global { interface Window { SpeechRecognition?: SpeechRecognizerConstructor; webkitSpeechRecognition?: SpeechRecognizerConstructor } }

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
  decisions: DecisionRecord[];
  onDecisionRequest: (draft: DecisionDraft, action: DecisionAction) => DecisionRequestResult;
  onDecisionConfirm: (id: string) => void;
  onDecisionSuggest: (id: string) => void;
  onDecisionDismiss: (id: string) => void;
  onDecisionUndo: (id: string) => void;
  onDecisionReview: (record: DecisionRecord) => void;
  onDecisionScope: (id: string, scope: DecisionScope, customDate?: string) => void;
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

export function TalkToCovarify({ categories, merchants, cashGap, cashFreed, decisions, onDecisionRequest, onDecisionConfirm, onDecisionSuggest, onDecisionDismiss, onDecisionUndo, onDecisionReview, onDecisionScope }: Props) {
  const [command, setCommand] = useState("");
  const [response, setResponse] = useState<ResponseState | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion[] | null>(null);
  const [voiceSupported] = useState(() => typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
  const [voiceActive, setVoiceActive] = useState(false);
  const [latestHeard, setLatestHeard] = useState("");
  const [voiceFeedback, setVoiceFeedback] = useState("Voice Mode is off.");
  const recognitionRef = useRef<SpeechRecognizer | null>(null);
  const voiceActiveRef = useRef(false);
  const applyRef = useRef<(raw?: string, source?: DecisionSource, confidence?: number) => void>(() => undefined);
  const willApplyRef = useRef<(raw: string) => boolean>(() => false);
  const examples = ["Cut out Uber Eats this month", "Reduce Food and Drink by $100", "Pay minimums this cycle"];

  const reply = (input: string, understood: string, changed: string, impact = 0, caution = "This models future choices if similar spending repeats. It does not judge past spending.") => setResponse({ command: input, understood, changed, impact, remaining: Math.max(0, cashGap - Math.max(0, cashFreed + impact)), caution });

  const request = (input: string, source: DecisionSource, confidence: number, action: DecisionAction, details: Partial<DecisionDraft> & Pick<DecisionDraft, "title" | "decision_type" | "explanation" | "previous_value" | "new_value">) => onDecisionRequest({
    title: details.title,
    interpreted_command: input,
    source,
    profile_name: source === "voice" ? "Unconfirmed speaker" : "Current user",
    decision_type: details.decision_type,
    affected_category: details.affected_category || "",
    affected_merchant: details.affected_merchant || "",
    affected_debt: details.affected_debt || "",
    estimated_cash_impact: details.estimated_cash_impact || 0,
    estimated_gap_impact: details.estimated_gap_impact || 0,
    confidence,
    requires_confirmation: source === "voice" || Boolean(details.requires_confirmation),
    explanation: details.explanation,
    previous_value: details.previous_value,
    new_value: details.new_value,
    preferred_status: details.preferred_status,
  }, action);

  const willApplyPlanChange = (input: string) => {
    const clean = normalize(input);
    if (/\b(minimum|min payments|minimum payments|full statement|statement balance|pay full)\b/.test(clean)) return true;
    if (clean.match(/(?:pay|payment)\s*\$?\s*\d+(?:\.\d+)?/)) return true;
    if (/\b(protect|do not count|dont count|dont cut|mark .* required)\b/.test(clean) && findMerchant(input, merchants)) return true;
    if (/\b(cut out|pause|stop|no)\b/.test(clean) && findMerchant(input, merchants)) return true;
    return Boolean(findCategory(input, categories) && (clean.match(/\d+(?:\.\d+)?\s*%/) || clean.match(/(?:by\s*)?\$\s*\d+(?:\.\d+)?|(?:by\s+)\d+(?:\.\d+)?/)));
  };

  const apply = (raw = command, source: DecisionSource = "typed", confidence = 1) => {
    const input = raw.trim();
    const clean = normalize(input);
    setCommand(input);
    setSuggestion(null);
    if (!clean) { reply(input, "I can help with that.", "Try telling Covarify a merchant, category, payment amount, or goal.", 0); return; }

    const protectedIntent = /\b(protect|do not count|dont count|dont cut|mark .* required)\b/.test(clean);
    if (protectedIntent) {
      const merchant = findMerchant(input, merchants);
      if (merchant) { request(input, source, confidence, { kind: "protect_merchant", category: merchant.category, merchant: merchant.name }, { title: `Protect ${merchant.name}`, decision_type: "protected_obligation", affected_category: merchant.category, affected_merchant: merchant.name, requires_confirmation: true, explanation: `${merchant.name} would be protected from savings calculations.`, previous_value: "Not protected", new_value: "Protected" }); reply(input, `${merchant.name} · ${merchant.category}`, "Pending confirmation. Nothing changed in the working plan yet.", 0, "Protect essentials first. Review and confirm this decision in the ledger."); return; }
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
      request(input, source === "voice" ? "voice" : "covarify_suggestion", confidence, { kind: "apply_suggestion", items: plan }, { title: `Free up about ${money(target)}`, decision_type: "multi_category_plan", affected_category: plan.map((item) => item.category).join(", "), estimated_cash_impact: target, estimated_gap_impact: Math.min(target, Math.max(0, cashGap - cashFreed)), requires_confirmation: true, preferred_status: "suggestion", explanation: `Preview reductions across ${plan.length} flexible categories.`, previous_value: "Current category plan", new_value: `Suggested ${money(target)} reduction plan` });
      const names = plan.slice(0, 2).map((item) => item.category).join(" and ");
      reply(input, `A goal of about ${money(target)}.`, `Covarify would look first at ${names || "the largest flexible categories"} because they are flexible and high-impact. Review the suggestion before applying it.`, 0, "You choose what feels realistic. Covarify is showing tradeoffs, not judging spending.");
      return;
    }

    if (/\b(minimum|min payments|minimum payments)\b/.test(clean)) { request(input, source, confidence, { kind: "set_payment", scenario: "minimums" }, { title: "Pay minimums this cycle", decision_type: "payment_strategy", affected_debt: "All modeled debts", requires_confirmation: true, preferred_status: "scenario_only", explanation: "Preview the cash-flow effect of minimum payments before applying it.", previous_value: "Current payment strategy", new_value: "Minimums only this cycle" }); reply(input, "Pay minimums only this cycle.", "Preview only. Use Apply to working plan in the Decision Ledger to confirm.", 0, "This may protect cash now but can increase interest if balances carry."); return; }
    if (/\b(full statement|statement balance|pay full)\b/.test(clean)) { request(input, source, confidence, { kind: "set_payment", scenario: "full" }, { title: "Pay full statement balance", decision_type: "payment_strategy", affected_debt: "All modeled debts", requires_confirmation: true, preferred_status: "scenario_only", explanation: "Preview the full-statement payment strategy before applying it.", previous_value: "Current payment strategy", new_value: "Full / statement balance" }); reply(input, "Pay the full statement balance.", "Preview only. Use Apply to working plan in the Decision Ledger to confirm.", 0, "Review the cash-flow tradeoff before applying a larger payment."); return; }
    const paymentMatch = clean.match(/(?:pay|payment)\s*\$?\s*(\d+(?:\.\d+)?)/);
    if (paymentMatch) { const amount = Number(paymentMatch[1]); request(input, source, confidence, { kind: "set_payment", scenario: "custom", amount }, { title: `Pay ${money(amount)} this cycle`, decision_type: "payment_strategy", affected_debt: "All modeled debts", requires_confirmation: true, preferred_status: "scenario_only", explanation: "Preview a custom payment amount before applying it.", previous_value: "Current payment strategy", new_value: `Custom payment of ${money(amount)}` }); reply(input, `A custom payment of ${money(amount)}.`, "Preview only. Use Apply to working plan in the Decision Ledger to confirm.", 0, "Protect essential bills and required minimums first."); return; }

    const category = findCategory(input, categories);
    const percentMatch = clean.match(/(\d+(?:\.\d+)?)\s*%/);
    const amountMatch = clean.match(/(?:by\s*)?\$\s*(\d+(?:\.\d+)?)|(?:by\s+)(\d+(?:\.\d+)?)/);
    if (category && (percentMatch || amountMatch)) {
      const amount = Math.min(category.currentSpend, percentMatch ? category.currentSpend * Number(percentMatch[1]) / 100 : Number(amountMatch?.[1] || amountMatch?.[2]));
      const impact = amount - category.currentReduction;
      const requiresConfirmation = amount >= 500 || amount >= category.currentSpend * .5 || (cashGap > 0 && impact >= Math.max(1, cashGap - cashFreed) * .8);
      const result = request(input, source, confidence, { kind: "set_reduction", category: category.name, amount }, { title: `Reduce ${category.name} by ${money(amount)}`, decision_type: "category_reduction", affected_category: category.name, estimated_cash_impact: impact, estimated_gap_impact: Math.min(Math.max(0, impact), Math.max(0, cashGap - cashFreed)), requires_confirmation: requiresConfirmation, explanation: `Set the ${category.name} reduction target to ${money(amount)}.`, previous_value: money(category.currentReduction), new_value: money(amount) });
      reply(input, `${category.name} · ${percentMatch ? `${percentMatch[1]}%` : money(amount)}`, result.applied ? `${category.name} reduction set to ${money(amount)}. Applied to your working plan.` : "Pending confirmation. Nothing changed in the working plan yet.", result.applied ? impact : 0);
      return;
    }

    const pauseIntent = /\b(cut out|pause|stop|no)\b/.test(clean);
    if (pauseIntent) {
      const merchant = findMerchant(input, merchants);
      if (merchant) { const categoryState = categories.find((item) => item.name === merchant.category); const impact = Math.max(0, merchant.amount - (categoryState?.currentReduction || 0)); const result = request(input, source, confidence, { kind: "pause_merchant", category: merchant.category, merchant: merchant.name, amount: merchant.amount }, { title: `Pause ${merchant.name} this month`, decision_type: "merchant_pause", affected_category: merchant.category, affected_merchant: merchant.name, estimated_cash_impact: impact, estimated_gap_impact: Math.min(impact, Math.max(0, cashGap - cashFreed)), requires_confirmation: cashGap > 0 && impact >= Math.max(1, cashGap - cashFreed) * .8, explanation: `Pause similar ${merchant.name} spending for the selected scope.`, previous_value: "Active spending", new_value: `Paused · ${money(merchant.amount)} modeled` }); reply(input, `${merchant.name} · ${merchant.category} · ${money(merchant.amount)} across ${merchant.count} transactions.`, result.applied ? `Pausing similar ${merchant.name} spending could free up about ${money(merchant.amount)}. Applied to your working plan.` : `Pending confirmation. Review the request to pause ${merchant.name} in the Decision Ledger.`, result.applied ? impact : 0); return; }
    }

    const tooBroad = clean.split(" ").length < 4 || /^(help|what can i do|make a plan|save money)$/.test(clean);
    setResponse({ command: input, understood: tooBroad ? "I can help with that." : "I could not find that merchant or category in this sandbox history.", changed: tooBroad ? "Try telling Covarify a merchant, category, payment amount, or goal." : "Try a merchant from the transaction list, a category like Food and Drink, Shopping, or Entertainment, or “reduce Food and Drink by $100.”", impact: 0, remaining: Math.max(0, cashGap - cashFreed), caution: "Covarify is showing tradeoffs, not judging spending.", noMatch: true });
  };

  useEffect(() => { applyRef.current = apply; willApplyRef.current = willApplyPlanChange; });

  useEffect(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result.isFinal) continue;
        const heard = result[0].transcript.trim();
        if (!heard) continue;
        const wakePattern = /\b(?:hey\s+covarify|ask\s+covarify|hey\s+cova)\b[\s,.:;!?-]*/i;
        const hasWakePhrase = wakePattern.test(heard);
        const stripped = heard.replace(wakePattern, "").trim();
        setLatestHeard(stripped || heard);
        if (hasWakePhrase && stripped) {
          const changesPlan = willApplyRef.current(stripped);
          applyRef.current(stripped, "voice", result[0].confidence);
          setVoiceFeedback(changesPlan ? "Pending confirmation. The working plan was not changed." : "Nothing was applied. Review Covarify’s response below.");
        } else {
          setCommand(heard);
          setVoiceFeedback(result[0].confidence >= 0.85 ? "High-confidence transcript ready. Select Apply to Plan to confirm." : "Transcript ready. Review it, then select Apply to Plan.");
        }
      }
    };
    recognition.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") setVoiceFeedback("Voice input paused. Restart Voice Mode or keep typing.");
    };
    recognition.onend = () => {
      if (voiceActiveRef.current) {
        try { recognition.start(); } catch { setVoiceFeedback("Voice input paused. Select Start Voice Mode to resume."); }
      }
    };
    recognitionRef.current = recognition;
    return () => { voiceActiveRef.current = false; recognition.stop(); recognitionRef.current = null; };
  }, []);

  const toggleVoice = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (voiceActiveRef.current) {
      voiceActiveRef.current = false;
      setVoiceActive(false);
      setVoiceFeedback("Voice Mode is off.");
      recognition.stop();
      return;
    }
    try {
      recognition.start();
      voiceActiveRef.current = true;
      setVoiceActive(true);
      setVoiceFeedback("Listening for “Hey Covarify”…");
    } catch { setVoiceFeedback("Voice input could not start. Check microphone permission and try again."); }
  };

  return <section className="talk-covarify" aria-labelledby="talk-covarify-title">
    <div className="talk-heading"><span><MessageCircle size={20} /></span><div><p className="eyebrow plain">Conversational plan builder</p><h3 id="talk-covarify-title">Talk to Covarify</h3><p>Tell Covarify what you want to try. It will update the plan so you can see the tradeoff.</p></div></div>
    <div className={`voice-mode ${voiceActive ? "is-listening" : ""}`}>
      <div className="voice-mode-top"><div><strong><Mic size={15} /> Voice Mode</strong><p>Voice Mode listens while this page is open. You can turn it off anytime.</p></div><button type="button" onClick={toggleVoice} disabled={voiceSupported !== true} aria-label={voiceActive ? "Stop Voice Mode microphone" : "Start Voice Mode microphone"} aria-pressed={voiceActive}>{voiceActive ? <><Square size={12} /> Stop Voice Mode</> : <><Mic size={14} /> Start Voice Mode</>}</button></div>
      {voiceSupported === false ? <p className="voice-unsupported">Voice input is not supported in this browser yet. You can still type to Covarify.</p> : <div className="voice-status" aria-live="polite"><span className="voice-dot" aria-hidden="true" /><strong>{voiceActive ? "Listening" : "Mic off"}</strong><span>{voiceFeedback}</span>{latestHeard && <span>Heard: “{latestHeard}”</span>}</div>}
      <p className="voice-privacy">Voice input is processed only for this session and is not saved. Some browsers may process speech recognition through their own speech service.</p>
    </div>
    <form onSubmit={(event) => { event.preventDefault(); apply(); }}><label htmlFor="covarify-command">Try a plan change</label><div><input id="covarify-command" value={command} onChange={(event) => setCommand(event.target.value)} placeholder="Try: “Cut out Uber Eats this month” or “Reduce Food and Drink by $100”" /><button type="submit">Apply to my plan <ArrowRight size={15} /></button></div></form>
    <div className="command-chips" aria-label="Example commands">{examples.map((example) => <button type="button" key={example} onClick={() => apply(example)}>{example}</button>)}</div>
    {response && <div className={`command-response ${response.noMatch ? "no-match" : ""}`} aria-live="polite"><p><strong>You said:</strong> “{response.command}”</p><div><span><small>What Covarify understood</small><strong>{response.understood}</strong></span><span><small>What changed in the plan</small><strong>{response.changed}</strong></span><span><small>Estimated impact</small><strong>{money(response.impact)}</strong></span><span><small>Remaining gap</small><strong>{money(response.remaining)}</strong></span></div><p className="command-caution"><strong>Note:</strong> {response.caution}</p>{suggestion && <a className="ledger-jump" href="#decision-ledger"><Check size={14} /> Review suggested plan</a>}</div>}
    <DecisionLedger records={decisions} onConfirm={onDecisionConfirm} onEdit={(record) => { setCommand(record.interpreted_command); document.getElementById("covarify-command")?.focus(); }} onSuggest={onDecisionSuggest} onDismiss={onDecisionDismiss} onUndo={onDecisionUndo} onReview={onDecisionReview} onScope={onDecisionScope} />
  </section>;
}

// TODO: Add real AI-assisted command understanding, saved plans after authentication,
// encrypted user data storage, recurring merchant detection, Plaid Liabilities integration,
// compliance/legal review, and user confirmation before larger recommendations.
// TODO(voice): Add an on-device custom wake word engine, speaker-aware wake phrase,
// native app voice mode, stricter privacy review, user wake phrase settings,
// and LLM-powered command interpretation.
