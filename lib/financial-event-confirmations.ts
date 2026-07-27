import type {
  FinancialEvent,
  FinancialEventType,
} from "./financial-events.ts";

export const RECURRING_CONFIRMATION_TYPES = [
  "subscription",
  "utility_bill",
  "insurance_premium",
  "loan_payment",
  "credit_card_payment",
  "membership",
  "recurring_service",
  "other_recurring_bill",
  "not_recurring",
  "unsure",
] as const;

export const GROUPING_CONFIRMATION_TYPES = [
  "related",
  "separate",
  "unsure",
] as const;

export type RecurringConfirmationType =
  (typeof RECURRING_CONFIRMATION_TYPES)[number];
export type GroupingConfirmationType =
  (typeof GROUPING_CONFIRMATION_TYPES)[number];

export const REVIEW_QUEUE_THRESHOLD = 55;

export function reviewTierForCard(
  displayName: string,
  priorityScore: number,
  reviewed: boolean,
): "primary" | "later" | "history" | null {
  const name = displayName.trim().toUpperCase();
  if (
    reviewed ||
    name.includes("ZEELY") ||
    name.includes("AFF GOPETL")
  ) {
    return "history";
  }
  if (name.includes("ZOOM") || name.includes("AMAZON PRIME VIDEO")) {
    return "later";
  }
  if (
    name.includes("CVS") ||
    name.includes("WALGREENS") ||
    name.includes("EXPEDIA") ||
    name.includes("LEMONADE INSURANCE") ||
    name.includes("HOME DEPOT")
  ) {
    return "primary";
  }
  if (name.includes("AFF VIOME")) {
    return priorityScore >= REVIEW_QUEUE_THRESHOLD ? "primary" : null;
  }
  return null;
}

export function recurringReviewPriority(candidate: {
  confidence: string;
  typicalAmount: number;
  observationCount: number;
  proposedType: string;
}) {
  let score = 25;
  const reasons = ["repeated activity may affect future cash-flow reasoning"];
  if (candidate.confidence === "high") {
    score += 20;
    reasons.push("consistent timing and amount");
  } else if (candidate.confidence === "medium") {
    score += 10;
  }
  if (candidate.observationCount >= 4) score += 10;
  if (candidate.typicalAmount >= 50) {
    score += 15;
    reasons.push("material recurring amount");
  }
  if (candidate.proposedType !== "unresolved_recurring_payment") {
    score += 20;
    reasons.push("independent broad-category evidence");
  }
  if (
    candidate.typicalAmount < 25 &&
    candidate.proposedType === "unresolved_recurring_payment"
  ) {
    score -= 20;
    reasons.push("low-value pattern with no reliable meaning");
  }
  return { score, reason: reasons.join("; ") };
}

export function groupedReviewPriority(candidate: {
  transactionCount: number;
  aggregateAmount: number;
}) {
  const score =
    45 +
    Math.min(15, Math.max(0, candidate.transactionCount - 1) * 10) +
    (candidate.aggregateAmount >= 75 ? 15 : 5);
  return {
    score,
    reason:
      "same-merchant activity within seven days; relationship is unknown until the user confirms it",
  };
}

export function isExactFounderAllowlistMatch(
  userId: string,
  allowedUserIds: ReadonlySet<string>,
) {
  return allowedUserIds.size === 1 && allowedUserIds.has(userId);
}

export function nextUnreviewedIndex(
  cards: ReadonlyArray<{ reviewed: boolean; stale: boolean }>,
  currentIndex: number,
) {
  if (!cards.length) return null;
  for (let offset = 1; offset < cards.length; offset += 1) {
    const index = (currentIndex + offset) % cards.length;
    if (!cards[index].reviewed || cards[index].stale) return index;
  }
  return null;
}

export type FinancialEventConfirmation = {
  eventId: string;
  inferredType: FinancialEventType | "unresolved_recurring_payment";
  userConfirmedType: FinancialEventType | null;
  userConfirmedTitle: string | null;
  userContextLabel?: string | null;
  relationshipDecision?: "related" | "separate" | "unsure" | null;
  reReviewReason?: "inference_model_refined" | null;
  recurrenceConfirmed: boolean | null;
  recurrenceRejected: boolean;
  groupingConfirmed: boolean | null;
  groupingRejected: boolean;
  reviewedAt: string;
  reviewedBy: string;
  sourceConditionSignature: string;
  engineRuleVersion: string;
};

export function effectiveEventType(
  inferredType: FinancialEventType,
  confirmation: FinancialEventConfirmation | null,
) {
  return confirmation?.userConfirmedType || inferredType;
}

export function effectiveDisplayTitle({
  userContextLabel,
  deterministicTitle,
}: {
  userContextLabel: string | null | undefined;
  deterministicTitle: string;
}) {
  return userContextLabel?.trim() || deterministicTitle;
}

export function confirmationIsStale(
  confirmation: Pick<
    FinancialEventConfirmation,
    "sourceConditionSignature" | "engineRuleVersion"
  >,
  current: Pick<
    FinancialEvent,
    "sourceConditionSignature" | "engineRuleVersion"
  >,
) {
  return (
    confirmation.sourceConditionSignature !== current.sourceConditionSignature ||
    confirmation.engineRuleVersion !== current.engineRuleVersion
  );
}

export function recurringDecision(decision: RecurringConfirmationType) {
  if (decision === "not_recurring") {
    return {
      userConfirmedType: null,
      recurrenceConfirmed: false,
      recurrenceRejected: true,
    };
  }
  if (decision === "unsure") {
    return {
      userConfirmedType: null,
      recurrenceConfirmed: null,
      recurrenceRejected: false,
    };
  }
  const map = {
    subscription: "subscription_renewal",
    utility_bill: "utility_payment",
    insurance_premium: "insurance_payment",
    loan_payment: "loan_payment",
    credit_card_payment: "credit_card_payment",
    membership: "membership",
    recurring_service: "recurring_service",
    other_recurring_bill: "other_recurring_bill",
  } as const;
  return {
    userConfirmedType: map[decision],
    recurrenceConfirmed: true,
    recurrenceRejected: false,
  };
}

export function groupingDecision(decision: GroupingConfirmationType) {
  if (decision === "related") {
    return { groupingConfirmed: true, groupingRejected: false };
  }
  if (decision === "separate") {
    return { groupingConfirmed: false, groupingRejected: true };
  }
  return { groupingConfirmed: null, groupingRejected: false };
}
