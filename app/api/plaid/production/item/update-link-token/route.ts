import { NextResponse } from "next/server";
import { supabasePlaidAuthProvider } from "@/lib/plaid/production/supabase-auth";
import { assertProductionConnectionAllowed, readProductionPlaidConfig } from "@/lib/plaid/production/config";
import { readTokenCipher } from "@/lib/plaid/production/encryption";
import { productionPlaidError } from "@/lib/plaid/production/http";
import { findRecoverableOwnedItem } from "@/lib/plaid/production/supabase-repository";

export async function POST(request: Request) {
  const profile = await supabasePlaidAuthProvider.getAuthenticatedProfile(request);
  if (!profile) return NextResponse.json({ ok: false, error_code: "AUTHENTICATION_REQUIRED", message: "Sign in to refresh this connection." }, { status: 401 });
  try {
    const config = readProductionPlaidConfig();
    assertProductionConnectionAllowed(config, profile.userId);
    const item = await findRecoverableOwnedItem(profile.userId);
    if (!item) return NextResponse.json({ ok: false, error_code: "ITEM_NOT_FOUND", message: "The existing connection is not available for refresh." }, { status: 404 });
    const accessToken = await readTokenCipher().decrypt({ ciphertext: item.encryptedAccessToken, keyVersion: item.tokenKeyVersion });
    const response = await config.client.linkTokenCreate({
      client_name: config.clientName,
      language: "en",
      country_codes: config.countryCodes,
      webhook: config.webhookUrl,
      redirect_uri: config.redirectUri,
      user: { client_user_id: profile.userId },
      access_token: accessToken,
    });
    return NextResponse.json({ link_token: response.data.link_token, expiration: response.data.expiration });
  } catch (error) {
    return productionPlaidError(error);
  }
}
