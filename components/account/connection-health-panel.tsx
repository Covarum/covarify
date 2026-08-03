"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AccountClass, InstitutionConnectionHealth } from "@/lib/plaid/production/connection-health";
import styles from "./money-picture.module.css";

const classLabels: Record<AccountClass, string> = { cash: "checking and savings", credit: "credit cards", loan: "loans", investment: "investments", other: "other accounts" };
const when = (value: string | null, prefix = "Updated") => {
  if (!value) return "Data not available yet";
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
  return days === 0 ? `${prefix} today` : days === 1 ? `${prefix} yesterday` : `${prefix} ${days} days ago`;
};

export function ConnectionHealthPanel({ connections }: { connections: InstitutionConnectionHealth[] }) {
  const router = useRouter();
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const eligible = connections.filter((item) => item.refreshEligible);
  const currentCount = connections.filter((item) => item.state === "current").length;
  const attentionCount = connections.filter((item) => ["aging", "stale", "action_required", "unavailable"].includes(item.state)).length;
  const bankingUpdates = connections.filter((item) => item.accountClasses.some((value) => value !== "investment")).map((item) => item.lastTransactionSyncAt).filter((value): value is string => Boolean(value)).sort();
  const refresh = async (itemIds: string[]) => {
    if (!itemIds.length || busyIds.length) return;
    setBusyIds(itemIds); setNotice("Requesting a safe refresh…");
    try {
      const response = await fetch("/api/plaid/production/items/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemIds }) });
      const result = await response.json();
      setNotice(result.message || "Refresh unavailable right now.");
      router.refresh();
    } catch { setNotice("Refresh unavailable right now. Your existing data remains safe."); }
    finally { setBusyIds([]); }
  };
  return <div className={styles.connectionHealth}>
    <span><i aria-hidden="true" />Connection health</span>
    <strong>{attentionCount === 0 ? "All connected institutions are up to date." : `${currentCount} current · ${attentionCount} need${attentionCount === 1 ? "s" : ""} attention`}</strong>
    {bankingUpdates.length ? <small>{when(bankingUpdates.at(-1) || null, "Last banking update")}</small> : null}
    <div className={styles.connectionActions}>
      <a href="#connection-details">Review connections</a>
      {eligible.length ? <button type="button" disabled={busyIds.length > 0} aria-busy={busyIds.length > 0} onClick={() => refresh(eligible.map((item) => item.itemId))}>Refresh stale accounts</button> : null}
      <Link href="/connect">Add another institution</Link>
    </div>
    {notice ? <p className={styles.refreshNotice} role="status" aria-live="polite">{notice}</p> : null}
    <details className={styles.connectionDetails} id="connection-details">
      <summary>Connection details</summary>
      <div>{connections.map((item) => <article key={item.itemId}>
        <header><div><h3>{item.institutionName}</h3><p>{item.accountCount} {item.accountCount === 1 ? "account" : "accounts"} · {item.accountClasses.map((value) => classLabels[value]).join(", ") || "account type unavailable"}</p></div><strong>{item.safeMessage}</strong></header>
        {item.accountClasses.some((value) => value !== "investment") ? <p>{when(item.lastTransactionSyncAt, "Transactions updated")}</p> : null}
        {item.lastBalanceUpdateAt ? <p>{when(item.lastBalanceUpdateAt, "Account balance updated")}</p> : null}
        {item.accountClasses.includes("investment") ? <><p>{when(item.lastInvestmentUpdateAt, "Investment account balance updated")}</p><p>Investment data may be delayed. Holdings and investment transactions are not available yet.</p></> : null}
        <footer>{item.reconnectRequired ? <Link href="/account/connection/refresh">Reconnect {item.institutionName}</Link> : item.refreshEligible ? <button type="button" disabled={busyIds.length > 0} aria-busy={busyIds.includes(item.itemId)} onClick={() => refresh([item.itemId])}>Refresh</button> : item.state === "syncing" ? <span>Refresh already in progress</span> : item.retryAt ? <span>Refresh available later</span> : null}</footer>
      </article>)}</div>
    </details>
  </div>;
}
