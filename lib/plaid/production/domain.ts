export type PlaidItemStatus = "pending" | "active" | "error" | "needs_update" | "disconnected";
export type SyncStatus = "idle" | "queued" | "running" | "retry" | "failed" | "complete";

export type PlaidItemRecord = {
  id: string; userId: string; profileId: string; plaidItemId: string; institutionId: string | null; institutionName: string | null;
  environment: "sandbox" | "production"; encryptedAccessToken: string; tokenKeyVersion: string; status: PlaidItemStatus; consentId: string;
  createdAt: string; updatedAt: string; lastSuccessfulSyncAt: string | null; lastWebhookAt: string | null; errorCode: string | null;
  needsUpdateMode: boolean; disconnectedAt: string | null;
};

export type PlaidAccountRecord = {
  id: string; userId: string; plaidItemId: string; plaidAccountId: string; persistentAccountId: string | null; name: string;
  officialName: string | null; type: string; subtype: string | null; mask: string | null; currency: string; currentBalance: number | null;
  availableBalance: number | null; institutionId: string | null; institutionName: string | null; status: "active" | "closed";
  sourceCreatedAt: string | null; sourceUpdatedAt: string | null; observedAt: string;
};

export type TransactionSyncStateRecord = {
  plaidItemId: string; cursor: string | null; lastSyncStartedAt: string | null; lastSyncCompletedAt: string | null; status: SyncStatus;
  retryCount: number; lastErrorCode: string | null; triggeringWebhookCode: string | null;
};

export type ConsentRecord = {
  id: string; userId: string; profileId: string; consentVersion: string; productsRequested: readonly string[]; dataPurposes: readonly string[];
  acceptedAt: string; revokedAt: string | null; source: "connect" | "update"; ipHash: string | null;
};

export type WebhookEventRecord = {
  id: string; bodyHash: string; plaidItemId: string | null; webhookType: string; webhookCode: string; receivedAt: string; processedAt: string | null;
};

export type PlaidTransactionRecord = {
  id: string; userId: string; plaidItemId: string; plaidAccountId: string; plaidTransactionId: string; pendingTransactionId: string | null;
  merchantName: string | null; name: string; amount: number; currency: string | null; date: string; authorizedDate: string | null;
  pending: boolean; removedAt: string | null; sourceUpdatedAt: string; rawCategory: string | null;
};

export type PlaidSyncJobRecord = {
  id: string; plaidItemId: string; webhookCode: string; attemptCount: number; leaseToken: string;
};
