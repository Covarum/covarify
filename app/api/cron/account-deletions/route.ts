import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendAccountDeletionEmail } from "@/lib/account-deletion/email";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request, secret: string) { const supplied = Buffer.from(request.headers.get("authorization") || ""); const expected = Buffer.from(`Bearer ${secret}`); return supplied.length === expected.length && timingSafeEqual(supplied, expected); }

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim() || "";
  if (!secret || !authorized(request, secret)) return NextResponse.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const db = createSupabaseAdminClient();
  const { data: due, error } = await db.from("account_deletion_requests").select("id,notification_email").eq("status", "scheduled").lte("deletion_due_at", new Date().toISOString()).limit(10);
  if (error) return NextResponse.json({ ok: false, outcome: "error" }, { status: 500 });
  let completed = 0;
  for (const row of due || []) {
    const { error: purgeError } = await db.rpc("complete_account_deletion", { request_id: row.id });
    if (purgeError) continue;
    try { await sendAccountDeletionEmail(row.notification_email, "completed"); await db.from("account_deletion_requests").update({ completed_email_sent_at: new Date().toISOString(), notification_email: null }).eq("id", row.id); } catch { /* Retain the address only until delivery can be retried. */ }
    completed += 1;
  }
  const { data: receivedPending } = await db.from("account_deletion_requests").select("id,notification_email").is("received_email_sent_at", null).not("notification_email", "is", null).limit(10);
  for (const row of receivedPending || []) try { await sendAccountDeletionEmail(row.notification_email, "received"); await db.from("account_deletion_requests").update({ received_email_sent_at: new Date().toISOString() }).eq("id", row.id); } catch { /* Retry on the next daily run. */ }
  const { data: completionPending } = await db.from("account_deletion_requests").select("id,notification_email").eq("status", "completed").is("completed_email_sent_at", null).not("notification_email", "is", null).limit(10);
  for (const row of completionPending || []) try { await sendAccountDeletionEmail(row.notification_email, "completed"); await db.from("account_deletion_requests").update({ completed_email_sent_at: new Date().toISOString(), notification_email: null }).eq("id", row.id); } catch { /* Retry on the next daily run. */ }
  await db.rpc("purge_expired_plaid_operational_records");
  return NextResponse.json({ ok: true, outcome: "complete", completed }, { headers: { "Cache-Control": "no-store" } });
}
