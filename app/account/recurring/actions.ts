"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadRecurringCommitments } from "@/lib/recurring-commitments-server";
import type {
  RecurringCommitment,
  RecurringCommitmentDecision,
  RecurringCommitmentType,
} from "@/lib/recurring-commitments";

export type RecurringReviewActionState = {
  status: "idle" | "saved" | "error";
  error: string | null;
  patternKey: string | null;
  decision: RecurringCommitmentDecision | null;
  commitment: RecurringCommitment | null;
  destination: "confirmed" | "completed" | "possible" | "attention" | "suppressed" | null;
  message: string | null;
  savedLabels: string[];
};

const initialRecurringReviewActionState: RecurringReviewActionState = {
  status: "idle",
  error: null,
  patternKey: null,
  decision: null,
  commitment: null,
  destination: null,
  message: null,
  savedLabels: [],
};

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
const recurringStatuses = new Set(["confirmed", "completed", "possible", "not_recurring"]);
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

const destinationFor = (commitment: RecurringCommitment | null) => {
  if (!commitment) return "suppressed" as const;
  if (commitment.status === "completed") return "completed" as const;
  return commitment.status === "confirmed"
    ? ("confirmed" as const)
    : commitment.status === "needs_attention"
      ? ("attention" as const)
      : ("possible" as const);
};

const movementMessage = (
  decision: RecurringCommitmentDecision,
  destination: RecurringReviewActionState["destination"],
) => {
  if (destination === "suppressed") {
    return "This item was removed from recurring suggestions because you marked it Not recurring.";
  }
  if (destination === "confirmed") {
    return "This commitment was moved to Confirmed Recurring.";
  }
  if (destination === "completed") {
    return "Saved as a completed installment plan.";
  }
  if (destination === "attention") {
    return "This commitment was moved to Needs Attention.";
  }
  if (decision.recurringStatus === "possible") {
    return "This commitment remains in Possible Recurring until you confirm that it repeats.";
  }
  return "Your recurring commitment was updated.";
};

const labelsFor = (decision: RecurringCommitmentDecision) => {
  const labels = [
    decision.recurringStatus === "confirmed"
      ? "Active"
      : decision.recurringStatus === "completed"
        ? "Completed"
      : decision.recurringStatus === "not_recurring"
        ? "Not recurring"
        : "Recurrence not sure",
    decision.recognitionStatus === "recognized"
      ? "Recognized"
      : decision.recognitionStatus === "unrecognized"
        ? "Not recognized"
        : "Recognition not answered",
  ];
  if (decision.disposition === "keep") labels.push("Keep");
  if (decision.disposition === "review") labels.push("Review later");
  if (decision.disposition === "cancellation_requested") {
    labels.push("Marked for cancellation review");
  }
  return labels;
};

async function persistDecision(
  userId: string,
  commitment: RecurringCommitment,
  decision: RecurringCommitmentDecision,
) {
  const { error } = await createSupabaseAdminClient().rpc(
    "record_recurring_commitment_decision",
    {
      p_user_id: userId,
      p_pattern_key: commitment.patternKey,
      p_detection: {
        sourceConditionSignature: commitment.sourceConditionSignature,
        engineRuleVersion: commitment.engineRuleVersion,
        displayName: commitment.displayName,
        normalizedMerchant: commitment.normalizedMerchant,
        commitmentType: commitment.detectedType,
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
}

async function resultAfterSave(
  userId: string,
  patternKey: string,
  decision: RecurringCommitmentDecision,
): Promise<RecurringReviewActionState> {
  const refreshed = await loadRecurringCommitments(userId);
  const commitment =
    refreshed.commitments.find((item) => item.patternKey === patternKey) || null;
  const destination = destinationFor(commitment);
  revalidatePath("/account/recurring");
  revalidatePath("/account");
  return {
    status: "saved",
    error: null,
    patternKey,
    decision,
    commitment,
    destination,
    message: movementMessage(decision, destination),
    savedLabels: labelsFor(decision),
  };
}

export async function saveRecurringCommitmentDecision(
  _previousState: RecurringReviewActionState,
  formData: FormData,
): Promise<RecurringReviewActionState> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) throw new Error("AUTHENTICATION_REQUIRED");
    const patternKey = String(formData.get("patternKey") || "");
    const data = await loadRecurringCommitments(user.id);
    const commitment = data.commitments.find((item) => item.patternKey === patternKey);
    if (!commitment) throw new Error("RECURRING_COMMITMENT_NOT_FOUND");

    const prior = commitment.decision;
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
      commitmentType: optionalChoice(
        formData,
        "commitmentType",
        allowedTypes,
        null,
      ),
      ownerLabel: choice(
        formData,
        "ownerLabel",
        owners,
        prior?.ownerLabel || "Not sure",
      ) as RecurringCommitmentDecision["ownerLabel"],
      userNote: text(formData, "userNote", 1000),
      identityNote: assertNoCredential(text(formData, "identityNote", 500)),
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
      manualOriginalPurpose: text(formData, "manualOriginalPurpose", 240),
      manualCurrentBalance: optionalNumber(formData, "manualCurrentBalance"),
      manualOriginalAmount: optionalNumber(formData, "manualOriginalAmount"),
      manualPaymentsRemaining: optionalInteger(formData, "manualPaymentsRemaining"),
      manualNextPaymentDate: optionalDate(formData, "manualNextPaymentDate"),
    };
    if (decision.recurringStatus === "not_recurring") {
      decision.recognitionStatus = "unsure";
      decision.disposition = "unsure";
    } else if (decision.recurringStatus === "completed") {
      decision.disposition =
        decision.disposition === "cancellation_requested"
          ? "unsure"
          : decision.disposition;
    } else if (decision.recognitionStatus === "unsure") {
      decision.disposition = "unsure";
    } else if (
      decision.recognitionStatus === "unrecognized" &&
      decision.disposition === "keep"
    ) {
      decision.disposition = "unsure";
    }

    await persistDecision(user.id, commitment, decision);
    return await resultAfterSave(user.id, patternKey, decision);
  } catch (error) {
    const message =
      error instanceof Error && error.message === "CREDENTIALS_NOT_ALLOWED"
        ? "Do not enter passwords or security codes. Remove that information and try again."
        : "Covarify could not save this understanding. Your selections are still here; please try again.";
    return {
      ...initialRecurringReviewActionState,
      status: "error",
      error: message,
    };
  }
}

const decisionFromRow = (
  row: Record<string, unknown>,
): RecurringCommitmentDecision => ({
  recurringStatus: (row.recurring_status || "possible") as RecurringCommitmentDecision["recurringStatus"],
  recognitionStatus: (row.recognition_status || "unsure") as RecurringCommitmentDecision["recognitionStatus"],
  disposition: (row.disposition || "unsure") as RecurringCommitmentDecision["disposition"],
  commitmentType: row.commitment_type
    ? (row.commitment_type as RecurringCommitmentType)
    : null,
  ownerLabel: (row.owner_label || "Not sure") as RecurringCommitmentDecision["ownerLabel"],
  userNote: row.user_note ? String(row.user_note) : null,
  identityNote: row.identity_note ? String(row.identity_note) : null,
  loginStatus: (row.login_status || "unsure") as RecurringCommitmentDecision["loginStatus"],
  duplicateDecision: (row.duplicate_decision || null) as RecurringCommitmentDecision["duplicateDecision"],
  manualOriginalPurpose: row.manual_original_purpose ? String(row.manual_original_purpose) : null,
  manualCurrentBalance: row.manual_current_balance == null ? null : Number(row.manual_current_balance),
  manualOriginalAmount: row.manual_original_amount == null ? null : Number(row.manual_original_amount),
  manualPaymentsRemaining: row.manual_payments_remaining == null ? null : Number(row.manual_payments_remaining),
  manualNextPaymentDate: row.manual_next_payment_date ? String(row.manual_next_payment_date) : null,
});

export async function undoRecurringCommitmentDecision(
  patternKey: string,
): Promise<RecurringReviewActionState> {
  try {
    const user = await getAuthenticatedUser();
    if (!user) throw new Error("AUTHENTICATION_REQUIRED");
    const admin = createSupabaseAdminClient();
    const { data: stored, error: storedError } = await admin
      .from("recurring_commitments")
      .select("id,detection_evidence")
      .eq("user_id", user.id)
      .eq("pattern_key", patternKey)
      .single();
    if (storedError || !stored) throw new Error("RECURRING_COMMITMENT_NOT_FOUND");

    const [{ data: versions, error: versionError }, { data: links, error: linkError }] =
      await Promise.all([
        admin
          .from("recurring_commitment_decision_versions")
          .select("*")
          .eq("user_id", user.id)
          .eq("commitment_id", stored.id),
        admin
          .from("recurring_commitment_transactions")
          .select("plaid_transaction_id")
          .eq("user_id", user.id)
          .eq("commitment_id", stored.id),
      ]);
    if (versionError || linkError || !versions?.length || !links?.length) {
      throw new Error("RECURRING_UNDO_UNAVAILABLE");
    }
    const superseded = new Set(
      versions
        .map((row) => row.supersedes_version_id)
        .filter((value): value is string => Boolean(value)),
    );
    const current = versions.find((row) => !superseded.has(row.id));
    if (!current) throw new Error("RECURRING_UNDO_UNAVAILABLE");
    const previous = current.supersedes_version_id
      ? versions.find((row) => row.id === current.supersedes_version_id)
      : null;
    const detection = stored.detection_evidence as Record<string, unknown>;
    const decision = previous
      ? decisionFromRow(previous as Record<string, unknown>)
      : decisionFromRow({});

    const { error } = await admin.rpc("record_recurring_commitment_decision", {
      p_user_id: user.id,
      p_pattern_key: patternKey,
      p_detection: detection,
      p_supporting_transaction_ids: links.map((row) => row.plaid_transaction_id),
      p_decision: decision,
    });
    if (error) throw new Error("RECURRING_UNDO_FAILED");
    return await resultAfterSave(user.id, patternKey, decision);
  } catch {
    return {
      ...initialRecurringReviewActionState,
      status: "error",
      error: "Covarify could not undo that change. Nothing was deleted; please try again.",
    };
  }
}
