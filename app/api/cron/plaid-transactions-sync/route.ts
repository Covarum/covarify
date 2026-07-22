import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server.js";
import { readProductionPlaidConfig, type ProductionPlaidConfig } from "@/lib/plaid/production/config";
import { readTokenCipher, type PlaidTokenCipher } from "@/lib/plaid/production/encryption";
import type { PlaidSyncWorkerRepository } from "@/lib/plaid/production/repositories";
import { createSupabasePlaidRepository } from "@/lib/plaid/production/supabase-repository";
import { runTransactionsSyncWorker } from "@/lib/plaid/production/sync-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request, secret: string) {
  const supplied = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function handlePlaidTransactionsCron(request: Request, dependencies: {
  environment?: NodeJS.ProcessEnv; config?: ProductionPlaidConfig; cipher?: PlaidTokenCipher; repository?: PlaidSyncWorkerRepository;
} = {}) {
  const environment = dependencies.environment ?? process.env;
  const secret = (environment.CRON_SECRET || "").trim();
  if (!secret || !authorized(request, secret)) return NextResponse.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (environment.PLAID_SYNC_WORKER_ENABLED !== "true") return NextResponse.json({ ok: false, outcome: "disabled" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try {
    const config = dependencies.config ?? readProductionPlaidConfig(environment);
    if (config.environment !== "production") throw new Error("Transactions sync worker requires PLAID_ENV=production.");
    const result = await runTransactionsSyncWorker({ config, cipher: dependencies.cipher ?? readTokenCipher(), repository: dependencies.repository ?? createSupabasePlaidRepository() });
    return NextResponse.json({ ok: true, outcome: result.outcome }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, outcome: "error" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET(request: Request) { return handlePlaidTransactionsCron(request); }
