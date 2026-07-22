import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountDeletionForm } from "@/components/account/account-deletion-form";
import { Brand } from "@/components/site/site-shell";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

export const dynamic = "force-dynamic";

export default async function DeleteAccountPage() {
  if (!await getAuthenticatedUser()) redirect("/login?next=/account/delete");
  return <main className="deletion-page"><div className="deletion-shell"><Brand /><Link className="auth-back" href="/account">← Return to my account</Link>
    <p className="eyebrow plain">Permanent account deletion</p><h1>Understand what deleting your account means.</h1>
    <p className="deletion-intro">If you want a copy of your information, request it before deleting your account. Deletion is permanent and cannot be undone.</p>
    <section><h2>What happens immediately</h2><ul><li>Your account is disabled.</li><li>All Plaid institutions are disconnected.</li><li>Plaid access tokens are permanently destroyed.</li><li>Covarify can no longer access your connected institutions.</li></ul></section>
    <section><h2>What happens within 30 days</h2><ul><li>Connected account information is removed.</li><li>Transaction history is removed.</li><li>Your Money Picture is removed.</li><li>Your Financial Memory is removed.</li><li>Your decision history is removed.</li><li>Synchronization records are removed.</li></ul></section>
    <section><h2>What may be retained</h2><p>Covarify may retain consent records, security audit events, your deletion request, and records required by applicable law. These retained records cannot be used to reconnect to financial institutions or rebuild your financial profile.</p></section>
    <section><h2>Encrypted backups</h2><p>Encrypted backups may temporarily contain historical copies of deleted information. Backups expire according to Covarify’s backup policy, within a maximum of 35 days, and are never used to reactivate a deleted account. A deletion request always takes precedence if a backup is restored.</p></section>
    <AccountDeletionForm />
  </div></main>;
}
