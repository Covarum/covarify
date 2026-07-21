import Link from "next/link";
import { Download, Search } from "lucide-react";
import { listBetaApplications } from "@/lib/waitlist";
import { WAITLIST_STATUSES } from "@/lib/waitlist-core";

const PAGE_SIZE = 25;
const formatDate = (value: string) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/New_York" }).format(new Date(value));
type Params = { q?: string; status?: string; source?: string; sort?: "newest" | "oldest"; page?: string };

export default async function WaitlistPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const filters = { search: params.q, status: params.status, leadSource: params.source, sort: params.sort };
  const rows = await listBetaApplications(filters);
  const allRows = await listBetaApplications();
  const leadSources = [...new Set(allRows.map((row) => row.lead_source))].sort();
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(params.page) || 1));
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q); if (params.status) query.set("status", params.status); if (params.source) query.set("source", params.source); if (params.sort) query.set("sort", params.sort);
  const pageHref = (next: number) => { const nextQuery = new URLSearchParams(query); nextQuery.set("page", String(next)); return `/admin/waitlist?${nextQuery}`; };
  return <>
    <header className="admin-page-head"><div><p className="admin-overline">Application pipeline</p><h1>Waitlist</h1><p>{rows.length} matching application{rows.length === 1 ? "" : "s"}.</p></div><Link className="admin-secondary" href={`/admin/waitlist/export?${query}`}><Download size={15} /> Export CSV</Link></header>
    <form className="admin-filters" method="get">
      <label className="admin-search"><Search size={15} /><span className="sr-only">Search applications</span><input name="q" defaultValue={params.q || ""} placeholder="ID, name, email, referral, detail, or notes" /></label>
      <label><span className="sr-only">Status</span><select name="status" defaultValue={params.status || "all"}><option value="all">All statuses</option>{WAITLIST_STATUSES.map((status) => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></label>
      <label><span className="sr-only">Lead source</span><select name="source" defaultValue={params.source || "all"}><option value="all">All lead sources</option>{leadSources.map((source) => <option key={source}>{source}</option>)}</select></label>
      <label><span className="sr-only">Sort order</span><select name="sort" defaultValue={params.sort || "newest"}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
      <button className="admin-primary" type="submit">Apply</button><Link className="admin-filter-reset" href="/admin/waitlist">Reset</Link>
    </form>
    <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Application</th><th>Submitted</th><th>Status</th><th>Applicant</th><th>Lead source</th><th>Financial context</th></tr></thead><tbody>
      {visible.map((row) => <tr key={row.id}><td><Link href={`/admin/waitlist/${row.id}`}><strong>{row.application_id}</strong></Link></td><td>{formatDate(row.created_at)}</td><td><span className={`admin-status status-${row.status}`}>{row.status}</span></td><td><Link href={`/admin/waitlist/${row.id}`}><strong>{row.name}</strong><small>{row.email}</small></Link></td><td><strong>{row.lead_source}</strong><small>{row.lead_source_detail || row.referred_by_name || "—"}</small></td><td><span className="admin-clamp">{row.financial_stress || "—"}</span><small className="admin-clamp">{row.decision || "—"}</small></td></tr>)}
      {!visible.length && <tr><td className="admin-empty" colSpan={6}>No applications match these filters.</td></tr>}
    </tbody></table></div>
    <nav className="admin-pagination" aria-label="Waitlist pages"><span>Page {page} of {pages}</span><div>{page > 1 && <Link href={pageHref(page - 1)}>Previous</Link>}{page < pages && <Link href={pageHref(page + 1)}>Next</Link>}</div></nav>
  </>;
}
