import "server-only";
import { Configuration, CountryCode, PlaidApi, PlaidEnvironments, Products } from "plaid";

type PlaidConfig = {
  client: PlaidApi;
  clientName: string;
  products: Products[];
  countryCodes: CountryCode[];
};

export function getPlaidConfig(): PlaidConfig {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const environment = process.env.PLAID_ENV || "sandbox";

  if (!clientId || !secret) throw new Error("Plaid is not configured. Set PLAID_CLIENT_ID and PLAID_SECRET.");
  if (environment !== "sandbox") throw new Error("This prototype only supports PLAID_ENV=sandbox.");

  const configuration = new Configuration({
    basePath: PlaidEnvironments.sandbox,
    baseOptions: { headers: { "PLAID-CLIENT-ID": clientId, "PLAID-SECRET": secret } },
  });

  return {
    client: new PlaidApi(configuration),
    clientName: process.env.PLAID_CLIENT_NAME || "Covarify",
    products: (process.env.PLAID_PRODUCTS || "transactions").split(",").map((value) => value.trim() as Products),
    countryCodes: (process.env.PLAID_COUNTRY_CODES || "US").split(",").map((value) => value.trim() as CountryCode),
  };
}

// TODO: Add encrypted token storage, user authentication, production Plaid environment
// support, a real user consent flow, and lifecycle-aware token management.
