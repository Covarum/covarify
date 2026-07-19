import { NextResponse } from "next/server.js";
import { supabasePlaidAuthProvider } from "@/lib/plaid/production/supabase-auth";
import { assertProductionConnectionAllowed, readProductionPlaidConfig } from "@/lib/plaid/production/config";
import { readTokenCipher } from "@/lib/plaid/production/encryption";
import { productionPlaidError } from "@/lib/plaid/production/http";
import { createSupabasePlaidRepository } from "@/lib/plaid/production/supabase-repository";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const profile = await supabasePlaidAuthProvider.getAuthenticatedProfile(request);
  if (!profile) return NextResponse.json({ ok: false, error_code: "AUTHENTICATION_REQUIRED", message: "Sign in to disconnect an account." }, { status: 401 });
  try {
    const config = readProductionPlaidConfig();
    assertProductionConnectionAllowed(config, profile.userId);
    const { id } = await context.params;
    const repository = createSupabasePlaidRepository();
    const item = await repository.findOwnedItem(id, profile.userId);
    if (!item) return NextResponse.json({ ok: false, error_code: "ITEM_NOT_FOUND", message: "Connection not found." }, { status: 404 });
    const accessToken = readTokenCipher().decrypt({ ciphertext: item.encryptedAccessToken, keyVersion: item.tokenKeyVersion });
    await config.client.itemRemove({ access_token: accessToken });
    await repository.markDisconnected(item.id, new Date().toISOString());
    await repository.clearEncryptedToken(item.id);
    return NextResponse.json({ disconnected: true, message: "The institution connection was removed. Local-history retention depends on the approved deletion policy." });
  } catch (error) { return productionPlaidError(error); }
}
