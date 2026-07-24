import {
  classifyTransaction,
  type MoneyTransaction,
} from "./money-picture.ts";
import type { InsightCandidate } from "./money-picture-intelligence.ts";
import type { CanonicalScopedFinancialMetrics } from "./money-picture-canonical-metrics.ts";

export type ExplanationMetric = {
  key: string;
  label: string;
  current: number | null;
  prior: number | null;
  change: number | null;
  unit: "currency" | "count" | "percentage";
};

export type ExplanationContributor = {
  key: string;
  label: string;
  current: number;
  prior: number;
  change: number;
  transactionCount: number;
};

export type ExplanationAccount = {
  accountScope: string;
  label: string;
  outflowShare: number;
  inflowShare: number;
  recurringBillCount: number;
  recurringDepositCount: number;
  transferCount: number;
};

export type SupportingTransactionGroup = {
  groupKey: string;
  kind: "category" | "merchant" | "largest_expense";
  count: number;
  aggregateAmount: number;
  accountScope: string[];
};

export type SupportedQuestion = {
  id: string;
  label: string;
};

export type ObservationExplanationPayload = {
  observationId: string;
  ruleId: string;
  generatedAt: string;
  period: string;
  accountScope: string[];
  confidence: number;
  canonicalMetrics?: CanonicalScopedFinancialMetrics;
  supportingMetrics: ExplanationMetric[];
  supportingCategories: ExplanationContributor[];
  supportingMerchants: ExplanationContributor[];
  supportingAccounts: ExplanationAccount[];
  supportingTransactions: SupportingTransactionGroup[];
  signals: {
    unusualSpending: ExplanationContributor[];
    unusualIncomeChange: {
      flagged: boolean;
      current: number;
      prior: number;
      change: number;
      threshold: number;
    } | null;
    largestExpense: number | null;
  };
  explanationBullets: string[];
  supportedQuestions: SupportedQuestion[];
};

export type ConversationAnswer = {
  questionId: string;
  heading: string;
  answer: string;
  evidence: string[];
  qualification: string;
};

const DAY = 86400000;
const utcDay = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
const pct = (value: number) => `${Math.round(value)}%`;
const categoryLabel = (value: string) =>
  value
    .toLowerCase()
    .split("_")
    .map((word) => `${word[0]?.toUpperCase() || ""}${word.slice(1)}`)
    .join(" ");
const normalizedMerchant = (transaction: MoneyTransaction) =>
  transaction.name.trim().toLowerCase();
const rowsInRange = (
  rows: MoneyTransaction[],
  start: Date,
  end: Date,
) =>
  rows.filter((row) => {
    const date = new Date(`${row.date}T00:00:00Z`);
    return date >= start && date <= end;
  });
const sum = (
  rows: MoneyTransaction[],
  kind: "inflow" | "outflow",
) =>
  rows
    .filter((row) => classifyTransaction(row) === kind)
    .reduce(
      (total, row) =>
        total + (kind === "inflow" ? Math.abs(row.amount) : row.amount),
      0,
    );

function contributors(
  current: MoneyTransaction[],
  prior: MoneyTransaction[],
  group: (row: MoneyTransaction) => string,
  kind: "inflow" | "outflow",
) {
  const keys = new Set([
    ...current.filter((row) => classifyTransaction(row) === kind).map(group),
    ...prior.filter((row) => classifyTransaction(row) === kind).map(group),
  ]);
  return [...keys]
    .map((key): ExplanationContributor => {
      const currentRows = current.filter(
        (row) => classifyTransaction(row) === kind && group(row) === key,
      );
      const priorRows = prior.filter(
        (row) => classifyTransaction(row) === kind && group(row) === key,
      );
      const currentAmount = currentRows.reduce(
        (total, row) => total + Math.abs(row.amount),
        0,
      );
      const priorAmount = priorRows.reduce(
        (total, row) => total + Math.abs(row.amount),
        0,
      );
      return {
        key,
        label: key,
        current: currentAmount,
        prior: priorAmount,
        change: currentAmount - priorAmount,
        transactionCount: currentRows.length,
      };
    })
    .filter((item) => Math.abs(item.change) >= 25)
    .sort(
      (left, right) =>
        Math.abs(right.change) - Math.abs(left.change) ||
        left.key.localeCompare(right.key),
    );
}

function recurringCount(
  rows: MoneyTransaction[],
  accountId: string,
  kind: "inflow" | "outflow",
) {
  const groups = new Map<string, MoneyTransaction[]>();
  rows
    .filter(
      (row) =>
        row.plaidAccountId === accountId &&
        classifyTransaction(row) === kind,
    )
    .forEach((row) => {
      const key = normalizedMerchant(row);
      groups.set(key, [...(groups.get(key) || []), row]);
    });
  return [...groups.values()].filter((group) => {
    if (group.length < 2) return false;
    const dates = group
      .map((row) => new Date(`${row.date}T00:00:00Z`).getTime())
      .sort((a, b) => a - b);
    return dates.some((date, index) => {
      if (index === 0) return false;
      const days = (date - dates[index - 1]) / DAY;
      return days >= 20 && days <= 40;
    });
  }).length;
}

function recurringContributors(
  rows: MoneyTransaction[],
  accountId: string,
  kind: "inflow" | "outflow",
) {
  const groups = new Map<string, MoneyTransaction[]>();
  rows
    .filter(
      (row) =>
        row.plaidAccountId === accountId &&
        classifyTransaction(row) === kind,
    )
    .forEach((row) => {
      const key = normalizedMerchant(row);
      groups.set(key, [...(groups.get(key) || []), row]);
    });
  return [...groups]
    .filter(([, group]) => {
      if (group.length < 2) return false;
      const dates = group
        .map((row) => new Date(`${row.date}T00:00:00Z`).getTime())
        .sort((a, b) => a - b);
      return dates.some((date, index) => {
        if (index === 0) return false;
        const days = (date - dates[index - 1]) / DAY;
        return days >= 20 && days <= 40;
      });
    })
    .map(([key, group]) => ({
      key: `${kind}:${key}`,
      label: group[0].name,
      current: group.reduce(
        (total, transaction) => total + Math.abs(transaction.amount),
        0,
      ),
      prior: 0,
      change: group.reduce(
        (total, transaction) => total + Math.abs(transaction.amount),
        0,
      ),
      transactionCount: group.length,
    }));
}

function accountEvidence(rows: MoneyTransaction[]) {
  const accountIds = [...new Set(rows.map((row) => row.plaidAccountId))];
  const totalOutflow = sum(rows, "outflow");
  const totalInflow = sum(rows, "inflow");
  return accountIds.map((accountId): ExplanationAccount => {
    const accountRows = rows.filter(
      (row) => row.plaidAccountId === accountId,
    );
    return {
      accountScope: accountId,
      label: accountRows[0]?.accountLabel || "Connected account",
      outflowShare: totalOutflow
        ? sum(accountRows, "outflow") / totalOutflow
        : 0,
      inflowShare: totalInflow ? sum(accountRows, "inflow") / totalInflow : 0,
      recurringBillCount: recurringCount(rows, accountId, "outflow"),
      recurringDepositCount: recurringCount(rows, accountId, "inflow"),
      transferCount: accountRows.filter((row) =>
        ["transfer", "internal_transfer"].includes(
          classifyTransaction(row),
        ),
      ).length,
    };
  });
}

function cashFlowExplanation(
  observation: InsightCandidate,
  rows: MoneyTransaction[],
): ObservationExplanationPayload {
  const generated = new Date(observation.generatedAt);
  const currentEnd = utcDay(generated);
  const currentStart = new Date(currentEnd.getTime() - 30 * DAY);
  const priorStart = new Date(currentEnd.getTime() - 60 * DAY);
  const priorEnd = new Date(currentStart.getTime() - DAY);
  const current = rowsInRange(rows, currentStart, currentEnd);
  const prior = rowsInRange(rows, priorStart, priorEnd);
  const canonical = observation.canonicalMetrics;
  const currentInflows = canonical?.current.inflows ?? sum(current, "inflow");
  const priorInflows = canonical?.prior.inflows ?? sum(prior, "inflow");
  const currentOutflows =
    canonical?.current.outflows ?? sum(current, "outflow");
  const priorOutflows = canonical?.prior.outflows ?? sum(prior, "outflow");
  const currentNet =
    canonical?.current.net ?? currentInflows - currentOutflows;
  const priorNet = canonical?.prior.net ?? priorInflows - priorOutflows;
  const netChange = currentNet - priorNet;
  const categoryChanges = contributors(
    current,
    prior,
    (row) => row.category,
    "outflow",
  )
    .slice(0, 5)
    .map((item) => ({ ...item, label: categoryLabel(item.label) }));
  const merchantChanges = contributors(
    current,
    prior,
    normalizedMerchant,
    "outflow",
  ).slice(0, 5);
  const largestExpense = current
    .filter((row) => classifyTransaction(row) === "outflow")
    .sort((left, right) => right.amount - left.amount)[0];
  const transferCount =
    canonical?.current.transfersExcluded ??
    current.filter((row) =>
      ["transfer", "internal_transfer"].includes(
        classifyTransaction(row),
      ),
    ).length;
  const spendingChange = currentOutflows - priorOutflows;
  const incomeChange = currentInflows - priorInflows;
  const unusualSpending = categoryChanges.filter(
    (item) =>
      item.change >= 100 &&
      (item.prior === 0 || item.current >= item.prior * 1.5),
  );
  const incomeChangeThreshold = Math.max(250, priorInflows * .2);
  const bullets = [
    `Identified outflows ${spendingChange >= 0 ? "increased" : "decreased"} by ${money(Math.abs(spendingChange))}.`,
    `Identified inflows ${incomeChange >= 0 ? "increased" : "decreased"} by ${money(Math.abs(incomeChange))}.`,
  ];
  if (categoryChanges[0]) {
    bullets.push(
      `${categoryChanges[0].label} was the largest category change at ${money(Math.abs(categoryChanges[0].change))}.`,
    );
  }
  if (transferCount) {
    bullets.push(
      `${transferCount} transfer entries were excluded from income and spending.`,
    );
  }

  return {
    observationId: observation.observationId,
    ruleId: observation.ruleId,
    generatedAt: observation.generatedAt,
    period: observation.period,
    accountScope: observation.accountScope,
    confidence: observation.confidence,
    canonicalMetrics: observation.canonicalMetrics,
    supportingMetrics: [
      {
        key: "inflows",
        label: "Identified inflows",
        current: currentInflows,
        prior: priorInflows,
        change: incomeChange,
        unit: "currency",
      },
      {
        key: "outflows",
        label: "Identified outflows",
        current: currentOutflows,
        prior: priorOutflows,
        change: spendingChange,
        unit: "currency",
      },
      {
        key: "net_cash_flow",
        label: "Identified net cash flow",
        current: currentNet,
        prior: priorNet,
        change: netChange,
        unit: "currency",
      },
      {
        key: "transfer_exclusions",
        label: "Transfer entries excluded",
        current: transferCount,
        prior: null,
        change: null,
        unit: "count",
      },
    ],
    supportingCategories: categoryChanges,
    supportingMerchants: merchantChanges,
    supportingAccounts: accountEvidence(current),
    supportingTransactions: largestExpense
      ? [
          {
            groupKey: "largest-expense",
            kind: "largest_expense",
            count: 1,
            aggregateAmount: largestExpense.amount,
            accountScope: [largestExpense.plaidAccountId],
          },
        ]
      : [],
    signals: {
      unusualSpending,
      unusualIncomeChange: {
        flagged: Math.abs(incomeChange) >= incomeChangeThreshold,
        current: currentInflows,
        prior: priorInflows,
        change: incomeChange,
        threshold: incomeChangeThreshold,
      },
      largestExpense: largestExpense?.amount || null,
    },
    explanationBullets: bullets,
    supportedQuestions: [
      { id: "income_change", label: "Show me the income change" },
      { id: "spending_change", label: "Show me the spending change" },
      { id: "categories_changed", label: "What categories changed most?" },
      { id: "one_purchase", label: "Did one purchase cause this?" },
      { id: "compare_periods", label: "Compare the two periods" },
    ],
  };
}

function operatingAccountExplanation(
  observation: InsightCandidate,
  rows: MoneyTransaction[],
): ObservationExplanationPayload {
  const generated = utcDay(new Date(observation.generatedAt));
  const current = rowsInRange(
    rows,
    new Date(generated.getTime() - 30 * DAY),
    generated,
  );
  const accounts = accountEvidence(current).sort(
    (left, right) => right.outflowShare - left.outflowShare,
  );
  const primary = accounts[0];
  const recurringBills = primary
    ? recurringContributors(
        current,
        primary.accountScope,
        "outflow",
      )
    : [];
  const recurringDeposits = primary
    ? recurringContributors(
        current,
        primary.accountScope,
        "inflow",
      )
    : [];
  return {
    observationId: observation.observationId,
    ruleId: observation.ruleId,
    generatedAt: observation.generatedAt,
    period: observation.period,
    accountScope: observation.accountScope,
    confidence: observation.confidence,
    supportingMetrics: primary
      ? [
          {
            key: "outflow_share",
            label: "Share of identified outflow",
            current: primary.outflowShare * 100,
            prior: null,
            change: null,
            unit: "percentage",
          },
          {
            key: "inflow_share",
            label: "Share of identified inflow",
            current: primary.inflowShare * 100,
            prior: null,
            change: null,
            unit: "percentage",
          },
          {
            key: "recurring_bills",
            label: "Identified recurring bill patterns",
            current: primary.recurringBillCount,
            prior: null,
            change: null,
            unit: "count",
          },
          {
            key: "recurring_deposits",
            label: "Identified recurring deposit patterns",
            current: primary.recurringDepositCount,
            prior: null,
            change: null,
            unit: "count",
          },
        ]
      : [],
    supportingCategories: [],
    supportingMerchants: [...recurringBills, ...recurringDeposits],
    supportingAccounts: accounts,
    supportingTransactions: [],
    signals: {
      unusualSpending: [],
      unusualIncomeChange: null,
      largestExpense: null,
    },
    explanationBullets: primary
      ? [
          `${primary.label} handled ${pct(primary.outflowShare * 100)} of identified outflow in this period.`,
          `${pct(primary.inflowShare * 100)} of identified inflow arrived in this account.`,
          `The account has ${primary.recurringBillCount} identified recurring bill patterns and ${primary.transferCount} transfer entries in the period.`,
          "This appears to function as a primary operating account; the role is inferred, not assigned.",
        ]
      : [],
    supportedQuestions: [
      { id: "income_to_account", label: "Which income arrives here?" },
      {
        id: "bills_from_account",
        label: "Which recurring payments use this account?",
      },
      {
        id: "operating_account",
        label: "How is this account used?",
      },
      {
        id: "move_bills",
        label: "Should I move my bills?",
      },
      {
        id: "recommendation_needs",
        label: "What would Covarify need to know before recommending a change?",
      },
    ],
  };
}

export function buildObservationExplanation(
  observation: InsightCandidate,
  transactions: MoneyTransaction[],
) {
  if (observation.ruleId === "cashflow.material_change") {
    return cashFlowExplanation(observation, transactions);
  }
  if (observation.ruleId === "account.outflow_concentration") {
    return operatingAccountExplanation(observation, transactions);
  }
  return null;
}

export function answerObservationQuestion(
  payload: ObservationExplanationPayload,
  questionId: string,
): ConversationAnswer | null {
  if (!payload.supportedQuestions.some((question) => question.id === questionId)) {
    return null;
  }
  const metric = (key: string) =>
    payload.supportingMetrics.find((item) => item.key === key);
  if (questionId === "income_change" || questionId === "spending_change") {
    const selected =
      questionId === "income_change" ? metric("inflows") : metric("outflows");
    const subject =
      questionId === "income_change"
        ? "Identified inflows"
        : "Identified outflows";
    return {
      questionId,
      heading:
        questionId === "income_change" ? "Income change" : "Spending change",
      answer:
        selected?.change == null
          ? `There is not enough current evidence to compare ${subject.toLowerCase()}.`
          : `${subject} ${selected.change >= 0 ? "increased" : "decreased"} by approximately ${money(Math.abs(selected.change))}.`,
      evidence:
        selected?.current == null || selected.prior == null
          ? []
          : [
              `Current period: ${money(selected.current)}.`,
              `Previous period: ${money(selected.prior)}.`,
            ],
      qualification:
        "Based on identified, posted activity; transfers, refunds, and pending activity are excluded.",
    };
  }
  if (questionId === "categories_changed") {
    const categories = payload.supportingCategories.slice(0, 3);
    return {
      questionId,
      heading: "Category changes",
      answer: categories.length
        ? "These categories contributed most to the period-over-period change."
        : "No category change crossed the evidence threshold.",
      evidence: categories.map(
        (item) =>
          `${item.label}: ${item.change >= 0 ? "up" : "down"} ${money(Math.abs(item.change))}.`,
      ),
      qualification: "Based on categorized, non-transfer, posted activity.",
    };
  }
  if (questionId === "merchants_increased") {
    const merchants = payload.supportingMerchants
      .filter((item) => item.change > 0)
      .slice(0, 3);
    return {
      questionId,
      heading: "Merchant changes",
      answer: merchants.length
        ? "These merchant aggregates increased most in the current period."
        : "No merchant increase crossed the evidence threshold.",
      evidence: merchants.map(
        (item) => `${item.label}: up ${money(item.change)} across ${item.transactionCount} current-period transactions.`,
      ),
      qualification: "Merchant names are shown only for this requested drill-down.",
    };
  }
  if (questionId === "income_or_spending") {
    const inflows = metric("inflows");
    const outflows = metric("outflows");
    const incomeEffect = Math.abs(inflows?.change || 0);
    const spendingEffect = Math.abs(outflows?.change || 0);
    return {
      questionId,
      heading: "Income versus spending",
      answer:
        incomeEffect > spendingEffect
          ? "The larger aggregate effect came from the change in identified inflows."
          : "The larger aggregate effect came from the change in identified outflows.",
      evidence: [
        `Identified inflows changed by ${money(incomeEffect)}.`,
        `Identified outflows changed by ${money(spendingEffect)}.`,
      ],
      qualification: "Transfers, refunds, and pending activity are excluded.",
    };
  }
  if (questionId === "compare_periods") {
    const inflows = metric("inflows");
    const outflows = metric("outflows");
    const net = metric("net_cash_flow");
    return {
      questionId,
      heading: "Period comparison",
      answer:
        Math.abs(inflows?.change || 0) > Math.abs(outflows?.change || 0)
          ? "The larger change between the two periods came from identified inflows."
          : "The larger change between the two periods came from identified outflows.",
      evidence: [
        `Identified net cash flow moved from ${money(net?.prior || 0)} to ${money(net?.current || 0)}.`,
        `Identified inflows changed by ${money(Math.abs(inflows?.change || 0))}.`,
        `Identified outflows changed by ${money(Math.abs(outflows?.change || 0))}.`,
      ],
      qualification:
        "This comparison uses the same complete periods and excludes transfers, refunds, and pending activity.",
    };
  }
  if (questionId === "one_purchase" || questionId === "without_largest_expense") {
    const largest = payload.supportingTransactions.find(
      (item) => item.kind === "largest_expense",
    );
    const net = metric("net_cash_flow")?.current || 0;
    return {
      questionId,
      heading: "Largest-expense comparison",
      answer: largest
        ? questionId === "without_largest_expense"
          ? `Without the largest identified expense, estimated net cash flow would have been approximately ${money(net + largest.aggregateAmount)}.`
          : "The largest identified expense contributed to the result, but it did not by itself explain the full period-over-period change."
        : "No qualifying expense was available for this comparison.",
      evidence: largest
        ? [
            `Largest identified expense: ${money(largest.aggregateAmount)}.`,
            `Current identified net cash flow: ${money(net)}.`,
          ]
        : [],
      qualification: "This is a comparison, not a recommendation or prediction.",
    };
  }
  const primary = payload.supportingAccounts[0];
  if (
    questionId === "bills_from_account" ||
    questionId === "income_to_account" ||
    questionId === "operating_account" ||
    questionId === "move_bills" ||
    questionId === "recommendation_needs"
  ) {
    const evidence = primary
      ? [
          `${pct(primary.outflowShare * 100)} of identified outflow used this account.`,
          `${pct(primary.inflowShare * 100)} of identified inflow used this account.`,
          `${primary.recurringBillCount} recurring bill patterns were identified.`,
          `${primary.transferCount} transfer entries were identified.`,
        ]
      : [];
    const answers: Record<string, string> = {
      bills_from_account:
        payload.supportingMerchants.length
          ? `${payload.supportingMerchants.length} recurring bill patterns appear to use this account.`
          : "No recurring bill pattern crossed the deterministic evidence threshold for this account.",
      income_to_account:
        payload.supportingMerchants.some((item) =>
          item.key.startsWith("inflow:"),
        )
          ? `${payload.supportingMerchants.filter((item) => item.key.startsWith("inflow:")).length} recurring deposit patterns appear to arrive in this account.`
          : "No recurring deposit pattern crossed the deterministic evidence threshold for this account.",
      operating_account:
        "This account appears to function as the primary operating account based on its share of identified outflow and inflow. That role is inferred, not assigned.",
      move_bills:
        "Covarify cannot reliably estimate that from the current evidence alone. A destination account, explicit bill set, balance context, and cash-flow requirements would be needed before comparing the effect.",
      recommendation_needs:
        "Covarify would need a user-selected destination account, an explicit bill set, balance context, cash-flow requirements, and the user's goals before comparing a change.",
    };
    return {
      questionId,
      heading:
        questionId === "operating_account"
          ? "Operating-account pattern"
          : "Account-use explanation",
      answer: answers[questionId],
      evidence:
        questionId === "bills_from_account" &&
        payload.supportingMerchants.some((item) =>
          item.key.startsWith("outflow:"),
        )
          ? payload.supportingMerchants
              .filter((item) => item.key.startsWith("outflow:"))
              .map(
              (item) =>
                `${item.label}: ${item.transactionCount} matching payments totaling ${money(item.current)} in the observed period.`,
              )
          : questionId === "income_to_account" &&
              payload.supportingMerchants.some((item) =>
                item.key.startsWith("inflow:"),
              )
            ? payload.supportingMerchants
                .filter((item) => item.key.startsWith("inflow:"))
                .map(
                  (item) =>
                    `${item.label}: ${item.transactionCount} matching deposits totaling ${money(item.current)} in the observed period.`,
                )
            : evidence,
      qualification:
        "This explains observed account use and does not recommend switching accounts.",
    };
  }
  return null;
}
