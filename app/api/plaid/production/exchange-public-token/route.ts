import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server.js";
import { unconfiguredPlaidAuthProvider, type PlaidAuthProvider } from "@/lib/plaid/production/auth";
import { assertProductionConnectionAllowed, readProductionPlaidConfig } from "@/lib/plaid/production/config";
import { readTokenCipher, type PlaidTokenCipher } from "@/lib/plaid/production/encryption";
import { productionPlaidError } from "@/lib/plaid/production/http";
import { unavailablePlaidRepository, type PlaidProductionRepository } from "@/lib/plaid/production/repositories";
import { exchangeAndPersistProductionItem } from "@/lib/plaid/production/services";

export type ExchangeDependencies = { auth: PlaidAuthProvider; repository: PlaidProductionRepository; cipher: PlaidTokenCipher };

export async function handleProductionExchange(request: Request, dependencies?: Partial<ExchangeDependencies>) {
  const auth = dependencies?.auth || unconfiguredPlaidAuthProvider;
  const profile = await auth.getAuthenticatedProfile(request);
  if (!profile) return NextResponse.json({ ok: false, error_code: "AUTHENTICATION_REQUIRED", message: "Sign in to connect an account." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const publicToken = typeof body?.public_token === "string" ? body.public_token.trim() : "";
  const consentVersion = typeof body?.consent_version === "string" ? body.consent_version.trim() : "";
  if (!publicToken || !consentVersion) return NextResponse.json({ ok: false, error_code: "INVALID_REQUEST", message: "A public token and consent version are required." }, { status: 400 });

  try {
    const config = readProductionPlaidConfig();
    assertProductionConnectionAllowed(config, profile.userId);
    const consent = {
      id: randomUUID(), userId: profile.userId, profileId: profile.profileId, consentVersion,
      productsRequested: config.products.map(String), dataPurposes: ["Build the Money Picture", "Support explainable financial decisions"],
      acceptedAt: new Date().toISOString(), revokedAt: null, source: "connect" as const, ipHash: null,
    };
    const result = await exchangeAndPersistProductionItem({ config, profile, publicToken, consent, repository: dependencies?.repository || unavailablePlaidRepository, cipher: dependencies?.cipher || readTokenCipher() });
    return NextResponse.json(result, { status: result.idempotent ? 200 : 201 });
  } catch (error) { return productionPlaidError(error); }
}

export async function POST(request: Request) { return handleProductionExchange(request); }
