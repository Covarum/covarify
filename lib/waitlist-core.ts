export const WAITLIST_STATUSES = ["waiting", "invited", "active", "archived"] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

export type BetaApplication = {
  id: string;
  application_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  email: string;
  financial_stress: string;
  decision: string;
  lead_source: string;
  lead_source_detail: string;
  referred_by_name: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  status: WaitlistStatus;
  founder_notes: string;
  invited_at: string | null;
  activated_at: string | null;
  admin_email_sent: boolean;
  confirmation_email_sent: boolean;
};

export type WaitlistFilters = {
  search?: string;
  status?: string;
  leadSource?: string;
  sort?: "newest" | "oldest";
};

export function parseAdminEmails(value: string | undefined) {
  if (!value) return [];
  return value.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export function isFounderAdmin(user: { email?: string | null } | null, allowlist: string | undefined) {
  const email = user?.email?.trim().toLowerCase();
  return Boolean(email && parseAdminEmails(allowlist).includes(email));
}

export function filterAndSortApplications(rows: BetaApplication[], filters: WaitlistFilters = {}) {
  const term = filters.search?.trim().toLowerCase() || "";
  const status = WAITLIST_STATUSES.includes(filters.status as WaitlistStatus) ? filters.status : "all";
  const leadSource = filters.leadSource?.trim() || "all";
  const filtered = rows.filter((row) => {
    if (status !== "all" && row.status !== status) return false;
    if (leadSource !== "all" && row.lead_source !== leadSource) return false;
    if (!term) return true;
    return [row.application_id, row.name, row.email, row.referred_by_name, row.lead_source_detail, row.founder_notes]
      .some((value) => value.toLowerCase().includes(term));
  });
  return filtered.sort((a, b) => {
    const delta = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    return filters.sort === "oldest" ? delta : -delta;
  });
}

export function buildApplicationUpdate(
  current: Pick<BetaApplication, "invited_at" | "activated_at">,
  values: { status?: string; founder_notes?: string },
  now = new Date().toISOString(),
) {
  const update: Record<string, string> = {};
  if (values.status !== undefined) {
    if (!WAITLIST_STATUSES.includes(values.status as WaitlistStatus)) throw new Error("INVALID_WAITLIST_STATUS");
    update.status = values.status;
    if (values.status === "invited" && !current.invited_at) update.invited_at = now;
    if (values.status === "active" && !current.activated_at) update.activated_at = now;
  }
  if (values.founder_notes !== undefined) {
    if (values.founder_notes.length > 5000) throw new Error("FOUNDER_NOTES_TOO_LONG");
    update.founder_notes = values.founder_notes;
  }
  return update;
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function applicationsToCsv(rows: BetaApplication[]) {
  const columns: Array<[string, keyof BetaApplication]> = [
    ["Application ID", "application_id"], ["Submitted", "created_at"], ["Status", "status"], ["Name", "name"],
    ["Email", "email"], ["Lead source", "lead_source"], ["Lead source detail", "lead_source_detail"],
    ["Referred by", "referred_by_name"], ["Financial stress", "financial_stress"], ["Decision", "decision"],
    ["UTM source", "utm_source"], ["UTM medium", "utm_medium"], ["UTM campaign", "utm_campaign"],
    ["Founder notes", "founder_notes"], ["Invited at", "invited_at"], ["Activated at", "activated_at"],
    ["Admin email sent", "admin_email_sent"], ["Confirmation email sent", "confirmation_email_sent"],
  ];
  return [columns.map(([label]) => csvCell(label)).join(","), ...rows.map((row) => columns.map(([, key]) => csvCell(row[key])).join(","))].join("\r\n");
}
