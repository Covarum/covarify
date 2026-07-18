import { NextResponse } from "next/server.js";
import { unconfiguredPlaidAuthProvider } from "@/lib/plaid/production/auth";
import { assertProductionConnectionAllowed, readProductionPlaidConfig } from "@/lib/plaid/production/config";
import { readTokenCipher } from "@/lib/plaid/production/encryption";
import { productionPlaidError } from "@/lib/plaid/production/http";
import { unavailablePlaidRepository } from "@/lib/plaid/production/repositories";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const profile = await unconfiguredPlaidAuthProvider.getAuthenticatedProfile(request);
  if (!profile) return NextResponse.json({ ok: false, error_code: "AUTHENTICATION_REQUIRED", message: "Sign in to repair an account connection." }, { status: 401 });
  try {
    const config = readProductionPlaidConfig();
    assertProductionConnectionAllowed(config, profile.userId);
    const { id } = await context.params;
    const item = await unavailablePlaidRepository.findOwnedItem(id, profile.userId);
    if (!item || item.status === "disconnected") return NextResponse.json({ ok: false, error_code: "ITEM_NOT_FOUND", message: "Connection not found." }, { status: 404 });
    const accessToken = readTokenCipher().decrypt({ ciphertext: item.encryptedAccessToken, keyVersion: item.tokenKeyVersion });
    const response = await config.client.linkTokenCreate({ client_name: config.clientName, language: "en", country_codes: config.countryCodes, webhook: config.webhookUrl, redirect_uri: config.redirectUri, user: { client_user_id: profile.userId }, access_token: accessToken });
    return NextResponse.json({ link_token: response.data.link_token, expiration: response.data.expiration });
  } catch (error) { return productionPlaidError(error); }
}
