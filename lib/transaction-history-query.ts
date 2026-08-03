import { resolveFinancialPeriod, type ResolvedFinancialPeriod } from "./financial-periods.ts";
import type { MoneyTransaction } from "./money-picture.ts";

export type TransactionHistoryIntent = "transaction_count_query" | "transaction_total_query" | "transaction_list_query";
export type TransactionHistoryQuery = { intentType: TransactionHistoryIntent; merchant: string | null; periodKey: ResolvedFinancialPeriod["key"] | "all-connected-history" | null };

export const normalizeHistoryMerchant = (value: string) => value.normalize("NFKD").toUpperCase().replace(/[’']/g, "").replace(/[^A-Z0-9]+/g, " ").trim();
const compactMerchant = (value: string) => normalizeHistoryMerchant(value).replace(/\s+/g, "");

export function ambiguousHistoryMerchantNames(merchant: string, transactions: MoneyTransaction[]) {
  const requested = compactMerchant(merchant);
  const names = [...new Set(transactions.map((row) => row.merchantName || row.name).filter(Boolean))];
  const candidates = names.filter((name) => {
    const candidate = compactMerchant(name);
    return candidate === requested || candidate.startsWith(`${requested}OUTLET`) || candidate.startsWith(`${requested}STORE`);
  });
  const identities = new Set(candidates.map(compactMerchant));
  return identities.size > 1 ? candidates : [];
}

export function parseTransactionHistoryQuery(text: string): TransactionHistoryQuery | null {
  const intentType = /\b(?:how many|how often|number of|count|times did i)\b/i.test(text) ? "transaction_count_query"
    : /\b(?:how much|total (?:spent|paid)|sum|what did i (?:spend|pay)|how much have i paid)\b/i.test(text) ? "transaction_total_query"
      : /\b(?:show me|list|which transactions|every payment|all purchases|all transactions)\b/i.test(text) ? "transaction_list_query" : null;
  if (!intentType) return null;
  const match = text.match(/\b(?:payments?|charges?|purchases?|transactions?)\s+(?:were\s+made\s+)?(?:to|at|from)\s+(.+?)(?=\s+(?:this|last)\s+(?:month|quarter|year)\b|[?!.]|$)/i)
    || text.match(/\b(?:to|at|from|pay|paid)\s+(.+?)(?=\s+(?:this|last)\s+(?:month|quarter|year)\b|[?!.]|$)/i)
    || text.match(/\b(?:my\s+)?(.+?)\s+(?:payments?|charges?|purchases?|transactions?)(?=\s+(?:this|last|from)\b|[?!.]|$)/i);
  const periodKey = /\ball connected history\b/i.test(text) ? "all-connected-history" : /\blast quarter\b/i.test(text) ? "last-quarter" : /\bthis quarter\b/i.test(text) ? "this-quarter" : /\blast month\b/i.test(text) ? "last-month" : /\bthis month\b/i.test(text) ? "this-month" : /\b(?:this year|year to date)\b/i.test(text) ? "year-to-date" : null;
  return { intentType, merchant: match?.[1]?.trim().replace(/[?.!,]+$/, "") || null, periodKey };
}

const transfer = (row: MoneyTransaction) => row.transferRelationship !== null || /^(TRANSFER|LOAN_PAYMENTS)/i.test(row.sourceCategory || row.category);
const refund = (row: MoneyTransaction) => row.direction === "inflow" || /REFUND/i.test(row.sourceCategory || row.category);

export function answerTransactionHistoryQuery(input: { query: TransactionHistoryQuery; transactions: MoneyTransaction[]; activePeriod: ResolvedFinancialPeriod; now?: Date }) {
  const period = input.query.periodKey === "all-connected-history" ? null : input.query.periodKey ? resolveFinancialPeriod({ key: input.query.periodKey }, input.now) : input.activePeriod;
  const key = normalizeHistoryMerchant(input.query.merchant || "");
  const merchantRows = input.transactions.filter((row) => normalizeHistoryMerchant(row.merchantName || row.name) === key || normalizeHistoryMerchant(row.description || "") === key);
  const within = period ? merchantRows.filter((row) => row.date >= period.start && row.date <= period.end) : merchantRows;
  const postedPendingIds = new Set(within.filter((row) => !row.pending).map((row) => row.pendingTransactionId).filter(Boolean));
  const deduped = within.filter((row) => !row.pending || !postedPendingIds.has(row.id));
  const purchases = deduped.filter((row) => !row.pending && row.direction === "outflow" && !transfer(row));
  const refunds = deduped.filter((row) => !row.pending && refund(row) && !transfer(row));
  const accountCounts = new Map<string, number>();
  purchases.forEach((row) => accountCounts.set(row.accountLabel, (accountCounts.get(row.accountLabel) || 0) + 1));
  return { period, purchases, refunds, total: purchases.reduce((sum, row) => sum + Math.abs(row.amount), 0), refundTotal: refunds.reduce((sum, row) => sum + Math.abs(row.amount), 0), accounts: [...accountCounts].map(([label, count]) => ({ label, count })), hasEarlierActivity: Boolean(period && merchantRows.some((row) => row.date < period.start)) };
}
