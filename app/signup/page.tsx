import Link from "next/link";
import { AuthNotice, AuthShell } from "@/components/auth/auth-shell";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { signUp } from "../auth/actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <AuthShell eyebrow="Controlled access" title="Create your Covarify workspace." description="Enrollment is currently limited to approved internal beta participants." footer={<><span>Already enrolled?</span><Link href="/login">Sign in</Link></>}>{params.error && <AuthNotice>{params.error}</AuthNotice>}<form action={signUp} className="auth-form"><label>Email address<input required autoComplete="email" name="email" type="email" placeholder="you@example.com" /></label><label>Password<input required minLength={12} autoComplete="new-password" name="password" type="password" placeholder="At least 12 characters" /></label><AuthSubmitButton pendingLabel="Creating workspace">Create secure account</AuthSubmitButton></form></AuthShell>;
}
