import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/site/site-shell";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { readProductionPlaidConfig } from "@/lib/plaid/production/config";

export const dynamic = "force-dynamic";

export default async function ConnectPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?next=/connect");
  let enabled = false;
  let allowlisted = false;
  try { const config = readProductionPlaidConfig(); enabled = config.connectionsEnabled; allowlisted = config.allowedUserIds.has(user.id); } catch {}
  const available = enabled && allowlisted;
  return <main className="auth-page"><section className="auth-card"><Brand /><p className="eyebrow plain">Controlled founder connection</p><h1>Connect your first account</h1><p>Covarify will use Plaid to request read-only account, balance, and transaction data for your Money Picture. You enter institution credentials directly with Plaid; Covarify does not receive them.</p><div className="auth-notice" role="status">{available ? "Final provider checks are required before Link starts." : "Connections remain intentionally disabled while Production safeguards are completed."}</div><button className="auth-submit" type="button" disabled={!available}>Continue securely with Plaid</button><p className="auth-meta">Internal beta only. No financial institution will be contacted while the connection gate is disabled.</p><Link href="/account">Return to your workspace</Link></section></main>;
}
