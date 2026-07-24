import { createClient } from "@supabase/supabase-js";

import {
  annotateInternalTransfers,
  buildAccountAnalytics,
  buildMoneyPicture,
  classifyTransaction,
  type MoneyTransaction,
} from "../lib/money-picture.ts";
import { runMoneyPictureIntelligence } from "../lib/money-picture-intelligence.ts";
import { normalizePersistedPlaidCategory } from "../lib/plaid/category-normalization.ts";
import {
  answerObservationQuestion,
  buildObservationExplanation,
} from "../lib/money-picture-explanations.ts";
import { buildCanonicalScopedFinancialMetrics } from "../lib/money-picture-canonical-metrics.ts";

const url = process.env.SAFE_SUPABASE_URL;
const key = process.env.SAFE_SUPABASE_KEY;
if (!url || !key) throw new Error("SAFE_PREVIEW_CONFIG_MISSING");

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: items, error: itemError } = await db
  .from("plaid_items")
  .select("id,last_successful_sync_at")
  .eq("environment", "production")
  .eq("status", "active");
if (itemError || items.length !== 1) throw new Error("SAFE_ITEM_STATE_FAILED");
const item = items[0];

const [accountResult, transactionResult, syncResult] = await Promise.all([
  db
    .from("plaid_accounts")
    .select("id")
    .eq("plaid_item_id", item.id)
    .eq("active_status", "active"),
  db
    .from("plaid_transactions")
    .select(
      "id,plaid_account_id,transaction_name,merchant_name,amount,currency,transaction_date,pending,pending_transaction_id,category_data,removed_at",
    )
    .eq("plaid_item_id", item.id)
    .order("transaction_date", { ascending: false })
    .limit(1000),
  db
    .from("transaction_sync_states")
    .select("sync_status,last_sync_completed_at")
    .eq("plaid_item_id", item.id)
    .maybeSingle(),
]);
if (accountResult.error || transactionResult.error || syncResult.error) {
  throw new Error("SAFE_PREVIEW_READ_FAILED");
}

const accountAliases = new Map(
  (accountResult.data || []).map((account, index) => [
    account.id,
    {
      id: `selected-account-${String.fromCharCode(97 + index)}`,
      label: `Selected account ${String.fromCharCode(65 + index)}`,
    },
  ]),
);
const activeRows = (transactionResult.data || []).filter(
  (row) => row.removed_at === null && accountAliases.has(row.plaid_account_id),
);
const rows = annotateInternalTransfers(
  activeRows.map((row): MoneyTransaction => {
    const category = normalizePersistedPlaidCategory(row.category_data);
    const amount = Number(row.amount);
    const account = accountAliases.get(row.plaid_account_id)!;
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

const now = new Date("2026-07-23T12:00:00.000Z");
const canonical = buildCanonicalScopedFinancialMetrics(rows, {
  now,
  removedExcluded: (transactionResult.data || []).filter(
    (row) => row.removed_at !== null,
  ).length,
});
const periodRows = canonical.currentRows;
const picture = buildMoneyPicture(rows, now);
const periodAnalytics = buildAccountAnalytics(periodRows);

const metrics = {
  generatedAt: now.toISOString(),
  period: canonical.metrics.period,
  transactionCount: rows.length,
  pendingCount: rows.filter((row) => row.pending).length,
  removedCount: (transactionResult.data || []).filter(
    (row) => row.removed_at !== null,
  ).length,
  transferCount: rows.filter((row) =>
    ["transfer", "internal_transfer"].includes(classifyTransaction(row)),
  ).length,
  internalTransferCount: rows.filter(
    (row) => classifyTransaction(row) === "internal_transfer",
  ).length,
  identifiedInflows: canonical.metrics.current.inflows,
  identifiedOutflows: canonical.metrics.current.outflows,
  priorInflows: canonical.metrics.prior.inflows,
  priorOutflows: canonical.metrics.prior.outflows,
  largestExpense:
    periodRows
      .filter((row) => classifyTransaction(row) === "outflow")
      .reduce((largest, row) => Math.max(largest, row.amount), 0) || null,
  uncategorizedOutflow: periodRows
    .filter(
      (row) =>
        classifyTransaction(row) === "outflow" &&
        row.category === "Uncategorized",
    )
    .reduce((total, row) => total + row.amount, 0),
  categorizedOutflow: periodRows
    .filter(
      (row) =>
        classifyTransaction(row) === "outflow" &&
        row.category !== "Uncategorized",
    )
    .reduce((total, row) => total + row.amount, 0),
  completeMonths: picture.trend
    .slice(0, -1)
    .map((month) => ({ inflow: month.inflow, outflow: month.outflow })),
  accounts: periodAnalytics.map((account) => ({
    id: account.accountId,
    label: account.accountLabel,
    transactionCount: account.transactionCount,
    identifiedInflows: account.identifiedInflows,
    identifiedOutflows: account.identifiedOutflows,
    spendingShare: account.spendingShare / 100,
    depositShare: account.depositShare / 100,
    transferCount: account.transfersIn + account.transfersOut,
    currentBalance: null,
    availableBalance: null,
    lastActivityDate: account.lastActivityDate,
  })),
  syncStatus: syncResult.data?.sync_status || "pending",
  lastSyncAt:
    syncResult.data?.last_sync_completed_at ||
    item.last_successful_sync_at ||
    null,
  canonicalCashFlow: canonical.metrics,
};
const result = runMoneyPictureIntelligence(metrics);
const explanations = result.observations
  .map((observation) => buildObservationExplanation(observation, rows))
  .filter((payload) => payload !== null);
const storedStrings = activeRows.filter(
  (row) => typeof row.category_data === "string",
).length;
const normalizedPrimary = activeRows.filter(
  (row) => normalizePersistedPlaidCategory(row.category_data)?.primary,
).length;
const normalizedDetailed = activeRows.filter(
  (row) => normalizePersistedPlaidCategory(row.category_data)?.detailed,
).length;

console.log(
  JSON.stringify(
    {
      coverage: {
        activeRows: activeRows.length,
        storedStrings,
        normalizedPrimary,
        normalizedDetailed,
        mappedCategoryRows: rows.filter(
          (row) => row.category !== "Uncategorized",
        ).length,
        uncategorizedRows: rows.filter(
          (row) => row.category === "Uncategorized",
        ).length,
        postedMapped: rows.filter(
          (row) => !row.pending && row.category !== "Uncategorized",
        ).length,
        pendingMapped: rows.filter(
          (row) => row.pending && row.category !== "Uncategorized",
        ).length,
        removedExcluded: metrics.removedCount,
      },
      metrics: {
        transactions: metrics.transactionCount,
        pending: metrics.pendingCount,
        transfers: metrics.transferCount,
        internalTransfers: metrics.internalTransferCount,
        periodUncategorizedOutflow: Number(
          metrics.uncategorizedOutflow.toFixed(2),
        ),
        periodCategorizedOutflow: Number(
          metrics.categorizedOutflow.toFixed(2),
        ),
        canonicalCashFlow: canonical.metrics,
      },
      preview: {
        candidateCount: result.candidateCount,
        rejected: result.rejected,
        dataQualityStatus: result.dataQualityStatus,
        critical: result.criticalAlert?.ruleId || null,
        observations: result.observations.map((observation) => ({
          ruleId: observation.ruleId,
          title: observation.title,
          observed: observation.observed,
          meaning: observation.meaning,
          period: observation.period,
          support: observation.support,
          qualification: observation.qualification,
          question: observation.question,
          confidence: observation.confidence,
          score: observation.score,
        })),
        explanations: explanations.map((payload) => ({
          observationId: payload.observationId,
          ruleId: payload.ruleId,
          period: payload.period,
          accountScope: payload.accountScope,
          confidence: payload.confidence,
          supportingMetrics: payload.supportingMetrics,
          supportingCategories: payload.supportingCategories,
          supportingMerchants: payload.supportingMerchants.map(
            (merchant, index) => ({
              ...merchant,
              key: `merchant-${index + 1}`,
              label: `Merchant ${index + 1}`,
            }),
          ),
          supportingAccounts: payload.supportingAccounts,
          supportingTransactions: payload.supportingTransactions,
          signals: payload.signals,
          explanationBullets: payload.explanationBullets,
          supportedQuestions: payload.supportedQuestions,
        })),
        conversationExamples: explanations.flatMap((payload) =>
          payload.supportedQuestions
            .filter((question) =>
              [
                "categories_changed",
                "income_or_spending",
                "one_purchase",
                "operating_account",
                "bills_from_account",
              ].includes(question.id),
            )
            .slice(0, 2)
            .map((question) => ({
              observationId: payload.observationId,
              question: question.label,
              answer: answerObservationQuestion(payload, question.id),
            })),
        ),
      },
    },
    null,
    2,
  ),
);
