import { createClient } from "@supabase/supabase-js";

import { buildFinancialEventLayer } from "../lib/financial-events.ts";
import {
  annotateInternalTransfers,
  type MoneyTransaction,
} from "../lib/money-picture.ts";
import { normalizePersistedPlaidCategory } from "../lib/plaid/category-normalization.ts";

const url =
  process.env.SAFE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SAFE_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SAFE_PREVIEW_CONFIG_MISSING");

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: items, error: itemError } = await db
  .from("plaid_items")
  .select("id")
  .eq("environment", "production")
  .eq("status", "active");
if (itemError || items.length !== 1) throw new Error("SAFE_ITEM_STATE_FAILED");

const [accountResult, transactionResult] = await Promise.all([
  db
    .from("plaid_accounts")
    .select("id,institution_name")
    .eq("plaid_item_id", items[0].id)
    .eq("active_status", "active"),
  db
    .from("plaid_transactions")
    .select(
      "id,plaid_account_id,transaction_name,merchant_name,amount,currency,transaction_date,pending,pending_transaction_id,category_data,removed_at",
    )
    .eq("plaid_item_id", items[0].id)
    .order("transaction_date", { ascending: false })
    .limit(1000),
]);
if (accountResult.error || transactionResult.error) {
  throw new Error("SAFE_EVENT_PREVIEW_READ_FAILED");
}

const accountAliases = new Map(
  (accountResult.data || []).map((account, index) => [
    account.id,
    {
      id: `selected-account-${String.fromCharCode(97 + index)}`,
      label: `Selected account ${String.fromCharCode(65 + index)}`,
      institution: account.institution_name
        ? `Connected institution ${index + 1}`
        : null,
    },
  ]),
);
const activeRows = (transactionResult.data || []).filter(
  (row) => row.removed_at === null && accountAliases.has(row.plaid_account_id),
);
const transactions = annotateInternalTransfers(
  activeRows.map((row): MoneyTransaction => {
    const category = normalizePersistedPlaidCategory(row.category_data);
    const account = accountAliases.get(row.plaid_account_id)!;
    const amount = Number(row.amount);
    return {
      id: String(row.id),
      plaidAccountId: account.id,
      accountLabel: account.label,
      name: String(row.merchant_name || row.transaction_name),
      amount,
      currency: String(row.currency || "USD"),
      date: String(row.transaction_date),
      pending: Boolean(row.pending),
      pendingTransactionId: row.pending_transaction_id
        ? String(row.pending_transaction_id)
        : null,
      category: category?.primary || "Uncategorized",
      detailedCategory: category?.detailed || null,
      direction: amount < 0 ? "inflow" : amount > 0 ? "outflow" : "neutral",
      transferRelationship: null,
    };
  }),
);
const layer = buildFinancialEventLayer(transactions, {
  institutionsByAccountId: Object.fromEntries(
    [...accountAliases.values()].map((account) => [
      account.id,
      account.institution,
    ]),
  ),
});
const events = layer.events;
const counts = <T extends string>(values: T[]) =>
  Object.fromEntries(
    [...new Set(values)].sort().map((value) => [
      value,
      values.filter((candidate) => candidate === value).length,
    ]),
  );
const grouped = events.filter((event) => event.relatedTransactionIds.length > 1);
const structuredCategories = activeRows
  .map((row) => row.category_data)
  .filter(
    (value) =>
      value && typeof value === "object" && !Array.isArray(value),
  ) as Array<Record<string, unknown>>;

console.log(JSON.stringify({
  source: {
    selectedAccounts: accountAliases.size,
    activeTransactions: activeRows.length,
    postedTransactions: transactions.filter((transaction) => !transaction.pending).length,
    pendingExcluded: transactions.filter((transaction) => transaction.pending).length,
  },
  historicalFieldCoverage: {
    primaryCategory: activeRows.filter(
      (row) => Boolean(normalizePersistedPlaidCategory(row.category_data)?.primary),
    ).length,
    detailedCategory: activeRows.filter(
      (row) => Boolean(normalizePersistedPlaidCategory(row.category_data)?.detailed),
    ).length,
    merchantName: activeRows.filter((row) => Boolean(row.merchant_name)).length,
    legacyStringCategory: activeRows.filter(
      (row) => typeof row.category_data === "string",
    ).length,
    structuredCategoryProvenance: structuredCategories.filter(
      (value) =>
        value.source === "personal_finance_category" ||
        value.source === "legacy_category",
    ).length,
    rawPlaidPayloadRetained: false,
  },
  metrics: layer.metrics,
  eventTypes: counts(events.map((event) => event.type)),
  confidence: counts(events.map((event) => event.confidence)),
  recurrence: counts(events.filter((event) => event.recurring).map((event) => event.recurring!.cadence)),
  grouping: {
    groupedEvents: grouped.length,
    transactionsInGroupedEvents: grouped.reduce((sum, event) => sum + event.relatedTransactionIds.length, 0),
  },
  examples: events.slice(0, 8).map((event, index) => ({
    example: index + 1,
    type: event.type,
    title: event.title,
    dateSpan: event.startDate === event.completionDate
      ? event.startDate
      : `${event.startDate} to ${event.completionDate}`,
    accountCount: event.relatedAccounts.length,
    transactionCount: event.relatedTransactionIds.length,
    direction: event.direction,
    confidence: event.confidence,
    recurringCadence: event.recurring?.cadence || null,
    ruleId: event.supportingEvidence.ruleId,
  })),
  classifiedActivity: counts(
    layer.classifiedActivity.map((activity) => activity.classification),
  ),
  unresolvedActivity: layer.unresolvedActivity.length,
  recurringPaymentReview: layer.recurringPaymentReview.map(
    (candidate, index) => ({
      alias: `Recurring candidate ${index + 1}`,
      proposedType: candidate.proposedType,
      observationCount: candidate.observationCount,
      firstObserved: candidate.firstObserved,
      lastObserved: candidate.lastObserved,
      typicalAmount: candidate.typicalAmount,
      amountVariability: candidate.amountVariability,
      cadence: candidate.cadence,
      confidence: candidate.confidence,
      accountLabel: candidate.account.label,
      ruleId: candidate.ruleId,
      reason: candidate.reason,
      alternativeClassification: candidate.alternativeClassification,
    }),
  ),
  groupingReview: {
    groupedEvents: grouped.map((event) => ({
      type: event.type,
      transactionCount: event.relatedTransactionIds.length,
      accountCount: event.relatedAccounts.length,
      dateSpan: `${event.startDate} to ${event.completionDate}`,
      confidence: event.confidence,
      ruleId: event.supportingEvidence.ruleId,
    })),
  },
  falsePositiveReview: {
    singleTransactionEvents: events.filter((event) => event.relatedTransactionIds.length === 1).length,
    groupedEvents: grouped.length,
    unresolvedRowsNotPromoted: layer.unresolvedActivity.length,
    recommendationIneligible: events.filter((event) => !event.futureRecommendationEligible).length,
    traceabilityComplete: events.every((event) => event.relatedTransactionIds.length > 0),
  },
}, null, 2));
