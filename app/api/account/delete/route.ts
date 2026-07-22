import { NextResponse } from "next/server";
import { sendAccountDeletionEmail } from "@/lib/account-deletion/email";
import { ACCOUNT_DELETION_RECEIVED_MESSAGE } from "@/lib/account-deletion/policy";
import { readProductionPlaidConfig } from "@/lib/plaid/production/config";
import { readTokenCipher } from "@/lib/plaid/production/encryption";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user?.email) return NextResponse.json({ ok: false, message: "Sign in to delete your account." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (body?.confirmed !== true) return NextResponse.json({ ok: false, message: "Final deletion confirmation is required." }, { status: 400 });

  const db = createSupabaseAdminClient();
  const requestedAt = new Date();
  const dueAt = new Date(requestedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  const { data: existing } = await db.from("account_deletion_requests").select("id,status").eq("user_id", user.id).in("status", ["requested", "processing", "scheduled", "legal_hold"]).maybeSingle();
  if (existing) return NextResponse.json({ ok: true, message: ACCOUNT_DELETION_RECEIVED_MESSAGE });

  const { data: deletion, error: requestError } = await db.from("account_deletion_requests").insert({ user_id: user.id, notification_email: user.email, status: "processing", requested_at: requestedAt.toISOString(), deletion_due_at: dueAt.toISOString() }).select("id").single();
  if (requestError || !deletion) return NextResponse.json({ ok: false, message: "Your deletion request could not be recorded. Contact contact@covarify.com." }, { status: 500 });

  let immediateActionsComplete = true;
  const { error: profileError } = await db.from("profiles").update({ account_status: "closed", display_name: null, updated_at: requestedAt.toISOString() }).eq("id", user.id);
  const { error: banError } = await db.auth.admin.updateUserById(user.id, { ban_duration: "876000h" });
  if (profileError || banError) immediateActionsComplete = false;
  const { data: items, error: itemError } = await db.from("plaid_items").select("id,encrypted_access_token,token_key_version").eq("user_id", user.id).eq("environment", "production").neq("status", "disconnected");
  if (itemError) immediateActionsComplete = false;
  if (items?.length) {
    try {
      const config = readProductionPlaidConfig();
      const cipher = readTokenCipher();
      for (const item of items) {
        if (item.encrypted_access_token && item.token_key_version) {
          const token = await cipher.decrypt({ ciphertext: item.encrypted_access_token, keyVersion: item.token_key_version });
          await config.client.itemRemove({ access_token: token });
        }
        const { error } = await db.rpc("disconnect_plaid_item_for_deletion", { target_item_id: item.id, disconnected_time: requestedAt.toISOString() });
        if (error) throw error;
      }
    } catch { immediateActionsComplete = false; }
  }

  await db.from("account_deletion_requests").update({ status: immediateActionsComplete ? "scheduled" : "action_required", immediate_actions_completed_at: immediateActionsComplete ? new Date().toISOString() : null }).eq("id", deletion.id);
  await db.from("audit_events").insert({ user_id: user.id, event_type: "account_deletion_requested", entity_type: "account_deletion_request", entity_id: deletion.id, safe_metadata: { due_at: dueAt.toISOString(), immediate_actions_complete: immediateActionsComplete } });
  try { await sendAccountDeletionEmail(user.email, "received"); await db.from("account_deletion_requests").update({ received_email_sent_at: new Date().toISOString() }).eq("id", deletion.id); } catch { /* The durable request remains available for operational retry. */ }

  return NextResponse.json({ ok: true, message: ACCOUNT_DELETION_RECEIVED_MESSAGE, immediate_actions_complete: immediateActionsComplete }, { status: immediateActionsComplete ? 200 : 202 });
}
