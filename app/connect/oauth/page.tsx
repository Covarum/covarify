import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/site/site-shell";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { readProductionPlaidConfig } from "@/lib/plaid/production/config";
import { PLAID_CONSENT_VERSION } from "@/lib/plaid/production/consent";
import { ProductionOauthResume } from "@/components/plaid/production-oauth-resume";

export const dynamic = "force-dynamic";

export default async function ConnectOauthPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?next=/connect/oauth");
  let available = false;
  try { const config = readProductionPlaidConfig(); available = config.connectionsEnabled && config.allowedUserIds.has(user.id); } catch {}
  return <main className="auth-page"><section className="auth-card"><Brand /><p className="eyebrow plain">Secure connection return</p><h1>Resume your Plaid connection</h1><ProductionOauthResume available={available} consentVersion={PLAID_CONSENT_VERSION} /><p>For your protection, a bank connection can resume only from the same signed-in, unexpired, one-time connection attempt.</p><Link href="/connect">Start a new connection attempt</Link></section></main>;
}
