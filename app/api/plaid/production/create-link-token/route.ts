import { NextResponse } from "next/server.js";
import type { PlaidAuthProvider } from "@/lib/plaid/production/auth";
import { supabasePlaidAuthProvider } from "@/lib/plaid/production/supabase-auth";
import { assertProductionConnectionAllowed, readProductionPlaidConfig } from "@/lib/plaid/production/config";
import { productionPlaidError } from "@/lib/plaid/production/http";
import { createProductionLinkToken } from "@/lib/plaid/production/services";
import { isCurrentPlaidConsentVersion, PLAID_CONSENT_VERSION } from "@/lib/plaid/production/consent";
import { createLinkAttempt, type LinkAttemptStore } from "@/lib/plaid/production/link-state";
import { createSupabaseLinkAttemptStore } from "@/lib/plaid/production/supabase-link-attempt-store";
import type { ProductionPlaidConfig } from "@/lib/plaid/production/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertFounderPilotItemLimit } from "@/lib/plaid/production/item-limit";

async function hasProductionPlaidItem(userId: string) {
  const { count, error } = await createSupabaseAdminClient()
    .from("plaid_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("environment", "production");
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function handleProductionCreateLinkToken(request: Request, dependencies: { auth?: PlaidAuthProvider; store?: LinkAttemptStore; config?: ProductionPlaidConfig; hasExistingConnection?: (userId: string) => Promise<boolean> } = {}) {
  const auth = dependencies.auth ?? supabasePlaidAuthProvider;
  const profile = await auth.getAuthenticatedProfile(request);
  if (!profile) return NextResponse.json({ ok: false, error_code: "AUTHENTICATION_REQUIRED", message: "Sign in to connect an account." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!isCurrentPlaidConsentVersion(body?.consent_version)) return NextResponse.json({ ok: false, error_code: "CONSENT_REQUIRED", message: "Accept the current connection consent before continuing." }, { status: 400 });
  try {
    const config = dependencies.config ?? readProductionPlaidConfig();
    assertProductionConnectionAllowed(config, profile.userId);
    assertFounderPilotItemLimit(await (dependencies.hasExistingConnection ?? hasProductionPlaidItem)(profile.userId));
    const token = await createProductionLinkToken(config, profile);
    const attempt = await createLinkAttempt(dependencies.store ?? createSupabaseLinkAttemptStore(), profile.userId, PLAID_CONSENT_VERSION);
    return NextResponse.json({ ...token, oauth_state: attempt.state, oauth_state_expires_at: attempt.expiresAt });
  } catch (error) { return productionPlaidError(error); }
}

export async function POST(request: Request) { return handleProductionCreateLinkToken(request); }
