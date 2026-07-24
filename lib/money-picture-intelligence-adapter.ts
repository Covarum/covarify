import {
  buildAccountAnalytics,
  buildMoneyPicture,
  classifyTransaction,
  type MoneyTransaction,
} from "./money-picture.ts";
import {
  runMoneyPictureIntelligence,
  type IntelligenceMetrics,
} from "./money-picture-intelligence.ts";
import { buildObservationExplanation } from "./money-picture-explanations.ts";
import { buildCanonicalScopedFinancialMetrics } from "./money-picture-canonical-metrics.ts";

export function buildMoneyPictureIntelligence(
  transactions: MoneyTransaction[],
  input: { syncStatus: string; lastSyncAt: string | null; now?: Date },
) {
  const now = input.now || new Date();
  const canonical = buildCanonicalScopedFinancialMetrics(transactions, {
    now,
  });
  const { currentRows } = canonical;
  const analytics = buildAccountAnalytics(currentRows);
  const picture = buildMoneyPicture(transactions, now);

  const metrics: IntelligenceMetrics = {
    generatedAt: now.toISOString(),
    period: canonical.metrics.period,
    transactionCount: transactions.length,
    pendingCount: transactions.filter((transaction) => transaction.pending)
      .length,
    removedCount: 0,
    transferCount: transactions.filter((transaction) =>
      ["transfer", "internal_transfer"].includes(
        classifyTransaction(transaction),
      ),
    ).length,
    internalTransferCount: transactions.filter(
      (transaction) =>
        classifyTransaction(transaction) === "internal_transfer",
    ).length,
    identifiedInflows: canonical.metrics.current.inflows,
    identifiedOutflows: canonical.metrics.current.outflows,
    priorInflows: canonical.metrics.prior.inflows,
    priorOutflows: canonical.metrics.prior.outflows,
    largestExpense:
      currentRows
        .filter(
          (transaction) => classifyTransaction(transaction) === "outflow",
        )
        .reduce(
          (largest, transaction) => Math.max(largest, transaction.amount),
          0,
        ) || null,
    uncategorizedOutflow: currentRows
      .filter(
        (transaction) =>
          classifyTransaction(transaction) === "outflow" &&
          transaction.category === "Uncategorized",
      )
      .reduce((total, transaction) => total + transaction.amount, 0),
    categorizedOutflow: currentRows
      .filter(
        (transaction) =>
          classifyTransaction(transaction) === "outflow" &&
          transaction.category !== "Uncategorized",
      )
      .reduce((total, transaction) => total + transaction.amount, 0),
    completeMonths: picture.trend
      .slice(0, -1)
      .map((month) => ({ inflow: month.inflow, outflow: month.outflow })),
    accounts: analytics.map((account) => ({
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
    syncStatus: input.syncStatus,
    lastSyncAt: input.lastSyncAt,
    canonicalCashFlow: canonical.metrics,
  };

  return runMoneyPictureIntelligence(metrics);
}

export function buildMoneyPictureIntelligenceBundle(
  transactions: MoneyTransaction[],
  input: { syncStatus: string; lastSyncAt: string | null; now?: Date },
) {
  const intelligence = buildMoneyPictureIntelligence(transactions, input);
  const explanations = [
    ...(intelligence.criticalAlert ? [intelligence.criticalAlert] : []),
    ...intelligence.observations,
  ]
    .map((observation) =>
      buildObservationExplanation(observation, transactions),
    )
    .filter((payload) => payload !== null);
  return { intelligence, explanations };
}
