import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { PlaidSandboxLink } from "@/components/plaid/plaid-sandbox-link";
import "@/styles/plaid.css";
import "@/styles/plaid-results.css";
import "@/styles/first-win-engine.css";

export const metadata: Metadata = { title: "Plaid Sandbox Connection", robots: { index: false, follow: false, nocache: true } };

export default function PlaidSandboxPage() {
  return <main className="plaid-sandbox"><header className="demo-header shell"><Link href="/" className="back-link"><ArrowLeft size={16} /> Covarify</Link><span className="sample-badge"><FlaskConical size={12} /> Development only</span></header><div className="plaid-shell shell"><section className="plaid-intro"><p className="eyebrow plain">Private integration preview</p><h1>Plaid Sandbox Connection</h1><p>This page uses Plaid sandbox data for development testing only.</p></section><div className="sandbox-grid"><PlaidSandboxLink /><aside className="sandbox-hint"><p className="eyebrow plain">Sandbox test hint</p><h2>First Platypus Bank</h2><dl><div><dt>Username</dt><dd><code>user_good</code></dd></div><div><dt>Password</dt><dd><code>pass_good</code></dd></div></dl><p><strong>Recommended for Covarify:</strong> For transaction-rich testing, use <code>user_transactions_dynamic</code> with any password.</p><div className="sandbox-note">No Plaid access token is displayed, returned to this page, or stored.</div></aside></div></div></main>;
}
