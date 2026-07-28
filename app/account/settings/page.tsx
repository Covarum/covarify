import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleUserRound, Landmark, LockKeyhole, Settings, ShieldCheck, Trash2 } from "lucide-react";
import { Brand } from "@/components/site/site-shell";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login?next=/account/settings");

  return <main className="settings-page">
    <div className="settings-shell">
      <header className="settings-header">
        <Brand />
        <Link className="auth-back" href="/account">← Return to Money Picture</Link>
      </header>
      <section className="settings-intro" aria-labelledby="settings-heading">
        <p className="eyebrow plain"><Settings size={14} /> Account settings</p>
        <h1 id="settings-heading">Your access, connections, and privacy.</h1>
        <p>Manage the administrative parts of your Covarify account without taking focus away from your Money Picture.</p>
      </section>
      <div className="settings-list">
        <section>
          <span><CircleUserRound aria-hidden="true" /></span>
          <div><p>Account preferences</p><h2>Profile and sign-in</h2><p>Signed in as <strong>{user.email || "your Covarify account"}</strong>.</p></div>
          <Link href="/forgot-password">Change password</Link>
        </section>
        <section>
          <span><Landmark aria-hidden="true" /></span>
          <div><p>Connection management</p><h2>Connected financial accounts</h2><p>Review the connection and consent flow used to add financial institutions.</p></div>
          <Link href="/connect">Manage connections</Link>
        </section>
        <section>
          <span><ShieldCheck aria-hidden="true" /></span>
          <div><p>Privacy and consent</p><h2>How your information is handled</h2><p>Review privacy, security, consent, disconnecting, and data-retention details.</p></div>
          <div className="settings-links"><Link href="/privacy">Privacy</Link><Link href="/security">Security</Link><Link href="/terms">Terms</Link></div>
        </section>
        <section className="settings-danger">
          <span><Trash2 aria-hidden="true" /></span>
          <div><p>Administrative controls</p><h2>Delete account</h2><p>Permanently disable your account, disconnect institutions, and begin deletion of your financial data.</p></div>
          <Link href="/account/delete">Review account deletion</Link>
        </section>
      </div>
      <footer className="settings-note"><LockKeyhole size={15} aria-hidden="true" />Settings changes never initiate transactions or move money.</footer>
    </div>
  </main>;
}
