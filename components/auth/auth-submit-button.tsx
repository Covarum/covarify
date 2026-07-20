"use client";

import { useFormStatus } from "react-dom";

export function AuthSubmitButton({ children, pendingLabel }: { children: React.ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return <button className="auth-submit" type="submit" disabled={pending} aria-disabled={pending}>{pending ? <><span className="auth-spinner" aria-hidden="true" />{pendingLabel}</> : children}</button>;
}
