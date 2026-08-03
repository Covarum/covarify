import { resolveFinancialPeriod } from "../financial-periods.ts";
import type { ConversationContext, ConversationScope } from "./types.ts";

export function resolveConversationScope(text: string, now = new Date(), context?: ConversationContext | null, selectedTransactionId?: string | null): ConversationScope {
  if (selectedTransactionId) return { type: "specific_transaction", start: null, end: null, source: "visible_context", coverageLabel: "the selected transaction", limitations: [] };
  if (/\b(?:in this view|this observation|shown here)\b/i.test(text)) return { type: "visible_context", start: null, end: null, source: "visible_context", coverageLabel: "the current view", limitations: [] };
  const key = /\blast quarter\b/i.test(text) ? "last-quarter" : /\bthis quarter\b/i.test(text) ? "this-quarter" : /\blast month\b/i.test(text) ? "last-month" : /\bthis month\b/i.test(text) ? "this-month" : /\b(?:this year|year to date)\b/i.test(text) ? "year-to-date" : null;
  if (key) { const period = resolveFinancialPeriod({ key }, now); return { type: "explicit_period", start: period.start, end: period.end, source: "user", coverageLabel: period.label, limitations: [] }; }
  const custom = text.match(/\bfrom\s+(20\d{2}-\d{2}-\d{2})\s+(?:to|through)\s+(20\d{2}-\d{2}-\d{2})\b/i);
  if (custom) return { type: "explicit_period", start: custom[1], end: custom[2], source: "user", coverageLabel: `${custom[1]} through ${custom[2]}`, limitations: [] };
  if (/\b(?:which|what)\s+(?:card|account)\b/i.test(text) && context?.scope) return { ...context.scope, source: "prior_result" };
  return { type: "all_available_history", start: null, end: null, source: "default", coverageLabel: "the connected history currently available", limitations: ["Connected history may not include activity before an institution was linked."] };
}
