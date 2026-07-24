import {
  classifyTransaction,
  type MoneyTransaction,
} from "./money-picture.ts";

const DAY = 86400000;

export type CanonicalScopedFinancialMetrics = {
  ruleVersion: "cashflow-v1";
  period: {
    currentStart: string;
    currentEnd: string;
    priorStart: string;
    priorEnd: string;
  };
  accountScope: string[];
  current: {
    transactionsConsidered: number;
    pendingExcluded: number;
    transfersExcluded: number;
    refundsReversalsExcluded: number;
    inflows: number;
    outflows: number;
    net: number;
  };
  prior: {
    transactionsConsidered: number;
    pendingExcluded: number;
    transfersExcluded: number;
    refundsReversalsExcluded: number;
    inflows: number;
    outflows: number;
    net: number;
  };
  removedExcluded: number;
  absoluteChange: number;
  confidence: number;
};

const utcDay = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

const dateValue = (transaction: MoneyTransaction) =>
  new Date(`${transaction.date}T00:00:00Z`);

const summarize = (rows: MoneyTransaction[]) => {
  const inflows = rows
    .filter((row) => classifyTransaction(row) === "inflow")
    .reduce((total, row) => total + Math.abs(row.amount), 0);
  const outflows = rows
    .filter((row) => classifyTransaction(row) === "outflow")
    .reduce((total, row) => total + row.amount, 0);
  return {
    transactionsConsidered: rows.length,
    pendingExcluded: rows.filter(
      (row) => classifyTransaction(row) === "pending",
    ).length,
    transfersExcluded: rows.filter((row) =>
      ["transfer", "internal_transfer"].includes(classifyTransaction(row)),
    ).length,
    refundsReversalsExcluded: rows.filter(
      (row) => classifyTransaction(row) === "refund",
    ).length,
    inflows,
    outflows,
    net: inflows - outflows,
  };
};

export function buildCanonicalScopedFinancialMetrics(
  transactions: MoneyTransaction[],
  input: {
    now: Date;
    accountScope?: string[];
    removedExcluded?: number;
    confidence?: number;
  },
) {
  const currentEnd = utcDay(input.now);
  const currentStart = new Date(currentEnd.getTime() - 30 * DAY);
  const priorStart = new Date(currentEnd.getTime() - 60 * DAY);
  const priorEnd = new Date(currentStart.getTime() - DAY);
  const accountScope = (
    input.accountScope?.length
      ? input.accountScope
      : [...new Set(transactions.map((row) => row.plaidAccountId))]
  )
    .slice()
    .sort();
  const scoped = transactions.filter((row) =>
    accountScope.includes(row.plaidAccountId),
  );
  const currentRows = scoped.filter((row) => {
    const date = dateValue(row);
    return date >= currentStart && date <= currentEnd;
  });
  const priorRows = scoped.filter((row) => {
    const date = dateValue(row);
    return date >= priorStart && date <= priorEnd;
  });
  const current = summarize(currentRows);
  const prior = summarize(priorRows);
  const metrics: CanonicalScopedFinancialMetrics = {
    ruleVersion: "cashflow-v1",
    period: {
      currentStart: currentStart.toISOString().slice(0, 10),
      currentEnd: currentEnd.toISOString().slice(0, 10),
      priorStart: priorStart.toISOString().slice(0, 10),
      priorEnd: priorEnd.toISOString().slice(0, 10),
    },
    accountScope,
    current,
    prior,
    removedExcluded: input.removedExcluded || 0,
    absoluteChange: Math.abs(current.net - prior.net),
    confidence: input.confidence ?? .88,
  };
  return { metrics, currentRows, priorRows };
}
