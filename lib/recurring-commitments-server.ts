import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizePersistedPlaidCategory } from "@/lib/plaid/category-normalization";
import { annotateInternalTransfers, type MoneyTransaction } from "@/lib/money-picture";
import { applyFounderTransactionUnderstanding } from "@/lib/transaction-understanding-server";
import {
  buildRecurringCommitments,
  recurringCommitmentSummary,
  type RecurringCommitmentDecision,
} from "@/lib/recurring-commitments";
import { displaySeparated } from "@/lib/presentation-separators";

function mapTransaction(
  row: Record<string, unknown>,
  account: {
    label: string;
    type: string | null;
    subtype: string | null;
    institutionName: string | null;
  },
): MoneyTransaction {
  const category = normalizePersistedPlaidCategory(row.category_data);
  const amount = Number(row.amount);
  return {
    id: String(row.id),
    plaidAccountId: String(row.plaid_account_id),
    accountLabel: account.label,
    accountType: account.type,
    accountSubtype: account.subtype,
    institutionName: account.institutionName,
    merchantName: row.merchant_name ? String(row.merchant_name) : null,
    name: String(row.merchant_name || row.transaction_name),
    description: String(row.transaction_name || ""),
    amount,
    currency: String(row.currency || "USD"),
    date: String(row.transaction_date),
    pending: Boolean(row.pending),
    pendingTransactionId: row.pending_transaction_id
      ? String(row.pending_transaction_id)
      : null,
    category: category?.primary || "Uncategorized",
    detailedCategory: category?.detailed || null,
    direction: amount < 0 ? "inflow" : amount > 0 ? "outflow" : "neutral",
    transferRelationship: null,
  };
}

function mapDecision(row: Record<string, unknown>): RecurringCommitmentDecision {
  return {
    recurringStatus: row.recurring_status as RecurringCommitmentDecision["recurringStatus"],
    recognitionStatus: row.recognition_status as RecurringCommitmentDecision["recognitionStatus"],
    disposition: row.disposition as RecurringCommitmentDecision["disposition"],
    commitmentType: (row.commitment_type || null) as RecurringCommitmentDecision["commitmentType"],
    ownerLabel: (row.owner_label || null) as RecurringCommitmentDecision["ownerLabel"],
    userNote: row.user_note ? String(row.user_note) : null,
    identityNote: row.identity_note ? String(row.identity_note) : null,
    loginStatus: (row.login_status || null) as RecurringCommitmentDecision["loginStatus"],
    duplicateDecision: (row.duplicate_decision || null) as RecurringCommitmentDecision["duplicateDecision"],
    manualOriginalPurpose: row.manual_original_purpose ? String(row.manual_original_purpose) : null,
    manualCurrentBalance:
      row.manual_current_balance == null ? null : Number(row.manual_current_balance),
    manualOriginalAmount:
      row.manual_original_amount == null ? null : Number(row.manual_original_amount),
    manualPaymentsRemaining:
      row.manual_payments_remaining == null ? null : Number(row.manual_payments_remaining),
    manualNextPaymentDate: row.manual_next_payment_date
      ? String(row.manual_next_payment_date)
      : null,
  };
}

export async function loadRecurringCommitmentDecisionMap(userId: string) {
  const { data, error } = await createSupabaseAdminClient()
    .from("recurring_commitment_current_decisions")
    .select("*")
    .eq("user_id", userId);
  if (error && ["42P01", "PGRST205"].includes(error.code)) {
    return new Map<string, RecurringCommitmentDecision>();
  }
  if (error) throw new Error("RECURRING_DECISIONS_UNAVAILABLE");
  return new Map(
    (data || []).map((row) => [
      String(row.pattern_key),
      mapDecision(row as Record<string, unknown>),
    ]),
  );
}

export async function loadRecurringCommitments(userId: string) {
  const admin = createSupabaseAdminClient();
  const { data: items, error: itemError } = await admin
    .from("plaid_items")
    .select("id,institution_name,status")
    .eq("user_id", userId)
    .eq("environment", "production")
    .neq("status", "disconnected");
  if (itemError) throw new Error("RECURRING_ITEMS_UNAVAILABLE");
  if (!items?.length) {
    return {
      commitments: [],
      summary: recurringCommitmentSummary([]),
      syncPending: false,
      coverage: "Based on your connected accounts.",
    };
  }
  const itemIds = items.map((item) => item.id);
  const [accounts, transactions, sync, decisionMap] = await Promise.all([
    admin
      .from("plaid_accounts")
      .select("id,plaid_item_id,name,official_name,mask,type,subtype")
      .eq("user_id", userId)
      .in("plaid_item_id", itemIds)
      .eq("active_status", "active"),
    admin
      .from("plaid_transactions")
      .select(
        "id,plaid_account_id,transaction_name,merchant_name,amount,currency,transaction_date,pending,pending_transaction_id,category_data",
      )
      .eq("user_id", userId)
      .in("plaid_item_id", itemIds)
      .is("removed_at", null)
      .order("transaction_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(5000),
    admin
      .from("transaction_sync_states")
      .select("sync_status")
      .in("plaid_item_id", itemIds),
    loadRecurringCommitmentDecisionMap(userId),
  ]);
  if (accounts.error || transactions.error) {
    throw new Error("RECURRING_ACTIVITY_UNAVAILABLE");
  }
  const institutions = new Map(
    items.map((item) => [item.id, item.institution_name || null]),
  );
  const accountContexts = new Map(
    (accounts.data || []).map((account) => [
      account.id,
      {
        label: displaySeparated(
          account.official_name || account.name,
          account.mask || null,
        ),
        type: account.type || null,
        subtype: account.subtype || null,
        institutionName: institutions.get(account.plaid_item_id) || null,
      },
    ]),
  );
  const source = annotateInternalTransfers(
    (transactions.data || [])
      .filter((row) => accountContexts.has(row.plaid_account_id))
      .map((row) =>
        mapTransaction(
          row as Record<string, unknown>,
          accountContexts.get(row.plaid_account_id)!,
        ),
      ),
  );
  const effective = (await applyFounderTransactionUnderstanding(userId, source))
    .transactions;
  const commitments = buildRecurringCommitments(effective, decisionMap);
  return {
    commitments,
    summary: recurringCommitmentSummary(commitments),
    syncPending:
      Boolean(sync.error) ||
      !(sync.data || []).length ||
      (sync.data || []).some((row) => row.sync_status !== "complete"),
    coverage: "Based on your connected accounts.",
  };
}
