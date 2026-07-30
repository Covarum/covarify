import { redirect } from "next/navigation";
import { Brand } from "@/components/site/site-shell";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readProductionPlaidConfig } from "@/lib/plaid/production/config";
import { PLAID_CONSENT_VERSION } from "@/lib/plaid/production/consent";
import { ProductionPlaidLink } from "@/components/plaid/production-link";
import { buildConnectionSummary } from "@/lib/plaid/production/connection-summary";

export const dynamic = "force-dynamic";

const lastSynced = (value: string | null) => value
  ? `Last synced ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value))}`
  : null;

export default async function ConnectPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?next=/connect");
  const resolvedSearchParams = await searchParams;
  const connectedItemId = typeof resolvedSearchParams.connected === "string" ? resolvedSearchParams.connected : null;
  const supabase = await createSupabaseServerClient();
  const { data: items, error: itemError } = await supabase
    .from("plaid_items")
    .select("id,institution_id,institution_name,environment,status,last_successful_sync_at")
    .eq("user_id", user.id)
    .eq("environment", "production")
    .in("status", ["active", "pending"])
    .order("created_at", { ascending: true });
  const itemIds = (items || []).map((item) => item.id);
  const [accountResult, syncResult] = itemIds.length ? await Promise.all([
    supabase.from("plaid_accounts").select("plaid_item_id,active_status").eq("user_id", user.id).in("plaid_item_id", itemIds).eq("active_status", "active"),
    supabase.from("transaction_sync_states").select("plaid_item_id,last_sync_completed_at").in("plaid_item_id", itemIds),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  const summaryUnavailable = Boolean(itemError || accountResult.error);
  if (summaryUnavailable && !connectedItemId) throw new Error("CONNECTION_SUMMARY_UNAVAILABLE");
  const summary = buildConnectionSummary(items || [], accountResult.data || [], syncResult.error ? [] : syncResult.data || []);
  const { connectedInstitutions, institutionCount, accountCount } = summary;
  const connectedInstitution = connectedItemId
    ? connectedInstitutions.find((institution) => institution.itemIds.includes(connectedItemId))
    : null;
  const connectionSucceeded = Boolean(connectedItemId && (connectedInstitution || summaryUnavailable));
  const isAdditionalConnection = institutionCount > 0;
  let enabled = false;
  let allowlisted = false;
  try {
    const config = readProductionPlaidConfig();
    enabled = config.connectionsEnabled;
    allowlisted = config.allowedUserIds.has(user.id);
  } catch {}
  const available = enabled && allowlisted;

  return <main className="connect-page"><section className="connect-shell">
    <header className="connect-header">
      <div className="connect-brand-row"><Brand /><p className="connect-pilot">Founder Pilot <span aria-hidden="true">•</span> Invite Only</p></div>
      <div className="connect-heading">
        <h1>{isAdditionalConnection ? "Your Financial Connections" : "Build your Money Picture"}</h1>
        <p className="connect-lede"><strong>{isAdditionalConnection ? "A calm, current view of the institutions shaping your Money Picture." : "Securely connect your financial accounts through Plaid."}</strong></p>
        {connectionSucceeded ? <section className="connect-success" aria-labelledby="connection-success-heading">
          <p className="eyebrow plain">Connection complete</p>
          <h2 id="connection-success-heading">{connectedInstitution ? `${connectedInstitution.name} connected successfully.` : "Institution connected successfully."}</h2>
          <p>Your Money Picture is now more complete. We&apos;re adding your new accounts and updating what Covarify understands about your financial life.</p>
          {summaryUnavailable || !connectedInstitution
            ? <div className="connect-summary-updating" role="status">Your connection succeeded, but this summary is still updating. <a href={`/connect?connected=${encodeURIComponent(connectedItemId || "")}`}>Refresh connection summary</a></div>
            : <p className="connect-success-counts">{institutionCount} {institutionCount === 1 ? "institution" : "institutions"} connected <span aria-hidden="true">·</span> {accountCount} {accountCount === 1 ? "account" : "accounts"} connected</p>}
          <div className="connect-success-actions"><a className="auth-submit" href="/account">View your updated Money Picture</a><a className="auth-secondary-link" href="/connect">Connect another institution</a></div>
        </section> : null}
        {isAdditionalConnection ? <section className="connect-existing" aria-labelledby="connected-summary-heading">
          <div><p className="eyebrow plain">Connected summary</p><div><h2 id="connected-summary-heading">{institutionCount} {institutionCount === 1 ? "institution" : "institutions"} connected</h2><p>{accountCount} {accountCount === 1 ? "account" : "accounts"} connected</p></div></div>
          <ul>{connectedInstitutions.map((institution) => {
            const syncLabel = lastSynced(institution.lastSyncedAt);
            return <li key={institution.id}><div><strong>{institution.name}</strong><span>{institution.accountCount} connected {institution.accountCount === 1 ? "account" : "accounts"}</span></div><div><span className={`connect-item-status ${institution.status === "connected" ? "is-connected" : ""}`}>{institution.status === "connected" ? "Connected" : "Finishing setup"}</span>{syncLabel ? <span>{syncLabel}</span> : null}</div></li>;
          })}</ul>
        </section> : <p>Covarify uses your account information to build and keep your Money Picture current, helping you make more informed financial decisions.</p>}
      </div>
      {!available && <div className="connect-status" role="status">Connections remain intentionally disabled while Production safeguards are completed.</div>}
    </header>
    <ProductionPlaidLink available={available} consentVersion={PLAID_CONSENT_VERSION} isAdditionalConnection={isAdditionalConnection} />
  </section></main>;
}
