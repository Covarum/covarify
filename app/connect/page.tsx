import { redirect } from "next/navigation";
import { Brand } from "@/components/site/site-shell";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readProductionPlaidConfig } from "@/lib/plaid/production/config";
import { PLAID_CONSENT_VERSION } from "@/lib/plaid/production/consent";
import { ProductionPlaidLink } from "@/components/plaid/production-link";

export const dynamic = "force-dynamic";
const lastSynced = (value: string | null) => value
  ? `Last synced ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value))}`
  : "Sync pending";

export default async function ConnectPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?next=/connect");
  const supabase = await createSupabaseServerClient();
  const { data: items, error: itemError } = await supabase
    .from("plaid_items")
    .select("id,institution_name,last_successful_sync_at")
    .eq("user_id", user.id)
    .eq("environment", "production")
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (itemError) throw new Error("CONNECTION_SUMMARY_UNAVAILABLE");
  const itemIds = (items || []).map((item) => item.id);
  const { data: accounts, error: accountError } = itemIds.length
    ? await supabase.from("plaid_accounts").select("plaid_item_id").eq("user_id", user.id).in("plaid_item_id", itemIds).eq("active_status", "active")
    : { data: [], error: null };
  if (accountError) throw new Error("CONNECTION_SUMMARY_UNAVAILABLE");
  const accountCountByItem = new Map<string, number>();
  for (const account of accounts || []) accountCountByItem.set(account.plaid_item_id, (accountCountByItem.get(account.plaid_item_id) || 0) + 1);
  const connectedInstitutions = (items || []).map((item) => ({
    id: item.id,
    name: item.institution_name || "Connected institution",
    accountCount: accountCountByItem.get(item.id) || 0,
    syncLabel: lastSynced(item.last_successful_sync_at),
  }));
  const isAdditionalConnection = connectedInstitutions.length > 0;
  let enabled = false;
  let allowlisted = false;
  try { const config = readProductionPlaidConfig(); enabled = config.connectionsEnabled; allowlisted = config.allowedUserIds.has(user.id); } catch {}
  const available = enabled && allowlisted;
  return <main className="connect-page"><section className="connect-shell">
    <header className="connect-header">
      <div className="connect-brand-row"><Brand /><p className="connect-pilot">Founder Pilot <span aria-hidden="true">•</span> Invite Only</p></div>
      <div className="connect-heading">
        <h1>{isAdditionalConnection ? "Add another institution" : "Build your Money Picture"}</h1>
        <p className="connect-lede"><strong>{isAdditionalConnection ? "Expand your Money Picture by securely connecting another bank or credit card." : "Securely connect your financial accounts through Plaid."}</strong></p>
        {isAdditionalConnection ? <>
          <p><strong>Your existing connections stay exactly as they are.</strong><br />Connecting another institution will not replace or disconnect any bank, credit card, or other connected account.</p>
          <section className="connect-existing" aria-labelledby="connected-summary-heading">
            <div><p className="eyebrow plain">Already connected</p><h2 id="connected-summary-heading">{connectedInstitutions.length} {connectedInstitutions.length === 1 ? "institution" : "institutions"}</h2></div>
            <ul>{connectedInstitutions.map((institution) => <li key={institution.id}><strong>{institution.name}</strong><span>{institution.accountCount} connected {institution.accountCount === 1 ? "account" : "accounts"} · {institution.syncLabel}</span></li>)}</ul>
          </section>
        </> : <p>Covarify uses your account information to build and keep your Money Picture current, helping you make more informed financial decisions.</p>}
      </div>
      {!available && <div className="connect-status" role="status">Connections remain intentionally disabled while Production safeguards are completed.</div>}
    </header>
    <ProductionPlaidLink available={available} consentVersion={PLAID_CONSENT_VERSION} isAdditionalConnection={isAdditionalConnection} />
  </section></main>;
}
