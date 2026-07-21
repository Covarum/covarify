import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { getWaitlistDashboard } from "@/lib/waitlist";

const statusLabels: Record<string, string> = { waiting: "Waiting", invited: "Invited", active: "Active", archived: "Archived" };
const formatDate = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(new Date(value));

export default async function AdminDashboardPage() {
  const dashboard = await getWaitlistDashboard();
  const metrics = [
    ["Total applications", dashboard.rows.length], ["Waiting", dashboard.counts.waiting], ["Invited", dashboard.counts.invited],
    ["Active", dashboard.counts.active], ["Archived", dashboard.counts.archived], ["Signups today", dashboard.today],
    ["Last 7 days", dashboard.lastSevenDays], ["Top lead source", dashboard.topLeadSource],
  ];
  const sources = Object.entries(dashboard.sourceCounts).sort((a, b) => b[1] - a[1]);
  return <>
    <header className="admin-page-head"><div><p className="admin-overline">Private operations</p><h1>Waitlist overview</h1><p>Founder-only visibility into Covarify&apos;s early-access pipeline.</p></div><Link className="admin-primary" href="/admin/waitlist">Manage applications <ArrowRight size={16} /></Link></header>
    <section className="admin-metrics" aria-label="Waitlist metrics">{metrics.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}</section>
    <section className="admin-dashboard-grid">
      <article className="admin-panel"><div className="admin-panel-head"><div><p className="admin-overline">Latest activity</p><h2>Recent applications</h2></div><Users size={20} /></div>
        <div className="admin-recent">{dashboard.rows.slice(0, 7).map((row) => <Link key={row.id} href={`/admin/waitlist/${row.id}`}><span><strong>{row.application_id}</strong><small>{row.name} · {row.lead_source}</small></span><span><b className={`admin-status status-${row.status}`}>{statusLabels[row.status]}</b><small>{formatDate(row.created_at)}</small></span></Link>)}{!dashboard.rows.length && <p className="admin-empty">No applications yet.</p>}</div>
      </article>
      <article className="admin-panel"><div className="admin-panel-head"><div><p className="admin-overline">Acquisition</p><h2>Lead sources</h2></div></div>
        <div className="admin-source-list">{sources.map(([source, count]) => <div key={source}><span>{source}</span><strong>{count}</strong><i style={{ width: `${dashboard.rows.length ? Math.max(8, count / dashboard.rows.length * 100) : 0}%` }} /></div>)}</div>
        <dl className="admin-mini-metrics"><div><dt>Referrals</dt><dd>{(dashboard.sourceCounts["Friend / Referral"] || 0) + (dashboard.sourceCounts["Professional Referral"] || 0)}</dd></div><div><dt>Instagram</dt><dd>{dashboard.sourceCounts.Instagram || 0}</dd></div><div><dt>Professional referrals</dt><dd>{dashboard.sourceCounts["Professional Referral"] || 0}</dd></div></dl>
      </article>
    </section>
  </>;
}
