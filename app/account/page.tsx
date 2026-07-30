import { redirect } from "next/navigation";
import { AuthenticatedWorkspace } from "@/components/account/authenticated-workspace";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { annotateInternalTransfers, buildAccountAnalytics, buildAccountObservations, buildScopedMoneyPicture, filterTransactions, formatTransactionCategoryPath, summarizeFilteredTransactions, type MoneyTransaction } from "@/lib/money-picture";
import { encodeTransactionCursor } from "@/lib/transaction-pagination";
import { RECENT_ACTIVITY_PAGE_SIZE } from "@/lib/recent-activity-pagination";
import { normalizePersistedPlaidCategory } from "@/lib/plaid/category-normalization";
import { buildMoneyPictureIntelligenceBundle } from "@/lib/money-picture-intelligence-adapter";
import { parseFinancialPeriodSelection, resolveFinancialPeriod, transactionInPeriod } from "@/lib/financial-periods";
import { buildFinancialEventLayer } from "@/lib/financial-events";
import { buildCategoryIntelligence } from "@/lib/category-intelligence";
import { displaySeparated } from "@/lib/presentation-separators";
import { getAuthorizedFounderUser } from "@/lib/founder-review-auth";
import { applyFounderTransactionUnderstanding } from "@/lib/transaction-understanding-server";

export const dynamic = "force-dynamic";
function founderName(user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>) { const metadataName = [user.user_metadata?.full_name, user.user_metadata?.name, user.user_metadata?.first_name].find((value) => typeof value === "string" && value.trim()); const fallback = user.email?.split("@")[0]?.split(/[._-]/)[0] || "there"; const raw = String(metadataName || fallback).trim().split(/\s+/)[0]; return raw.charAt(0).toUpperCase() + raw.slice(1); }
function mapTransaction(row: Record<string, unknown>, accountLabel: string): MoneyTransaction { const category = normalizePersistedPlaidCategory(row.category_data); const amount = Number(row.amount); return { id: String(row.id), plaidAccountId: String(row.plaid_account_id), accountLabel, name: String(row.merchant_name || row.transaction_name), description: String(row.transaction_name || ""), amount, currency: String(row.currency || "USD"), date: String(row.transaction_date), pending: Boolean(row.pending), pendingTransactionId: row.pending_transaction_id ? String(row.pending_transaction_id) : null, category: category?.primary || "Uncategorized", detailedCategory: category?.detailed || null, direction: amount < 0 ? "inflow" : amount > 0 ? "outflow" : "neutral", transferRelationship: null }; }

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getAuthenticatedUser(); if (!user) redirect("/login?next=/account");
  const transactionUnderstandingEnabled = Boolean(await getAuthorizedFounderUser(user));
  const periodSelection = parseFinancialPeriodSelection(await searchParams);
  let period;
  try { period = resolveFinancialPeriod(periodSelection); }
  catch { redirect("/account?period=this-month"); }
  const supabase = await createSupabaseServerClient();
  const { data: items, error: itemsError } = await supabase.from("plaid_items").select("id,status,institution_name,last_successful_sync_at,error_code,needs_update_mode").eq("user_id", user.id).eq("environment", "production").neq("status", "disconnected").order("created_at", { ascending: true });
  let financialData = null;
  if (itemsError) financialData = { state: "unavailable" as const };
  else if (items?.length) {
    const itemIds = items.map((item) => item.id);
    const [accounts, transactions, sync] = await Promise.all([
      supabase.from("plaid_accounts").select("id,plaid_item_id,name,official_name,type,subtype,mask,currency,current_balance,available_balance").eq("user_id", user.id).in("plaid_item_id", itemIds).eq("active_status", "active").order("created_at", { ascending: true }),
      supabase.from("plaid_transactions").select("id,plaid_item_id,plaid_account_id,transaction_name,merchant_name,amount,currency,transaction_date,pending,pending_transaction_id,category_data").eq("user_id", user.id).in("plaid_item_id", itemIds).is("removed_at", null).order("transaction_date", { ascending: false }).order("id", { ascending: false }).limit(5000),
      supabase.from("transaction_sync_states").select("plaid_item_id,sync_status,retry_count,last_sync_completed_at,last_error").in("plaid_item_id", itemIds),
    ]);
      const itemById = new Map(items.map((item) => [item.id, item]));
      const syncByItemId = new Map((sync.data || []).map((state) => [state.plaid_item_id, state]));
      const accountRows = (accounts.data || []).map((account) => {
        const item = itemById.get(account.plaid_item_id);
        const itemSync = syncByItemId.get(account.plaid_item_id);
        return { id: account.id, name: account.official_name || account.name, type: account.type, subtype: account.subtype, mask: account.mask, label: displaySeparated(account.official_name || account.name, account.mask || null), currency: account.currency || "USD", currentBalance: account.current_balance === null ? null : Number(account.current_balance), availableBalance: account.available_balance === null ? null : Number(account.available_balance), institution: item?.institution_name || "Connected institution", syncStatus: itemSync?.sync_status || "pending" };
      }); const labels = new Map(accountRows.map((account) => [account.id, account.label])); const mappedTransactions = (transactions.data || []).map((row) => mapTransaction(row, labels.get(String(row.plaid_account_id)) || "Connected account")); const sourceRows = annotateInternalTransfers(accounts.error ? mappedTransactions : mappedTransactions.filter((row) => labels.has(row.plaidAccountId))); const rows = transactionUnderstandingEnabled ? (await applyFounderTransactionUnderstanding(user.id, sourceRows)).transactions : sourceRows; const currentRows = rows.filter((row) => transactionInPeriod(row.date, period)); const priorRows = rows.filter((row) => row.date >= period.priorStart && row.date <= period.priorEnd); const activityRows = filterTransactions(currentRows, { sort: "newest" }); const first = activityRows.slice(0, RECENT_ACTIVITY_PAGE_SIZE); const last = first.at(-1); const accountAnalytics = buildAccountAnalytics(currentRows); const financialEvents = buildFinancialEventLayer(currentRows);
      const picture = buildScopedMoneyPicture(currentRows, priorRows, period);
      const latestSync = items.map((item) => item.last_successful_sync_at).filter((value): value is string => Boolean(value)).sort().at(0) || null;
      const unhealthyItem = items.find((item) => item.status === "error" || item.needs_update_mode || item.error_code) || items.find((item) => item.status !== "active") || items[0];
      const unhealthySync = syncByItemId.get(unhealthyItem.id);
      const aggregateSyncStatus = !sync.error && (sync.data || []).length > 0 && (sync.data || []).every((state) => state.sync_status === "complete") ? "complete" : "pending";
      financialData = { state: "ready" as const, connectionStatus: items.some((item) => item.status === "active") ? "active" : unhealthyItem.status, syncStatus: aggregateSyncStatus, lastSync: latestSync, sectionStatus: { accountsUnavailable: Boolean(accounts.error), activityUnavailable: Boolean(transactions.error), syncUnavailable: Boolean(sync.error) }, accounts: accountRows, transactionCount: currentRows.length, transactions: first, transactionSummary: summarizeFilteredTransactions(currentRows), activityCategories: [...new Set(currentRows.map(formatTransactionCategoryPath))].sort(), cursor: activityRows.length > RECENT_ACTIVITY_PAGE_SIZE && last ? encodeTransactionCursor({ date: last.date, id: last.id }) : null, period, financialEventCount: financialEvents.events.length, picture, categoryIntelligence: buildCategoryIntelligence(currentRows, priorRows, period, financialEvents.events), accountAnalytics, accountObservations: buildAccountObservations(accountAnalytics), ...buildMoneyPictureIntelligenceBundle(rows, { syncStatus: aggregateSyncStatus, lastSyncAt: latestSync, connectionHealth: { itemStatus: unhealthyItem.status, needsUpdateMode: Boolean(unhealthyItem.needs_update_mode), itemErrorCode: unhealthyItem.error_code, syncRetryCount: Number(unhealthySync?.retry_count || 0), syncErrorCode: unhealthySync?.last_error || null, activeAccountCount: accountRows.filter((account) => account.syncStatus !== "failed").length }, period }) };
  }
  return <AuthenticatedWorkspace firstName={founderName(user)} email={user.email || "Signed-in founder"} financialData={financialData} transactionUnderstandingEnabled={transactionUnderstandingEnabled} />;
}
