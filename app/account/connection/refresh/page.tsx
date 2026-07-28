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
  const { data: item } = await supabase
    .from("plaid_items")
    .select("id,status,error_code,needs_update_mode")
    .eq("user_id", user.id)
    .eq("environment", "production")
    .maybeSingle();
  const { data: sync } = item ? await supabase
    .from("transaction_sync_states")
    .select("sync_status,retry_count")
    .eq("plaid_item_id", item.id)
    .maybeSingle() : { data: null };
  const needsRecovery = Boolean(item && item.status !== "disconnected" && (item.status === "error" || item.error_code || item.needs_update_mode || (sync?.sync_status === "failed" && Number(sync.retry_count) >= 5)));
  if (!needsRecovery) redirect("/account");
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Brand />
        <p className="eyebrow plain">Secure account recovery</p>
        <h1>Refresh your bank connection</h1>
        <p>This updates the existing connection securely through Plaid. It does not create another institution connection or replace your imported financial history.</p>
        <ConnectionRecovery />
        <p><Link href="/account">Return to your Money Picture</Link></p>
      </section>
    </main>
  );
}
