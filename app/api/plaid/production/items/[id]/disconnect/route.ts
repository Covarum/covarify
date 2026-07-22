import { NextResponse } from "next/server.js";
import { supabasePlaidAuthProvider } from "@/lib/plaid/production/supabase-auth";
import { readProductionPlaidConfig } from "@/lib/plaid/production/config";
import { readTokenCipher } from "@/lib/plaid/production/encryption";
import { productionPlaidError } from "@/lib/plaid/production/http";
import { createSupabasePlaidRepository } from "@/lib/plaid/production/supabase-repository";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const profile = await supabasePlaidAuthProvider.getAuthenticatedProfile(request);
  if (!profile) return NextResponse.json({ ok: false, error_code: "AUTHENTICATION_REQUIRED", message: "Sign in to disconnect an account." }, { status: 401 });
  try {
    const config = readProductionPlaidConfig();
    const { id } = await context.params;
    const repository = createSupabasePlaidRepository();
    const item = await repository.findOwnedItem(id, profile.userId);
    if (!item) return NextResponse.json({ ok: false, error_code: "ITEM_NOT_FOUND", message: "Connection not found." }, { status: 404 });
    const accessToken = await readTokenCipher().decrypt({ ciphertext: item.encryptedAccessToken, keyVersion: item.tokenKeyVersion });
    await config.client.itemRemove({ access_token: accessToken });
    const disconnectedAt = new Date().toISOString();
    const { error } = await (await import("@/lib/supabase/admin")).createSupabaseAdminClient().rpc("disconnect_plaid_item_for_deletion", { target_item_id: item.id, disconnected_time: disconnectedAt });
    if (error) throw new Error("Plaid disconnect persistence failed.");
    return NextResponse.json({ disconnected: true, message: "The institution was disconnected, its access token was destroyed, and future synchronization stopped. Historical financial data remains until full account deletion." });
  } catch (error) { return productionPlaidError(error); }
}
