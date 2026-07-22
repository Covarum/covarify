"use client";

import { useState } from "react";
import { ACCOUNT_DELETION_CONFIRMATION } from "@/lib/account-deletion/policy";

export function AccountDeletionForm() {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (!confirmed || busy) return;
    setBusy(true); setMessage(null);
    const response = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmed: true }) });
    const result = await response.json().catch(() => null);
    if (!response.ok) { setMessage(result?.message || "Your deletion request could not be completed. Contact contact@covarify.com."); setBusy(false); return; }
    window.location.assign("/login?message=We%27ve%20received%20your%20account%20deletion%20request.");
  }

  return <div className="deletion-confirmation">
    <label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={busy} /> <span>{ACCOUNT_DELETION_CONFIRMATION}</span></label>
    {message && <p className="auth-notice auth-notice-error" role="alert">{message}</p>}
    <button type="button" className="deletion-button" disabled={!confirmed || busy} onClick={() => void submit()}>{busy ? "Submitting deletion request…" : "Delete my account permanently"}</button>
  </div>;
}
