import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server.js";
import { readProductionPlaidConfig } from "@/lib/plaid/production/config";
import { productionPlaidError } from "@/lib/plaid/production/http";
import type { PlaidProductionRepository, PlaidSyncQueue } from "@/lib/plaid/production/repositories";
import { createSupabasePlaidRepository } from "@/lib/plaid/production/supabase-repository";
import { verifyPlaidWebhook } from "@/lib/plaid/production/webhook-verification";

const unavailableQueue: PlaidSyncQueue = { async enqueue() { throw new Error("Plaid sync queue is not configured."); } };

export async function handleProductionWebhook(request: Request, dependencies: { repository?: PlaidProductionRepository; queue?: PlaidSyncQueue } = {}) {
  const rawBody = await request.text();
  try {
    const config = readProductionPlaidConfig();
    const valid = await verifyPlaidWebhook({ verificationHeader: request.headers.get("Plaid-Verification"), rawBody, client: config.client });
    if (!valid) return NextResponse.json({ received: false }, { status: 401 });
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const webhookType = typeof body.webhook_type === "string" ? body.webhook_type : "UNKNOWN";
    const webhookCode = typeof body.webhook_code === "string" ? body.webhook_code : "UNKNOWN";
    const plaidItemId = typeof body.item_id === "string" ? body.item_id : null;
    const bodyHash = createHash("sha256").update(rawBody).digest("hex");
    const repository = dependencies.repository || createSupabasePlaidRepository();
    const result = await repository.recordWebhook({ id: randomUUID(), bodyHash, plaidItemId, webhookType, webhookCode, receivedAt: new Date().toISOString(), processedAt: null });
    if (result === "duplicate") return NextResponse.json({ received: true, duplicate: true });
    if (plaidItemId && webhookType === "TRANSACTIONS" && ["SYNC_UPDATES_AVAILABLE", "INITIAL_UPDATE", "HISTORICAL_UPDATE"].includes(webhookCode)) {
      await (dependencies.queue || unavailableQueue).enqueue({ plaidItemId, webhookCode, deduplicationKey: bodyHash });
    }
    return NextResponse.json({ received: true }, { status: 202 });
  } catch (error) { return productionPlaidError(error); }
}

export async function POST(request: Request) { return handleProductionWebhook(request); }
