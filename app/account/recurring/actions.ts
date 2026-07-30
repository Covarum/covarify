"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadRecurringCommitments } from "@/lib/recurring-commitments-server";
import type {
  RecurringCommitmentDecision,
  RecurringCommitmentType,
} from "@/lib/recurring-commitments";

const allowedTypes = new Set<RecurringCommitmentType>([
  "subscription",
  "utility",
  "insurance",
  "membership",
  "software_service",
  "installment_loan",
  "buy_now_pay_later",
  "loan_payment",
  "recurring_transfer",
  "other_recurring",
  "unknown_recurring",
]);
const recurringStatuses = new Set(["confirmed", "possible", "not_recurring"]);
const recognitionStatuses = new Set(["recognized", "unrecognized", "unsure"]);
const dispositions = new Set(["keep", "review", "cancellation_requested", "unsure"]);
const owners = new Set(["Mine", "Household", "Business", "Someone else", "Not sure"]);
const loginStatuses = new Set(["known", "cannot_find", "belongs_to_someone_else", "unsure"]);
const duplicateDecisions = new Set(["separate", "review", "unrecognized_one"]);

const text = (formData: FormData, name: string, maximum: number) => {
  const value = String(formData.get(name) || "").trim();
  if (value.length > maximum) throw new Error("RECURRING_NOTE_TOO_LONG");
  return value || null;
};
const choice = <T extends string>(
  formData: FormData,
  name: string,
  allowed: ReadonlySet<T>,
  fallback: T,
) => {
  const value = String(formData.get(name) || "");
  return allowed.has(value as T) ? (value as T) : fallback;
};
const optionalChoice = <T extends string>(
  formData: FormData,
  name: string,
  allowed: ReadonlySet<T>,
  fallback: T | null,
) => {
  const value = String(formData.get(name) || "");
  return allowed.has(value as T) ? (value as T) : fallback;
};
const optionalNumber = (formData: FormData, name: string) => {
  const value = String(formData.get(name) || "").trim();
  if (!value) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error("INVALID_USER_PROVIDED_AMOUNT");
  return number;
};
const optionalInteger = (formData: FormData, name: string) => {
  const number = optionalNumber(formData, name);
  if (number !== null && !Number.isInteger(number)) {
    throw new Error("INVALID_USER_PROVIDED_COUNT");
  }
  return number;
};
const optionalDate = (formData: FormData, name: string) => {
  const value = text(formData, name, 10);
  if (
    value &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(`${value}T00:00:00Z`)))
  ) {
    throw new Error("INVALID_USER_PROVIDED_DATE");
  }
  return value;
};
const assertNoCredential = (value: string | null) => {
  if (
    value &&
    /\b(password|passcode|security\s*code|verification\s*code|one[- ]time\s*(?:password|code)|otp)\b\s*[:=]/i.test(
      value,
    )
  ) {
    throw new Error("CREDENTIALS_NOT_ALLOWED");
  }
  return value;
};

export async function saveRecurringCommitmentDecision(formData: FormData) {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("AUTHENTICATION_REQUIRED");
  const patternKey = String(formData.get("patternKey") || "");
  const data = await loadRecurringCommitments(user.id);
  const commitment = data.commitments.find((item) => item.patternKey === patternKey);
  if (!commitment) throw new Error("RECURRING_COMMITMENT_NOT_FOUND");

  const prior = commitment.decision;
  const isEditor = formData.get("mode") === "editor";
  const userNote = text(formData, "userNote", 1000);
  const identityNote = assertNoCredential(text(formData, "identityNote", 500));
  const manualOriginalPurpose = text(formData, "manualOriginalPurpose", 240);
  const manualCurrentBalance = optionalNumber(formData, "manualCurrentBalance");
  const manualOriginalAmount = optionalNumber(formData, "manualOriginalAmount");
  const manualPaymentsRemaining = optionalInteger(
    formData,
    "manualPaymentsRemaining",
  );
  const manualNextPaymentDate = optionalDate(formData, "manualNextPaymentDate");
  const decision: RecurringCommitmentDecision = {
    recurringStatus: choice(
      formData,
      "recurringStatus",
      recurringStatuses,
      prior?.recurringStatus || "possible",
    ) as RecurringCommitmentDecision["recurringStatus"],
    recognitionStatus: choice(
      formData,
      "recognitionStatus",
      recognitionStatuses,
      prior?.recognitionStatus || "unsure",
    ) as RecurringCommitmentDecision["recognitionStatus"],
    disposition: choice(
      formData,
      "disposition",
      dispositions,
      prior?.disposition || "unsure",
    ) as RecurringCommitmentDecision["disposition"],
    commitmentType: choice(
      formData,
      "commitmentType",
      allowedTypes,
      prior?.commitmentType || commitment.type,
    ),
    ownerLabel: choice(
      formData,
      "ownerLabel",
      owners,
      prior?.ownerLabel || "Not sure",
    ) as RecurringCommitmentDecision["ownerLabel"],
    userNote: isEditor ? userNote : (prior?.userNote ?? null),
    identityNote: isEditor ? identityNote : (prior?.identityNote ?? null),
    loginStatus: choice(
      formData,
      "loginStatus",
      loginStatuses,
      prior?.loginStatus || "unsure",
    ) as RecurringCommitmentDecision["loginStatus"],
    duplicateDecision: optionalChoice(
      formData,
      "duplicateDecision",
      duplicateDecisions,
      prior?.duplicateDecision || null,
    ) as RecurringCommitmentDecision["duplicateDecision"],
    manualOriginalPurpose: isEditor
      ? manualOriginalPurpose
      : (prior?.manualOriginalPurpose ?? null),
    manualCurrentBalance: isEditor
      ? manualCurrentBalance
      : (prior?.manualCurrentBalance ?? null),
    manualOriginalAmount: isEditor
      ? manualOriginalAmount
      : (prior?.manualOriginalAmount ?? null),
    manualPaymentsRemaining: isEditor
      ? manualPaymentsRemaining
      : (prior?.manualPaymentsRemaining ?? null),
    manualNextPaymentDate: isEditor
      ? manualNextPaymentDate
      : (prior?.manualNextPaymentDate ?? null),
  };

  const { error } = await createSupabaseAdminClient().rpc(
    "record_recurring_commitment_decision",
    {
      p_user_id: user.id,
      p_pattern_key: commitment.patternKey,
      p_detection: {
        sourceConditionSignature: commitment.sourceConditionSignature,
        engineRuleVersion: commitment.engineRuleVersion,
        displayName: commitment.displayName,
        normalizedMerchant: commitment.normalizedMerchant,
        commitmentType: commitment.type,
        confidence: commitment.confidence,
        cadence: commitment.cadence,
        typicalAmount: commitment.typicalAmount,
        amountMin: commitment.amountMin,
        amountMax: commitment.amountMax,
        firstObserved: commitment.firstObserved,
        lastObserved: commitment.lastObserved,
        nextExpected: commitment.nextExpected,
        paymentAccountId: commitment.paymentAccountId,
        effectiveCategory: commitment.effectiveCategory,
        housingObligationVersionId: commitment.housingObligationVersionId,
        explanation: commitment.confidenceExplanation,
      },
      p_supporting_transaction_ids: commitment.supportingTransactionIds,
      p_decision: decision,
    },
  );
  if (error) throw new Error("RECURRING_DECISION_SAVE_FAILED");
  revalidatePath("/account/recurring");
  revalidatePath("/account");
}
