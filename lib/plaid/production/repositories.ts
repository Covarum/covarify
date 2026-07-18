if (typeof window !== "undefined") throw new Error("Plaid production modules are server-only.");
import type { ConsentRecord, PlaidAccountRecord, PlaidItemRecord, PlaidTransactionRecord, TransactionSyncStateRecord, WebhookEventRecord } from "./domain.ts";

export interface PlaidProductionRepository {
  findItemByPlaidId(plaidItemId: string): Promise<PlaidItemRecord | null>;
  findOwnedItem(id: string, userId: string): Promise<PlaidItemRecord | null>;
  createConnection(input: { item: PlaidItemRecord; accounts: PlaidAccountRecord[]; syncState: TransactionSyncStateRecord; consent: ConsentRecord }): Promise<void>;
  upsertAccounts(accounts: PlaidAccountRecord[]): Promise<void>;
  updateSyncState(state: TransactionSyncStateRecord): Promise<void>;
  applyTransactionDelta(input: { added: PlaidTransactionRecord[]; modified: PlaidTransactionRecord[]; removedIds: string[]; removedAt: string }): Promise<void>;
  markDisconnected(id: string, disconnectedAt: string): Promise<void>;
  clearEncryptedToken(id: string): Promise<void>;
  recordWebhook(event: WebhookEventRecord): Promise<"created" | "duplicate">;
}

export interface PlaidSyncQueue {
  enqueue(input: { plaidItemId: string; webhookCode: string; deduplicationKey: string }): Promise<void>;
}

export class PlaidPersistenceUnavailableError extends Error {
  constructor() { super("An approved Plaid persistence adapter is not configured."); }
}

export const unavailablePlaidRepository: PlaidProductionRepository = new Proxy({} as PlaidProductionRepository, {
  get() { return async () => { throw new PlaidPersistenceUnavailableError(); }; },
});
