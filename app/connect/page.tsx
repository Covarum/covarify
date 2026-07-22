import { redirect } from "next/navigation";
import { Brand } from "@/components/site/site-shell";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { readProductionPlaidConfig } from "@/lib/plaid/production/config";
import { PLAID_CONSENT_VERSION } from "@/lib/plaid/production/consent";
import { ProductionPlaidLink } from "@/components/plaid/production-link";

export const dynamic = "force-dynamic";

export default async function ConnectPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?next=/connect");
  let enabled = false;
  let allowlisted = false;
  try { const config = readProductionPlaidConfig(); enabled = config.connectionsEnabled; allowlisted = config.allowedUserIds.has(user.id); } catch {}
  const available = enabled && allowlisted;
  return <main className="auth-page"><section className="auth-card"><Brand /><p className="eyebrow plain">Controlled founder connection</p><h1>Connect your financial accounts</h1><div className="auth-notice" role="status">{available ? "This connection is limited to the approved founder account." : "Connections remain intentionally disabled while Production safeguards are completed."}</div><ProductionPlaidLink available={available} consentVersion={PLAID_CONSENT_VERSION} /><p className="auth-meta">Internal beta only. No financial institution will be contacted while the connection gate is disabled.</p></section></main>;
}
