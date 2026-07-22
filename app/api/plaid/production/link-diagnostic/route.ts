import { createHash } from "node:crypto";
import { NextResponse } from "next/server.js";
import { supabasePlaidAuthProvider } from "@/lib/plaid/production/supabase-auth";
import { assertProductionConnectionAllowed, readProductionPlaidConfig } from "@/lib/plaid/production/config";
import { sanitizeLinkDiagnostic } from "@/lib/plaid/production/link-diagnostics";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const profile = await supabasePlaidAuthProvider.getAuthenticatedProfile(request);
  if (!profile) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json().catch(() => null);
  const state = typeof body?.state === "string" && body.state.length <= 128 ? body.state : "";
  const diagnostic = sanitizeLinkDiagnostic(body);
  if (!state || !diagnostic) return NextResponse.json({ ok: false }, { status: 400 });
  try {
    assertProductionConnectionAllowed(readProductionPlaidConfig(), profile.userId);
    if (diagnostic.eventName === "EXIT" || diagnostic.eventName === "CLIENT_TIMEOUT") {
      const status = diagnostic.eventName === "CLIENT_TIMEOUT" ? "expired" : "failed";
      const { error } = await createSupabaseAdminClient().from("plaid_link_attempts").update({ status })
        .eq("user_id", profile.userId)
        .eq("state_hash", createHash("sha256").update(state).digest("hex"))
        .eq("status", "created");
      if (error) throw new Error("Link attempt status could not be recorded.");
    }
    console.info("Plaid Link lifecycle", { operation: "production_link", ...diagnostic });
    return NextResponse.json({ ok: true });
  } catch {
    console.error("Plaid Link diagnostic failed", { operation: "production_link_diagnostic", error_code: "DIAGNOSTIC_WRITE_FAILED" });
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
