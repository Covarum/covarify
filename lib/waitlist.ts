import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { BetaApplication, buildApplicationUpdate, filterAndSortApplications, isFounderAdmin, WaitlistFilters, WaitlistStatus } from "@/lib/waitlist-core";
export { WAITLIST_STATUSES } from "@/lib/waitlist-core";

export type BetaApplicationInput = {
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
};

export async function createBetaApplication(input: BetaApplicationInput) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("beta_applications").insert(input).select("id,application_id").single();
  if (error) throw new Error("WAITLIST_INSERT_FAILED");
  return data as { id: string; application_id: string };
}

export async function markApplicationEmail(id: string, field: "admin_email_sent" | "confirmation_email_sent") {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("beta_applications").update({ [field]: true }).eq("id", id);
  if (error) console.error("Waitlist email delivery status update failed.");
}

export async function requireFounderAdmin() {
  const user = await getAuthenticatedUser();
  return isFounderAdmin(user, process.env.COVARIFY_ADMIN_EMAILS) ? user : null;
}

async function readAllBetaApplications() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("beta_applications").select("*").order("created_at", { ascending: false }).limit(5000);
  if (error) throw new Error("WAITLIST_READ_FAILED");
  return (data || []) as BetaApplication[];
}

export async function listBetaApplications(filters: WaitlistFilters = {}) {
  return filterAndSortApplications(await readAllBetaApplications(), filters);
}

export async function getBetaApplication(id: string) {
  const { data, error } = await createSupabaseAdminClient().from("beta_applications").select("*").eq("id", id).single();
  if (error || !data) return null;
  return data as BetaApplication;
}

export async function getWaitlistDashboard() {
  const rows = await readAllBetaApplications();
  const now = new Date();
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const counts = Object.fromEntries(["waiting", "invited", "active", "archived"].map((status) => [status, rows.filter((row) => row.status === status).length]));
  const sourceCounts = rows.reduce<Record<string, number>>((result, row) => { result[row.lead_source] = (result[row.lead_source] || 0) + 1; return result; }, {});
  const topLeadSource = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  return {
    rows, counts, sourceCounts, topLeadSource,
    today: rows.filter((row) => new Date(row.created_at) >= startToday).length,
    lastSevenDays: rows.filter((row) => new Date(row.created_at) >= sevenDaysAgo).length,
  };
}

export async function updateBetaApplication(id: string, values: { status?: WaitlistStatus; founder_notes?: string }) {
  const supabase = createSupabaseAdminClient();
  const { data: current, error: readError } = await supabase.from("beta_applications").select("invited_at,activated_at").eq("id", id).single();
  if (readError || !current) throw new Error("WAITLIST_NOT_FOUND");
  const update = buildApplicationUpdate(current, values);
  if (!Object.keys(update).length) return;
  const { error } = await supabase.from("beta_applications").update(update).eq("id", id);
  if (error) throw new Error("WAITLIST_UPDATE_FAILED");
}
