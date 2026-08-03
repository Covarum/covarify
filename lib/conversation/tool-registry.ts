import type { MoneyTransaction } from "../money-picture.ts";
import { answerTransactionHistoryQuery, type TransactionHistoryIntent } from "../transaction-history-query.ts";
import { assertReadOnlyTool } from "./safety-policy.ts";
import type { ConversationScope } from "./types.ts";

export function runTransactionQueryTool(input: { intent: TransactionHistoryIntent; merchant: string; scope: ConversationScope; transactions: MoneyTransaction[] }) {
  assertReadOnlyTool(true);
  return answerTransactionHistoryQuery({ query: { intentType: input.intent, merchant: input.merchant, periodKey: input.scope.type === "all_available_history" ? "all-connected-history" : null, customPeriod: input.scope.start && input.scope.end ? { label: input.scope.coverageLabel, start: input.scope.start, end: input.scope.end } : null }, transactions: input.transactions, activePeriod: { key: "custom", label: input.scope.coverageLabel, start: input.scope.start || "0001-01-01", end: input.scope.end || "9999-12-31", priorStart: input.scope.start || "0001-01-01", priorEnd: input.scope.end || "9999-12-31", asOf: input.scope.end || "9999-12-31", futureKind: "custom" } });
}
