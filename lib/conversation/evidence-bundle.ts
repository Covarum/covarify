import type { MoneyTransaction } from "../money-picture.ts";
import type { ConversationEvidence, ConversationScope } from "./types.ts";

export function buildTransactionEvidence(rows: MoneyTransaction[], merchant: string, scope: ConversationScope, now = new Date()): ConversationEvidence {
  return { transactionIds: rows.map((row) => row.id), accountIds: [...new Set(rows.map((row) => row.plaidAccountId))], merchant, period: { start: scope.start, end: scope.end, label: scope.coverageLabel }, sourceCategories: [...new Set(rows.map((row) => row.sourceCategory || row.category))], effectiveCategories: [...new Set(rows.map((row) => row.effectiveParentCategory || row.category))], confidence: "high", freshness: now.toISOString(), limitations: scope.limitations };
}
