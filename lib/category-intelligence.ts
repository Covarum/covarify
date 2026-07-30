import type { ResolvedFinancialPeriod } from "./financial-periods.ts";
import type { FinancialEvent } from "./financial-events.ts";
import {
  classifyTransaction,
  formatCategoryLabel,
  type MoneyTransaction,
} from "./money-picture.ts";

export const CATEGORY_INSIGHT_RULE_VERSION =
  "category-intelligence-v1-preview-2026-07-28";

export type CategoryAccountEvidence = {
  accountLabel: string;
  amount: number;
  share: number;
  transactionCount: number;
};

export type CategorySubcategoryEvidence = {
  label: string;
  amount: number;
  transactionCount: number;
  inferred: boolean;
};

export type CategoryInsight = {
  categoryId: string;
  displayLabel: string;
  activePeriod: Pick<ResolvedFinancialPeriod, "label" | "start" | "end">;
  priorPeriod: { label: string; priorStart: string; priorEnd: string };
  currentAmount: number;
  priorAmount: number;
  currentShare: number;
  priorShare: number;
  transactionCount: number;
  accountDistribution: CategoryAccountEvidence[];
  relatedEventIds: string[];
  relatedEventCount: number;
  largestContributor: { label: string; amount: number; share: number } | null;
  dominantContributors: Array<{ label: string | null; amount: number; share: number }>;
  supportingTransactionIds: string[];
  subcategories: CategorySubcategoryEvidence[];
  confidence: "high" | "medium";
  ruleVersion: string;
  comparison:
    | "increased"
    | "decreased"
    | "similar"
    | "new"
    | "insufficient";
  changeAmount: number;
  changePercentage: number | null;
  meaning: string;
};

export type CategoryIntelligencePayload = {
  totalIdentifiedSpending: number;
  interpretation: string | null;
  categories: CategoryInsight[];
  ruleVersion: string;
};

const labelCategory = (value: string) =>
  formatCategoryLabel(value) || "Uncategorized";

const roundMoney = (value: number) => Math.round(value * 100) / 100;

const safeMerchantDisplayName = (value: string | null | undefined) => {
  const name = value?.trim() || "";
  if (
    !name ||
    /^(?:unknown|redacted|not available|merchant)$/i.test(name) ||
    /^(?:merchant|mrc|plaid)[_-]?[a-z0-9]{6,}$/i.test(name) ||
    /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(name)
  ) return null;
  return name;
};

const categoryKey = (transaction: MoneyTransaction) =>
  transaction.category || "Uncategorized";

const foodDetail = (
  transaction: MoneyTransaction,
): { label: string; inferred: boolean } | null => {
  if (transaction.effectiveSubcategory) {
    return { label: transaction.effectiveSubcategory, inferred: false };
  }
  const detail = transaction.detailedCategory?.toUpperCase() || "";
  if (detail.includes("GROCER")) return { label: "Groceries", inferred: false };
  if (detail.includes("COFFEE")) return { label: "Coffee", inferred: false };
  if (detail.includes("FAST_FOOD"))
    return { label: "Fast food", inferred: false };
  if (detail.includes("BEER") || detail.includes("WINE") || detail.includes("LIQUOR"))
    return { label: "Alcohol", inferred: false };
  if (detail.includes("RESTAURANT") || detail.includes("DINING"))
    return { label: "Dining", inferred: false };
  return detail ? { label: "Other food and drink", inferred: false } : null;
};

const comparisonFor = (current: number, prior: number) => {
  if (prior < 1) return current > 0 ? ("new" as const) : ("insufficient" as const);
  const ratio = Math.abs(current - prior) / prior;
  if (ratio < 0.05) return "similar" as const;
  return current > prior ? ("increased" as const) : ("decreased" as const);
};

function categoryMeaning(
  insight: Pick<
    CategoryInsight,
    | "comparison"
    | "categoryId"
    | "largestContributor"
    | "currentAmount"
    | "accountDistribution"
    | "displayLabel"
    | "activePeriod"
    | "dominantContributors"
  >,
  rank: number,
) {
  const dominantShare = insight.dominantContributors.reduce(
    (total, contributor) => total + contributor.share,
    0,
  );
  if (insight.dominantContributors.length && dominantShare >= 60) {
    const names = insight.dominantContributors
      .map((contributor) => contributor.label)
      .filter((label): label is string => Boolean(label));
    const subject = names.length === insight.dominantContributors.length
      ? names.length === 1
        ? names[0]
        : `${names.slice(0, -1).join(", ")} and ${names.at(-1)} together`
      : insight.dominantContributors.length === 1
        ? "One merchant"
        : "Two merchants together";
    const period = `${insight.activePeriod.label.charAt(0).toLowerCase()}${insight.activePeriod.label.slice(1)}`;
    return `${subject} accounted for approximately ${dominantShare.toFixed(0)}% of your ${insight.displayLabel} spending ${period}.`;
  }
  if (rank === 0 && insight.currentAmount > 0)
    return "This was your largest identified spending category during the selected period.";
  if (
    insight.categoryId === "LOAN_PAYMENTS" &&
    insight.accountDistribution[0] &&
    insight.accountDistribution[0].share >= 70
  ) {
    return "Most identified activity came from one connected account.";
  }
  if (
    insight.accountDistribution[0] &&
    insight.accountDistribution[0].share >= 70
  ) {
    return `Most identified activity came from one connected account.`;
  }
  if (insight.comparison === "increased")
    return "This category increased compared with the prior equivalent period.";
  if (insight.comparison === "decreased")
    return "This category declined compared with the prior equivalent period.";
  if (insight.comparison === "new")
    return "This category newly appeared in the selected period.";
  return "Activity was spread across multiple identified purchases.";
}

export function buildCategoryIntelligence(
  currentRows: MoneyTransaction[],
  priorRows: MoneyTransaction[],
  period: ResolvedFinancialPeriod,
  events: FinancialEvent[] = [],
): CategoryIntelligencePayload {
  const currentOutflows = currentRows.filter(
    (transaction) => classifyTransaction(transaction) === "outflow",
  );
  const priorOutflows = priorRows.filter(
    (transaction) => classifyTransaction(transaction) === "outflow",
  );
  const total = currentOutflows.reduce(
    (sum, transaction) => sum + transaction.amount,
    0,
  );
  const priorTotal = priorOutflows.reduce(
    (sum, transaction) => sum + transaction.amount,
    0,
  );
  const idsByCategory = new Map<string, Set<string>>();
  for (const event of events) {
    for (const category of event.categorySummary) {
      const key = category.toUpperCase().replace(/\s+/g, "_");
      const ids = idsByCategory.get(key) || new Set<string>();
      ids.add(event.id);
      idsByCategory.set(key, ids);
    }
  }

  const grouped = new Map<string, MoneyTransaction[]>();
  for (const row of currentOutflows) {
    const key = categoryKey(row);
    grouped.set(key, [...(grouped.get(key) || []), row]);
  }

  const categories = [...grouped]
    .map(([categoryId, rows]) => {
      const currentAmount = rows.reduce((sum, row) => sum + row.amount, 0);
      const priorCategoryRows = priorOutflows.filter(
        (row) => categoryKey(row) === categoryId,
      );
      const priorAmount = priorCategoryRows.reduce(
        (sum, row) => sum + row.amount,
        0,
      );
      const accountGroups = new Map<string, MoneyTransaction[]>();
      const merchantTotals = new Map<
        string,
        { amount: number; transactionIds: string[] }
      >();
      for (const row of rows) {
        accountGroups.set(row.accountLabel, [
          ...(accountGroups.get(row.accountLabel) || []),
          row,
        ]);
        const merchant = merchantTotals.get(row.name) || {
          amount: 0,
          transactionIds: [],
        };
        merchant.amount += row.amount;
        merchant.transactionIds.push(row.id);
        merchantTotals.set(row.name, merchant);
      }
      const accountDistribution = [...accountGroups]
        .map(([accountLabel, accountRows]) => {
          const amount = accountRows.reduce((sum, row) => sum + row.amount, 0);
          return {
            accountLabel,
            amount: roundMoney(amount),
            share: currentAmount ? (amount / currentAmount) * 100 : 0,
            transactionCount: accountRows.length,
          };
        })
        .sort((a, b) => b.amount - a.amount);
      const merchants = [...merchantTotals].sort(
        (a, b) => b[1].amount - a[1].amount,
      );
      const merchant = merchants[0];
      const largestContributor =
        merchant && merchant[1].amount >= currentAmount * 0.25
          ? {
              label: safeMerchantDisplayName(merchant[0]) || "One merchant",
              amount: roundMoney(merchant[1].amount),
              share: (merchant[1].amount / currentAmount) * 100,
            }
          : null;
      const topMerchantShare = merchant
        ? (merchant[1].amount / currentAmount) * 100
        : 0;
      const dominantMerchantRows =
        topMerchantShare >= 60
          ? merchants.slice(0, 1)
          : merchants
                .slice(0, 2)
                .reduce((sum, entry) => sum + entry[1].amount, 0) >=
              currentAmount * .6
            ? merchants.slice(0, 2)
            : [];
      const dominantContributors = dominantMerchantRows.map(
        ([name, evidence]) => ({
          label: safeMerchantDisplayName(name),
          amount: roundMoney(evidence.amount),
          share: (evidence.amount / currentAmount) * 100,
        }),
      );
      const supportingTransactionIds = dominantMerchantRows.flatMap(
        ([, evidence]) => evidence.transactionIds,
      );
      const relatedIds = [
        ...(idsByCategory.get(categoryId.toUpperCase()) || new Set<string>()),
      ];
      const subcategoryGroups = new Map<
        string,
        { amount: number; count: number; inferred: boolean }
      >();
      if (categoryId.toUpperCase() === "FOOD_AND_DRINK") {
        for (const row of rows) {
          const detail = foodDetail(row);
          if (!detail) continue;
          const current = subcategoryGroups.get(detail.label) || {
            amount: 0,
            count: 0,
            inferred: detail.inferred,
          };
          current.amount += row.amount;
          current.count += 1;
          subcategoryGroups.set(detail.label, current);
        }
      }
      const comparison = comparisonFor(currentAmount, priorAmount);
      const draft = {
        categoryId,
        displayLabel: labelCategory(categoryId),
        activePeriod: {
          label: period.label,
          start: period.start,
          end: period.end,
        },
        priorPeriod: {
          label: "Previous equivalent period",
          priorStart: period.priorStart,
          priorEnd: period.priorEnd,
        },
        currentAmount: roundMoney(currentAmount),
        priorAmount: roundMoney(priorAmount),
        currentShare: total ? (currentAmount / total) * 100 : 0,
        priorShare: priorTotal ? (priorAmount / priorTotal) * 100 : 0,
        transactionCount: rows.length,
        accountDistribution,
        relatedEventIds: relatedIds,
        relatedEventCount: relatedIds.length,
        largestContributor,
        dominantContributors,
        supportingTransactionIds,
        subcategories: [...subcategoryGroups]
          .map(([label, value]) => ({
            label,
            amount: roundMoney(value.amount),
            transactionCount: value.count,
            inferred: value.inferred,
          }))
          .sort((a, b) => b.amount - a.amount),
        confidence: rows.length >= 2 ? ("high" as const) : ("medium" as const),
        ruleVersion: CATEGORY_INSIGHT_RULE_VERSION,
        comparison,
        changeAmount: roundMoney(currentAmount - priorAmount),
        changePercentage:
          priorAmount >= 1
            ? ((currentAmount - priorAmount) / priorAmount) * 100
            : null,
        meaning: "",
      };
      return draft;
    })
    .sort((a, b) => b.currentAmount - a.currentAmount)
    .map((insight, rank) => ({
      ...insight,
      meaning: categoryMeaning(insight, rank),
    }));

  const top = categories[0];
  const topThreeShare = categories
    .slice(0, 3)
    .reduce((sum, category) => sum + category.currentShare, 0);
  const interpretation = !top
    ? null
    : top.currentShare >= 25
      ? `${top.displayLabel} was your largest spending category, representing ${top.currentShare.toFixed(0)}% of identified spending.`
      : topThreeShare >= 65
        ? `Your top three categories represented ${topThreeShare.toFixed(0)}% of identified spending.`
        : "No single category dominated identified spending during this period.";

  return {
    totalIdentifiedSpending: roundMoney(total),
    interpretation,
    categories,
    ruleVersion: CATEGORY_INSIGHT_RULE_VERSION,
  };
}
