"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import type { PlaidLinkError } from "react-plaid-link";

export function ConnectionRecovery() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const openWhenReady = useRef(false);
  const reset = useCallback((nextMessage: string) => {
    openWhenReady.current = false;
    setLinkToken(null);
    setBusy(false);
    setMessage(nextMessage);
  }, []);
  const onSuccess = useCallback(() => {
    window.location.assign("/account?connection=refreshed");
  }, []);
  const onExit = useCallback((error: PlaidLinkError | null) => {
    reset(error ? "We couldn’t refresh the connection. Your existing account remains connected. You can safely try again." : "Connection refresh paused. Your existing information remains available.");
  }, [reset]);
  const { open, ready, error } = usePlaidLink({ token: linkToken, onSuccess, onExit });

  useEffect(() => {
    if (openWhenReady.current && ready) {
      openWhenReady.current = false;
      open();
    }
  }, [open, ready]);
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => reset("The secure refresh could not start. Your existing account remains connected. Please try again."), 0);
    return () => clearTimeout(timer);
  }, [error, reset]);

  async function start() {
    if (busy || linkToken) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/plaid/production/item/update-link-token", { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.link_token) throw new Error(result?.message || "The secure refresh could not start.");
      openWhenReady.current = true;
      setLinkToken(result.link_token);
    } catch (cause) {
      reset(cause instanceof Error ? cause.message : "The secure refresh could not start.");
    }
  }

  return (
    <div className="connect-consent-action">
      {message ? <div className="auth-notice auth-notice-error" role="alert">{message}</div> : null}
      <button className="auth-submit" type="button" aria-busy={busy} disabled={busy || Boolean(linkToken)} onClick={() => void start()}>
        {busy ? "Preparing secure refresh…" : "Refresh connection"}
      </button>
      <a className="auth-secondary-link" href="/account">Not now</a>
    </div>
  );
}
