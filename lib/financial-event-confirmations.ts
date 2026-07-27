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
  "confirm_group",
  "separate",
  "rename",
  "unsure",
] as const;

export type RecurringConfirmationType =
  (typeof RECURRING_CONFIRMATION_TYPES)[number];
export type GroupingConfirmationType =
  (typeof GROUPING_CONFIRMATION_TYPES)[number];

export function isExactFounderAllowlistMatch(
  userId: string,
  allowedUserIds: ReadonlySet<string>,
) {
  return allowedUserIds.size === 1 && allowedUserIds.has(userId);
}

export type FinancialEventConfirmation = {
  eventId: string;
  inferredType: FinancialEventType | "unresolved_recurring_payment";
  userConfirmedType: FinancialEventType | null;
  userConfirmedTitle: string | null;
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
  if (decision === "confirm_group" || decision === "rename") {
    return { groupingConfirmed: true, groupingRejected: false };
  }
  if (decision === "separate") {
    return { groupingConfirmed: false, groupingRejected: true };
  }
  return { groupingConfirmed: null, groupingRejected: false };
}
