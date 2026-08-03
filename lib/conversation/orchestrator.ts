import type { MoneyTransaction } from "../money-picture.ts";
import { matchesHistoryMerchant } from "../transaction-history-query.ts";
import { createConversationContext, validConversationContext } from "./conversation-context.ts";
import { resolveConversationEntities } from "./entity-resolver.ts";
import { buildTransactionEvidence } from "./evidence-bundle.ts";
import { routeConversationIntent } from "./intent-router.ts";
import { planNamedContextProposal } from "./proposal-planner.ts";
import { transactionAnswer } from "./response-planner.ts";
import { resolveConversationScope } from "./scope-resolver.ts";
import { runTransactionQueryTool } from "./tool-registry.ts";
import type { ConversationEvidence, ConversationRequest, ConversationResponse } from "./types.ts";

const merchantFromText = (text: string) => (text.match(/\b(?:to|at|from|pay|paid)\s+(.+?)(?=\s+(?:this|last)\s+(?:month|quarter|year)\b|[?!.]|$)/i)?.[1] || text.match(/\b(?:show me(?:\s+my)?|show all|every)\s+(.+?)\s+(?:payments?|charges?|purchases?|transactions?)/i)?.[1] || null)?.trim() || null;
const currency = (value: number, code = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(value);
export function orchestrateConversation(input: ConversationRequest & { transactions: MoneyTransaction[] }): ConversationResponse {
  const now = input.now || new Date();
  const prior = validConversationContext(input.context, input.userId, input.sessionId, now);
  const intent = routeConversationIntent(input.text, prior);
  const scope = resolveConversationScope(input.text, now, prior, input.selectedTransactionId);
  const empty = (message: string): ConversationResponse => ({ kind: "clarification_question", message, intent, scope, evidence: null, context: prior });
  if (intent.type === "account_question" && prior) {
    const accounts = prior.accounts.map((account) => `${account.label}: ${account.count} ${account.count === 1 ? "payment" : "payments"}`).join("; ");
    return { kind: "direct_answer", message: accounts ? `You used ${accounts}.` : "I couldn't determine the account from that result.", intent, scope, evidence: null, context: prior };
  }
  if (["transaction_count", "transaction_total", "transaction_list"].includes(intent.type)) {
    const transactionIntent = intent.type as "transaction_count" | "transaction_total" | "transaction_list";
    const merchant = merchantFromText(input.text) || prior?.merchant;
    if (!merchant) return empty("Which merchant should I look for?");
    const historyIntent = transactionIntent === "transaction_count" ? "transaction_count_query" : transactionIntent === "transaction_total" ? "transaction_total_query" : "transaction_list_query";
    const answer = runTransactionQueryTool({ intent: historyIntent, merchant, scope, transactions: input.transactions });
    const ids = answer.purchases.map((row) => row.id);
    const context = createConversationContext({ userId: input.userId, sessionId: input.sessionId, merchant, scope, transactionIds: ids, count: answer.purchases.length, total: answer.total, accounts: answer.accounts, now });
    const evidence: ConversationEvidence = buildTransactionEvidence(answer.purchases, merchant, scope, now);
    const count = answer.purchases.length; const total = currency(answer.total, answer.purchases[0]?.currency || "USD");
    const message = transactionAnswer({ intent: transactionIntent, merchant, count, total, coverage: scope.coverageLabel });
    return { kind: transactionIntent === "transaction_list" ? "transaction_list" : "direct_answer", message: message + (answer.refunds.length ? ` ${answer.refunds.length} ${answer.refunds.length === 1 ? "refund was" : "refunds were"} kept separate.` : ""), intent, scope, evidence, context, actions: ids.length ? [{ type: "view_transactions", label: "View payments", transactionIds: ids, search: merchant, start: scope.start, end: scope.end }] : [] };
  }
  if (intent.type === "named_context_statement") {
    const entities = resolveConversationEntities(input.text); const amount = entities.find((entity) => entity.type === "amount");
    let ids = prior?.transactionIds || (input.selectedTransactionId ? [input.selectedTransactionId] : []);
    const namedService = input.text.match(/^([\p{L}0-9&.'’ -]{2,60}?)\s+is\s+(?:my\s+)?(?:booking app|software|service)\b/iu)?.[1]?.trim();
    if (!ids.length && namedService) ids = input.transactions.filter((row) => matchesHistoryMerchant(namedService, row)).map((row) => row.id);
    if (amount) ids = ids.filter((id) => { const row = input.transactions.find((transaction) => transaction.id === id); return row && Math.abs(Math.abs(row.amount) - Number(amount.value)) < .005; });
    if (ids.length !== 1) return { ...empty(ids.length ? "Which payment was it?" : "Which transaction did you mean?"), candidates: ids.slice(0, 4).map((id) => input.transactions.find((row) => row.id === id)).filter(Boolean).map((row) => ({ id: row!.id, name: row!.name, amount: row!.amount, currency: row!.currency, date: row!.date, accountLabel: row!.accountLabel })) };
    return { kind: "structured_proposal", message: "Here’s what I understood. Nothing will change unless you confirm it.", intent, scope, evidence: null, context: prior, proposal: planNamedContextProposal(input.text, entities, ids) };
  }
  return empty("What would you like to know or change about your financial activity?");
}
