import { NextResponse } from "next/server.js";
import { unconfiguredPlaidAuthProvider, type PlaidAuthProvider } from "@/lib/plaid/production/auth";
import { assertProductionConnectionAllowed, readProductionPlaidConfig } from "@/lib/plaid/production/config";
import { productionPlaidError } from "@/lib/plaid/production/http";
import { createProductionLinkToken } from "@/lib/plaid/production/services";

export async function handleProductionCreateLinkToken(request: Request, auth: PlaidAuthProvider = unconfiguredPlaidAuthProvider) {
  const profile = await auth.getAuthenticatedProfile(request);
  if (!profile) return NextResponse.json({ ok: false, error_code: "AUTHENTICATION_REQUIRED", message: "Sign in to connect an account." }, { status: 401 });
  try {
    const config = readProductionPlaidConfig();
    assertProductionConnectionAllowed(config, profile.userId);
    return NextResponse.json(await createProductionLinkToken(config, profile));
  } catch (error) { return productionPlaidError(error); }
}

export async function POST(request: Request) { return handleProductionCreateLinkToken(request); }
