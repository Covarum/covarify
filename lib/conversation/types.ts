import type { MoneyTransaction } from "../money-picture.ts";

export type ConversationIntentType =
  | "transaction_count" | "transaction_total" | "transaction_list"
  | "account_question" | "named_context_statement" | "transaction_correction"
  | "merchant_rule" | "ambiguous";
export type ConversationScopeType = "all_available_history" | "explicit_period" | "specific_transaction" | "visible_context" | "clarification_required";
export type ConversationEntity = { type: "merchant" | "person" | "business" | "purpose" | "amount" | "transaction_reference"; value: string; confidence: "high" | "medium"; canonicalId?: string | null };
export type ResolvedConversationIntent = { type: ConversationIntentType; confidence: "high" | "medium" | "low"; capability: string | null; factual: boolean; mutating: boolean; clarificationRequired: boolean; evidence: string[]; unresolvedFields: string[] };
export type ConversationScope = { type: ConversationScopeType; start: string | null; end: string | null; source: "user" | "prior_result" | "visible_context" | "default"; coverageLabel: string; limitations: string[] };
export type ConversationEvidence = { transactionIds: string[]; accountIds: string[]; merchant: string | null; period: { start: string | null; end: string | null; label: string }; sourceCategories: string[]; effectiveCategories: string[]; confidence: "high" | "medium" | "low"; freshness: string; limitations: string[] };
export type ConversationContext = { version: 1; sessionId: string; userId: string; expiresAt: string; merchant: string | null; scope: ConversationScope | null; transactionIds: string[]; count: number | null; total: number | null; accounts: Array<{ label: string; count: number }>; evidenceTimestamp: string; pendingStatement?: string | null; pendingEntities?: ConversationEntity[] };
export type ConversationProposal = { kind: "transaction_category" | "named_context"; title: string; values: Array<{ label: string; value: string }>; evidence: string[]; changes: string[]; unchanged: string[]; transactionIds: string[]; confirmationRequired: true };
export type ConversationResponse = { kind: "direct_answer" | "transaction_list" | "clarification_question" | "structured_proposal" | "no_match" | "error"; message: string; intent: ResolvedConversationIntent; scope: ConversationScope; evidence: ConversationEvidence | null; context: ConversationContext | null; proposal?: ConversationProposal; candidates?: Array<Pick<MoneyTransaction, "id" | "name" | "amount" | "currency" | "date" | "accountLabel">>; actions?: Array<{ type: "view_transactions"; label: string; transactionIds: string[]; search: string | null; start: string | null; end: string | null }> };
export type ConversationRequest = { text: string; userId: string; sessionId: string; now?: Date; activePeriod?: { label: string; start: string; end: string }; selectedTransactionId?: string | null; context?: ConversationContext | null };
