if (typeof window !== "undefined") throw new Error("Plaid production modules are server-only.");
import { randomUUID } from "node:crypto";
import type { AccountBase, RemovedTransaction, Transaction } from "plaid";
import type { AuthenticatedProfile } from "./auth.ts";
import type { ConsentRecord, PlaidAccountRecord, PlaidItemRecord, PlaidTransactionRecord, TransactionSyncStateRecord } from "./domain.ts";
import type { PlaidTokenCipher } from "./encryption.ts";
import type { ProductionPlaidConfig } from "./config.ts";
import type { PlaidProductionRepository } from "./repositories.ts";
import { categoryFromPlaidTransaction } from "../category-normalization.ts";

const now = () => new Date().toISOString();

function accountRecord(account: AccountBase, profile: AuthenticatedProfile, internalItemId: string, institution: { id: string | null; name: string | null }): PlaidAccountRecord {
  return {
    id: randomUUID(), userId: profile.userId, plaidItemId: internalItemId, plaidAccountId: account.account_id,
    persistentAccountId: account.persistent_account_id || null, name: account.name, officialName: account.official_name || null,
    type: String(account.type), subtype: account.subtype ? String(account.subtype) : null, mask: account.mask || null,
    currency: account.balances.iso_currency_code || account.balances.unofficial_currency_code || "USD",
    currentBalance: account.balances.current, availableBalance: account.balances.available, institutionId: institution.id,
    institutionName: institution.name, status: "active", sourceCreatedAt: null, sourceUpdatedAt: null, observedAt: now(),
  };
}

function transactionRecord(transaction: Transaction, item: PlaidItemRecord): PlaidTransactionRecord {
  return {
    id: randomUUID(), userId: item.userId, plaidItemId: item.id, plaidAccountId: transaction.account_id,
    plaidTransactionId: transaction.transaction_id, pendingTransactionId: transaction.pending_transaction_id || null,
    merchantName: transaction.merchant_name || null, name: transaction.name, amount: transaction.amount,
    currency: transaction.iso_currency_code || transaction.unofficial_currency_code || null, date: transaction.date,
    authorizedDate: transaction.authorized_date || null, pending: transaction.pending, removedAt: null, sourceUpdatedAt: now(),
    rawCategory: categoryFromPlaidTransaction(transaction),
  };
}

export async function createProductionLinkToken(config: ProductionPlaidConfig, profile: AuthenticatedProfile) {
  const response = await config.client.linkTokenCreate({
    client_name: config.clientName, language: "en", products: config.products, country_codes: config.countryCodes,
    webhook: config.webhookUrl, redirect_uri: config.redirectUri, user: { client_user_id: profile.userId },
  });
  return { link_token: response.data.link_token, expiration: response.data.expiration, request_id: response.data.request_id };
}

export async function exchangeAndPersistProductionItem(input: {
  config: ProductionPlaidConfig; profile: AuthenticatedProfile; publicToken: string; consent: ConsentRecord;
  repository: PlaidProductionRepository; cipher: PlaidTokenCipher;
}) {
  const exchange = await input.config.client.itemPublicTokenExchange({ public_token: input.publicToken });
  const plaidItemId = exchange.data.item_id;
  const existing = await input.repository.findItemByPlaidId(plaidItemId);
  if (existing && existing.userId !== input.profile.userId) throw new Error("Plaid Item ownership conflict.");
  if (existing) return { connected: true, itemId: existing.id, status: existing.status, idempotent: true };

  const encrypted = await input.cipher.encrypt(exchange.data.access_token);
  const itemResponse = await input.config.client.itemGet({ access_token: exchange.data.access_token });
  const institutionId = itemResponse.data.item.institution_id || null;
  let institutionName: string | null = null;
  if (institutionId) {
    const institution = await input.config.client.institutionsGetById({ institution_id: institutionId, country_codes: input.config.countryCodes });
    institutionName = institution.data.institution.name;
  }
  const accountResponse = await input.config.client.accountsGet({ access_token: exchange.data.access_token });
  const timestamp = now();
  const internalId = randomUUID();
  const item: PlaidItemRecord = {
    id: internalId, userId: input.profile.userId, profileId: input.profile.profileId, plaidItemId, institutionId, institutionName,
    environment: input.config.environment, encryptedAccessToken: encrypted.ciphertext, tokenKeyVersion: encrypted.keyVersion,
    status: "pending", consentId: input.consent.id, createdAt: timestamp, updatedAt: timestamp, lastSuccessfulSyncAt: null,
    lastWebhookAt: null, errorCode: null, needsUpdateMode: false, disconnectedAt: null,
  };
  const syncState: TransactionSyncStateRecord = { plaidItemId: internalId, cursor: null, lastSyncStartedAt: null, lastSyncCompletedAt: null, status: "queued", retryCount: 0, lastErrorCode: null, triggeringWebhookCode: null };
  await input.repository.createConnection({ item, accounts: accountResponse.data.accounts.map((account) => accountRecord(account, input.profile, internalId, { id: institutionId, name: institutionName })), syncState, consent: input.consent });
  return { connected: true, itemId: internalId, institutionName, accountCount: accountResponse.data.accounts.length, status: "processing", idempotent: false };
}

export async function syncTransactions(input: { config: ProductionPlaidConfig; item: PlaidItemRecord; accessToken: string; state: TransactionSyncStateRecord; repository: PlaidProductionRepository }) {
  let cursor = input.state.cursor || undefined;
  let hasMore = true;
  while (hasMore) {
    const page = await input.config.client.transactionsSync({ access_token: input.accessToken, cursor, count: 500 });
    const removedIds = page.data.removed.map((value: RemovedTransaction) => value.transaction_id);
    await input.repository.applyTransactionDelta({
      added: page.data.added.map((value) => transactionRecord(value, input.item)),
      modified: page.data.modified.map((value) => transactionRecord(value, input.item)),
      removedIds, removedAt: now(),
    });
    cursor = page.data.next_cursor;
    hasMore = page.data.has_more;
  }
  await input.repository.updateSyncState({ ...input.state, cursor: cursor || null, lastSyncCompletedAt: now(), status: "complete", retryCount: 0, lastErrorCode: null });
}
