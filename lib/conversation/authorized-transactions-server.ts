import "server-only";
import type { MoneyTransaction } from "../money-picture.ts";
import { normalizePersistedPlaidCategory } from "../plaid/category-normalization.ts";
import { displaySeparated } from "../presentation-separators.ts";
import { createSupabaseServerClient } from "../supabase/server.ts";

export async function loadAuthorizedTransactions(userId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: items, error: itemError } = await supabase.from("plaid_items").select("id").eq("user_id", userId).eq("environment", "production").in("status", ["active", "pending"]);
  if (itemError || !items?.length) throw new Error("ACTIVITY_UNAVAILABLE");
  const itemIds = items.map((item) => item.id);
  const [accounts, transactions] = await Promise.all([
    supabase.from("plaid_accounts").select("id,name,official_name,mask").eq("user_id", userId).in("plaid_item_id", itemIds).eq("active_status", "active"),
    supabase.from("plaid_transactions").select("id,plaid_account_id,transaction_name,merchant_name,amount,currency,transaction_date,pending,pending_transaction_id,category_data").eq("user_id", userId).in("plaid_item_id", itemIds).is("removed_at", null).order("transaction_date", { ascending: false }).order("id", { ascending: false }).limit(5000),
  ]);
  if (accounts.error || transactions.error) throw new Error("ACTIVITY_UNAVAILABLE");
  const labels = new Map((accounts.data || []).map((account) => [account.id, displaySeparated(account.official_name || account.name, account.mask ? `•••• ${account.mask}` : null)]));
  return (transactions.data || []).filter((row) => labels.has(row.plaid_account_id)).map((row): MoneyTransaction => {
    const category = normalizePersistedPlaidCategory(row.category_data); const amount = Number(row.amount);
    return { id: String(row.id), plaidAccountId: String(row.plaid_account_id), accountLabel: labels.get(row.plaid_account_id) || "Connected account", merchantName: row.merchant_name ? String(row.merchant_name) : null, name: String(row.merchant_name || row.transaction_name), description: String(row.transaction_name || ""), amount, currency: String(row.currency || "USD"), date: String(row.transaction_date), pending: Boolean(row.pending), pendingTransactionId: row.pending_transaction_id ? String(row.pending_transaction_id) : null, category: category?.primary || "Uncategorized", sourceCategory: category?.primary || "Uncategorized", detailedCategory: category?.detailed || null, direction: amount < 0 ? "inflow" : amount > 0 ? "outflow" : "neutral", transferRelationship: null };
  });
}
