import Link from "next/link";
import { AuthNotice, AuthShell } from "@/components/auth/auth-shell";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { updatePassword } from "../auth/actions";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return <AuthShell eyebrow="Secure reset" title="Choose a new password." description="Use at least 12 characters and a password you don’t use anywhere else." footer={<Link href="/login">Return to sign in</Link>}>{params.error && <AuthNotice>{params.error}</AuthNotice>}<form action={updatePassword} className="auth-form"><label>New password<input required minLength={12} autoComplete="new-password" name="password" type="password" placeholder="At least 12 characters" /></label><AuthSubmitButton pendingLabel="Updating password">Update password</AuthSubmitButton></form></AuthShell>;
}
