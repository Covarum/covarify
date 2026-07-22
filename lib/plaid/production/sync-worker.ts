if (typeof window !== "undefined") throw new Error("Plaid production modules are server-only.");
import type { PlaidTokenCipher } from "./encryption.ts";
import type { ProductionPlaidConfig } from "./config.ts";
import type { PlaidSyncWorkerRepository } from "./repositories.ts";
import { syncTransactions } from "./services.ts";

const MAX_ATTEMPTS = 5;
const RETRYABLE_TYPES = new Set(["API_ERROR", "INSTITUTION_ERROR", "RATE_LIMIT_EXCEEDED"]);
const RETRYABLE_CODES = new Set(["PRODUCT_NOT_READY", "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION"]);

function safePlaidError(error: unknown) {
  if (!error || typeof error !== "object") return { code: "WORKER_ERROR", retryable: true };
  const response = "response" in error && error.response && typeof error.response === "object" ? error.response : null;
  const data = response && "data" in response && response.data && typeof response.data === "object" ? response.data : null;
  const code = data && "error_code" in data && typeof data.error_code === "string" ? data.error_code : "WORKER_ERROR";
  const type = data && "error_type" in data && typeof data.error_type === "string" ? data.error_type : null;
  const hasResponse = Boolean(response);
  return { code: code.replace(/[^A-Z0-9_]/g, "_").slice(0, 80) || "WORKER_ERROR", retryable: !hasResponse || Boolean(type && RETRYABLE_TYPES.has(type)) || RETRYABLE_CODES.has(code) };
}

export function retryDelaySeconds(attemptCount: number, random = Math.random) {
  const base = Math.min(3600, 60 * 2 ** Math.max(0, attemptCount - 1));
  return Math.max(30, Math.round(base * (0.5 + random())));
}

export async function runTransactionsSyncWorker(input: {
  config: ProductionPlaidConfig; cipher: PlaidTokenCipher; repository: PlaidSyncWorkerRepository;
  now?: () => Date; random?: () => number;
}) {
  const job = await input.repository.claimSyncJob();
  if (!job) return { outcome: "idle" as const };
  const clock = input.now ?? (() => new Date());
  try {
    const item = await input.repository.findItemById(job.plaidItemId);
    const state = await input.repository.getSyncState(job.plaidItemId);
    if (!item || !state || item.status === "disconnected" || item.environment !== input.config.environment) {
      await input.repository.failSyncJob(job, "ITEM_UNAVAILABLE");
      return { outcome: "failed" as const };
    }
    const accessToken = await input.cipher.decrypt({ ciphertext: item.encryptedAccessToken, keyVersion: item.tokenKeyVersion });
    const runningState = { ...state, status: "running" as const, retryCount: job.attemptCount, lastSyncStartedAt: clock().toISOString(), lastErrorCode: null, triggeringWebhookCode: job.webhookCode };
    await input.repository.updateSyncState(runningState);
    await syncTransactions({ config: input.config, item, accessToken, state: runningState, repository: input.repository });
    await input.repository.completeSyncJob(job);
    return { outcome: "complete" as const };
  } catch (error) {
    const classified = safePlaidError(error);
    const state = await input.repository.getSyncState(job.plaidItemId).catch(() => null);
    const exhausted = !classified.retryable || job.attemptCount >= MAX_ATTEMPTS;
    if (state) await input.repository.updateSyncState({ ...state, status: exhausted ? "failed" : "retry", retryCount: job.attemptCount, lastErrorCode: classified.code }).catch(() => undefined);
    if (exhausted) {
      await input.repository.failSyncJob(job, classified.code);
      return { outcome: "failed" as const };
    }
    const availableAt = new Date(clock().getTime() + retryDelaySeconds(job.attemptCount, input.random) * 1000).toISOString();
    await input.repository.retrySyncJob(job, { availableAt, safeErrorCode: classified.code });
    return { outcome: "retry" as const };
  }
}
