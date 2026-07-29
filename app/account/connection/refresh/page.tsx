import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/site/site-shell";
import { ConnectionRecovery } from "@/components/plaid/connection-recovery";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RefreshConnectionPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?next=/account/connection/refresh");
  const supabase = await createSupabaseServerClient();
  const { data: items } = await supabase
    .from("plaid_items")
    .select("id,institution_name,status,error_code,needs_update_mode")
    .eq("user_id", user.id)
    .eq("environment", "production")
    .neq("status", "disconnected");
  const itemIds = (items || []).map((item) => item.id);
  const { data: syncStates } = itemIds.length ? await supabase
    .from("transaction_sync_states")
    .select("plaid_item_id,sync_status,retry_count")
    .in("plaid_item_id", itemIds) : { data: [] };
  const syncByItemId = new Map((syncStates || []).map((sync) => [sync.plaid_item_id, sync]));
  const recoverableItems = (items || []).filter((item) => {
    const sync = syncByItemId.get(item.id);
    return item.status === "error" || item.error_code || item.needs_update_mode || (sync?.sync_status === "failed" && Number(sync.retry_count) >= 5);
  });
  if (!recoverableItems.length) redirect("/account");
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Brand />
        <p className="eyebrow plain">Secure account recovery</p>
        <h1>Refresh your bank connection</h1>
        <p>This updates the existing connection securely through Plaid. It does not create another institution connection or replace your imported financial history.</p>
        <div className="settings-list">
          {recoverableItems.map((item) => <section key={item.id}>
            <div><p>Institution connection</p><h2>{item.institution_name || "Connected institution"}</h2><p>Update Mode applies only to this Plaid Item.</p></div>
            <ConnectionRecovery itemId={item.id} />
          </section>)}
        </div>
        <p><Link href="/account">Return to your Money Picture</Link></p>
      </section>
    </main>
  );
}
