"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireFounderReviewUser } from "@/lib/founder-review-auth";
import { loadFinancialEventReviewQueue } from "@/lib/financial-event-review-server";
import {
  resolveFinancialPeriod,
  type FinancialPeriodKey,
} from "@/lib/financial-periods";
import {
  GROUPING_CONFIRMATION_TYPES,
  RECURRING_CONFIRMATION_TYPES,
  groupingDecision,
  recurringDecision,
  type GroupingConfirmationType,
  type RecurringConfirmationType,
} from "@/lib/financial-event-confirmations";

export async function saveFinancialEventReview(formData: FormData) {
  const user = await requireFounderReviewUser();
  const eventId = String(formData.get("eventId") || "");
  const conditionSignature = String(formData.get("conditionSignature") || "");
  const decision = String(formData.get("decision") || "");
  const context =
    String(formData.get("context") || "").trim() ||
    String(formData.get("contextSuggestion") || "").trim();
  const period = resolveFinancialPeriod({
    key: String(formData.get("periodKey") || "this-month") as FinancialPeriodKey,
    start: String(formData.get("periodStart") || "") || undefined,
    end: String(formData.get("periodEnd") || "") || undefined,
  });
  if (!eventId || !conditionSignature || context.length > 120) {
    throw new Error("INVALID_EVENT_REVIEW");
  }

  const queue = await loadFinancialEventReviewQueue(user.id, period);
  const current = queue.find(
    (card) =>
      card.eventId === eventId &&
      card.conditionSignature === conditionSignature,
  );
  if (!current) throw new Error("STALE_EVENT_REVIEW");

  let values: Record<string, unknown>;
  if (
    current.kind === "recurring" &&
    RECURRING_CONFIRMATION_TYPES.includes(
      decision as RecurringConfirmationType,
    )
  ) {
    values = {
      ...recurringDecision(decision as RecurringConfirmationType),
      groupingConfirmed: null,
      groupingRejected: false,
    };
  } else if (
    current.kind === "grouped" &&
    GROUPING_CONFIRMATION_TYPES.includes(
      decision as GroupingConfirmationType,
    )
  ) {
    values = {
      ...groupingDecision(decision as GroupingConfirmationType),
      recurrenceConfirmed: null,
      recurrenceRejected: false,
    };
  } else {
    throw new Error("INVALID_EVENT_REVIEW_DECISION");
  }

  const { error } = await createSupabaseAdminClient()
    .from("financial_event_confirmations")
    .insert({
      user_id: user.id,
      event_id: current.eventId,
      inferred_type: current.inferredType,
      selected_decision: decision,
      user_confirmed_type: values.userConfirmedType || null,
      user_confirmed_title: null,
      user_context_label: context || null,
      relationship_decision: current.kind === "grouped" ? decision : null,
      re_review_reason: current.reReviewReason,
      review_priority_score: current.priorityScore,
      review_priority_reason: current.priorityReason,
      recurrence_confirmed: values.recurrenceConfirmed ?? null,
      recurrence_rejected: values.recurrenceRejected || false,
      grouping_confirmed: values.groupingConfirmed ?? null,
      grouping_rejected: values.groupingRejected || false,
      reviewed_by: user.id,
      source_condition_signature: current.conditionSignature,
      engine_rule_version: current.ruleVersion,
    });
  if (error) throw new Error("EVENT_REVIEW_SAVE_FAILED");
  revalidatePath("/account/events/review");
  const refreshedQueue = await loadFinancialEventReviewQueue(user.id, period);
  const next = refreshedQueue.find(
    (card) =>
      card.reviewTier === "primary" && card.eventId !== current.eventId,
  );
  return {
    savedEventId: current.eventId,
    nextEventId: next?.eventId ?? null,
  };
}
