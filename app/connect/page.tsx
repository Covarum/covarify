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
  return <main className="connect-page"><section className="connect-shell">
    <header className="connect-header">
      <div className="connect-brand-row"><Brand /><p className="connect-pilot">Founder Pilot <span aria-hidden="true">•</span> Invite Only</p></div>
      <div className="connect-heading">
        <h1>Build your Money Picture</h1>
        <p className="connect-lede"><strong>Securely connect your financial accounts through Plaid.</strong></p>
        <p>Covarify uses your account information to build and keep your Money Picture current, helping you make more informed financial decisions.</p>
      </div>
      {!available && <div className="connect-status" role="status">Connections remain intentionally disabled while Production safeguards are completed.</div>}
    </header>
    <ProductionPlaidLink available={available} consentVersion={PLAID_CONSENT_VERSION} />
  </section></main>;
}
