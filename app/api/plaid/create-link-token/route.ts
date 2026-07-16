import { NextResponse } from "next/server";
import { getPlaidConfig } from "@/lib/plaid/server";

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
    const message = error instanceof Error && error.message.startsWith("Plaid is not configured") ? error.message : "Unable to create a Plaid sandbox link token.";
    return NextResponse.json({ message }, { status: message.startsWith("Plaid is not configured") ? 503 : 502 });
  }
}
