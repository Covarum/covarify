import type { ConversationContext, ResolvedConversationIntent } from "./types.ts";

export function routeConversationIntent(text: string, context?: ConversationContext | null): ResolvedConversationIntent {
  const evidence: string[] = [];
  const result = (type: ResolvedConversationIntent["type"], capability: string | null, factual: boolean, mutating: boolean, confidence: ResolvedConversationIntent["confidence"] = "high", unresolvedFields: string[] = []): ResolvedConversationIntent => ({ type, capability, factual, mutating, confidence, clarificationRequired: unresolvedFields.length > 0, evidence, unresolvedFields });
  const accountFollowUp = /\b(?:(?:which|what)\s+(?:card|account)|which account paid|where did (?:this|that|these|those|the)?\s*(?:payments?|purchases?|charges?)?\s*come from|did i use more than one (?:card|account))\b/i.test(text);
  if (accountFollowUp) { evidence.push("account follow-up language"); if (context?.transactionIds.length) { evidence.push("active prior evidence set"); return result("account_question", "summarize_accounts", true, false); } return result("account_question", "summarize_accounts", true, false, "medium", ["reference antecedent"]); }
  if (/\b(?:how many|how often|number of|count|times did i)\b/i.test(text)) { evidence.push("count question language"); return result("transaction_count", "count_transactions", true, false); }
  if (/\b(?:how much|total (?:spent|paid)|sum|what did i (?:spend|pay)|how much have i paid)\b/i.test(text)) { evidence.push("total question language"); return result("transaction_total", "total_transactions", true, false); }
  if (/\b(?:show me|show all|list|which transactions|every\b.+\bpayment|all purchases|all transactions)\b/i.test(text)) { evidence.push("list question language"); return result("transaction_list", "list_transactions", true, false); }
  if (/\b(?:always|future purchases|from now on)\b/i.test(text) && /\b(?:category|categorize|treat|food|shopping|groceries)\b/i.test(text)) { evidence.push("persistent merchant instruction"); return result("merchant_rule", "propose_merchant_rule", false, true); }
  if (/\b(?:gift|booking app|software|for\s+[A-Z][\p{L}'’-]+)\b/iu.test(text)) { evidence.push("named purpose or relationship statement"); return result("named_context_statement", "propose_named_context", false, true, "medium"); }
  evidence.push("no high-confidence deterministic route");
  return result("ambiguous", null, false, false, "low", ["intent"]);
}
