import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { normalizePersistedPlaidCategory } from "../lib/plaid/category-normalization.ts";
import {
  buildMerchantRuleAssignmentRecords,
  type MerchantCategoryRule,
  type TransactionUnderstandingRecord,
} from "../lib/transaction-understanding.ts";
import { normalizeCategoryName, normalizeMerchantName } from "../lib/category-hierarchy.ts";
import type { MoneyTransaction } from "../lib/money-picture.ts";

const EXPECTED_MERCHANT = "WALMART";
const EXPECTED_PARENT_ID = "10000000-0000-4000-8000-000000000001";
const EXPECTED_SUBCATEGORY = "grocery";

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const ruleId = required("REPAIR_MERCHANT_RULE_ID");
const apply = process.argv.includes("--apply");
const allowedUsers = required("PLAID_PRODUCTION_ALLOWED_USER_IDS")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
if (allowedUsers.length !== 1) throw new Error("Repair requires the exact one-user production allowlist");

const db = createClient(
  required("NEXT_PUBLIC_SUPABASE_URL"),
  required("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
);

const { data: ruleRow, error: ruleError } = await db
  .from("merchant_category_rules")
  .select("id,user_id,merchant_identifier,normalized_merchant_name,parent_category_id,subcategory_id,rule_scope,status,created_at,category_subcategories(display_name,normalized_name,parent_category_id)")
  .eq("id", ruleId)
  .single();
if (ruleError || !ruleRow) throw new Error("Expected merchant rule was not found");
if (
  ruleRow.user_id !== allowedUsers[0] ||
  ruleRow.normalized_merchant_name !== EXPECTED_MERCHANT ||
  ruleRow.status !== "active" ||
  ruleRow.rule_scope !== "past_and_future" ||
  ruleRow.parent_category_id !== EXPECTED_PARENT_ID
) {
  throw new Error("Merchant rule does not match the approved founder Walmart repair boundary");
}
const joined = ruleRow.category_subcategories as unknown as {
  display_name?: string;
  normalized_name?: string;
  parent_category_id?: string;
} | null;
if (
  joined?.parent_category_id !== EXPECTED_PARENT_ID ||
  normalizeCategoryName(joined?.normalized_name || joined?.display_name || "") !== EXPECTED_SUBCATEGORY
) {
  throw new Error("Merchant rule does not resolve to Food & Drink → Groceries");
}

const [{ data: transactionRows, error: transactionError }, { data: historyRows, error: historyError }] =
  await Promise.all([
    db.from("plaid_transactions")
      .select("id,plaid_account_id,merchant_name,transaction_name,amount,currency,transaction_date,pending,pending_transaction_id,category_data")
      .eq("user_id", ruleRow.user_id)
      .is("removed_at", null),
    db.from("transaction_understanding_confirmations")
      .select("*")
      .eq("user_id", ruleRow.user_id)
      .order("confirmed_at", { ascending: true }),
  ]);
if (transactionError || historyError) throw new Error("Repair source audit failed");

const transactions = (transactionRows || []).map((row): MoneyTransaction => {
  const category = normalizePersistedPlaidCategory(row.category_data);
  const amount = Number(row.amount);
  return {
    id: String(row.id),
    plaidAccountId: String(row.plaid_account_id),
    accountLabel: "Connected account",
    name: String(row.merchant_name || row.transaction_name),
    amount,
    currency: String(row.currency || "USD"),
    date: String(row.transaction_date),
    pending: Boolean(row.pending),
    pendingTransactionId: row.pending_transaction_id ? String(row.pending_transaction_id) : null,
    category: category?.primary || "Uncategorized",
    sourceCategory: category?.primary || "Uncategorized",
    detailedCategory: category?.detailed || null,
    direction: amount < 0 ? "inflow" : amount > 0 ? "outflow" : "neutral",
    transferRelationship: null,
  };
});

const history = (historyRows || []).map((row): TransactionUnderstandingRecord => ({
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
}));

const rule: MerchantCategoryRule = {
  id: String(ruleRow.id),
  merchantIdentifier: ruleRow.merchant_identifier ? String(ruleRow.merchant_identifier) : null,
  normalizedMerchantName: EXPECTED_MERCHANT,
  parentCategoryId: EXPECTED_PARENT_ID,
  parentCategoryName: "Food & Drink",
  subcategoryId: String(ruleRow.subcategory_id),
  subcategoryName: String(joined?.display_name || "Groceries"),
  ruleScope: "past_and_future",
  status: "active",
  createdAt: String(ruleRow.created_at),
};
const confirmedAt = new Date().toISOString();
const records = buildMerchantRuleAssignmentRecords({
  userId: ruleRow.user_id,
  confirmedBy: ruleRow.user_id,
  rule,
  intent: {
    intentType: "merchant_rule",
    scopeSignal: "recurring",
    action: "classify",
    merchant: "Walmart",
    amount: null,
    approximateDate: null,
    accountLabel: null,
    direction: null,
    category: "Groceries",
    requestedSubcategory: "Groceries",
    treatment: null,
    split: null,
    contextLabel: null,
    note: null,
    reimbursable: false,
    receiptNeeded: false,
    modality: "typed",
    selectedTransactionId: null,
  },
  transactions,
  history,
  confirmedAt,
  idForTransaction: () => randomUUID(),
});

const rows = records.map((record) => ({
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
}));

if (apply && rows.length) {
  const { error } = await db.from("transaction_understanding_confirmations").insert(rows);
  if (error) throw new Error(`Repair append failed: ${error.code || "unknown"}`);
}

console.log(JSON.stringify({
  mode: apply ? "apply" : "dry-run",
  affectedRuleCount: 1,
  eligibleExactMerchantTransactions: transactions
    .filter((transaction) => normalizeMerchantName(transaction.name) === EXPECTED_MERCHANT).length,
  appendedAssignmentCount: rows.length,
  scope: "one allowlisted user, one explicit active Walmart past_and_future rule, normalized exact merchant matches",
}));
