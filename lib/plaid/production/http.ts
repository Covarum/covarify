import { NextResponse } from "next/server.js";
import { PlaidPersistenceUnavailableError } from "./repositories";
import { ProductionPlaidConfigurationError } from "./config";

export function productionPlaidError(error: unknown) {
  if (error instanceof ProductionPlaidConfigurationError) {
    const status = error.code === "USER_NOT_ALLOWLISTED" ? 403 : error.code === "PRODUCTION_ITEM_LIMIT_REACHED" ? 409 : 503;
    return NextResponse.json({ ok: false, error_code: error.code, message: error.message, missing_keys: error.missingKeys }, { status });
  }
  if (error instanceof PlaidPersistenceUnavailableError) {
    return NextResponse.json({ ok: false, error_code: "PERSISTENCE_NOT_CONFIGURED", message: error.message }, { status: 503 });
  }
  console.error("Production Plaid request failed", { error_code: "PLAID_PRODUCTION_REQUEST_FAILED" });
  return NextResponse.json({ ok: false, error_code: "PLAID_PRODUCTION_REQUEST_FAILED", message: "The connection request could not be completed." }, { status: 502 });
}
