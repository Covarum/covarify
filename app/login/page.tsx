import Link from "next/link";
import { AuthNotice, AuthShell } from "@/components/auth/auth-shell";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { signIn } from "../auth/actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string; next?: string }> }) {
  const params = await searchParams;
  return <AuthShell eyebrow="Welcome back" title="Return to your financial story." description="Sign in to your private Covarify workspace." footer={<><span>Need help?</span><Link href="/forgot-password">Reset your password</Link></>}>
    {params.error && <AuthNotice>{params.error}</AuthNotice>}{params.message && <AuthNotice tone="success">{params.message}</AuthNotice>}
    <form action={signIn} className="auth-form"><input type="hidden" name="next" value={params.next || "/account"} /><label>Email address<input required autoComplete="email" name="email" type="email" placeholder="you@example.com" /></label><label>Password<input required autoComplete="current-password" name="password" type="password" placeholder="Enter your password" /></label><div className="auth-form-row"><span>Founder access only</span><Link href="/forgot-password">Forgot password?</Link></div><AuthSubmitButton pendingLabel="Signing you in">Sign in securely</AuthSubmitButton></form>
  </AuthShell>;
}
