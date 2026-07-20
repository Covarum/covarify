import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

export const WAITLIST_STATUSES = ["waiting", "invited", "active", "archived"] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

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
  if (!user) return null;
  const allowed = (process.env.COVARIFY_ADMIN_EMAILS || "tara@covarify.com").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (!user.email || !allowed.includes(user.email.toLowerCase())) return null;
  return user;
}

export async function listBetaApplications(search = "", status = "all") {
  const supabase = createSupabaseAdminClient();
  let query = supabase.from("beta_applications").select("*").order("created_at", { ascending: false }).limit(500);
  if (status !== "all" && WAITLIST_STATUSES.includes(status as WaitlistStatus)) query = query.eq("status", status);
  const term = search.trim();
  if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,referred_by_name.ilike.%${term}%,founder_notes.ilike.%${term}%`);
  const { data, error } = await query;
  if (error) throw new Error("WAITLIST_READ_FAILED");
  return data || [];
}

export async function updateBetaApplication(id: string, values: { status?: WaitlistStatus; founder_notes?: string }) {
  const supabase = createSupabaseAdminClient();
  const update: Record<string, unknown> = {};
  if (values.status) {
    update.status = values.status;
    if (values.status === "invited") update.invited_at = new Date().toISOString();
    if (values.status === "active") update.activated_at = new Date().toISOString();
  }
  if (typeof values.founder_notes === "string") update.founder_notes = values.founder_notes.slice(0, 5000);
  const { error } = await supabase.from("beta_applications").update(update).eq("id", id);
  if (error) throw new Error("WAITLIST_UPDATE_FAILED");
}
