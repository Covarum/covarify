import { NextResponse } from "next/server";
import { getPlaidConfig, getPlaidRuntimeDiagnostics, logSafePlaidError, normalizePlaidError } from "@/lib/plaid/server";

export async function POST() {
  try {
    const { client, clientName, products, countryCodes } = getPlaidConfig();
    const response = await client.linkTokenCreate({
      client_name: clientName,
      products,
      country_codes: countryCodes,
      language: "en",
      user: { client_user_id: "covarify-sandbox-user" },
    });
    return NextResponse.json({ link_token: response.data.link_token, expiration: response.data.expiration });
  } catch (error) {
    const diagnostic = { ...normalizePlaidError(error, "Unable to create a Plaid sandbox link token."), ...getPlaidRuntimeDiagnostics() };
    logSafePlaidError(diagnostic);
    return NextResponse.json(diagnostic, { status: diagnostic.status });
  }
}
