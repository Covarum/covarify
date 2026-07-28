import { redirect } from "next/navigation";
import { AuthenticatedWorkspace } from "@/components/account/authenticated-workspace";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { annotateInternalTransfers, buildAccountAnalytics, buildAccountObservations, buildScopedMoneyPicture, summarizeFilteredTransactions, type MoneyTransaction } from "@/lib/money-picture";
import { encodeTransactionCursor } from "@/lib/transaction-pagination";
import { normalizePersistedPlaidCategory } from "@/lib/plaid/category-normalization";
import { buildMoneyPictureIntelligenceBundle } from "@/lib/money-picture-intelligence-adapter";
import { parseFinancialPeriodSelection, resolveFinancialPeriod, transactionInPeriod } from "@/lib/financial-periods";
import { buildFinancialEventLayer } from "@/lib/financial-events";

export const dynamic = "force-dynamic";
function founderName(user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>) { const metadataName = [user.user_metadata?.full_name, user.user_metadata?.name, user.user_metadata?.first_name].find((value) => typeof value === "string" && value.trim()); const fallback = user.email?.split("@")[0]?.split(/[._-]/)[0] || "there"; const raw = String(metadataName || fallback).trim().split(/\s+/)[0]; return raw.charAt(0).toUpperCase() + raw.slice(1); }
function mapTransaction(row: Record<string, unknown>, accountLabel: string): MoneyTransaction { const category = normalizePersistedPlaidCategory(row.category_data); const amount = Number(row.amount); return { id: String(row.id), plaidAccountId: String(row.plaid_account_id), accountLabel, name: String(row.merchant_name || row.transaction_name), amount, currency: String(row.currency || "USD"), date: String(row.transaction_date), pending: Boolean(row.pending), pendingTransactionId: row.pending_transaction_id ? String(row.pending_transaction_id) : null, category: category?.primary || "Uncategorized", detailedCategory: category?.detailed || null, direction: amount < 0 ? "inflow" : amount > 0 ? "outflow" : "neutral", transferRelationship: null }; }

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getAuthenticatedUser(); if (!user) redirect("/login?next=/account");
  const periodSelection = parseFinancialPeriodSelection(await searchParams);
  let period;
  try { period = resolveFinancialPeriod(periodSelection); }
  catch { redirect("/account?period=this-month"); }
  const supabase = await createSupabaseServerClient();
  const { data: item } = await supabase.from("plaid_items").select("id,status,institution_name,last_successful_sync_at,error_code,needs_update_mode").eq("user_id", user.id).eq("environment", "production").maybeSingle();
  let financialData = null;
  if (item) {
    const [accounts, transactions, sync] = await Promise.all([
      supabase.from("plaid_accounts").select("id,name,official_name,type,subtype,mask,currency,current_balance,available_balance").eq("user_id", user.id).eq("plaid_item_id", item.id).eq("active_status", "active").order("created_at", { ascending: true }),
      supabase.from("plaid_transactions").select("id,plaid_account_id,transaction_name,merchant_name,amount,currency,transaction_date,pending,pending_transaction_id,category_data").eq("user_id", user.id).eq("plaid_item_id", item.id).is("removed_at", null).order("transaction_date", { ascending: false }).order("id", { ascending: false }).limit(5000),
      supabase.from("transaction_sync_states").select("sync_status,retry_count,last_sync_completed_at,last_error").eq("plaid_item_id", item.id).maybeSingle(),
    ]);
    const readFailed = [accounts.error, transactions.error, sync.error].some(Boolean);
    if (readFailed) financialData = { state: "unavailable" as const };
    else {
      const accountRows = (accounts.data || []).map((account) => ({ id: account.id, name: account.official_name || account.name, type: account.subtype || account.type, mask: account.mask, label: `${account.official_name || account.name}${account.mask ? ` • ${account.mask}` : ""}`, currency: account.currency || "USD", currentBalance: account.current_balance === null ? null : Number(account.current_balance), availableBalance: account.available_balance === null ? null : Number(account.available_balance) })); const labels = new Map(accountRows.map((account) => [account.id, account.label])); const rows = annotateInternalTransfers((transactions.data || []).map((row) => mapTransaction(row, labels.get(String(row.plaid_account_id)) || "Connected account")).filter((row) => labels.has(row.plaidAccountId))); const currentRows = rows.filter((row) => transactionInPeriod(row.date, period)); const priorRows = rows.filter((row) => row.date >= period.priorStart && row.date <= period.priorEnd); const first = currentRows.slice(0, 25); const last = first.at(-1); const accountAnalytics = buildAccountAnalytics(currentRows); const financialEvents = buildFinancialEventLayer(currentRows);
      financialData = { state: "ready" as const, connectionStatus: item.status, syncStatus: sync.data?.sync_status || "pending", lastSync: sync.data?.last_sync_completed_at || item.last_successful_sync_at, institution: item.institution_name || "Connected institution", accounts: accountRows, transactionCount: currentRows.length, transactions: first, transactionSummary: summarizeFilteredTransactions(currentRows), cursor: currentRows.length > 25 && last ? encodeTransactionCursor({ date: last.date, id: last.id }) : null, period, financialEventCount: financialEvents.events.length, picture: buildScopedMoneyPicture(currentRows, priorRows, period), accountAnalytics, accountObservations: buildAccountObservations(accountAnalytics), ...buildMoneyPictureIntelligenceBundle(rows, { syncStatus: sync.data?.sync_status || "pending", lastSyncAt: sync.data?.last_sync_completed_at || item.last_successful_sync_at, connectionHealth: { itemStatus: item.status, needsUpdateMode: Boolean(item.needs_update_mode), itemErrorCode: item.error_code, syncRetryCount: Number(sync.data?.retry_count || 0), syncErrorCode: sync.data?.last_error || null, activeAccountCount: accountRows.length }, period }) };
    }
  }
  return <AuthenticatedWorkspace firstName={founderName(user)} email={user.email || "Signed-in founder"} financialData={financialData} />;
}
