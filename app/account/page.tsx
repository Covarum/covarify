import { redirect } from "next/navigation";
import { AuthenticatedWorkspace } from "@/components/account/authenticated-workspace";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function founderName(user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>) {
  const metadataName = [user.user_metadata?.full_name, user.user_metadata?.name, user.user_metadata?.first_name].find((value) => typeof value === "string" && value.trim());
  const fallback = user.email?.split("@")[0]?.split(/[._-]/)[0] || "there";
  const raw = String(metadataName || fallback).trim().split(/\s+/)[0];
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function timeGreeting() {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" }).format(new Date()));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function AccountPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?next=/account");

  const supabase = await createSupabaseServerClient();
  const { data: item } = await supabase.from("plaid_items").select("id,status").eq("user_id", user.id).eq("environment", "production").maybeSingle();
  let financialData = null;

  if (item) {
    const [accounts, transactions, recent, sync] = await Promise.all([
      supabase.from("plaid_accounts").select("id,name,official_name,type,subtype,mask").eq("user_id", user.id).eq("plaid_item_id", item.id).eq("active_status", "active").order("created_at", { ascending: true }),
      supabase.from("plaid_transactions").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("plaid_item_id", item.id).is("removed_at", null),
      supabase.from("plaid_transactions").select("id,transaction_name,merchant_name,amount,currency,transaction_date,pending").eq("user_id", user.id).eq("plaid_item_id", item.id).is("removed_at", null).order("transaction_date", { ascending: false }).limit(25),
      supabase.from("transaction_sync_states").select("sync_status,last_sync_completed_at").eq("plaid_item_id", item.id).maybeSingle(),
    ]);
    const readFailed = [accounts.error, transactions.error, recent.error, sync.error].some(Boolean);
    financialData = readFailed ? { state: "unavailable" as const } : {
      state: "ready" as const,
      connectionStatus: item.status,
      syncStatus: sync.data?.sync_status || "pending",
      accountCount: accounts.data?.length || 0,
      accounts: (accounts.data || []).map((account) => ({ id: account.id, name: account.official_name || account.name, type: account.subtype || account.type, mask: account.mask })),
      transactionCount: transactions.count || 0,
      transactions: (recent.data || []).map((transaction) => ({ id: transaction.id, name: transaction.merchant_name || transaction.transaction_name, amount: Number(transaction.amount), currency: transaction.currency || "USD", date: transaction.transaction_date, pending: transaction.pending })),
    };
  }

  return <AuthenticatedWorkspace firstName={founderName(user)} email={user.email || "Signed-in founder"} greeting={timeGreeting()} financialData={financialData} />;
}
