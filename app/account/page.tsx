import { redirect } from "next/navigation";
import { AuthenticatedWorkspace } from "@/components/account/authenticated-workspace";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildMoneyPicture, type MoneyTransaction } from "@/lib/money-picture";
import { encodeTransactionCursor } from "@/lib/transaction-pagination";

export const dynamic = "force-dynamic";
function founderName(user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>) { const metadataName = [user.user_metadata?.full_name, user.user_metadata?.name, user.user_metadata?.first_name].find((value) => typeof value === "string" && value.trim()); const fallback = user.email?.split("@")[0]?.split(/[._-]/)[0] || "there"; const raw = String(metadataName || fallback).trim().split(/\s+/)[0]; return raw.charAt(0).toUpperCase() + raw.slice(1); }
function mapTransaction(row: Record<string, unknown>): MoneyTransaction { const category = row.category_data as { primary?: string; detailed?: string } | null; return { id: String(row.id), plaidAccountId: String(row.plaid_account_id), name: String(row.merchant_name || row.transaction_name), amount: Number(row.amount), currency: String(row.currency || "USD"), date: String(row.transaction_date), pending: Boolean(row.pending), pendingTransactionId: row.pending_transaction_id ? String(row.pending_transaction_id) : null, category: category?.primary || "Uncategorized", detailedCategory: category?.detailed || null }; }

export default async function AccountPage() {
  const user = await getAuthenticatedUser(); if (!user) redirect("/login?next=/account");
  const supabase = await createSupabaseServerClient();
  const { data: item } = await supabase.from("plaid_items").select("id,status,institution_name,last_successful_sync_at").eq("user_id", user.id).eq("environment", "production").maybeSingle();
  let financialData = null;
  if (item) {
    const [accounts, transactions, sync] = await Promise.all([
      supabase.from("plaid_accounts").select("id,name,official_name,type,subtype,mask,currency,current_balance,available_balance").eq("user_id", user.id).eq("plaid_item_id", item.id).eq("active_status", "active").order("created_at", { ascending: true }),
      supabase.from("plaid_transactions").select("id,plaid_account_id,transaction_name,merchant_name,amount,currency,transaction_date,pending,pending_transaction_id,category_data").eq("user_id", user.id).eq("plaid_item_id", item.id).is("removed_at", null).order("transaction_date", { ascending: false }).order("id", { ascending: false }).limit(1000),
      supabase.from("transaction_sync_states").select("sync_status,last_sync_completed_at,last_error").eq("plaid_item_id", item.id).maybeSingle(),
    ]);
    const readFailed = [accounts.error, transactions.error, sync.error].some(Boolean);
    if (readFailed) financialData = { state: "unavailable" as const };
    else {
      const rows = (transactions.data || []).map((row) => mapTransaction(row)); const first = rows.slice(0, 25); const last = first.at(-1);
      financialData = { state: "ready" as const, connectionStatus: item.status, syncStatus: sync.data?.sync_status || "pending", lastSync: sync.data?.last_sync_completed_at || item.last_successful_sync_at, institution: item.institution_name || "Connected institution", accounts: (accounts.data || []).map((account) => ({ id: account.id, name: account.official_name || account.name, type: account.subtype || account.type, mask: account.mask, currency: account.currency || "USD", currentBalance: account.current_balance === null ? null : Number(account.current_balance), availableBalance: account.available_balance === null ? null : Number(account.available_balance) })), transactionCount: rows.length, transactions: first, cursor: rows.length > 25 && last ? encodeTransactionCursor({ date: last.date, id: last.id }) : null, picture: buildMoneyPicture(rows) };
    }
  }
  return <AuthenticatedWorkspace firstName={founderName(user)} email={user.email || "Signed-in founder"} financialData={financialData} />;
}
