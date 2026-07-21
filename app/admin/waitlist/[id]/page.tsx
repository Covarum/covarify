import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { notFound } from "next/navigation";
import { CopyEmailButton } from "@/components/admin/copy-email-button";
import { getBetaApplication } from "@/lib/waitlist";
import { WAITLIST_STATUSES } from "@/lib/waitlist-core";
import { updateApplicationAction } from "../actions";

const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "America/New_York" }).format(new Date(value)) : "—";
function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) { return <div className={wide ? "admin-detail-field is-wide" : "admin-detail-field"}><dt>{label}</dt><dd>{children || "—"}</dd></div>; }

export default async function ApplicationDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params; const query = await searchParams;
  const row = await getBetaApplication(id); if (!row) notFound();
  return <>
    <Link className="admin-back" href="/admin/waitlist"><ArrowLeft size={15} /> Back to waitlist</Link>
    <header className="admin-page-head admin-detail-head"><div><p className="admin-overline">{row.application_id}</p><h1>{row.name}</h1><p>Submitted {formatDate(row.created_at)}</p></div><div className="admin-head-actions"><a className="admin-secondary" href={`mailto:${row.email}`}><Mail size={15} /> Email applicant</a><CopyEmailButton email={row.email} /></div></header>
    {query.saved === "1" && <p className="admin-saved" role="status">Application updated successfully.</p>}
    <section className="admin-detail-grid">
      <article className="admin-panel"><h2>Application details</h2><dl className="admin-detail-list">
        <Field label="Application ID">{row.application_id}</Field><Field label="Status"><span className={`admin-status status-${row.status}`}>{row.status}</span></Field>
        <Field label="Name">{row.name}</Field><Field label="Email">{row.email}</Field><Field label="Created">{formatDate(row.created_at)}</Field><Field label="Updated">{formatDate(row.updated_at)}</Field>
        <Field label="Financial stress" wide>{row.financial_stress}</Field><Field label="Decision" wide>{row.decision}</Field>
        <Field label="Lead source">{row.lead_source}</Field><Field label="Lead-source detail">{row.lead_source_detail || row.referred_by_name}</Field>
        <Field label="UTM source">{row.utm_source}</Field><Field label="UTM medium">{row.utm_medium}</Field><Field label="UTM campaign">{row.utm_campaign}</Field>
        <Field label="Invited date">{formatDate(row.invited_at)}</Field><Field label="Activated date">{formatDate(row.activated_at)}</Field>
        <Field label="Administrator email"><span className={row.admin_email_sent ? "admin-delivery yes" : "admin-delivery no"}>{row.admin_email_sent ? "Sent" : "Not confirmed"}</span></Field>
        <Field label="Applicant confirmation"><span className={row.confirmation_email_sent ? "admin-delivery yes" : "admin-delivery no"}>{row.confirmation_email_sent ? "Sent" : "Not confirmed"}</span></Field>
      </dl></article>
      <aside className="admin-panel admin-editor"><p className="admin-overline">Founder actions</p><h2>Update application</h2><form action={updateApplicationAction}><input type="hidden" name="id" value={row.id} /><label>Status<select name="status" defaultValue={row.status}>{WAITLIST_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label><label>Founder notes<textarea name="founder_notes" defaultValue={row.founder_notes} maxLength={5000} rows={12} placeholder="Private context, follow-up notes, or next steps" /></label><p>Changing to invited or active sets its timestamp only the first time. Note edits preserve existing dates.</p><button className="admin-primary" type="submit">Save changes</button></form></aside>
    </section>
  </>;
}
