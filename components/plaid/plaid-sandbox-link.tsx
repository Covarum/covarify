"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { ArrowRight, Check, Landmark, LoaderCircle, RefreshCw } from "lucide-react";

type MoneyPicture = {
  accounts: { id: string; name: string; officialName: string | null; type: string; subtype: string | null; mask: string | null; currentBalance: number | null; availableBalance: number | null; currency: string }[];
  transactions: { id: string; accountId: string; name: string; amount: number; date: string; category: string; pending: boolean; currency: string }[];
  summary: { totalCash: number; totalDebt: number; recentSpending: number; recentInflow: number; netCashFlow: number; accountCount: number; transactionCount: number };
};

type SafePlaidError = { error_type: string; error_code: string; error_message: string; display_message: string | null; request_id: string | null; status: number; missing_env_keys?: string[] };
const fallbackError = (message: string): SafePlaidError => ({ error_type: "CLIENT_ERROR", error_code: "REQUEST_FAILED", error_message: message, display_message: null, request_id: null, status: 0 });

const money = (value: number | null, currency = "USD") => value === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);

export function PlaidSandboxLink() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [picture, setPicture] = useState<MoneyPicture | null>(null);
  const [error, setError] = useState<SafePlaidError | null>(null);
  const [loading, setLoading] = useState(true);
  const [exchanging, setExchanging] = useState(false);

  const loadLinkToken = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/plaid/create-link-token", { method: "POST" });
      const result = await response.json() as { link_token?: string } & Partial<SafePlaidError>;
      if (!response.ok || !result.link_token) { setError({ ...fallbackError("Plaid Link could not be prepared."), ...result, status: result.status ?? response.status }); return; }
      setLinkToken(result.link_token);
    } catch (err) { setError(fallbackError(err instanceof Error ? err.message : "Plaid Link could not be prepared.")); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/plaid/create-link-token", { method: "POST" })
      .then(async (response) => {
        const result = await response.json() as { link_token?: string } & Partial<SafePlaidError>;
        if (!response.ok || !result.link_token) { if (active) setError({ ...fallbackError("Plaid Link could not be prepared."), ...result, status: result.status ?? response.status }); return; }
        if (active) setLinkToken(result.link_token);
      })
      .catch((err: unknown) => { if (active) setError(fallbackError(err instanceof Error ? err.message : "Plaid Link could not be prepared.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const onSuccess = useCallback(async (publicToken: string) => {
    setExchanging(true); setError(null);
    try {
      const response = await fetch("/api/plaid/exchange-public-token", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ public_token: publicToken }) });
      const result = await response.json() as MoneyPicture & Partial<SafePlaidError>;
      if (!response.ok) { setError({ ...fallbackError("Sandbox data could not be loaded."), ...result, status: result.status ?? response.status }); return; }
      setPicture(result);
    } catch (err) { setError(fallbackError(err instanceof Error ? err.message : "Sandbox data could not be loaded.")); }
    finally { setExchanging(false); }
  }, []);

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess });
  const firstWin = picture && picture.summary.netCashFlow < 0 ? "Protect cash flow before making additional debt payments." : "Review your largest recent expense and direct the remaining margin toward your top priority.";

  if (picture) return <div className="plaid-results">
    <div className="plaid-connected"><span><Check size={18} /></span><div><strong>Sandbox account connected</strong><p>Sanitized data loaded for this session only.</p></div></div>
    <section><p className="eyebrow plain">Covarify Money Picture</p><div className="money-grid"><article><span>Total cash</span><strong>{money(picture.summary.totalCash)}</strong></article><article><span>Total debt</span><strong>{money(picture.summary.totalDebt)}</strong></article><article><span>30-day spending</span><strong>{money(picture.summary.recentSpending)}</strong></article><article><span>Net cash flow</span><strong>{money(picture.summary.netCashFlow)}</strong></article></div></section>
    <section className="sandbox-section"><div className="sandbox-heading"><div><p className="eyebrow plain">Connected accounts</p><h2>{picture.summary.accountCount} accounts in view</h2></div></div><div className="account-list">{picture.accounts.map((account) => <article key={account.id}><span className="account-icon"><Landmark size={18} /></span><div><strong>{account.name}</strong><small>{account.subtype} ···· {account.mask || "—"}</small></div><b>{money(account.currentBalance, account.currency)}</b></article>)}</div></section>
    <section className="sandbox-section"><div className="sandbox-heading"><div><p className="eyebrow plain">Recent transactions</p><h2>Last 30 days</h2></div><span>{picture.summary.transactionCount} shown</span></div><div className="transaction-list">{picture.transactions.slice(0, 10).map((transaction) => <article key={transaction.id}><div><strong>{transaction.name}</strong><small>{transaction.category.replaceAll("_", " ")} · {transaction.date}{transaction.pending ? " · Pending" : ""}</small></div><b className={transaction.amount < 0 ? "inflow" : ""}>{transaction.amount < 0 ? "+" : "−"}{money(Math.abs(transaction.amount), transaction.currency)}</b></article>)}</div></section>
    <section className="sandbox-first-win"><span className="success-icon"><Check /></span><div><p className="eyebrow plain">First Win recommendation</p><h2>{firstWin}</h2><p>This demonstration turns sandbox activity into a prioritized next step. It is illustrative, not individualized financial advice.</p></div></section>
  </div>;

  return <div className="sandbox-connect-card"><span className="sandbox-card-icon"><Landmark size={25} /></span><p className="eyebrow plain">Secure sandbox connection</p><h2>Bring a sample money picture into view.</h2><p>Plaid Link opens a sandbox institution flow. Credentials and financial data are simulated for development testing.</p>{error && <div className="sandbox-error" role="alert"><strong>{error.display_message || error.error_message}</strong><dl><div><dt>Type</dt><dd>{error.error_type}</dd></div><div><dt>Code</dt><dd>{error.error_code}</dd></div><div><dt>Status</dt><dd>{error.status || "Network error"}</dd></div>{error.request_id && <div><dt>Request ID</dt><dd>{error.request_id}</dd></div>}{error.missing_env_keys?.length ? <div><dt>Missing environment keys</dt><dd>{error.missing_env_keys.join(", ")}</dd></div> : null}</dl><button onClick={() => void loadLinkToken()}><RefreshCw size={14} /> Try again</button></div>}<button className="button button-primary" onClick={() => open()} disabled={!ready || loading || exchanging}>{loading || exchanging ? <><LoaderCircle className="spin" size={17} /> {exchanging ? "Building your picture…" : "Preparing Plaid…"}</> : <>Connect Sandbox Account <ArrowRight size={17} /></>}</button></div>;
}
