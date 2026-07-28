import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  applyEffectiveCategories,
  type TransactionUnderstandingRecord,
} from "@/lib/transaction-understanding";
import type { MoneyTransaction } from "@/lib/money-picture";

const rowToRecord = (row: Record<string, unknown>): TransactionUnderstandingRecord => ({
  id: String(row.id),
  userId: String(row.user_id),
  transactionId: String(row.plaid_transaction_id),
  sourceConditionSignature: String(row.source_condition_signature),
  parsedIntent: row.parsed_intent as TransactionUnderstandingRecord["parsedIntent"],
  priorEffectiveState: row.prior_effective_state as TransactionUnderstandingRecord["priorEffectiveState"],
  confirmedCategory: (row.confirmed_category || null) as TransactionUnderstandingRecord["confirmedCategory"],
  treatment: (row.treatment || null) as TransactionUnderstandingRecord["treatment"],
  split: (row.split_details || null) as TransactionUnderstandingRecord["split"],
  contextLabel: row.context_label ? String(row.context_label) : null,
  note: row.note ? String(row.note) : null,
  reimbursable: Boolean(row.reimbursable),
  receiptNeeded: Boolean(row.receipt_needed),
  confirmedAt: String(row.confirmed_at),
  confirmedBy: String(row.confirmed_by),
  supersedesRecordId: row.supersedes_record_id ? String(row.supersedes_record_id) : null,
  ruleVersion: String(row.rule_version),
  inputModality: row.input_modality as TransactionUnderstandingRecord["inputModality"],
  matchConfidence: row.match_confidence as TransactionUnderstandingRecord["matchConfidence"],
});

export async function loadTransactionUnderstandingHistory(userId: string) {
  const { data, error } = await createSupabaseAdminClient()
    .from("transaction_understanding_confirmations")
    .select("*")
    .eq("user_id", userId)
    .order("confirmed_at", { ascending: true });
  if (error) {
    if (error.code === "42P01") return [];
    throw new Error("TRANSACTION_UNDERSTANDING_HISTORY_FAILED");
  }
  return (data || []).map((row) => rowToRecord(row as Record<string, unknown>));
}

export async function applyFounderTransactionUnderstanding(
  userId: string,
  transactions: MoneyTransaction[],
) {
  const history = await loadTransactionUnderstandingHistory(userId);
  return {
    history,
    transactions: applyEffectiveCategories(transactions, new Map(), history),
  };
}

export function recordToInsert(record: TransactionUnderstandingRecord) {
  return {
    id: record.id,
    user_id: record.userId,
    plaid_transaction_id: record.transactionId,
    source_condition_signature: record.sourceConditionSignature,
    parsed_intent: record.parsedIntent,
    prior_effective_state: record.priorEffectiveState,
    confirmed_category: record.confirmedCategory,
    treatment: record.treatment,
    split_details: record.split,
    context_label: record.contextLabel,
    note: record.note,
    reimbursable: record.reimbursable,
    receipt_needed: record.receiptNeeded,
    confirmed_at: record.confirmedAt,
    confirmed_by: record.confirmedBy,
    supersedes_record_id: record.supersedesRecordId,
    rule_version: record.ruleVersion,
    input_modality: record.inputModality,
    match_confidence: record.matchConfidence,
  };
}
