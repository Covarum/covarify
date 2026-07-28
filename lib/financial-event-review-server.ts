import "server-only";
import { displaySeparated } from "@/lib/presentation-separators";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizePersistedPlaidCategory } from "@/lib/plaid/category-normalization";
import {
  annotateInternalTransfers,
  type MoneyTransaction,
} from "@/lib/money-picture";
import {
  transactionInPeriod,
  type ResolvedFinancialPeriod,
} from "@/lib/financial-periods";
import { buildFinancialEventLayer } from "@/lib/financial-events";
import {
  groupedReviewPriority,
  recurringReviewPriority,
  reviewTierForCard,
} from "@/lib/financial-event-confirmations";

export type RecurringReviewCard = {
  kind: "recurring";
  eventId: string;
  conditionSignature: string;
  ruleVersion: string;
  displayName: string;
  accountLabel: string;
  typicalAmount: number;
  cadence: string;
  firstObserved: string;
  lastObserved: string;
  occurrenceCount: number;
  amountVariation: number;
  inferredType: string;
  confidence: string;
  reason: string;
  reviewed: boolean;
  stale: boolean;
  reviewCount: number;
  latestDecision: string | null;
  latestLabel: string | null;
  priorityScore: number;
  priorityReason: string;
  reReviewReason: "inference_model_refined" | null;
  reviewTier: "primary" | "later" | "history" | null;
  sourceTransactionIds: readonly string[];
};

export type GroupedReviewCard = {
  kind: "grouped";
  eventId: string;
  conditionSignature: string;
  ruleVersion: string;
  displayName: string;
  accountLabel: string;
  dateRange: string;
  transactionCount: number;
  aggregateAmount: number;
  inferredType: string;
  confidence: string;
  reason: string;
  reviewed: boolean;
  stale: boolean;
  reviewCount: number;
  latestDecision: string | null;
  latestLabel: string | null;
  priorityScore: number;
  priorityReason: string;
  reReviewReason: "inference_model_refined" | null;
  reviewTier: "primary" | "later" | "history" | null;
};

export type FinancialEventReviewCard =
  | RecurringReviewCard
  | GroupedReviewCard;

function mapTransaction(
  row: Record<string, unknown>,
  accountLabel: string,
): MoneyTransaction {
  const category = normalizePersistedPlaidCategory(row.category_data);
  const amount = Number(row.amount);
  return {
    id: String(row.id),
    plaidAccountId: String(row.plaid_account_id),
    accountLabel,
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
    direction:
      amount < 0 ? "inflow" : amount > 0 ? "outflow" : "neutral",
    transferRelationship: null,
  };
}

export async function loadFinancialEventReviewQueue(
  userId: string,
  period?: ResolvedFinancialPeriod,
) {
  const supabase = await createSupabaseServerClient();
  const { data: item, error: itemError } = await supabase
    .from("plaid_items")
    .select("id,institution_name")
    .eq("user_id", userId)
    .eq("environment", "production")
    .eq("status", "active")
    .maybeSingle();
  if (itemError || !item) return [];

  const [accounts, transactions] = await Promise.all([
    supabase
      .from("plaid_accounts")
      .select("id,name,official_name,mask")
      .eq("user_id", userId)
      .eq("plaid_item_id", item.id)
      .eq("active_status", "active"),
    supabase
      .from("plaid_transactions")
      .select(
        "id,plaid_account_id,transaction_name,merchant_name,amount,currency,transaction_date,pending,pending_transaction_id,category_data",
      )
      .eq("user_id", userId)
      .eq("plaid_item_id", item.id)
      .is("removed_at", null)
      .order("transaction_date", { ascending: false })
      .limit(1000),
  ]);
  if (accounts.error || transactions.error) throw new Error("EVENT_REVIEW_READ_FAILED");

  const labels = new Map(
    (accounts.data || []).map((account) => [
      account.id,
      displaySeparated(account.official_name || account.name, account.mask || null),
    ]),
  );
  const rows = annotateInternalTransfers(
    (transactions.data || [])
      .map((row) =>
        mapTransaction(
          row,
          labels.get(String(row.plaid_account_id)) || "Connected account",
        ),
      )
      .filter((row) => labels.has(row.plaidAccountId)),
  ).filter((row) => !period || transactionInPeriod(row.date, period));
  const layer = buildFinancialEventLayer(rows, {
    institutionsByAccountId: Object.fromEntries(
      [...labels.keys()].map((id) => [id, item.institution_name]),
    ),
  });

  const admin = createSupabaseAdminClient();
  const { data: history, error: historyError } = await admin
    .from("financial_event_confirmations")
    .select(
      "event_id,selected_decision,user_confirmed_title,user_context_label,source_condition_signature,engine_rule_version,reviewed_at",
    )
    .eq("user_id", userId)
    .order("reviewed_at", { ascending: false });
  if (historyError) throw new Error("EVENT_REVIEW_HISTORY_FAILED");
  const latest = new Map<string, Record<string, unknown>>();
  const reviewCounts = new Map<string, number>();
  for (const row of history || []) {
    const eventId = String(row.event_id);
    reviewCounts.set(eventId, (reviewCounts.get(eventId) || 0) + 1);
    if (!latest.has(eventId)) latest.set(eventId, row);
  }
  const reviewState = (
    eventId: string,
    signature: string,
    ruleVersion: string,
  ) => {
    const prior = latest.get(eventId);
    return {
      reviewed: Boolean(prior),
      reviewCount: reviewCounts.get(eventId) || 0,
      latestDecision: prior?.selected_decision
        ? String(prior.selected_decision)
        : null,
      latestLabel: prior?.user_context_label
        ? String(prior.user_context_label)
        : prior?.user_confirmed_title
          ? String(prior.user_confirmed_title)
        : null,
      stale: Boolean(
        prior &&
          (prior.source_condition_signature !== signature ||
            prior.engine_rule_version !== ruleVersion),
      ),
    };
  };

  const recurring: RecurringReviewCard[] = layer.recurringPaymentReview
    .map((candidate) => {
      const priority = recurringReviewPriority(candidate);
      return {
      kind: "recurring" as const,
      eventId: candidate.aliasKey,
      conditionSignature: candidate.sourceConditionSignature,
      ruleVersion: candidate.engineRuleVersion,
      displayName: candidate.displayName,
      accountLabel: candidate.account.label,
      typicalAmount: candidate.typicalAmount,
      cadence: candidate.cadence,
      firstObserved: candidate.firstObserved,
      lastObserved: candidate.lastObserved,
      occurrenceCount: candidate.observationCount,
      amountVariation: candidate.amountVariability,
      inferredType: candidate.proposedType,
      confidence: candidate.confidence,
      reason: `Covarify found ${candidate.observationCount} charges from the same merchant and selected account with a ${candidate.cadence} pattern.`,
      priorityScore: priority.score,
      priorityReason: priority.reason,
      reReviewReason: null,
      reviewTier: reviewTierForCard(
        candidate.displayName,
        priority.score,
        reviewState(
          candidate.aliasKey,
          candidate.sourceConditionSignature,
          candidate.engineRuleVersion,
        ).reviewed,
      ),
      sourceTransactionIds: candidate.sourceTransactionIds,
      ...reviewState(
        candidate.aliasKey,
        candidate.sourceConditionSignature,
        candidate.engineRuleVersion,
      ),
      };
    })
    .filter((candidate) => candidate.reviewTier !== null);
  const grouped: GroupedReviewCard[] = layer.events
    .filter(
      (event) =>
        (event.inferredType === "medical_expense" ||
          event.inferredType === "related_purchases") &&
        event.relatedTransactionIds.length > 1 &&
        event.confidence !== "high",
    )
    .map((event) => ({
      kind: "grouped" as const,
      eventId: event.id,
      conditionSignature: event.sourceConditionSignature,
      ruleVersion: event.engineRuleVersion,
      displayName: event.merchantSummary[0] || "Possible related purchases",
      accountLabel: event.relatedAccounts[0]?.label || "Connected account",
      dateRange:
        event.firstObserved === event.lastObserved
          ? event.firstObserved
          : `${event.firstObserved} – ${event.lastObserved}`,
      transactionCount: event.relatedTransactionIds.length,
      aggregateAmount: event.totalAmount,
      inferredType: "related_purchases",
      confidence: event.confidence,
      reason:
        "Covarify noticed multiple purchases at the same merchant within seven days. They may be related.",
      priorityScore: groupedReviewPriority({
        transactionCount: event.relatedTransactionIds.length,
        aggregateAmount: event.totalAmount,
      }).score,
      priorityReason: groupedReviewPriority({
        transactionCount: event.relatedTransactionIds.length,
        aggregateAmount: event.totalAmount,
      }).reason,
      reReviewReason:
        event.inferredType === "medical_expense"
          ? ("inference_model_refined" as const)
          : null,
      reviewTier: reviewTierForCard(
        event.merchantSummary[0] || "",
        groupedReviewPriority({
          transactionCount: event.relatedTransactionIds.length,
          aggregateAmount: event.totalAmount,
        }).score,
        reviewState(
          event.id,
          event.sourceConditionSignature,
          event.engineRuleVersion,
        ).reviewed,
      ),
      ...reviewState(
        event.id,
        event.sourceConditionSignature,
        event.engineRuleVersion,
      ),
    }))
    .filter((candidate) => candidate.reviewTier !== null);
  const tierOrder = { primary: 0, later: 1, history: 2 } as const;
  return [...recurring, ...grouped].sort((a, b) => {
    const tierDifference =
      tierOrder[a.reviewTier!] - tierOrder[b.reviewTier!];
    return (
      tierDifference ||
      b.priorityScore - a.priorityScore ||
      a.displayName.localeCompare(b.displayName)
    );
  });
}
