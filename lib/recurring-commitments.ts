import {
  buildFinancialEventLayer,
  type FinancialEventConfidence,
  type RecurrenceCadence,
} from "./financial-events.ts";
import {
  formatTransactionCategoryPath,
  type MoneyTransaction,
} from "./money-picture.ts";

export const RECURRING_COMMITMENT_RULE_VERSION =
  "recurring-commitments-v1-2026-07-30";
export const PRICE_INCREASE_MINIMUM_DOLLARS = 5;
export const PRICE_INCREASE_MINIMUM_PERCENT = 10;

export type RecurringCommitmentType =
  | "subscription"
  | "utility"
  | "insurance"
  | "membership"
  | "software_service"
  | "installment_loan"
  | "buy_now_pay_later"
  | "loan_payment"
  | "recurring_transfer"
  | "other_recurring"
  | "unknown_recurring";

export type RecurringCommitmentDecision = {
  recurringStatus: "confirmed" | "completed" | "possible" | "not_recurring";
  recognitionStatus: "recognized" | "unrecognized" | "unsure";
  disposition: "keep" | "review" | "cancellation_requested" | "unsure";
  commitmentType: RecurringCommitmentType | null;
  ownerLabel: "Mine" | "Household" | "Business" | "Someone else" | "Not sure" | null;
  userNote: string | null;
  identityNote: string | null;
  loginStatus: "known" | "cannot_find" | "belongs_to_someone_else" | "unsure" | null;
  duplicateDecision: "separate" | "review" | "unrecognized_one" | null;
  manualOriginalPurpose: string | null;
  manualCurrentBalance: number | null;
  manualOriginalAmount: number | null;
  manualPaymentsRemaining: number | null;
  manualNextPaymentDate: string | null;
};

export type RecurringCommitment = {
  patternKey: string;
  sourceConditionSignature: string;
  engineRuleVersion: string;
  displayName: string;
  normalizedMerchant: string;
  detectedType: RecurringCommitmentType;
  type: RecurringCommitmentType;
  status: "confirmed" | "completed" | "possible" | "needs_attention";
  confidence: FinancialEventConfidence;
  confidenceExplanation: string;
  cadence: RecurrenceCadence;
  typicalAmount: number;
  amountMin: number;
  amountMax: number;
  lastAmount: number;
  priorAmount: number | null;
  firstObserved: string;
  lastObserved: string;
  nextExpected: string | null;
  paymentAccountId: string;
  paymentAccountLabel: string;
  effectiveCategory: string;
  supportingTransactionIds: string[];
  supportingTransactions: MoneyTransaction[];
  variableAmount: boolean;
  installmentAmbiguous: boolean;
  attentionReasons: string[];
  decision: RecurringCommitmentDecision | null;
  housingObligationVersionId: string | null;
};

export function reconcileSupportingTransactions(
  commitment: Pick<
    RecurringCommitment,
    "supportingTransactionIds" | "supportingTransactions"
  >,
) {
  const availableById = new Map(
    commitment.supportingTransactions.map((transaction) => [
      transaction.id,
      transaction,
    ]),
  );
  const requestedIds = [...new Set(commitment.supportingTransactionIds)];
  const available = requestedIds.flatMap((id) => {
    const transaction = availableById.get(id);
    return transaction ? [transaction] : [];
  });
  return {
    available,
    missingCount: requestedIds.length - available.length,
  };
}

const normalizeMerchant = (value: string) =>
  value.toUpperCase().replace(/\b\d{2,}\b/g, "").replace(/[^A-Z]+/g, " ").trim();
const installmentProvider =
  /\b(AFFIRM|KLARNA|AFTERPAY|ZIP|PAYPAL PAY IN 4|PAY IN 4)\b/i;
const generalRetailCategory =
  /\b(GENERAL MERCHANDISE|GROCER|GAS|RESTAURANT|FOOD & DRINK|SHOPPING)\b/i;

function commitmentType(proposedType: string, name: string): RecurringCommitmentType {
  if (installmentProvider.test(name)) return "buy_now_pay_later";
  const map: Record<string, RecurringCommitmentType> = {
    subscription: "subscription",
    utility_bill: "utility",
    insurance_premium: "insurance",
    membership: "membership",
    recurring_service: "software_service",
    loan_payment: "loan_payment",
    other_recurring_bill: "other_recurring",
    unresolved_recurring_payment: "unknown_recurring",
  };
  return map[proposedType] || "unknown_recurring";
}

function latestDecisionFor(
  decisions: ReadonlyMap<string, RecurringCommitmentDecision>,
  patternKey: string,
) {
  return decisions.get(patternKey) || null;
}

export function buildRecurringCommitments(
  transactions: MoneyTransaction[],
  decisions: ReadonlyMap<string, RecurringCommitmentDecision> = new Map(),
) {
  const byId = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const candidates = buildFinancialEventLayer(transactions).recurringPaymentReview;
  const commitments: RecurringCommitment[] = [];

  for (const candidate of candidates) {
    const rows = candidate.sourceTransactionIds
      .map((id) => byId.get(id))
      .filter((row): row is MoneyTransaction => Boolean(row))
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    if (rows.length < 3) continue;
    // Housing obligations already have a canonical, versioned model. Do not
    // create a second recurring truth for the same rent or mortgage payments.
    if (rows.some((row) => row.housingObligation)) continue;
    const category = formatTransactionCategoryPath(rows.at(-1)!);
    const type = commitmentType(candidate.proposedType, candidate.displayName);
    if (
      type === "unknown_recurring" &&
      generalRetailCategory.test(category)
    ) {
      continue;
    }
    const amounts = rows.map((row) => Math.abs(row.amount));
    const amountMin = Math.min(...amounts);
    const amountMax = Math.max(...amounts);
    const lastAmount = amounts.at(-1)!;
    const priorAmount = amounts.length > 1 ? amounts.at(-2)! : null;
    const variableAmount = candidate.amountVariability > 0.15;
    const increaseDollars = priorAmount === null ? 0 : lastAmount - priorAmount;
    const increasePercent =
      priorAmount && priorAmount > 0 ? (increaseDollars / priorAmount) * 100 : 0;
    const attentionReasons: string[] = [];
    if (
      !variableAmount &&
      increaseDollars >= PRICE_INCREASE_MINIMUM_DOLLARS &&
      increasePercent >= PRICE_INCREASE_MINIMUM_PERCENT
    ) {
      attentionReasons.push(
        `Price increased from ${money(priorAmount!)} to ${money(lastAmount)}.`,
      );
    }
    const decision = latestDecisionFor(decisions, candidate.aliasKey);
    if (decision?.recognitionStatus === "unrecognized") {
      attentionReasons.push("You marked this commitment as unrecognized.");
    }
    if (decision?.disposition === "cancellation_requested") {
      attentionReasons.push("Cancellation requested for review.");
    }
    if (decision?.disposition === "review") {
      attentionReasons.push("You marked this commitment to review later.");
    }
    if (decision?.duplicateDecision === "review") {
      attentionReasons.push("Possible duplicate marked for review.");
    }
    const installmentAmbiguous =
      type === "buy_now_pay_later" &&
      rows.every((row) => normalizeMerchant(row.name) === normalizeMerchant(candidate.displayName));
    if (installmentAmbiguous) {
      attentionReasons.push(
        `${candidate.displayName} may include more than one payment plan.`,
      );
    }
    const recurringStatus = decision?.recurringStatus || "possible";
    if (recurringStatus === "not_recurring") continue;
    const status = attentionReasons.length
      ? recurringStatus === "completed"
        ? "completed"
        : "needs_attention"
      : recurringStatus === "completed"
        ? "completed"
        : recurringStatus === "confirmed"
        ? "confirmed"
        : "possible";
    commitments.push({
      patternKey: candidate.aliasKey,
      sourceConditionSignature: candidate.sourceConditionSignature,
      engineRuleVersion: candidate.engineRuleVersion,
      displayName: candidate.displayName,
      normalizedMerchant: normalizeMerchant(candidate.displayName),
      detectedType: type,
      type: decision?.commitmentType || type,
      status,
      confidence: candidate.confidence,
      confidenceExplanation: `${candidate.observationCount} posted charges from the same merchant pattern and payment account; ${candidate.cadence} timing; ${Math.round(candidate.amountVariability * 100)}% amount variability.`,
      cadence: candidate.cadence,
      typicalAmount: candidate.typicalAmount,
      amountMin,
      amountMax,
      lastAmount,
      priorAmount,
      firstObserved: candidate.firstObserved,
      lastObserved: candidate.lastObserved,
      nextExpected:
        candidate.confidence === "low" || candidate.cadence === "irregular"
          ? null
          : nextExpected(candidate.lastObserved, candidate.cadence),
      paymentAccountId: candidate.account.id,
      paymentAccountLabel: candidate.account.label,
      effectiveCategory: category,
      supportingTransactionIds: rows.map((row) => row.id),
      supportingTransactions: rows,
      variableAmount,
      installmentAmbiguous,
      attentionReasons,
      decision,
      housingObligationVersionId: null,
    });
  }

  const duplicateGroups = new Map<string, RecurringCommitment[]>();
  for (const commitment of commitments) {
    const group = duplicateGroups.get(commitment.normalizedMerchant) || [];
    group.push(commitment);
    duplicateGroups.set(commitment.normalizedMerchant, group);
  }
  for (const group of duplicateGroups.values()) {
    if (group.length < 2) continue;
    for (const commitment of group) {
      if (!commitment.attentionReasons.some((reason) => reason.includes("duplicate"))) {
        commitment.attentionReasons.push("Possible duplicate pattern; review the supporting charges.");
        commitment.status = "needs_attention";
      }
    }
  }
  return commitments.sort(
    (a, b) =>
      ({ needs_attention: 0, confirmed: 1, possible: 2, completed: 3 }[a.status] -
        { needs_attention: 0, confirmed: 1, possible: 2, completed: 3 }[b.status]) ||
      b.lastObserved.localeCompare(a.lastObserved) ||
      a.patternKey.localeCompare(b.patternKey),
  );
}

export function recurringCommitmentSummary(commitments: RecurringCommitment[]) {
  const confirmed = commitments.filter((item) => item.status === "confirmed");
  const possible = commitments.filter((item) => item.status === "possible");
  const needsAttention = commitments.filter((item) => item.status === "needs_attention");
  const completed = commitments.filter((item) => item.status === "completed");
  const monthlyEligible =
    confirmed.length > 0 &&
    confirmed.every(
      (item) =>
        !item.variableAmount &&
        ["weekly", "biweekly", "monthly"].includes(item.cadence) &&
        !item.housingObligationVersionId,
    );
  const monthlyEquivalent = monthlyEligible
    ? confirmed.reduce((total, item) => {
        const factor = item.cadence === "weekly" ? 52 / 12 : item.cadence === "biweekly" ? 26 / 12 : 1;
        return total + item.typicalAmount * factor;
      }, 0)
    : null;
  return {
    confirmed: confirmed.length,
    possible: possible.length,
    needsAttention: needsAttention.length,
    completed: completed.length,
    monthlyEquivalent,
    meaningfulAttention:
      needsAttention
        .flatMap((item) => item.attentionReasons)
        .find(
          (reason) =>
            !/cancellation requested for review/i.test(reason),
        ) || null,
  };
}

export const money = (amount: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

export function amountDescription(commitment: RecurringCommitment) {
  return commitment.variableAmount
    ? `Usually ${money(commitment.amountMin)}–${money(commitment.amountMax)}`
    : `${money(commitment.typicalAmount)} ${commitment.cadence}`;
}

function nextExpected(date: string, cadence: RecurrenceCadence) {
  const days = {
    weekly: 7,
    biweekly: 14,
    monthly: 30,
    quarterly: 91,
    semiannual: 182,
    annual: 365,
    irregular: 0,
  }[cadence];
  if (!days) return null;
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
