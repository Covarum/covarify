import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  applyEffectiveCategories,
  type MerchantCategoryRule,
  type TransactionUnderstandingRecord,
} from "@/lib/transaction-understanding";
import type { MoneyTransaction } from "@/lib/money-picture";
import {
  normalizeCategoryName,
  normalizeMerchantName,
  SYSTEM_CATEGORY_PARENTS,
  type CategorySubcategory,
} from "@/lib/category-hierarchy";

const rowToRecord = (row: Record<string, unknown>): TransactionUnderstandingRecord => ({
  id: String(row.id),
  userId: String(row.user_id),
  transactionId: String(row.plaid_transaction_id),
  sourceConditionSignature: String(row.source_condition_signature),
  parsedIntent: row.parsed_intent as TransactionUnderstandingRecord["parsedIntent"],
  priorEffectiveState: row.prior_effective_state as TransactionUnderstandingRecord["priorEffectiveState"],
  confirmedCategory: (row.confirmed_category || null) as TransactionUnderstandingRecord["confirmedCategory"],
  confirmedParentCategoryId: row.effective_parent_category_id ? String(row.effective_parent_category_id) : null,
  confirmedParentCategory: row.confirmed_parent_category ? String(row.confirmed_parent_category) : null,
  confirmedSubcategoryId: row.effective_subcategory_id ? String(row.effective_subcategory_id) : null,
  confirmedSubcategory: row.confirmed_subcategory ? String(row.confirmed_subcategory) : null,
  requestedSubcategoryName: row.requested_subcategory_name ? String(row.requested_subcategory_name) : null,
  assignmentSource: (row.assignment_source || null) as TransactionUnderstandingRecord["assignmentSource"],
  merchantRuleId: row.merchant_rule_id ? String(row.merchant_rule_id) : null,
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
  const [history, merchantRules] = await Promise.all([
    loadTransactionUnderstandingHistory(userId),
    loadMerchantCategoryRules(userId),
  ]);
  return {
    history,
    transactions: applyEffectiveCategories(transactions, new Map(), history, merchantRules),
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
    effective_parent_category_id: record.confirmedParentCategoryId,
    effective_subcategory_id: record.confirmedSubcategoryId,
    confirmed_parent_category: record.confirmedParentCategory,
    confirmed_subcategory: record.confirmedSubcategory,
    requested_subcategory_name: record.requestedSubcategoryName,
    assignment_source: record.assignmentSource,
    merchant_rule_id: record.merchantRuleId,
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

export async function appendTransactionUnderstandingRecords(
  records: TransactionUnderstandingRecord[],
) {
  if (!records.length) return;
  const { error } = await createSupabaseAdminClient()
    .from("transaction_understanding_confirmations")
    .insert(records.map(recordToInsert));
  if (error) throw new Error("CONFIRMATION_APPEND_FAILED");
}

const subcategoryFromRow = (row: Record<string, unknown>): CategorySubcategory => ({
  id: String(row.id),
  userId: row.user_id ? String(row.user_id) : null,
  parentCategoryId: String(row.parent_category_id),
  displayName: String(row.display_name),
  normalizedName: String(row.normalized_name),
  aliases: Array.isArray(row.aliases) ? row.aliases.map(String) : [],
  categoryType: row.category_type as CategorySubcategory["categoryType"],
  status: row.status as CategorySubcategory["status"],
});

export async function loadAvailableSubcategories(userId: string) {
  const { data, error } = await createSupabaseAdminClient()
    .from("category_subcategories")
    .select("id,user_id,parent_category_id,display_name,normalized_name,aliases,category_type,status")
    .eq("status", "active")
    .or(`user_id.is.null,user_id.eq.${userId}`);
  if (error) {
    if (error.code === "42P01") return [];
    throw new Error("SUBCATEGORY_CATALOG_FAILED");
  }
  return (data || []).map((row) => subcategoryFromRow(row as Record<string, unknown>));
}

export async function createUserSubcategory(userId: string, parentCategoryId: string, displayName: string) {
  const parent = SYSTEM_CATEGORY_PARENTS.find((candidate) => candidate.id === parentCategoryId);
  if (!parent) throw new Error("INVALID_PARENT_CATEGORY");
  if (!displayName.trim() || displayName.trim().length > 60) throw new Error("INVALID_SUBCATEGORY");
  const normalizedName = normalizeCategoryName(displayName);
  if (!normalizedName) throw new Error("INVALID_SUBCATEGORY");
  const { data, error } = await createSupabaseAdminClient()
    .from("category_subcategories")
    .insert({
      user_id: userId,
      parent_category_id: parentCategoryId,
      display_name: displayName.trim(),
      normalized_name: normalizedName,
      aliases: [],
      category_type: "user",
      status: "active",
    })
    .select("id,user_id,parent_category_id,display_name,normalized_name,aliases,category_type,status")
    .single();
  if (error?.code === "23505") throw new Error("DUPLICATE_SUBCATEGORY");
  if (error || !data) throw new Error("SUBCATEGORY_CREATE_FAILED");
  return subcategoryFromRow(data as Record<string, unknown>);
}

export async function loadMerchantCategoryRules(userId: string, includeArchived = false): Promise<MerchantCategoryRule[]> {
  let query = createSupabaseAdminClient()
    .from("merchant_category_rules")
    .select("id,merchant_identifier,normalized_merchant_name,parent_category_id,subcategory_id,rule_scope,status,created_at,category_subcategories(display_name)")
    .eq("user_id", userId);
  if (!includeArchived) query = query.eq("status", "active");
  const { data, error } = await query;
  if (error) {
    if (error.code === "42P01") return [];
    throw new Error("MERCHANT_RULES_FAILED");
  }
  return (data || []).map((row) => {
    const parent = SYSTEM_CATEGORY_PARENTS.find((candidate) => candidate.id === row.parent_category_id);
    const joined = row.category_subcategories as unknown as { display_name?: string } | null;
    return {
      id: String(row.id),
      merchantIdentifier: row.merchant_identifier ? String(row.merchant_identifier) : null,
      normalizedMerchantName: String(row.normalized_merchant_name),
      parentCategoryId: String(row.parent_category_id),
      parentCategoryName: parent?.displayName || "Other",
      subcategoryId: String(row.subcategory_id),
      subcategoryName: String(joined?.display_name || "Other"),
      ruleScope: row.rule_scope as MerchantCategoryRule["ruleScope"],
      status: row.status as MerchantCategoryRule["status"],
      createdAt: String(row.created_at),
    };
  });
}

export async function createMerchantCategoryRule(input: {
  id: string;
  userId: string;
  merchantName: string;
  parentCategoryId: string;
  subcategoryId: string;
  ruleScope: "future" | "past_and_future";
  merchantIdentifier?: string | null;
}) {
  const { error } = await createSupabaseAdminClient().from("merchant_category_rules").insert({
    id: input.id,
    user_id: input.userId,
    merchant_identifier: input.merchantIdentifier || null,
    normalized_merchant_name: normalizeMerchantName(input.merchantName),
    parent_category_id: input.parentCategoryId,
    subcategory_id: input.subcategoryId,
    rule_scope: input.ruleScope,
    status: "active",
  });
  if (error) throw new Error("MERCHANT_RULE_CREATE_FAILED");
}

export async function replaceOrReactivateMerchantCategoryRule(input: {
  userId: string;
  existingRuleId: string;
  parentCategoryId: string;
  subcategoryId: string;
  ruleScope: "future" | "past_and_future";
}) {
  const { error } = await createSupabaseAdminClient()
    .from("merchant_category_rules")
    .update({
      parent_category_id: input.parentCategoryId,
      subcategory_id: input.subcategoryId,
      rule_scope: input.ruleScope,
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.existingRuleId)
    .eq("user_id", input.userId);
  if (error) throw new Error("MERCHANT_RULE_UPDATE_FAILED");
}
