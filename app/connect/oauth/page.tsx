import Link from "next/link";
import { redirect } from "next/navigation";
import { Brand } from "@/components/site/site-shell";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function ConnectOauthPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?next=/connect/oauth");
  return <main className="auth-page"><section className="auth-card"><Brand /><p className="eyebrow plain">Secure connection return</p><h1>Your connection has not resumed.</h1><div className="auth-notice" role="alert">The controlled connection gate is disabled. No account data was requested or stored.</div><p>For your protection, a bank connection can resume only from the same signed-in, unexpired, one-time connection attempt. Start again from the connection screen after the beta gate is approved.</p><Link href="/connect">Return to connection readiness</Link></section></main>;
}
