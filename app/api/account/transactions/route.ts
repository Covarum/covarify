import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { annotateInternalTransfers, filterTransactions, type MoneyTransaction, type TransactionFilters } from "@/lib/money-picture";
import { decodeTransactionCursor, encodeTransactionCursor } from "@/lib/transaction-pagination";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;
function mapTransaction(row: Record<string, unknown>, accountLabel: string): MoneyTransaction { const category = row.category_data as { primary?: string; detailed?: string } | null; const amount = Number(row.amount); return { id: String(row.id), plaidAccountId: String(row.plaid_account_id), accountLabel, name: String(row.merchant_name || row.transaction_name), amount, currency: String(row.currency || "USD"), date: String(row.transaction_date), pending: Boolean(row.pending), pendingTransactionId: row.pending_transaction_id ? String(row.pending_transaction_id) : null, category: category?.primary || "Uncategorized", detailedCategory: category?.detailed || null, direction: amount < 0 ? "inflow" : amount > 0 ? "outflow" : "neutral", transferRelationship: null }; }

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(); if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const body = await request.json() as { cursor?: string | null; filters?: TransactionFilters };
    const supabase = await createSupabaseServerClient();
    const { data: item, error: itemError } = await supabase.from("plaid_items").select("id").eq("user_id", user.id).eq("environment", "production").eq("status", "active").maybeSingle();
    if (itemError || !item) return NextResponse.json({ error: "ACTIVITY_UNAVAILABLE" }, { status: 503 });
    const { data: accounts, error: accountError } = await supabase.from("plaid_accounts").select("id,name,official_name,mask").eq("user_id", user.id).eq("plaid_item_id", item.id).eq("active_status", "active"); if (accountError || !accounts?.length) return NextResponse.json({ error: "ACTIVITY_UNAVAILABLE" }, { status: 503 }); const labels = new Map(accounts.map((account) => [account.id, `${account.official_name || account.name}${account.mask ? ` • ${account.mask}` : ""}`]));
    const { data, error } = await supabase.from("plaid_transactions").select("id,plaid_account_id,transaction_name,merchant_name,amount,currency,transaction_date,pending,pending_transaction_id,category_data").eq("user_id", user.id).eq("plaid_item_id", item.id).in("plaid_account_id", [...labels.keys()]).is("removed_at", null).order("transaction_date", { ascending: false }).order("id", { ascending: false }).limit(1000);
    if (error) return NextResponse.json({ error: "ACTIVITY_UNAVAILABLE" }, { status: 503 });
    const filtered = filterTransactions(annotateInternalTransfers((data || []).map((row) => mapTransaction(row, labels.get(String(row.plaid_account_id)) || "Connected account"))), body.filters || {});
    let start = 0; if (body.cursor) { const cursor = decodeTransactionCursor(body.cursor); const index = filtered.findIndex((row) => row.id === cursor.id && row.date === cursor.date); start = index < 0 ? 0 : index + 1; }
    const transactions = filtered.slice(start, start + PAGE_SIZE); const last = transactions.at(-1); const next = start + transactions.length < filtered.length && last ? encodeTransactionCursor({ date: last.date, id: last.id }) : null;
    return NextResponse.json({ transactions, total: filtered.length, cursor: next });
  } catch { return NextResponse.json({ error: "INVALID_ACTIVITY_REQUEST" }, { status: 400 }); }
}
