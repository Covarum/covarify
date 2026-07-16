import "server-only";
import { Configuration, CountryCode, PlaidApi, PlaidEnvironments, Products } from "plaid";

const REQUIRED_ENV_KEYS = ["PLAID_CLIENT_ID", "PLAID_SECRET", "PLAID_ENV", "PLAID_PRODUCTS", "PLAID_COUNTRY_CODES", "PLAID_CLIENT_NAME"] as const;

export type SafePlaidError = {
  error_type: string;
  error_code: string;
  error_message: string;
  display_message: string | null;
  request_id: string | null;
  status: number;
  missing_env_keys?: string[];
};

type PlaidConfig = { client: PlaidApi; clientName: string; products: Products[]; countryCodes: CountryCode[] };
type PlaidLikeError = { response?: { status?: unknown; data?: unknown }; status?: unknown; message?: unknown };
type PlaidErrorData = { error_type?: unknown; error_code?: unknown; error_message?: unknown; display_message?: unknown; request_id?: unknown };

export class PlaidConfigurationError extends Error {
  constructor(public readonly diagnostic: SafePlaidError) { super(diagnostic.error_message); }
}

const stringOr = (value: unknown, fallback: string) => typeof value === "string" && value.length > 0 ? value : fallback;
const nullableString = (value: unknown) => typeof value === "string" && value.length > 0 ? value : null;
const httpStatus = (value: unknown, fallback = 502) => typeof value === "number" && value >= 400 && value <= 599 ? value : fallback;

export function getPlaidConfig(): PlaidConfig {
  const missing = REQUIRED_ENV_KEYS.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) throw new PlaidConfigurationError({ error_type: "CONFIGURATION_ERROR", error_code: "MISSING_ENV_VARS", error_message: "Plaid sandbox configuration is incomplete.", display_message: "Plaid sandbox is not configured for this deployment.", request_id: null, status: 503, missing_env_keys: [...missing] });

  const environment = process.env.PLAID_ENV!;
  if (environment !== "sandbox") throw new PlaidConfigurationError({ error_type: "CONFIGURATION_ERROR", error_code: "INVALID_PLAID_ENV", error_message: "This integration requires PLAID_ENV=sandbox.", display_message: "Plaid sandbox mode is not enabled for this deployment.", request_id: null, status: 503 });

  const configuration = new Configuration({ basePath: PlaidEnvironments.sandbox, baseOptions: { headers: { "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!, "PLAID-SECRET": process.env.PLAID_SECRET! } } });
  return { client: new PlaidApi(configuration), clientName: process.env.PLAID_CLIENT_NAME!, products: process.env.PLAID_PRODUCTS!.split(",").map((value) => value.trim() as Products), countryCodes: process.env.PLAID_COUNTRY_CODES!.split(",").map((value) => value.trim() as CountryCode) };
}

export function normalizePlaidError(error: unknown, fallbackMessage: string): SafePlaidError {
  if (error instanceof PlaidConfigurationError) return error.diagnostic;
  const candidate = error && typeof error === "object" ? error as PlaidLikeError : {};
  const data = candidate.response?.data && typeof candidate.response.data === "object" ? candidate.response.data as PlaidErrorData : {};
  return {
    error_type: stringOr(data.error_type, "API_ERROR"),
    error_code: stringOr(data.error_code, "PLAID_REQUEST_FAILED"),
    error_message: stringOr(data.error_message, fallbackMessage),
    display_message: nullableString(data.display_message),
    request_id: nullableString(data.request_id),
    status: httpStatus(candidate.response?.status ?? candidate.status),
  };
}

export function logSafePlaidError(diagnostic: SafePlaidError) {
  console.error("Plaid API error", { error_type: diagnostic.error_type, error_code: diagnostic.error_code, error_message: diagnostic.error_message, request_id: diagnostic.request_id, status: diagnostic.status });
}

// TODO: Add encrypted token storage, user authentication, production Plaid environment
// support, a real user consent flow, and lifecycle-aware token management.
