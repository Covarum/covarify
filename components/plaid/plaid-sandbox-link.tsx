"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { ArrowRight, Check, Landmark, LoaderCircle, RefreshCw } from "lucide-react";
import { FirstWinAnalysis, type FirstWinAnalysisData } from "./first-win-analysis";

type MoneyPicture = {
  connected: boolean;
  transactions_status: "ready" | "processing";
  message: string;
  first_win: FirstWinAnalysisData;
  debt_strategy: { detected_credit_accounts: number; estimated_total_credit_balance: number; estimated_available_credit: number | null; estimated_credit_utilization_if_available: number | null; minimum_payment_data_status: string; apr_data_status: string; payment_strategy_note: string };
  accounts: { id: string; name: string; officialName: string | null; type: string; subtype: string | null; mask: string | null; currentBalance: number | null; availableBalance: number | null; creditLimit: number | null; currency: string }[];
  transactions: { id: string; accountId: string; name: string; amount: number; date: string; category: string; pending: boolean; currency: string }[];
  summary: { totalCash: number; totalDebt: number; recentSpending: number; recentInflow: number; netCashFlow: number; accountCount: number; transactionCount: number };
};

type SafePlaidError = { error_type: string; error_code: string; error_message: string; display_message: string | null; request_id: string | null; status: number; missing_env_keys?: string[]; has_client_id?: boolean; client_id_length?: number; has_secret?: boolean; plaid_env?: string; products?: string[]; country_codes?: string[] };
const fallbackError = (message: string): SafePlaidError => ({ error_type: "CLIENT_ERROR", error_code: "REQUEST_FAILED", error_message: message, display_message: null, request_id: null, status: 0 });
const withRuntimeDiagnostics = (error: SafePlaidError): SafePlaidError => typeof error.has_client_id !== "boolean" ? error : { ...error, display_message: `${error.display_message || error.error_message} Config: has_client_id=${error.has_client_id}, client_id_length=${error.client_id_length ?? 0}, has_secret=${error.has_secret ?? false}, plaid_env=${error.plaid_env || "empty"}, products=${error.products?.join(",") || "empty"}, country_codes=${error.country_codes?.join(",") || "empty"}.` };

const money = (value: number | null, currency = "USD") => value === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
const accountClassification = (account: MoneyPicture["accounts"][number]) => account.type.toLowerCase() === "depository" && ["checking", "savings"].includes((account.subtype || "").toLowerCase()) ? "cash" : ["credit", "loan", "liability", "liabilities"].includes(account.type.toLowerCase()) ? "debt" : "other";

function MoneyPictureSummary({ picture }: { picture: MoneyPicture }) {
  const cash = picture.first_win.cash_flow_summary;
  const weeklyRepairTarget = picture.first_win.deficit_repair?.weekly_improvement_needed ?? (cash.cash_gap > 0 ? cash.cash_gap / 4 : 0);
  const signedMoney = (value: number) => `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`;
  return <section className="money-picture-summary">
    <div className="money-picture-heading"><div><p className="eyebrow plain">Covarify Money Picture</p><h2>The full story at a glance</h2></div><div className="money-picture-meta"><span>{picture.summary.accountCount} connected accounts</span><span>{cash.transaction_count_used} transactions analyzed</span><span>{cash.analysis_window_label}</span></div></div>
    <div className="money-picture-group"><p className="money-group-label">Current position</p><div className="money-summary-grid position-grid"><article><span>Cash in connected accounts</span><strong>{money(picture.summary.totalCash)}</strong><small>Current balance from connected cash accounts. This is not leftover monthly cash.</small></article><article><span>Debt in connected accounts</span><strong>{money(picture.summary.totalDebt)}</strong><small>Detected balances from connected credit/debt accounts.</small></article></div></div>
    <div className="money-picture-group movement-group"><p className="money-group-label">30-day movement</p><div className="money-summary-grid movement-grid"><article><span>Money in</span><strong className="positive">+{money(cash.total_inflows)}</strong><small>{cash.total_inflows > 0 ? "Income-like deposits detected in the analysis window." : "No income-like deposits detected in this sandbox window."}</small></article><article><span>Money out</span><strong>−{money(cash.total_outflows)}</strong><small>Spending and payment outflows detected in the analysis window.</small></article><article><span>Net cash flow</span><strong className={cash.net_cash_flow >= 0 ? "positive" : "negative"}>{signedMoney(cash.net_cash_flow)}</strong><small>Money in minus money out.</small></article></div><p className="money-formula"><strong>{money(cash.total_inflows)}</strong> money in <span>−</span> <strong>{money(cash.total_outflows)}</strong> money out <span>=</span> <strong className={cash.net_cash_flow >= 0 ? "positive" : "negative"}>{signedMoney(cash.net_cash_flow)}</strong> net cash flow</p></div>
    <div className="money-picture-group"><p className="money-group-label">What this means</p><div className="money-summary-grid meaning-grid"><article><span>Estimated cash gap</span><strong className={cash.cash_gap > 0 ? "negative" : "positive"}>{money(cash.cash_gap)}</strong><small>How much would need to improve to get back to neutral for this window.</small></article><article><span>Weekly repair target</span><strong>{money(weeklyRepairTarget)}</strong><small>The approximate weekly improvement needed over four weeks.</small></article></div></div>
  </section>;
}

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
      if (!response.ok || !result.link_token) { setError(withRuntimeDiagnostics({ ...fallbackError("Plaid Link could not be prepared."), ...result, status: result.status ?? response.status })); return; }
      setLinkToken(result.link_token);
    } catch (err) { setError(fallbackError(err instanceof Error ? err.message : "Plaid Link could not be prepared.")); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/plaid/create-link-token", { method: "POST" })
      .then(async (response) => {
        const result = await response.json() as { link_token?: string } & Partial<SafePlaidError>;
        if (!response.ok || !result.link_token) { if (active) setError(withRuntimeDiagnostics({ ...fallbackError("Plaid Link could not be prepared."), ...result, status: result.status ?? response.status })); return; }
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
  if (picture) return <div className="plaid-results">
    <div className={`plaid-connected ${picture.transactions_status === "processing" ? "is-processing" : ""}`}><span><Check size={18} /></span><div><strong>{picture.transactions_status === "processing" ? "Sandbox account connected. Plaid is still preparing transaction history." : "Sandbox connection successful."}</strong><p>{picture.transactions_status === "processing" ? "For richer transaction testing, reconnect using user_transactions_dynamic with any password." : "Covarify pulled sample account and transaction data."}</p></div></div>
    <MoneyPictureSummary picture={picture} />
    <section className="sandbox-section"><div className="sandbox-heading"><div><p className="eyebrow plain">Connected accounts</p><h2>{picture.summary.accountCount} accounts in view</h2></div></div><div className="account-list">{picture.accounts.map((account) => <article key={account.id}><span className="account-icon"><Landmark size={18} /></span><div><strong>{account.name}</strong><small>{account.subtype} ···· {account.mask || "—"}</small><small className="account-debug">type: {account.type} · subtype: {account.subtype || "none"} · current: {money(account.currentBalance, account.currency)} · available: {money(account.availableBalance, account.currency)} · classification: {accountClassification(account)}</small></div><b>{money(account.currentBalance, account.currency)}</b></article>)}</div></section>
    <section className="sandbox-section"><div className="sandbox-heading"><div><p className="eyebrow plain">Recent transactions</p><h2>Latest activity</h2></div><span>{picture.summary.transactionCount} transactions analyzed · showing {Math.min(10, picture.transactions.length)}</span></div><div className="transaction-list">{picture.transactions.slice(0, 10).map((transaction) => <article key={transaction.id}><div><strong>{transaction.name}</strong><small>{transaction.category.replaceAll("_", " ")} · {transaction.date}{transaction.pending ? " · Pending" : ""}</small></div><b className={transaction.amount < 0 ? "inflow" : "outflow"}>{transaction.amount < 0 ? "+" : "−"}{money(Math.abs(transaction.amount), transaction.currency)}</b></article>)}</div></section>
    <FirstWinAnalysis analysis={picture.first_win} accounts={picture.accounts} debt={picture.debt_strategy} totalCash={picture.summary.totalCash} transactions={picture.transactions} />
  </div>;

  return <div className="sandbox-connect-card"><span className="sandbox-card-icon"><Landmark size={25} /></span><p className="eyebrow plain">Secure sandbox connection</p><h2>Bring a sample money picture into view.</h2><p>Plaid Link opens a sandbox institution flow. Credentials and financial data are simulated for development testing.</p>{error && <div className="sandbox-error" role="alert"><strong>{error.display_message || error.error_message}</strong><dl><div><dt>Type</dt><dd>{error.error_type}</dd></div><div><dt>Code</dt><dd>{error.error_code}</dd></div><div><dt>Status</dt><dd>{error.status || "Network error"}</dd></div>{error.request_id && <div><dt>Request ID</dt><dd>{error.request_id}</dd></div>}{error.missing_env_keys?.length ? <div><dt>Missing environment keys</dt><dd>{error.missing_env_keys.join(", ")}</dd></div> : null}</dl><button onClick={() => void loadLinkToken()}><RefreshCw size={14} /> Try again</button></div>}<button className="button button-primary" onClick={() => open()} disabled={!ready || loading || exchanging}>{loading || exchanging ? <><LoaderCircle className="spin" size={17} /> {exchanging ? "Building your picture…" : "Preparing Plaid…"}</> : <>Connect Sandbox Account <ArrowRight size={17} /></>}</button></div>;
}
