import type { Metadata } from "next";
import { ArrowLeft, Check, ShieldCheck, TrendingUp } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "First Win Preview", robots: { index: false, follow: false } };
// TODO: Add password protection or authentication before sharing sensitive demo content.
const stats = [{ label: "Monthly income", value: "$6,400", note: "After tax" }, { label: "Bills", value: "$4,180", note: "65% of income" }, { label: "Debt", value: "$18,750", note: "Across 3 accounts" }, { label: "Cash pressure", value: "Elevated", note: "$620 until payday" }];

export default function FirstWinPage() {
  return <main className="demo"><header className="demo-header shell"><Link href="/" className="back-link"><ArrowLeft size={16} /> Covarify</Link><span className="sample-badge">Sample data only</span></header><div className="demo-shell shell"><div className="demo-title"><p className="eyebrow plain">Your financial picture</p><h1>Good morning, Maya.</h1><p>Here is what matters most right now.</p></div><div className="stat-grid">{stats.map((s) => <article className="stat-card" key={s.label}><span>{s.label}</span><strong>{s.value}</strong><small>{s.note}</small></article>)}</div>
    <section className="win-card"><div className="win-icon"><Check /></div><div><p className="card-kicker">YOUR FIRST WIN</p><h2>Protect cash flow this week before making extra debt payments.</h2><p>Your upcoming bills leave a narrow margin before payday. Keep the planned $300 extra payment in checking for now, then revisit it after your next deposit.</p><div className="win-actions"><span><ShieldCheck size={17} /> Protect a $500 buffer</span><span><TrendingUp size={17} /> Revisit in 8 days</span></div></div></section>
    <section className="progress-card"><div><p>Goal progress</p><h3>Emergency cushion</h3></div><strong>$1,850 <span>of $4,000</span></strong><div className="progress-track"><i /></div><small>46% complete</small></section><p className="sample-disclaimer">This is sample data for demonstration only. Covarify is in early development and does not claim live account or Plaid integration.</p></div></main>;
}
