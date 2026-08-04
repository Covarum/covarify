import type { MoneyTransaction } from "../money-picture.ts";
import { matchesHistoryMerchant } from "../transaction-history-query.ts";
import { createConversationContext, validConversationContext } from "./conversation-context.ts";
import { resolveConversationEntities } from "./entity-resolver.ts";
import { buildTransactionEvidence } from "./evidence-bundle.ts";
import { routeConversationIntent } from "./intent-router.ts";
import { planNamedContextProposal } from "./proposal-planner.ts";
import { transactionAnswer } from "./response-planner.ts";
import { selectNextBestStep } from "./next-best-step.ts";
import { resolveConversationScope } from "./scope-resolver.ts";
import { runTransactionQueryTool } from "./tool-registry.ts";
import type { ConversationEvidence, ConversationRequest, ConversationResponse } from "./types.ts";

const merchantFromText = (text: string) => (text.match(/\b(?:to|at|from|pay|paid)\s+(.+?)(?=\s+(?:this|last)\s+(?:month|quarter|year)\b|[?!.]|$)/i)?.[1] || text.match(/\b(?:show me(?:\s+my)?|show all|every)\s+(.+?)\s+(?:payments?|charges?|purchases?|transactions?)/i)?.[1] || null)?.trim() || null;
const currency = (value: number, code = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(value);
const naturalAccountLabel = (label: string) => {
  const parts = label.split(/\s*[·•]\s*/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 && /^\d{4}$/.test(parts.at(-1)!) ? `${parts.slice(0, -1).join(" ")} ending in ${parts.at(-1)}` : label;
};
const naturalAccountAnswer = (accounts: Array<{ label: string; count: number }>) => {
  const parts = accounts.map((account) => `${naturalAccountLabel(account.label)} for ${account.count === 1 ? "one payment" : `${account.count} payments`}`);
  return parts.length === 1 ? `You used ${parts[0]}.` : parts.length === 2 ? `You used ${parts[0]} and ${parts[1].replace(/ for one payment$/, " for the other")}.` : `You used ${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}.`;
};
export function orchestrateConversation(input: ConversationRequest & { transactions: MoneyTransaction[] }): ConversationResponse {
  const now = input.now || new Date();
  const prior = validConversationContext(input.context, input.userId, input.sessionId, now);
  const intent = routeConversationIntent(input.text, prior);
  const scope = resolveConversationScope(input.text, now, prior, input.selectedTransactionId);
  const empty = (message: string): ConversationResponse => ({ kind: "clarification_question", message, intent, scope, evidence: null, context: prior, nextBestStep: selectNextBestStep({ missingInputs: intent.unresolvedFields.length ? intent.unresolvedFields : ["clarification"] }) });
  const pendingPerson = prior?.pendingEntities?.find((entity) => entity.type === "person");
  const relationship = input.text.match(/^\s*(?:he|she|they|caleb\s+is)?\s*my\s+(son|daughter|child|spouse|partner|friend)\s*[.!]?\s*$/i)?.[1];
  if (pendingPerson && relationship) {
    const relationshipName = `${relationship[0].toUpperCase()}${relationship.slice(1).toLowerCase()}`;
    return { kind: "structured_proposal", message: `I can remember that ${pendingPerson.value} is your ${relationship.toLowerCase()}, but only after you confirm it.`, intent, scope, evidence: null, context: { ...prior!, pendingStatement: input.text }, nextBestStep: selectNextBestStep({ transactionProposalReady: true }), proposal: { kind: "named_context", title: "Proposed person relationship", values: [{ label: "Person", value: pendingPerson.value }, { label: "Relationship", value: relationshipName }], evidence: [input.text], changes: ["Your confirmed person relationship memory"], unchanged: ["The transaction classification", "Other people and relationships"], transactionIds: prior!.transactionIds, confirmationRequired: true, memoryCandidate: { type: "person_relationship", scope: "user", subject: pendingPerson.value, relationship: relationship.toLowerCase(), sourceStatement: input.text, evidenceIds: prior!.transactionIds, effectiveDate: now.toISOString(), status: "proposed", confidence: "high", supersedesId: null, revocable: true, retrievalRule: "confirmed_only" } } };
  }
  if (intent.type === "account_question" && prior) {
    return { kind: "direct_answer", message: prior.accounts.length ? naturalAccountAnswer(prior.accounts) : "I couldn't determine the account from that result.", intent, scope, evidence: null, context: prior, nextBestStep: selectNextBestStep({ evidenceIds: prior.transactionIds }) };
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
    return { kind: transactionIntent === "transaction_list" ? "transaction_list" : "direct_answer", message: message + (answer.refunds.length ? ` ${answer.refunds.length} ${answer.refunds.length === 1 ? "refund was" : "refunds were"} kept separate.` : ""), intent, scope, evidence, context, nextBestStep: selectNextBestStep({ evidenceIds: ids }), actions: ids.length ? [{ type: "view_transactions", label: "View payments", transactionIds: ids, search: merchant, start: scope.start, end: scope.end }] : [] };
  }
  if (intent.type === "named_context_statement") {
    const entities = resolveConversationEntities(input.text); const amount = entities.find((entity) => entity.type === "amount");
    let ids = prior?.transactionIds || (input.selectedTransactionId ? [input.selectedTransactionId] : []);
    const namedService = input.text.match(/^([\p{L}0-9&.'’ -]{2,60}?)\s+is\s+(?:my\s+)?(?:booking app|software|service)\b/iu)?.[1]?.trim();
    if (!ids.length && namedService) ids = input.transactions.filter((row) => matchesHistoryMerchant(namedService, row)).map((row) => row.id);
    if (amount) ids = ids.filter((id) => { const row = input.transactions.find((transaction) => transaction.id === id); return row && Math.abs(Math.abs(row.amount) - Number(amount.value)) < .005; });
    if (ids.length !== 1) return { ...empty(ids.length ? "Which payment was it?" : "Which transaction did you mean?"), candidates: ids.slice(0, 4).map((id) => input.transactions.find((row) => row.id === id)).filter(Boolean).map((row) => ({ id: row!.id, name: row!.name, amount: row!.amount, currency: row!.currency, date: row!.date, accountLabel: row!.accountLabel })) };
    const personEntities = entities.filter((entity) => entity.type === "person");
    const nextContext = prior ? { ...prior, pendingStatement: input.text, pendingEntities: personEntities } : null;
    return { kind: "structured_proposal", message: personEntities.length ? "Here’s the transaction update I understood. Who is Caleb? Relationship memory stays separate and nothing changes without confirmation." : "Here’s what I understood. Nothing will change unless you confirm it.", intent, scope, evidence: null, context: nextContext, nextBestStep: selectNextBestStep({ evidenceIds: ids, transactionProposalReady: true }), proposal: planNamedContextProposal(input.text, entities, ids) };
  }
  return empty("What would you like to know or change about your financial activity?");
}
