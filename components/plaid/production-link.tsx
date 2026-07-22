"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import type { PlaidLinkError, PlaidLinkOnEventMetadata, PlaidLinkOnExitMetadata } from "react-plaid-link";
import { Ban, KeyRound, Landmark, Unplug } from "lucide-react";
import { LINK_FAILURE_MESSAGE } from "@/lib/plaid/production/link-diagnostics";

const LINK_TOKEN_KEY = "covarify:plaid:link-token";
const OAUTH_STATE_KEY = "covarify:plaid:oauth-state";

export function ProductionPlaidLink({ available, consentVersion }: { available: boolean; consentVersion: string }) {
  const [accepted, setAccepted] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const openWhenReady = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onSuccess = useCallback(async (publicToken: string) => {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/plaid/production/exchange-public-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ public_token: publicToken, consent_version: consentVersion }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.message || "The institution connection could not be saved.");
      sessionStorage.removeItem(LINK_TOKEN_KEY); sessionStorage.removeItem(OAUTH_STATE_KEY);
      window.location.assign("/account?connected=1");
    } catch (error) { setMessage(error instanceof Error ? error.message : "The institution connection could not be saved."); setBusy(false); }
  }, [consentVersion]);

  const recordDiagnostic = useCallback((eventName: string, metadata: Partial<PlaidLinkOnEventMetadata & PlaidLinkOnExitMetadata> = {}, error?: PlaidLinkError | null) => {
    const state = sessionStorage.getItem(OAUTH_STATE_KEY);
    if (!state) return;
    void fetch("/api/plaid/production/link-diagnostic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      state, event_name: eventName, error_code: error?.error_code ?? metadata.error_code, error_type: error?.error_type ?? metadata.error_type,
      institution_id: metadata.institution_id ?? metadata.institution?.institution_id, link_session_id: metadata.link_session_id, request_id: metadata.request_id,
    }) });
  }, []);
  const resetAfterFailure = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    openWhenReady.current = false; setLinkToken(null); setBusy(false); setMessage(LINK_FAILURE_MESSAGE);
    sessionStorage.removeItem(LINK_TOKEN_KEY); sessionStorage.removeItem(OAUTH_STATE_KEY);
  }, []);
  const onExit = useCallback((error: PlaidLinkError | null, metadata: PlaidLinkOnExitMetadata) => { recordDiagnostic("EXIT", metadata, error); resetAfterFailure(); }, [recordDiagnostic, resetAfterFailure]);
  const onEvent = useCallback((eventName: string, metadata: PlaidLinkOnEventMetadata) => recordDiagnostic(eventName, metadata), [recordDiagnostic]);
  const { open, ready, exit, error: initializationError } = usePlaidLink({ token: linkToken, onSuccess, onExit, onEvent, onLoad: () => recordDiagnostic("LOAD") });
  useEffect(() => { if (openWhenReady.current && ready) { openWhenReady.current = false; open(); timeoutRef.current = setTimeout(() => { recordDiagnostic("CLIENT_TIMEOUT"); exit({ force: true }); resetAfterFailure(); }, 10 * 60_000); } }, [exit, open, ready, recordDiagnostic, resetAfterFailure]);
  useEffect(() => { if (!initializationError) return; const timer = setTimeout(() => { recordDiagnostic("INITIALIZATION_ERROR"); resetAfterFailure(); }, 0); return () => clearTimeout(timer); }, [initializationError, recordDiagnostic, resetAfterFailure]);
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  async function start() {
    if (!available || !accepted || busy) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/plaid/production/create-link-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consent_version: consentVersion }) });
      const result = await response.json();
      if (!response.ok || !result.link_token || !result.oauth_state) throw new Error(result?.message || "Plaid Link could not be prepared.");
      sessionStorage.setItem(LINK_TOKEN_KEY, result.link_token);
      sessionStorage.setItem(OAUTH_STATE_KEY, result.oauth_state);
      setLinkToken(result.link_token); openWhenReady.current = true;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Plaid Link could not be prepared."); }
    finally { setBusy(false); }
  }

  return <div className="connect-consent">
    <section className="connect-trust" aria-labelledby="trust-heading"><h2 id="trust-heading">Before you continue</h2><div className="connect-trust-grid">
      <div><Landmark aria-hidden="true" /><p>You enter your bank credentials directly with Plaid.</p></div>
      <div><KeyRound aria-hidden="true" /><p>Covarify never sees or stores your banking username or password.</p></div>
      <div><Ban aria-hidden="true" /><p>Covarify cannot move money or initiate transactions.</p></div>
      <div><Unplug aria-hidden="true" /><p>You can disconnect a financial institution at any time.</p></div>
    </div></section>
    <section className="connect-learn" aria-labelledby="learn-heading"><h2 id="learn-heading">Learn more</h2><div className="connect-accordions">
      <details><summary>What information does Covarify receive?</summary><div><p>Covarify receives information about your connected accounts, balances, and transaction history through Plaid&apos;s Transactions product.</p><p>Covarify uses this information to build and update your Money Picture and provide financial insights and decision support.</p></div></details>
      <details><summary>How is my information protected?</summary><div><p>After you successfully connect an institution, Plaid provides Covarify with a secure access token.</p><p>The token is encrypted before it is stored, remains on Covarify&apos;s secure servers, and is never exposed to your browser.</p><p>Covarify never receives or stores your banking credentials.</p></div></details>
      <details><summary>Disconnecting versus deleting your account</summary><div><p>You can disconnect a financial institution at any time. Disconnecting immediately stops future account updates and permanently removes the encrypted Plaid access token used to access that institution.</p><p>Disconnecting an institution is separate from permanently deleting your Covarify account. Historical information already received may remain so your Money Picture, Financial Memory, and Decision Studio remain accurate until you request complete account deletion.</p><p>When you submit and verify a request to permanently delete your account, Covarify immediately disables your account, disconnects every Plaid institution, permanently destroys the encrypted Plaid access tokens, and stops future synchronization.</p><p>Connected account information, transaction history, your Money Picture, Financial Memory, decision history, connection metadata, and synchronization records are removed within 30 days.</p></div></details>
      <details><summary>Backups and retained records</summary><div><p>Encrypted backups may temporarily contain earlier copies of deleted information. Covarify&apos;s production backups expire within a maximum of seven days.</p><p>Before any backup is restored, Covarify performs a security review to ensure deleted accounts cannot be reactivated and removed financial institutions cannot regain access.</p><p>To meet security, legal, and compliance obligations, Covarify may retain limited records such as consent history, deletion requests, security audit events, and records required by applicable law for up to seven years.</p><p>These retained records cannot reconnect financial institutions or rebuild a financial profile. Covarify does not retain financial transaction data solely for audit purposes.</p></div></details>
      <details><summary>What does Covarify record when I continue?</summary><div><p>Covarify records:</p><ul><li>The consent version</li><li>The approved Plaid products</li><li>The purposes for which data is used</li><li>Your account identifier</li><li>The date and time you provided consent</li></ul><p>For questions about your connection or your data, contact <a href="mailto:contact@covarify.com">contact@covarify.com</a>.</p></div></details>
    </div></section>
    <section className="connect-consent-action">
      <label className="auth-consent"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} disabled={!available || busy} /> <span>I understand and consent to Covarify connecting my selected financial accounts through Plaid and using Transactions data to build and refresh my Money Picture and provide financial insights and decision support. I understand that disconnecting a financial institution stops future access but is separate from permanently deleting my Covarify account.</span></label>
      {message && <div className="auth-notice auth-notice-error" role="alert">{message}</div>}
      <div className="connect-actions">
        <button className="auth-submit" type="button" aria-busy={busy} disabled={!available || !accepted || busy} onClick={() => void start()}>{busy ? "Preparing secure connection…" : "Continue securely with Plaid"}</button>
        <a className="auth-secondary-link" href="/account">Not now - Return to my account</a>
      </div>
    </section>
  </div>;
}
