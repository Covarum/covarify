import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildConnectionHealth, MANUAL_REFRESH_COOLDOWN_MS } from "@/lib/plaid/production/connection-health";
import { createSupabasePlaidRepository } from "@/lib/plaid/production/supabase-repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ ok: false, message: "Authentication required." }, { status: 401 });
  let body: { itemIds?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false, message: "Invalid refresh request." }, { status: 400 }); }
  const requested = Array.isArray(body.itemIds) ? [...new Set(body.itemIds.filter((value): value is string => typeof value === "string" && value.length > 0))].slice(0, 10) : [];
  if (!requested.length) return NextResponse.json({ ok: false, message: "No connections were selected." }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data: items, error: itemError } = await supabase.from("plaid_items")
    .select("id,plaid_item_id,institution_name,status,last_successful_sync_at,error_code,needs_update_mode")
    .eq("user_id", user.id).eq("environment", "production").in("id", requested);
  if (itemError) return NextResponse.json({ ok: false, message: "Refresh is unavailable right now." }, { status: 503 });
  if ((items || []).length !== requested.length) return NextResponse.json({ ok: false, message: "Connection access was denied." }, { status: 403 });
  const [accountResult, syncResult] = await Promise.all([
    supabase.from("plaid_accounts").select("plaid_item_id,type,subtype,updated_at").eq("user_id", user.id).in("plaid_item_id", requested).eq("active_status", "active"),
    supabase.from("transaction_sync_states").select("plaid_item_id,sync_status,last_sync_started_at,last_sync_completed_at,last_error").in("plaid_item_id", requested),
  ]);
  if (accountResult.error || syncResult.error) return NextResponse.json({ ok: false, message: "Refresh is unavailable right now." }, { status: 503 });
  const health = buildConnectionHealth(items || [], accountResult.data || [], syncResult.data || []);
  const healthById = new Map(health.map((value) => [value.itemId, value]));
  const queue = createSupabasePlaidRepository();
  const bucket = Math.floor(Date.now() / MANUAL_REFRESH_COOLDOWN_MS);
  const results = await Promise.all((items || []).map(async (item) => {
    const current = healthById.get(item.id);
    if (!current?.refreshEligible) return { itemId: item.id, state: current?.reconnectRequired ? "reconnect_required" : current?.state === "syncing" ? "updating" : "not_eligible" };
    try {
      const outcome = await queue.enqueue({ plaidItemId: item.plaid_item_id, webhookCode: "MANUAL_REFRESH", deduplicationKey: `manual:${item.id}:${bucket}` });
      return { itemId: item.id, state: outcome === "unavailable" ? "unavailable" : outcome === "duplicate" ? "cooldown" : "requested" };
    } catch {
      return { itemId: item.id, state: "unavailable" };
    }
  }));
  const accepted = results.some((result) => result.state === "requested" || result.state === "updating" || result.state === "cooldown");
  if (accepted) { revalidatePath("/account"); revalidatePath("/connect"); }
  return NextResponse.json({ ok: accepted, message: accepted ? "Refresh requested. Covarify will show a newer timestamp only after fresh data arrives." : "No selected connection is eligible for refresh right now.", results }, { status: accepted ? 202 : 409, headers: { "Cache-Control": "no-store" } });
}
