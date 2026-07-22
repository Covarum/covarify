import { NextResponse } from "next/server.js";
import type { PlaidAuthProvider } from "@/lib/plaid/production/auth";
import { supabasePlaidAuthProvider } from "@/lib/plaid/production/supabase-auth";
import { assertProductionConnectionAllowed, readProductionPlaidConfig, type ProductionPlaidConfig } from "@/lib/plaid/production/config";
import { productionPlaidError } from "@/lib/plaid/production/http";
import { consumeLinkAttempt, type LinkAttemptStore } from "@/lib/plaid/production/link-state";
import { createSupabaseLinkAttemptStore } from "@/lib/plaid/production/supabase-link-attempt-store";

export async function handleProductionOauthResume(request: Request, dependencies: { auth?: PlaidAuthProvider; store?: LinkAttemptStore; config?: ProductionPlaidConfig } = {}) {
  const profile = await (dependencies.auth ?? supabasePlaidAuthProvider).getAuthenticatedProfile(request);
  if (!profile) return NextResponse.json({ ok: false, error_code: "AUTHENTICATION_REQUIRED", message: "Sign in to resume a connection." }, { status: 401 });
  const body = await request.json().catch(() => null);
  const state = typeof body?.state === "string" ? body.state.trim() : "";
  if (!state) return NextResponse.json({ ok: false, error_code: "OAUTH_STATE_REQUIRED", message: "The connection attempt cannot be resumed." }, { status: 400 });
  try {
    const config = dependencies.config ?? readProductionPlaidConfig();
    assertProductionConnectionAllowed(config, profile.userId);
    await consumeLinkAttempt(dependencies.store ?? createSupabaseLinkAttemptStore(), profile.userId, state);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("invalid, expired, or already used")) {
      return NextResponse.json({ ok: false, error_code: "OAUTH_STATE_INVALID", message: "The connection attempt is invalid, expired, or already used." }, { status: 409 });
    }
    return productionPlaidError(error);
  }
}

export async function POST(request: Request) { return handleProductionOauthResume(request); }

