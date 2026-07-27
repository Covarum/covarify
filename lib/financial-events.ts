import type { MoneyTransaction } from "./money-picture.ts";

export const FINANCIAL_EVENTS_RULE_VERSION =
  "financial-events-v1.1-2026-07-27";

export const FINANCIAL_EVENT_TYPES = [
  "payroll",
  "internal_transfer",
  "mortgage_payment",
  "rent_payment",
  "credit_card_payment",
  "loan_payment",
  "utility_payment",
  "insurance_payment",
  "subscription_renewal",
  "membership",
  "recurring_service",
  "other_recurring_bill",
  "unresolved_recurring_payment",
  "large_purchase",
  "travel_booking",
  "travel_spending",
  "medical_expense",
  "tax_payment",
  "refund",
  "returned_payment",
  "fee",
  "savings_transfer",
  "investment_contribution",
  "income_deposit",
] as const;

export const CLASSIFIED_ACTIVITY_TYPES = [
  "ordinary_transfer",
  "cash_withdrawal",
  "grocery",
  "dining",
  "food_and_drink",
  "general_merchandise",
  "transportation",
  "travel_activity",
  "other_classified_activity",
] as const;

export type FinancialEventType = (typeof FINANCIAL_EVENT_TYPES)[number];
export type ClassifiedActivityType =
  (typeof CLASSIFIED_ACTIVITY_TYPES)[number];
export type FinancialEventConfidence = "high" | "medium" | "low";
export type FinancialEventDirection =
  | "inflow"
  | "outflow"
  | "mixed"
  | "neutral";
export type FinancialEventStatus =
  | "first_observed"
  | "resolved"
  | "changed"
  | "disappeared"
  | "still_recurring"
  | "upcoming";
export type RecurrenceCadence =
  | "weekly"
  | "biweekly"
  | "monthly"
  | "quarterly"
  | "annual"
  | "irregular";
export type EventWorthinessReason =
  | "recurring_obligation"
  | "income_event"
  | "grouped_activity"
  | "material_exception"
  | "user_confirmed"
  | "memory_relevant"
  | "recommendation_relevant";

export type FinancialEventAccount = { id: string; label: string };
export type FinancialEventRecurrence = {
  cadence: RecurrenceCadence;
  firstObserved: string;
  lastObserved: string;
  timesObserved: number;
  typicalAmount: number;
  amountVariability: number;
  expectedNextOccurrence: string | null;
  confidence: FinancialEventConfidence;
};
export type FinancialEventEvidence = {
  ruleId: string;
  explanation: string;
  signals: readonly string[];
};
export type FinancialEventUserConfirmation = {
  confirmedType: FinancialEventType | null;
  renamedTitle: string | null;
  recurringStatus: "confirmed" | "rejected" | null;
  confirmedAccountRole: string | null;
  transactionAction: "separated" | "merged" | null;
  notAnEvent: boolean;
  notASubscription: boolean;
  confirmedAt: string | null;
};
export type FinancialEvent = {
  id: string;
  sourceConditionSignature: string;
  engineRuleVersion: string;
  type: FinancialEventType;
  inferredType: FinancialEventType;
  effectiveType: FinancialEventType;
  title: string;
  description: string;
  startDate: string;
  completionDate: string;
  firstObserved: string;
  lastObserved: string;
  occurrenceCount: number;
  relatedAccounts: FinancialEventAccount[];
  relatedTransactionIds: string[];
  institutions: string[];
  totalAmount: number;
  typicalAmount: number;
  amountVariability: number;
  direction: FinancialEventDirection;
  confidence: FinancialEventConfidence;
  confidenceHistory: Array<{
    observedAt: string;
    confidence: FinancialEventConfidence;
    ruleId: string;
  }>;
  supportingEvidence: FinancialEventEvidence;
  merchantSummary: string[];
  categorySummary: string[];
  recurring: FinancialEventRecurrence | null;
  status: FinancialEventStatus;
  eventWorthy: true;
  eventWorthinessReasons: EventWorthinessReason[];
  relatedEventIds: string[];
  observationReferences: string[];
  futureRecommendationEligible: boolean;
  userConfirmation: FinancialEventUserConfirmation;
  supersededClassification: FinancialEventType | null;
};
export type ClassifiedActivity = {
  classification: ClassifiedActivityType;
  transactionId: string;
  account: FinancialEventAccount;
  date: string;
  direction: FinancialEventDirection;
  confidence: FinancialEventConfidence;
  evidence: FinancialEventEvidence;
  eventWorthy: false;
};
export type UnresolvedActivity = {
  classification: "unresolved_activity";
  transactionId: string;
  account: FinancialEventAccount;
  date: string;
  direction: FinancialEventDirection;
  evidence: FinancialEventEvidence;
  eventWorthy: false;
};
export type RecurringPaymentReview = {
  aliasKey: string;
  displayName: string;
  sourceConditionSignature: string;
  engineRuleVersion: string;
  proposedType:
    | "subscription"
    | "utility_bill"
    | "insurance_premium"
    | "loan_payment"
    | "credit_card_payment"
    | "membership"
    | "recurring_service"
    | "other_recurring_bill"
    | "unresolved_recurring_payment";
  sourceTransactionIds: string[];
  account: FinancialEventAccount;
  firstObserved: string;
  lastObserved: string;
  observationCount: number;
  typicalAmount: number;
  amountVariability: number;
  cadence: RecurrenceCadence;
  confidence: FinancialEventConfidence;
  ruleId: string;
  reason: string;
  alternativeClassification: string | null;
};
export type FinancialEventLayer = {
  events: FinancialEvent[];
  classifiedActivity: ClassifiedActivity[];
  unresolvedActivity: UnresolvedActivity[];
  recurringPaymentReview: RecurringPaymentReview[];
  metrics: {
    postedTransactionsAnalyzed: number;
    eventWorthyEventsCreated: number;
    classifiedNonEventActivity: number;
    unresolvedActivity: number;
    multiTransactionEvents: number;
    recurringEventCandidates: number;
    transactionsRepresentedByEvents: number;
    meaningfulTransactionPercentage: number;
    groupedEventCompressionRatio: number | null;
  };
};

type Inference =
  | {
      layer: "event";
      type: FinancialEventType;
      transaction: MoneyTransaction;
      ruleId: string;
      signals: string[];
      confidence: FinancialEventConfidence;
      reasons: EventWorthinessReason[];
    }
  | {
      layer: "activity";
      type: ClassifiedActivityType;
      transaction: MoneyTransaction;
      ruleId: string;
      signals: string[];
      confidence: FinancialEventConfidence;
    }
  | {
      layer: "unresolved";
      transaction: MoneyTransaction;
      ruleId: "activity.unresolved";
      signals: string[];
      confidence: "low";
    };

const DAY = 86_400_000;
const normalize = (value: string | null | undefined) =>
  (value || "").trim().toUpperCase();
const dateMs = (value: string) => new Date(`${value}T00:00:00Z`).getTime();
const round = (value: number) => Number(value.toFixed(2));
const absoluteAmount = (transaction: MoneyTransaction) =>
  Math.abs(transaction.amount);
const directionOf = (
  transaction: MoneyTransaction,
): FinancialEventDirection =>
  transaction.amount < 0
    ? "inflow"
    : transaction.amount > 0
      ? "outflow"
      : "neutral";
const stableHash = (value: string) => {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};
const conditionSignature = (parts: readonly string[]) =>
  `fes_${stableHash(parts.join("|"))}`;
const merchantKey = (transaction: MoneyTransaction) =>
  normalize(transaction.name)
    .replace(/\b\d{2,}\b/g, "")
    .replace(/[^A-Z]+/g, " ")
    .trim()
    .split(/\s+/)
    .slice(0, 5)
    .join(" ") || "UNRESOLVED";
const accountOf = (transaction: MoneyTransaction): FinancialEventAccount => ({
  id: transaction.plaidAccountId,
  label: transaction.accountLabel,
});
const evidence = (
  ruleId: string,
  signals: string[],
): FinancialEventEvidence => ({
  ruleId,
  signals,
  explanation: signals.join("; "),
});

const TAXONOMY = {
  payroll: /\b(PAYROLL|PAY CHECK|PAYCHECK|SALARY|DIRECT DEP(?:OSIT)?)\b/,
  insurance:
    /\b(INSURANCE|GEICO|PROGRESSIVE|STATE FARM|ALLSTATE|LIBERTY MUTUAL|USAA)\b/,
  utility:
    /\b(ELECTRIC|ENERGY|POWER|WATER|SEWER|UTILITY|INTERNET|WIRELESS|TELECOM|CABLE)\b/,
  medical:
    /\b(PHARMACY|HOSPITAL|MEDICAL|DENTAL|DENTIST|CLINIC|HEALTH|LAB(?:ORATORY)?|DIAGNOSTIC)\b/,
  creditCard:
    /\b(CREDIT CARD PAYMENT|CARD PAYMENT|CC PAYMENT|AUTOPAY PAYMENT|PAYMENT THANK YOU)\b/,
  loan: /\b(MORTGAGE|AUTO (?:LOAN|FINANCE)|STUDENT LOAN|LOAN PAYMENT|LENDER)\b/,
  subscription:
    /\b(SUBSCRIPTION|STREAMING|STREAM SERVICE|SOFTWARE|SAAS|DIGITAL SERVICE)\b/,
  membership: /\b(MEMBERSHIP|MEMBER DUES|GYM|CLUB DUES|ASSOCIATION DUES)\b/,
  recurringService:
    /\b(PEST CONTROL|LAWN SERVICE|CLEANING SERVICE|SECURITY SERVICE|SERVICE PLAN)\b/,
  travelBooking:
    /\b(AIRLINE|AIRWAYS|FLIGHT|HOTEL|MOTEL|RESORT|LODGING|RENTAL CAR|CAR RENTAL)\b/,
  grocery: /\b(GROCERY|SUPERMARKET|FOOD MARKET)\b/,
  dining: /\b(RESTAURANT|CAFE|COFFEE|DINER|PIZZA|GRILL)\b/,
} as const;

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function materialThreshold(transactions: MoneyTransaction[]) {
  const ordinaryOutflows = transactions
    .filter(
      (transaction) =>
        !transaction.pending &&
        transaction.amount > 0 &&
        transaction.transferRelationship === null,
    )
    .map(absoluteAmount);
  return Math.max(500, median(ordinaryOutflows) * 3);
}

function classify(
  transaction: MoneyTransaction,
  largePurchaseThreshold: number,
): Inference {
  const category = normalize(transaction.category);
  const detail = normalize(transaction.detailedCategory);
  const merchant = normalize(transaction.name);
  const combined = `${category} ${detail} ${merchant}`;
  const direction = directionOf(transaction);

  if (transaction.transferRelationship === "internal") {
    return {
      layer: "event",
      type: "internal_transfer",
      transaction,
      ruleId: "transfer.internal",
      signals: [
        "equal-and-opposite transfer evidence",
        "different selected accounts",
        "date distance no greater than three days",
      ],
      confidence: "high",
      reasons: ["grouped_activity", "memory_relevant"],
    };
  }
  if (/\b(RETURNED|RETURN ITEM|NSF RETURN)\b/.test(merchant)) {
    return {
      layer: "event",
      type: "returned_payment",
      transaction,
      ruleId: "exception.returned_payment",
      signals: ["explicit returned-payment descriptor"],
      confidence: "high",
      reasons: ["material_exception", "memory_relevant"],
    };
  }
  if (
    direction === "inflow" &&
    /\b(REFUND|REVERSAL|CREDIT VOUCHER)\b/.test(merchant)
  ) {
    return {
      layer: "event",
      type: "refund",
      transaction,
      ruleId: "exception.refund",
      signals: ["refund or reversal descriptor", "inflow direction"],
      confidence: "high",
      reasons: ["material_exception", "memory_relevant"],
    };
  }
  if (direction === "inflow" && TAXONOMY.payroll.test(combined)) {
    return {
      layer: "event",
      type: "payroll",
      transaction,
      ruleId: "income.payroll_received",
      signals: ["payroll deposit descriptor", "inflow direction"],
      confidence: "high",
      reasons: ["income_event", "memory_relevant"],
    };
  }
  if (direction === "inflow" && category === "INCOME") {
    return {
      layer: "event",
      type: "income_deposit",
      transaction,
      ruleId: "income.deposit",
      signals: ["Plaid income primary category", "inflow direction"],
      confidence: "medium",
      reasons: ["income_event"],
    };
  }
  if (
    direction === "outflow" &&
    (detail.includes("MORTGAGE") || /\bMORTGAGE\b/.test(merchant))
  ) {
    return obligation(
      transaction,
      "mortgage_payment",
      "obligation.mortgage",
      "mortgage evidence",
    );
  }
  if (
    direction === "outflow" &&
    (detail.includes("RENT") || /\bRENT PAYMENT\b/.test(merchant))
  ) {
    return obligation(
      transaction,
      "rent_payment",
      "obligation.rent",
      "rent-payment evidence",
    );
  }
  if (direction === "outflow" && TAXONOMY.creditCard.test(combined)) {
    return obligation(
      transaction,
      "credit_card_payment",
      "obligation.credit_card",
      "credit-card payment descriptor",
    );
  }
  if (
    direction === "outflow" &&
    (TAXONOMY.loan.test(combined) ||
      (category === "LOAN_PAYMENTS" && detail.includes("LOAN")))
  ) {
    return obligation(
      transaction,
      "loan_payment",
      "obligation.loan",
      "loan-payment evidence",
    );
  }
  if (
    direction === "outflow" &&
    (TAXONOMY.insurance.test(combined) || detail.includes("INSURANCE"))
  ) {
    return obligation(
      transaction,
      "insurance_payment",
      "obligation.insurance",
      "insurance descriptor",
    );
  }
  if (
    direction === "outflow" &&
    (TAXONOMY.utility.test(combined) ||
      /GAS_AND_ELECTRIC|INTERNET_AND_CABLE|TELEPHONE|WATER/.test(detail))
  ) {
    return obligation(
      transaction,
      "utility_payment",
      "obligation.utility",
      "utility descriptor",
    );
  }
  if (
    direction === "outflow" &&
    (category === "MEDICAL" || TAXONOMY.medical.test(combined))
  ) {
    return {
      layer: "event",
      type: "medical_expense",
      transaction,
      ruleId: "health.medical",
      signals: ["medical category or healthcare-provider taxonomy"],
      confidence: category === "MEDICAL" ? "medium" : "high",
      reasons: ["memory_relevant"],
    };
  }
  if (
    direction === "outflow" &&
    (detail.includes("TAX") || /\b(IRS|TAX PAYMENT)\b/.test(merchant))
  ) {
    return obligation(
      transaction,
      "tax_payment",
      "obligation.tax",
      "tax-payment descriptor",
    );
  }
  if (direction === "outflow" && category === "BANK_FEES") {
    return {
      layer: "event",
      type: "fee",
      transaction,
      ruleId: "exception.fee",
      signals: ["Plaid bank-fee primary category"],
      confidence: "high",
      reasons: ["material_exception", "memory_relevant"],
    };
  }
  if (
    direction === "outflow" &&
    (detail.includes("INVESTMENT") ||
      detail.includes("RETIREMENT") ||
      /\b(401K|IRA|BROKERAGE|INVESTMENT CONTRIBUTION)\b/.test(merchant))
  ) {
    return obligation(
      transaction,
      "investment_contribution",
      "obligation.investment",
      "investment-contribution evidence",
    );
  }
  if (
    category.startsWith("TRANSFER") ||
    /\b(TRANSFER|XFER)\b/.test(merchant)
  ) {
    if (/\bSAVINGS?\b/.test(combined)) {
      return {
        layer: "event",
        type: "savings_transfer",
        transaction,
        ruleId: "transfer.savings",
        signals: ["transfer evidence", "explicit savings descriptor"],
        confidence: "medium",
        reasons: ["recommendation_relevant"],
      };
    }
    if (
      direction === "outflow" &&
      (detail.includes("ATM") || /\b(ATM|CASH WITHDRAWAL)\b/.test(merchant))
    ) {
      return activity(
        transaction,
        "cash_withdrawal",
        "activity.cash_withdrawal",
        "ATM or cash-withdrawal evidence",
      );
    }
    return activity(
      transaction,
      "ordinary_transfer",
      "activity.transfer",
      "ordinary external-transfer evidence",
    );
  }
  if (
    direction === "outflow" &&
    (detail.includes("FLIGHT") ||
      detail.includes("LODGING") ||
      detail.includes("RENTAL_CAR") ||
      TAXONOMY.travelBooking.test(combined))
  ) {
    return {
      layer: "event",
      type: "travel_booking",
      transaction,
      ruleId: "travel.booking",
      signals: ["recognized travel-booking evidence"],
      confidence: detail ? "high" : "medium",
      reasons: ["memory_relevant"],
    };
  }
  if (direction === "outflow" && category === "TRAVEL") {
    return activity(
      transaction,
      "travel_activity",
      "activity.travel",
      "Plaid travel primary category without coherent booking evidence",
    );
  }
  if (
    direction === "outflow" &&
    absoluteAmount(transaction) >= largePurchaseThreshold
  ) {
    return {
      layer: "event",
      type: "large_purchase",
      transaction,
      ruleId: "exception.large_purchase",
      signals: [
        "posted outflow",
        `amount at or above deterministic materiality threshold ${round(largePurchaseThreshold)}`,
      ],
      confidence: category === "UNCATEGORIZED" ? "medium" : "high",
      reasons: ["material_exception", "memory_relevant"],
    };
  }
  if (direction === "outflow" && category === "FOOD_AND_DRINK") {
    if (detail.includes("GROCER") || TAXONOMY.grocery.test(merchant)) {
      return activity(
        transaction,
        "grocery",
        "activity.grocery",
        "grocery evidence",
      );
    }
    if (
      /RESTAURANT|FAST_FOOD|COFFEE/.test(detail) ||
      TAXONOMY.dining.test(merchant)
    ) {
      return activity(
        transaction,
        "dining",
        "activity.dining",
        "dining evidence",
      );
    }
    return activity(
      transaction,
      "food_and_drink",
      "activity.food_and_drink",
      "Plaid food-and-drink primary category",
    );
  }
  if (direction === "outflow" && category === "GENERAL_MERCHANDISE") {
    return activity(
      transaction,
      "general_merchandise",
      "activity.general_merchandise",
      "Plaid general-merchandise primary category",
    );
  }
  if (direction === "outflow" && category === "TRANSPORTATION") {
    return activity(
      transaction,
      "transportation",
      "activity.transportation",
      "Plaid transportation primary category",
    );
  }
  return {
    layer: "unresolved",
    transaction,
    ruleId: "activity.unresolved",
    signals: ["available evidence does not support a reliable meaning"],
    confidence: "low",
  };
}

function obligation(
  transaction: MoneyTransaction,
  type: FinancialEventType,
  ruleId: string,
  signal: string,
): Inference {
  return {
    layer: "event",
    type,
    transaction,
    ruleId,
    signals: [signal, "posted outflow"],
    confidence: "high",
    reasons: ["recurring_obligation", "memory_relevant"],
  };
}

function activity(
  transaction: MoneyTransaction,
  type: ClassifiedActivityType,
  ruleId: string,
  signal: string,
): Inference {
  return {
    layer: "activity",
    type,
    transaction,
    ruleId,
    signals: [signal],
    confidence: "medium",
  };
}

function recurrenceFor(
  occurrences: Array<{ date: string; amount: number }>,
): FinancialEventRecurrence | null {
  if (occurrences.length < 2) return null;
  const sorted = [...occurrences].sort((a, b) => a.date.localeCompare(b.date));
  const intervals = sorted
    .slice(1)
    .map((occurrence, index) =>
      Math.round((dateMs(occurrence.date) - dateMs(sorted[index].date)) / DAY),
    );
  const average =
    intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
  const everyIntervalBetween = (minimum: number, maximum: number) =>
    intervals.every(
      (interval) => interval >= minimum && interval <= maximum,
    );
  const cadence: RecurrenceCadence =
    everyIntervalBetween(5, 9)
      ? "weekly"
      : everyIntervalBetween(12, 17)
        ? "biweekly"
        : everyIntervalBetween(25, 35)
          ? "monthly"
          : everyIntervalBetween(80, 100)
            ? "quarterly"
            : everyIntervalBetween(350, 380)
              ? "annual"
              : "irregular";
  const amounts = sorted.map((occurrence) => occurrence.amount);
  const typicalAmount =
    amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length;
  const amountVariability = typicalAmount
    ? Math.sqrt(
        amounts.reduce(
          (sum, amount) => sum + (amount - typicalAmount) ** 2,
          0,
        ) / amounts.length,
      ) / typicalAmount
    : 0;
  const timingVariability = average
    ? Math.max(...intervals.map((interval) => Math.abs(interval - average))) /
      average
    : 1;
  const confidence: FinancialEventConfidence =
    cadence !== "irregular" &&
    occurrences.length >= 3 &&
    timingVariability <= 0.15 &&
    amountVariability <= 0.15
      ? "high"
      : cadence !== "irregular" &&
          occurrences.length >= 3 &&
          timingVariability <= 0.25 &&
          amountVariability <= 0.25
        ? "medium"
        : "low";
  const expectedNextOccurrence =
    confidence !== "low" && cadence !== "irregular"
      ? new Date(
          dateMs(sorted.at(-1)!.date) + Math.round(average) * DAY,
        )
          .toISOString()
          .slice(0, 10)
      : null;
  return {
    cadence,
    firstObserved: sorted[0].date,
    lastObserved: sorted.at(-1)!.date,
    timesObserved: sorted.length,
    typicalAmount: round(typicalAmount),
    amountVariability: round(amountVariability),
    expectedNextOccurrence,
    confidence,
  };
}

function recurringProposal(
  inference: Inference,
  recurrence: FinancialEventRecurrence,
) {
  const combined = normalize(inference.transaction.name);
  if (inference.layer === "event") {
    if (inference.type === "utility_payment") return "utility_bill" as const;
    if (inference.type === "insurance_payment")
      return "insurance_premium" as const;
    if (inference.type === "loan_payment") return "loan_payment" as const;
    if (inference.type === "credit_card_payment")
      return "credit_card_payment" as const;
  }
  if (TAXONOMY.membership.test(combined)) return "membership" as const;
  if (TAXONOMY.subscription.test(combined)) return "subscription" as const;
  if (TAXONOMY.recurringService.test(combined))
    return "recurring_service" as const;
  if (
    inference.transaction.category === "RENT_AND_UTILITIES" &&
    recurrence.confidence !== "low"
  ) {
    return "other_recurring_bill" as const;
  }
  return "unresolved_recurring_payment" as const;
}

function recurringEventType(
  proposal: RecurringPaymentReview["proposedType"],
): FinancialEventType | null {
  return (
    {
      subscription: "subscription_renewal",
      utility_bill: "utility_payment",
      insurance_premium: "insurance_payment",
      loan_payment: "loan_payment",
      credit_card_payment: "credit_card_payment",
      membership: "membership",
      recurring_service: "recurring_service",
      other_recurring_bill: "other_recurring_bill",
      unresolved_recurring_payment: null,
    } satisfies Record<
      RecurringPaymentReview["proposedType"],
      FinancialEventType | null
    >
  )[proposal];
}

function defaultConfirmation(): FinancialEventUserConfirmation {
  return {
    confirmedType: null,
    renamedTitle: null,
    recurringStatus: null,
    confirmedAccountRole: null,
    transactionAction: null,
    notAnEvent: false,
    notASubscription: false,
    confirmedAt: null,
  };
}

function titleFor(type: FinancialEventType) {
  return (
    {
      payroll: "Payroll received",
      internal_transfer: "Internal transfer",
      mortgage_payment: "Mortgage payment",
      rent_payment: "Rent payment",
      credit_card_payment: "Credit-card payment",
      loan_payment: "Loan payment",
      utility_payment: "Utility bill",
      insurance_payment: "Insurance premium",
      subscription_renewal: "Subscription",
      membership: "Membership",
      recurring_service: "Recurring service",
      other_recurring_bill: "Other recurring bill",
      unresolved_recurring_payment: "Unresolved recurring payment",
      large_purchase: "Large purchase",
      travel_booking: "Travel booking",
      travel_spending: "Travel spending",
      medical_expense: "Medical expense",
      tax_payment: "Tax payment",
      refund: "Refund",
      returned_payment: "Returned payment",
      fee: "Fee",
      savings_transfer: "Savings transfer",
      investment_contribution: "Investment contribution",
      income_deposit: "Income deposit",
    } satisfies Record<FinancialEventType, string>
  )[type];
}

function makeEvent(
  group: Inference[],
  type: FinancialEventType,
  recurrence: FinancialEventRecurrence | null,
  context: {
    institutionsByAccountId?: Readonly<Record<string, string | null>>;
  },
  extraReasons: EventWorthinessReason[] = [],
): FinancialEvent {
  const transactions = group.map((inference) => inference.transaction);
  const transactionIds = transactions
    .map((transaction) => transaction.id)
    .sort();
  const dates = transactions.map((transaction) => transaction.date).sort();
  const accounts = [
    ...new Map(
      transactions.map((transaction) => [
        transaction.plaidAccountId,
        accountOf(transaction),
      ]),
    ).values(),
  ].sort((a, b) => a.id.localeCompare(b.id));
  const directions = new Set(
    transactions.map(directionOf).filter((direction) => direction !== "neutral"),
  );
  const direction: FinancialEventDirection =
    directions.size > 1
      ? "mixed"
      : directions.values().next().value || "neutral";
  const confidence =
    type === "internal_transfer"
      ? "high"
      : recurrence?.confidence && recurrence.confidence !== "low"
        ? recurrence.confidence
        : group.some((inference) => inference.confidence === "high")
          ? "high"
          : "medium";
  const reasons: EventWorthinessReason[] = [
    ...new Set([
      ...group.flatMap((inference) =>
        inference.layer === "event" ? inference.reasons : [],
      ),
      ...extraReasons,
      ...(group.length > 1 ? (["grouped_activity"] as const) : []),
    ]),
  ];
  const typicalAmount =
    recurrence?.typicalAmount ||
    round(
      transactions.reduce(
        (sum, transaction) => sum + absoluteAmount(transaction),
        0,
      ) / transactions.length,
    );
  const id = `fe_${stableHash(`${type}|${transactionIds.join("|")}`)}`;
  return {
    id,
    sourceConditionSignature: conditionSignature([
      type,
      ...transactionIds,
      recurrence?.cadence || "none",
      String(recurrence?.typicalAmount || ""),
      String(recurrence?.amountVariability || ""),
    ]),
    engineRuleVersion: FINANCIAL_EVENTS_RULE_VERSION,
    type,
    inferredType: type,
    effectiveType: type,
    title: titleFor(type),
    description: `${transactions.length} posted transaction${transactions.length === 1 ? "" : "s"} support this semantic object.`,
    startDate: dates[0],
    completionDate: dates.at(-1)!,
    firstObserved: recurrence?.firstObserved || dates[0],
    lastObserved: recurrence?.lastObserved || dates.at(-1)!,
    occurrenceCount: recurrence?.timesObserved || transactions.length,
    relatedAccounts: accounts,
    relatedTransactionIds: transactionIds,
    institutions: [
      ...new Set(
        accounts
          .map((account) => context.institutionsByAccountId?.[account.id])
          .filter((institution): institution is string => Boolean(institution)),
      ),
    ].sort(),
    totalAmount: round(
      transactions.reduce(
        (sum, transaction) =>
          sum + (direction === "mixed" ? transaction.amount : absoluteAmount(transaction)),
        0,
      ),
    ),
    typicalAmount,
    amountVariability: recurrence?.amountVariability || 0,
    direction,
    confidence,
    confidenceHistory: [
      {
        observedAt: dates.at(-1)!,
        confidence,
        ruleId: group[0].ruleId,
      },
    ],
    supportingEvidence: evidence(group[0].ruleId, [
      ...new Set([
        ...group.flatMap((inference) => inference.signals),
        `${transactions.length} source transaction${transactions.length === 1 ? "" : "s"} retained`,
        `${accounts.length} selected account${accounts.length === 1 ? "" : "s"} retained`,
      ]),
    ]),
    merchantSummary: [
      ...new Set(transactions.map((transaction) => transaction.name)),
    ].sort(),
    categorySummary: [
      ...new Set(transactions.map((transaction) => transaction.category)),
    ].sort(),
    recurring: recurrence,
    status: recurrence ? "still_recurring" : "first_observed",
    eventWorthy: true,
    eventWorthinessReasons: reasons,
    relatedEventIds: [],
    observationReferences: [],
    futureRecommendationEligible:
      reasons.some((reason) =>
        [
          "recurring_obligation",
          "recommendation_relevant",
          "memory_relevant",
        ].includes(reason),
      ),
    userConfirmation: defaultConfirmation(),
    supersededClassification: null,
  };
}

function groupInternalTransfers(inferences: Inference[]) {
  const internal = inferences.filter(
    (inference) =>
      inference.layer === "event" && inference.type === "internal_transfer",
  );
  const groups: Inference[][] = [];
  const consumed = new Set<string>();
  for (const outgoing of internal.filter(
    (inference) => inference.transaction.amount > 0,
  )) {
    if (consumed.has(outgoing.transaction.id)) continue;
    const match = internal.find(
      (candidate) =>
        !consumed.has(candidate.transaction.id) &&
        candidate.transaction.amount < 0 &&
        candidate.transaction.plaidAccountId !==
          outgoing.transaction.plaidAccountId &&
        Math.abs(
          absoluteAmount(candidate.transaction) -
            absoluteAmount(outgoing.transaction),
        ) < 0.01 &&
        Math.abs(
          dateMs(candidate.transaction.date) -
            dateMs(outgoing.transaction.date),
        ) <=
          3 * DAY,
    );
    if (!match) continue;
    groups.push([outgoing, match]);
    consumed.add(outgoing.transaction.id);
    consumed.add(match.transaction.id);
  }
  return { groups, consumed };
}

function groupEpisodes(
  inferences: Inference[],
  type: "medical_expense" | "travel_booking",
  windowDays: number,
) {
  const candidates = inferences
    .filter(
      (inference) => inference.layer === "event" && inference.type === type,
    )
    .sort(
      (a, b) =>
        a.transaction.date.localeCompare(b.transaction.date) ||
        a.transaction.id.localeCompare(b.transaction.id),
    );
  const groups: Inference[][] = [];
  const consumed = new Set<string>();
  for (const candidate of candidates) {
    if (consumed.has(candidate.transaction.id)) continue;
    const related = candidates.filter(
      (other) =>
        other.transaction.id !== candidate.transaction.id &&
        !consumed.has(other.transaction.id) &&
        Math.abs(
          dateMs(other.transaction.date) -
            dateMs(candidate.transaction.date),
        ) <=
          windowDays * DAY &&
        (type === "travel_booking"
          ? merchantKey(other.transaction) !== merchantKey(candidate.transaction)
          : merchantKey(other.transaction) === merchantKey(candidate.transaction)),
    );
    if (related.length < 1) continue;
    groups.push([candidate, ...related]);
    groups.at(-1)!.forEach((item) => consumed.add(item.transaction.id));
  }
  return { groups, consumed };
}

export function buildFinancialEventLayer(
  transactions: MoneyTransaction[],
  context: {
    institutionsByAccountId?: Readonly<Record<string, string | null>>;
  } = {},
): FinancialEventLayer {
  const posted = transactions
    .filter((transaction) => !transaction.pending)
    .slice()
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
    );
  const threshold = materialThreshold(posted);
  const inferences = posted.map((transaction) =>
    classify(transaction, threshold),
  );
  const recurringPaymentReview: RecurringPaymentReview[] = [];
  const recurringGroups: Array<{
    group: Inference[];
    type: FinancialEventType;
    recurrence: FinancialEventRecurrence;
  }> = [];
  const recurringConsumed = new Set<string>();
  const payrollGroups = new Map<string, Inference[]>();
  for (const inference of inferences) {
    if (inference.layer !== "event" || inference.type !== "payroll") continue;
    const key = `payroll|${merchantKey(inference.transaction)}|${inference.transaction.plaidAccountId}`;
    const group = payrollGroups.get(key) || [];
    group.push(inference);
    payrollGroups.set(key, group);
  }
  for (const group of payrollGroups.values()) {
    const recurrence = recurrenceFor(
      group.map((inference) => ({
        date: inference.transaction.date,
        amount: absoluteAmount(inference.transaction),
      })),
    );
    if (
      !recurrence ||
      recurrence.timesObserved < 3 ||
      recurrence.cadence === "irregular" ||
      recurrence.confidence === "low"
    ) {
      continue;
    }
    recurringGroups.push({ group, type: "payroll", recurrence });
    group.forEach((inference) =>
      recurringConsumed.add(inference.transaction.id),
    );
  }
  const merchantGroups = new Map<string, Inference[]>();
  for (const inference of inferences) {
    if (
      inference.transaction.amount <= 0 ||
      inference.transaction.transferRelationship !== null
    ) {
      continue;
    }
    const key = `${merchantKey(inference.transaction)}|${inference.transaction.plaidAccountId}`;
    const group = merchantGroups.get(key) || [];
    group.push(inference);
    merchantGroups.set(key, group);
  }
  for (const [key, group] of [...merchantGroups].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const recurrence = recurrenceFor(
      group.map((inference) => ({
        date: inference.transaction.date,
        amount: absoluteAmount(inference.transaction),
      })),
    );
    if (
      !recurrence ||
      recurrence.timesObserved < 3 ||
      recurrence.cadence === "irregular"
    ) {
      continue;
    }
    const proposal = recurringProposal(group[0], recurrence);
    const proposedEventType = recurringEventType(proposal);
    const aliasKey = `recurring-${stableHash(key)}`;
    recurringPaymentReview.push({
      aliasKey,
      displayName: group[0].transaction.name,
      sourceConditionSignature: conditionSignature([
        proposal,
        key,
        ...group.map((inference) => inference.transaction.id).sort(),
        recurrence.cadence,
        String(recurrence.typicalAmount),
        String(recurrence.amountVariability),
      ]),
      engineRuleVersion: FINANCIAL_EVENTS_RULE_VERSION,
      proposedType: proposal,
      sourceTransactionIds: group
        .map((inference) => inference.transaction.id)
        .sort(),
      account: accountOf(group[0].transaction),
      firstObserved: recurrence.firstObserved,
      lastObserved: recurrence.lastObserved,
      observationCount: recurrence.timesObserved,
      typicalAmount: recurrence.typicalAmount,
      amountVariability: recurrence.amountVariability,
      cadence: recurrence.cadence,
      confidence: recurrence.confidence,
      ruleId: `recurrence.${proposal}`,
      reason: `same merchant and selected account; ${recurrence.timesObserved} observations; ${recurrence.cadence} cadence`,
      alternativeClassification:
        proposal === "subscription"
          ? "membership, recurring service, or other recurring bill"
          : proposal === "unresolved_recurring_payment"
            ? "subscription, utility, insurance, loan, membership, or recurring service"
            : null,
    });
    if (!proposedEventType || recurrence.confidence === "low") continue;
    recurringGroups.push({
      group,
      type: proposedEventType,
      recurrence,
    });
    group.forEach((inference) =>
      recurringConsumed.add(inference.transaction.id),
    );
  }

  const events: FinancialEvent[] = recurringGroups.map(
    ({ group, type, recurrence }) =>
      makeEvent(
        group,
        type,
        recurrence,
        context,
        ["recurring_obligation", "memory_relevant"],
      ),
  );
  const remaining = inferences.filter(
    (inference) => !recurringConsumed.has(inference.transaction.id),
  );
  const internal = groupInternalTransfers(remaining);
  internal.groups.forEach((group) =>
    events.push(
      makeEvent(group, "internal_transfer", null, context, [
        "grouped_activity",
      ]),
    ),
  );
  const afterInternal = remaining
    .filter((inference) => !internal.consumed.has(inference.transaction.id))
    .map((inference): Inference =>
      inference.layer === "event" && inference.type === "internal_transfer"
        ? {
            layer: "unresolved",
            transaction: inference.transaction,
            ruleId: "activity.unresolved",
            signals: [
              "transfer was marked as potentially internal",
              "no equal-and-opposite selected-account side was verified",
            ],
            confidence: "low",
          }
        : inference,
    );
  const travel = groupEpisodes(afterInternal, "travel_booking", 7);
  travel.groups.forEach((group) =>
    events.push(
      makeEvent(group, "travel_spending", null, context, [
        "grouped_activity",
        "memory_relevant",
      ]),
    ),
  );
  const medical = groupEpisodes(afterInternal, "medical_expense", 7);
  medical.groups.forEach((group) =>
    events.push(
      makeEvent(group, "medical_expense", null, context, [
        "grouped_activity",
        "memory_relevant",
      ]),
    ),
  );
  const groupedConsumed = new Set([
    ...travel.consumed,
    ...medical.consumed,
  ]);
  const ungrouped = afterInternal.filter(
    (inference) => !groupedConsumed.has(inference.transaction.id),
  );
  for (const inference of ungrouped) {
    if (inference.layer !== "event") continue;
    events.push(makeEvent([inference], inference.type, null, context));
  }

  const eventTransactionIds = new Set(
    events.flatMap((event) => event.relatedTransactionIds),
  );
  const classifiedActivity = ungrouped
    .filter(
      (
        inference,
      ): inference is Extract<Inference, { layer: "activity" }> =>
        inference.layer === "activity" &&
        !eventTransactionIds.has(inference.transaction.id),
    )
    .map(
      (inference): ClassifiedActivity => ({
        classification: inference.type,
        transactionId: inference.transaction.id,
        account: accountOf(inference.transaction),
        date: inference.transaction.date,
        direction: directionOf(inference.transaction),
        confidence: inference.confidence,
        evidence: evidence(inference.ruleId, inference.signals),
        eventWorthy: false,
      }),
    );
  const unresolvedActivity = ungrouped
    .filter(
      (
        inference,
      ): inference is Extract<Inference, { layer: "unresolved" }> =>
        inference.layer === "unresolved" &&
        !eventTransactionIds.has(inference.transaction.id),
    )
    .map(
      (inference): UnresolvedActivity => ({
        classification: "unresolved_activity",
        transactionId: inference.transaction.id,
        account: accountOf(inference.transaction),
        date: inference.transaction.date,
        direction: directionOf(inference.transaction),
        evidence: evidence(inference.ruleId, inference.signals),
        eventWorthy: false,
      }),
    );
  const multi = events.filter(
    (event) => event.relatedTransactionIds.length > 1,
  );
  const groupedTransactions = multi.reduce(
    (sum, event) => sum + event.relatedTransactionIds.length,
    0,
  );
  return {
    events: events.sort(
      (a, b) =>
        b.startDate.localeCompare(a.startDate) || a.id.localeCompare(b.id),
    ),
    classifiedActivity: classifiedActivity.sort(
      (a, b) => b.date.localeCompare(a.date) || a.transactionId.localeCompare(b.transactionId),
    ),
    unresolvedActivity: unresolvedActivity.sort(
      (a, b) => b.date.localeCompare(a.date) || a.transactionId.localeCompare(b.transactionId),
    ),
    recurringPaymentReview: recurringPaymentReview.sort((a, b) =>
      a.aliasKey.localeCompare(b.aliasKey),
    ),
    metrics: {
      postedTransactionsAnalyzed: posted.length,
      eventWorthyEventsCreated: events.length,
      classifiedNonEventActivity: classifiedActivity.length,
      unresolvedActivity: unresolvedActivity.length,
      multiTransactionEvents: multi.length,
      recurringEventCandidates: recurringPaymentReview.length,
      transactionsRepresentedByEvents: eventTransactionIds.size,
      meaningfulTransactionPercentage: posted.length
        ? round((eventTransactionIds.size / posted.length) * 100)
        : 0,
      groupedEventCompressionRatio: multi.length
        ? round(groupedTransactions / multi.length)
        : null,
    },
  };
}

export function buildFinancialEvents(
  transactions: MoneyTransaction[],
  context: {
    institutionsByAccountId?: Readonly<Record<string, string | null>>;
  } = {},
) {
  return buildFinancialEventLayer(transactions, context).events;
}

export function applyFinancialEventConfirmation(
  event: FinancialEvent,
  confirmation: Partial<FinancialEventUserConfirmation>,
): FinancialEvent {
  const userConfirmation = {
    ...event.userConfirmation,
    ...confirmation,
  };
  const effectiveType = userConfirmation.confirmedType || event.inferredType;
  const confirmed =
    Boolean(userConfirmation.confirmedType) ||
    Boolean(userConfirmation.renamedTitle) ||
    userConfirmation.notAnEvent ||
    userConfirmation.notASubscription;
  return {
    ...event,
    type: event.inferredType,
    effectiveType,
    title: userConfirmation.renamedTitle || titleFor(effectiveType),
    eventWorthinessReasons: confirmed
      ? [
          ...new Set<EventWorthinessReason>([
            ...event.eventWorthinessReasons,
            "user_confirmed",
          ]),
        ]
      : event.eventWorthinessReasons,
    userConfirmation,
    supersededClassification:
      effectiveType !== event.inferredType ? event.inferredType : null,
  };
}
