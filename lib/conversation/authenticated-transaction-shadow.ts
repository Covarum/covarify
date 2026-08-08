import { assertAuthorizedTruth, type CanonicalFinancialTruth } from "./financial-truth.ts";
import { orchestrateConversation } from "./orchestrator.ts";
import type { ConversationContext, ConversationResponse } from "./types.ts";
import type { CovarifyTurn } from "./turn-contract.ts";
export type AuthenticatedTransactionShadow = { passed: boolean; checks: Record<"intent" | "entity" | "scope" | "evidence" | "facts" | "decision" | "response" | "actions" | "confirmation" | "nextBestStep", boolean>; failedChecks: string[] };
export function compareAuthenticatedTransactionShadow(input: { truth: CanonicalFinancialTruth; authenticatedUserId: string; sessionId: string; statement: string; selectedTransactionId?: string | null; context?: ConversationContext | null; activePeriod?: { label: string; start: string; end: string }; authoritativeTurn: CovarifyTurn; authoritativeLegacy: ConversationResponse }): AuthenticatedTransactionShadow {
  assertAuthorizedTruth(input.truth, input.authenticatedUserId); const selected = input.selectedTransactionId && input.truth.transactions.some((item) => item.id === input.selectedTransactionId) ? input.selectedTransactionId : null; const context = input.context?.userId === input.authenticatedUserId && input.context.sessionId === input.sessionId ? input.context : null;
  const legacy = orchestrateConversation({ text: input.statement, userId: input.authenticatedUserId, sessionId: input.sessionId, selectedTransactionId: selected, context, activePeriod: input.activePeriod, transactions: input.truth.transactions, dataMode: "connected" }); const legacyEvidence = legacy.evidence?.transactionIds || legacy.context?.transactionIds || legacy.proposal?.transactionIds || []; const turnEvidence = input.authoritativeTurn.evidence.references.map((item) => item.sourceId.replace(/^transaction:/, ""));
  const expectedIntent = legacy.intent.type === "transaction_count" ? "TRANSACTION_COUNT" : legacy.intent.type === "transaction_total" ? "TRANSACTION_TOTAL" : legacy.intent.type === "transaction_list" ? "TRANSACTION_LIST" : legacy.intent.type === "account_question" ? "ACCOUNT_QUESTION" : legacy.proposal ? "TRANSACTION_MEANING" : "UNRESOLVED"; const expectedScope = legacy.scope.type === "all_available_history" ? "ALL_AVAILABLE_HISTORY" : legacy.scope.type === "explicit_period" ? "EXPLICIT_PERIOD" : legacy.scope.type === "specific_transaction" ? "SPECIFIC_TRANSACTION" : legacy.scope.type === "visible_context" ? "VISIBLE_CONTEXT" : "CLARIFICATION_REQUIRED";
  const referenced = input.authoritativeTurn.understanding.referencedEntityIds;
  const legacyActions = legacy.actions || [];
  const count = input.authoritativeTurn.decision.quantified.find((item) => item.label === "Transaction count")?.value;
  const total = input.authoritativeTurn.decision.quantified.find((item) => item.label === "Transaction total")?.value;
  const checks = {
    intent: input.authoritativeTurn.understanding.intent === expectedIntent,
    entity: legacyEvidence.length === referenced.length && legacyEvidence.every((id) => referenced.includes(id)),
    scope: input.authoritativeTurn.understanding.scopeDetail === expectedScope,
    evidence: legacyEvidence.length === turnEvidence.length && legacyEvidence.every((id) => turnEvidence.includes(id)),
    facts: input.authoritativeTurn.decision.factsConsidered.every((fact) => legacyEvidence.includes(fact.entityId)) && count === (legacy.context?.count || legacyEvidence.length) && total === legacy.context?.total,
    decision: input.authoritativeTurn.decision.type === (legacy.proposal ? "TRANSACTION_MEANING" : "TRANSACTION_UNDERSTANDING") && input.authoritativeTurn.decision.confidence === legacy.intent.confidence && input.authoritativeTurn.decision.answer?.summary === legacy.message,
    response: input.authoritativeTurn.response.primaryMessage === legacy.message && input.authoritativeLegacy.message === legacy.message,
    actions: input.authoritativeTurn.actions.length === legacyActions.length && legacyActions.every((action, index) => input.authoritativeTurn.actions[index]?.label === action.label && input.authoritativeTurn.actions[index]?.payload.kind === "show_evidence" && input.authoritativeTurn.actions[index]?.payload.evidenceGroupId === action.transactionIds.join(":")),
    confirmation: input.authoritativeTurn.actions.every((action) => action.confirmation === "none" && action.consequence === "READ_ONLY"),
    nextBestStep: input.authoritativeTurn.next.bestStep === legacy.nextBestStep.label,
  };
  const failedChecks = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name); return { passed: failedChecks.length === 0, checks, failedChecks };
}
