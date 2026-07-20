import Link from "next/link";
import { AuthNotice, AuthShell } from "@/components/auth/auth-shell";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { requestReset } from "../auth/actions";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ message?: string }> }) {
  const params = await searchParams;
  return <AuthShell eyebrow="Account recovery" title="Find your way back." description="Enter your founder email and we’ll send a secure password reset link." footer={<Link href="/login">Return to sign in</Link>}>{params.message && <AuthNotice tone="success">{params.message}</AuthNotice>}<form action={requestReset} className="auth-form"><label>Email address<input required autoComplete="email" name="email" type="email" placeholder="you@example.com" /></label><AuthSubmitButton pendingLabel="Sending reset link">Send reset link</AuthSubmitButton></form></AuthShell>;
}
