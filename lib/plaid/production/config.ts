if (typeof window !== "undefined") throw new Error("Plaid production modules are server-only.");

import { Configuration, CountryCode, PlaidApi, PlaidEnvironments, Products } from "plaid";

export type PlaidEnvironment = "sandbox" | "production";

export type ProductionPlaidConfig = {
  environment: PlaidEnvironment;
  clientId: string;
  clientName: string;
  products: Products[];
  countryCodes: CountryCode[];
  webhookUrl: string;
  redirectUri: string;
  connectionsEnabled: boolean;
  allowedUserIds: ReadonlySet<string>;
  client: PlaidApi;
};

export class ProductionPlaidConfigurationError extends Error {
  readonly code: string;
  readonly missingKeys: string[];
  constructor(code: string, message: string, missingKeys: string[] = []) {
    super(message);
    this.code = code;
    this.missingKeys = missingKeys;
  }
}

const required = ["PLAID_CLIENT_ID", "PLAID_ENV", "PLAID_PRODUCTS", "PLAID_COUNTRY_CODES", "PLAID_CLIENT_NAME", "PLAID_WEBHOOK_URL", "PLAID_REDIRECT_URI"] as const;
const read = (environment: NodeJS.ProcessEnv, key: string) => (environment[key] || "").trim();

export function readProductionPlaidConfig(environment: NodeJS.ProcessEnv = process.env): ProductionPlaidConfig {
  const missing = required.filter((key) => !read(environment, key));
  if (missing.length) throw new ProductionPlaidConfigurationError("MISSING_ENV_VARS", "Plaid configuration is incomplete.", [...missing]);

  const plaidEnvironment = read(environment, "PLAID_ENV");
  if (plaidEnvironment !== "sandbox" && plaidEnvironment !== "production") {
    throw new ProductionPlaidConfigurationError("INVALID_PLAID_ENV", "PLAID_ENV must be sandbox or production.");
  }

  const secretKey = plaidEnvironment === "production" ? "PLAID_PRODUCTION_SECRET" : "PLAID_SANDBOX_SECRET";
  const oppositeKey = plaidEnvironment === "production" ? "PLAID_SANDBOX_SECRET" : "PLAID_PRODUCTION_SECRET";
  const secret = read(environment, secretKey);
  if (!secret) throw new ProductionPlaidConfigurationError("MISSING_ENV_SECRET", `${secretKey} is required for ${plaidEnvironment}.`, [secretKey]);
  if (secret === read(environment, oppositeKey) && read(environment, oppositeKey)) {
    throw new ProductionPlaidConfigurationError("SHARED_ENV_SECRET", "Sandbox and Production secrets must be distinct.");
  }

  const redirectUri = read(environment, "PLAID_REDIRECT_URI");
  const webhookUrl = read(environment, "PLAID_WEBHOOK_URL");
  if (plaidEnvironment === "production" && (!redirectUri.startsWith("https://") || !webhookUrl.startsWith("https://"))) {
    throw new ProductionPlaidConfigurationError("PRODUCTION_HTTPS_REQUIRED", "Production redirect and webhook URLs must use HTTPS.");
  }

  const basePath = plaidEnvironment === "production" ? PlaidEnvironments.production : PlaidEnvironments.sandbox;
  const clientId = read(environment, "PLAID_CLIENT_ID");
  const configuration = new Configuration({ basePath, baseOptions: { headers: { "PLAID-CLIENT-ID": clientId, "PLAID-SECRET": secret } } });

  return {
    environment: plaidEnvironment,
    clientId,
    clientName: read(environment, "PLAID_CLIENT_NAME"),
    products: read(environment, "PLAID_PRODUCTS").split(",").map((value) => value.trim()).filter(Boolean) as Products[],
    countryCodes: read(environment, "PLAID_COUNTRY_CODES").split(",").map((value) => value.trim().toUpperCase()).filter(Boolean) as CountryCode[],
    webhookUrl,
    redirectUri,
    connectionsEnabled: read(environment, "PLAID_PRODUCTION_CONNECTIONS_ENABLED").toLowerCase() === "true",
    allowedUserIds: new Set(read(environment, "PLAID_PRODUCTION_ALLOWED_USER_IDS").split(",").map((value) => value.trim()).filter(Boolean)),
    client: new PlaidApi(configuration),
  };
}

export function assertProductionConnectionAllowed(config: ProductionPlaidConfig, userId: string) {
  if (config.environment !== "production") throw new ProductionPlaidConfigurationError("PRODUCTION_ENV_REQUIRED", "Production Plaid routes require PLAID_ENV=production.");
  if (!config.connectionsEnabled) throw new ProductionPlaidConfigurationError("PRODUCTION_CONNECTIONS_DISABLED", "Production bank connections are not enabled.");
  if (!config.allowedUserIds.has(userId)) throw new ProductionPlaidConfigurationError("USER_NOT_ALLOWLISTED", "This account is not enabled for the controlled Plaid rollout.");
}
