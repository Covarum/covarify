import {
  buildAccountAnalytics,
  buildMoneyPicture,
  classifyTransaction,
  type MoneyTransaction,
} from "./money-picture";
import {
  runMoneyPictureIntelligence,
  type IntelligenceMetrics,
} from "./money-picture-intelligence";

const DAY = 86400000;

export function buildMoneyPictureIntelligence(
  transactions: MoneyTransaction[],
  input: { syncStatus: string; lastSyncAt: string | null; now?: Date },
) {
  const now = input.now || new Date();
  const currentStart = new Date(now.getTime() - 30 * DAY);
  const priorStart = new Date(now.getTime() - 60 * DAY);
  const currentRows = transactions.filter(
    (transaction) =>
      new Date(`${transaction.date}T00:00:00Z`) >= currentStart,
  );
  const priorRows = transactions.filter((transaction) => {
    const date = new Date(`${transaction.date}T00:00:00Z`);
    return date >= priorStart && date < currentStart;
  });
  const sum = (
    rows: MoneyTransaction[],
    kind: "inflow" | "outflow",
  ) =>
    rows
      .filter((transaction) => classifyTransaction(transaction) === kind)
      .reduce(
        (total, transaction) =>
          total +
          (kind === "inflow"
            ? Math.abs(transaction.amount)
            : transaction.amount),
        0,
      );
  const analytics = buildAccountAnalytics(currentRows);
  const picture = buildMoneyPicture(transactions, now);

  const metrics: IntelligenceMetrics = {
    generatedAt: now.toISOString(),
    period: {
      currentStart: currentStart.toISOString().slice(0, 10),
      currentEnd: now.toISOString().slice(0, 10),
      priorStart: priorStart.toISOString().slice(0, 10),
      priorEnd: new Date(currentStart.getTime() - DAY)
        .toISOString()
        .slice(0, 10),
    },
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
    identifiedInflows: sum(currentRows, "inflow"),
    identifiedOutflows: sum(currentRows, "outflow"),
    priorInflows: sum(priorRows, "inflow"),
    priorOutflows: sum(priorRows, "outflow"),
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
  };

  return runMoneyPictureIntelligence(metrics);
}
