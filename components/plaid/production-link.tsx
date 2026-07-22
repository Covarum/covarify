"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePlaidLink } from "react-plaid-link";

const LINK_TOKEN_KEY = "covarify:plaid:link-token";
const OAUTH_STATE_KEY = "covarify:plaid:oauth-state";

export function ProductionPlaidLink({ available, consentVersion }: { available: boolean; consentVersion: string }) {
  const [accepted, setAccepted] = useState(false);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const openWhenReady = useRef(false);
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

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });
  useEffect(() => { if (openWhenReady.current && ready) { openWhenReady.current = false; open(); } }, [open, ready]);

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

  return <div>
    <div className="auth-consent-copy">
      <p>Covarify securely connects the financial accounts you choose through Plaid so we can build your Money Picture and help you make more informed financial decisions.</p>
      <p>You enter your bank username and password directly with Plaid. Covarify never receives or stores your banking credentials.</p>
      <p>For this connection, Covarify requests access to the Plaid Transactions product. This allows Covarify to receive information about your connected accounts, balances, and transaction history.</p>
      <p>Covarify uses this information to build your Money Picture, keep it up to date, and provide financial insights and decision support. Covarify does not move money or initiate financial transactions through this connection.</p>
      <p>After a successful connection, Plaid provides Covarify with a secure access token. That token is encrypted before it is stored, remains on Covarify&apos;s secure servers, and is never exposed to your browser.</p>
      <p>You can disconnect a financial institution at any time. Disconnecting immediately stops future account updates and permanently removes the encrypted Plaid access token used to access that institution.</p>
      <p>Disconnecting a financial institution is separate from deleting your Covarify account. Historical information already received may remain so your Money Picture, Financial Memory, and Decision Studio remain accurate until you request complete account deletion.</p>
      <p>When you submit and verify a request to permanently delete your account, Covarify immediately disables your account, disconnects every Plaid institution, permanently destroys the encrypted Plaid access tokens, and stops future synchronization. Connected account information, transaction history, your Money Picture, Financial Memory, decision history, connection metadata, and synchronization records are removed within 30 days.</p>
      <p>Encrypted backups may temporarily contain earlier copies of deleted information. Covarify&apos;s production backups expire within a maximum of seven days. Before any backup is restored, Covarify performs a security review to ensure deleted accounts cannot be reactivated and removed financial institutions cannot regain access.</p>
      <p>To meet security, legal, and compliance obligations, Covarify may retain limited records such as your consent history, deletion requests, security audit events, and records required by applicable law for up to seven years. These retained records cannot reconnect your financial institutions or rebuild your financial profile. Covarify does not retain financial transaction data solely for audit purposes.</p>
      <p>If you continue, Covarify records:</p>
      <ul><li>The consent version</li><li>The approved Plaid products</li><li>The purposes for which data is used</li><li>Your account identifier</li><li>The date and time you provided consent</li></ul>
      <p>If you have questions about your connection or your data, contact <a href="mailto:contact@covarify.com">contact@covarify.com</a>.</p>
    </div>
    <label className="auth-consent"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} disabled={!available || busy} /> <span>I understand and consent to Covarify connecting my selected financial accounts through Plaid and using Transactions data to build and refresh my Money Picture and provide financial insights and decision support. I understand that disconnecting a financial institution stops future access but is separate from permanently deleting my Covarify account.</span></label>
    {message && <div className="auth-notice" role="alert">{message}</div>}
    <button className="auth-submit" type="button" disabled={!available || !accepted || busy} onClick={() => void start()}>{busy ? "Preparing secure connection…" : "Continue securely with Plaid"}</button>
    <a className="auth-secondary-link" href="/account">Not now — Return to my account</a>
  </div>;
}
