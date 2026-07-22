"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import type { PlaidLinkError, PlaidLinkOnEventMetadata, PlaidLinkOnExitMetadata } from "react-plaid-link";
import { LINK_FAILURE_MESSAGE } from "@/lib/plaid/production/link-diagnostics";

const LINK_TOKEN_KEY = "covarify:plaid:link-token";
const OAUTH_STATE_KEY = "covarify:plaid:oauth-state";

export function ProductionOauthResume({ available, consentVersion }: { available: boolean; consentVersion: string }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState(available ? "Validating your secure connection attempt…" : "Connections remain intentionally disabled.");

  const onSuccess = useCallback(async (publicToken: string) => {
    const response = await fetch("/api/plaid/production/exchange-public-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ public_token: publicToken, consent_version: consentVersion }) });
    const result = await response.json();
    if (!response.ok) { setMessage(result?.message || "The institution connection could not be saved."); return; }
    sessionStorage.removeItem(LINK_TOKEN_KEY); sessionStorage.removeItem(OAUTH_STATE_KEY);
    window.location.assign("/account?connected=1");
  }, [consentVersion]);

  const recordDiagnostic = useCallback((eventName: string, metadata: Partial<PlaidLinkOnEventMetadata & PlaidLinkOnExitMetadata> = {}, error?: PlaidLinkError | null) => {
    const state = sessionStorage.getItem(OAUTH_STATE_KEY);
    if (!state) return;
    void fetch("/api/plaid/production/link-diagnostic", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      state, event_name: eventName, error_code: error?.error_code ?? metadata.error_code, error_type: error?.error_type ?? metadata.error_type,
      institution_id: metadata.institution_id ?? metadata.institution?.institution_id, link_session_id: metadata.link_session_id, request_id: metadata.request_id,
    }) });
  }, []);
  const onExit = useCallback((error: PlaidLinkError | null, metadata: PlaidLinkOnExitMetadata) => {
    recordDiagnostic("EXIT", metadata, error); sessionStorage.removeItem(LINK_TOKEN_KEY); sessionStorage.removeItem(OAUTH_STATE_KEY); setAuthorized(false); setLinkToken(null); setMessage(LINK_FAILURE_MESSAGE);
  }, [recordDiagnostic]);
  const onEvent = useCallback((eventName: string, metadata: PlaidLinkOnEventMetadata) => recordDiagnostic(eventName, metadata), [recordDiagnostic]);

  const { open, ready, error } = usePlaidLink({ token: linkToken, receivedRedirectUri: typeof window === "undefined" ? undefined : window.location.href, onSuccess, onExit, onEvent, onLoad: () => recordDiagnostic("LOAD") });
  useEffect(() => {
    if (!available) return;
    void (async () => {
      await Promise.resolve();
      const token = sessionStorage.getItem(LINK_TOKEN_KEY);
      const state = sessionStorage.getItem(OAUTH_STATE_KEY);
      if (!token || !state) { setMessage("This connection attempt is missing or has expired. Start again from the connection screen."); return; }
      try {
        const response = await fetch("/api/plaid/production/oauth/resume", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result?.message || "This connection attempt cannot be resumed.");
        setLinkToken(token); setAuthorized(true); setMessage("Secure return validated. Resuming Plaid Link…");
      } catch (error) {
        sessionStorage.removeItem(LINK_TOKEN_KEY); sessionStorage.removeItem(OAUTH_STATE_KEY);
        setMessage(error instanceof Error ? error.message : "This connection attempt cannot be resumed.");
      }
    })();
  }, [available]);
  useEffect(() => { if (authorized && ready) open(); }, [authorized, open, ready]);
  useEffect(() => { if (!error) return; const timer = setTimeout(() => { recordDiagnostic("INITIALIZATION_ERROR"); setAuthorized(false); setMessage(LINK_FAILURE_MESSAGE); }, 0); return () => clearTimeout(timer); }, [error, recordDiagnostic]);

  return <div className="auth-notice" role={authorized ? "status" : "alert"}>{message}</div>;
}
