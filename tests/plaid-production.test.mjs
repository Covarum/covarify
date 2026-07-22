import assert from "node:assert/strict";
import test from "node:test";
import { unconfiguredPlaidAuthProvider } from "../lib/plaid/production/auth.ts";
import { KmsEnvelopePlaidTokenCipher, UnitTestKeyEncryptionService, readTokenCipher } from "../lib/plaid/production/encryption.ts";
import { AwsKmsKeyEncryptionService } from "../lib/plaid/production/aws-kms.ts";
import { readProductionPlaidConfig } from "../lib/plaid/production/config.ts";
import { exchangeAndPersistProductionItem } from "../lib/plaid/production/services.ts";
import { consumeLinkAttempt, createLinkAttempt } from "../lib/plaid/production/link-state.ts";
import { verifyPlaidWebhook } from "../lib/plaid/production/webhook-verification.ts";
import { retryDelaySeconds, runTransactionsSyncWorker } from "../lib/plaid/production/sync-worker.ts";
import { isCurrentPlaidConsentVersion, PLAID_CONSENT_VERSION } from "../lib/plaid/production/consent.ts";

const productionEnvironment = () => ({
  PLAID_CLIENT_ID: "client-id", PLAID_SANDBOX_SECRET: "sandbox-secret", PLAID_PRODUCTION_SECRET: "production-secret",
  PLAID_ENV: "production", PLAID_PRODUCTS: "transactions", PLAID_COUNTRY_CODES: "US", PLAID_CLIENT_NAME: "Covarify",
  PLAID_WEBHOOK_URL: "https://www.covarify.com/api/plaid/production/webhook", PLAID_REDIRECT_URI: "https://www.covarify.com/connect/oauth",
  PLAID_PRODUCTION_CONNECTIONS_ENABLED: "false", PLAID_PRODUCTION_ALLOWED_USER_IDS: "founder-user",
});

test("anonymous production Link token requests are rejected before configuration", async () => {
  const profile = await unconfiguredPlaidAuthProvider.getAuthenticatedProfile(new Request("https://www.covarify.com/api/plaid/production/create-link-token", { method: "POST" }));
  assert.equal(profile, null, "the default production auth adapter must fail closed");
});

test("environment configuration selects one distinct secret and requires HTTPS", () => {
  const config = readProductionPlaidConfig(productionEnvironment());
  assert.equal(config.environment, "production");
  assert.equal(config.connectionsEnabled, false);
  assert.throws(() => readProductionPlaidConfig({ ...productionEnvironment(), PLAID_REDIRECT_URI: "http://example.com/connect/oauth" }), /HTTPS/);
  assert.throws(() => readProductionPlaidConfig({ ...productionEnvironment(), PLAID_PRODUCTION_SECRET: "sandbox-secret" }), /distinct/);
});

test("generic PLAID_SECRET cannot configure Production", () => {
  const environment = { ...productionEnvironment(), PLAID_PRODUCTION_SECRET: "", PLAID_SECRET: "generic-secret" };
  assert.throws(() => readProductionPlaidConfig(environment), /PLAID_PRODUCTION_SECRET/);
});

test("production consent uses and enforces the immutable approved version", () => {
  assert.equal(PLAID_CONSENT_VERSION, "plaid-production-consent-v1-2026-07-22");
  assert.equal(isCurrentPlaidConsentVersion(PLAID_CONSENT_VERSION), true);
  assert.equal(isCurrentPlaidConsentVersion("obsolete-consent-version"), false);
});

test("production rollout requires both the global gate and exact UUID allowlist membership", async () => {
  const { assertProductionConnectionAllowed } = await import("../lib/plaid/production/config.ts");
  const disabled = readProductionPlaidConfig(productionEnvironment());
  assert.throws(() => assertProductionConnectionAllowed(disabled, "founder-user"), /not enabled/);
  const enabled = readProductionPlaidConfig({ ...productionEnvironment(), PLAID_PRODUCTION_CONNECTIONS_ENABLED: "true" });
  assert.throws(() => assertProductionConnectionAllowed(enabled, "different-user"), /not enabled for/);
  assert.doesNotThrow(() => assertProductionConnectionAllowed(enabled, "founder-user"));
});

test("OAuth state is user-bound, expiring, and one-time", async () => {
  let row;
  const store = {
    async create(input) { row = { id: "attempt-1", ...input, consumedAt: null }; },
    async consume(input) {
      if (!row || row.userId !== input.userId || row.stateHash !== input.stateHash || row.consumedAt) return null;
      const result = { ...row }; row.consumedAt = input.consumedAt; return result;
    },
  };
  const created = await createLinkAttempt(store, "founder-user", "draft-v1", new Date("2026-07-20T12:00:00Z"));
  await assert.rejects(() => consumeLinkAttempt(store, "other-user", created.state, new Date("2026-07-20T12:01:00Z")), /invalid/);
  await consumeLinkAttempt(store, "founder-user", created.state, new Date("2026-07-20T12:01:00Z"));
  await assert.rejects(() => consumeLinkAttempt(store, "founder-user", created.state, new Date("2026-07-20T12:02:00Z")), /invalid/);
});

test("versioned KMS envelope encrypts at rest and supports decryption", async () => {
  const cipher = new KmsEnvelopePlaidTokenCipher(new UnitTestKeyEncryptionService("v1"));
  const plaintext = "access-production-sensitive";
  const encrypted = await cipher.encrypt(plaintext);
  assert.equal(encrypted.keyVersion, "v1");
  assert.equal(encrypted.ciphertext.includes(plaintext), false);
  assert.equal(await cipher.decrypt(encrypted), plaintext);
});

test("AWS KMS adapter generates AES-256 keys and binds decrypt to the production context", async () => {
  const calls = [];
  const plaintext = new Uint8Array(32).fill(7);
  const wrapped = new Uint8Array([1, 2, 3, 4]);
  const client = { async send(command) {
    calls.push({ name: command.constructor.name, input: command.input });
    if (command.constructor.name === "GenerateDataKeyCommand") return { Plaintext: plaintext, CiphertextBlob: wrapped, KeyId: "arn:aws:kms:us-east-1:123456789012:key/key-id" };
    return { Plaintext: plaintext, KeyId: "arn:aws:kms:us-east-1:123456789012:key/key-id" };
  } };
  const kms = new AwsKmsKeyEncryptionService({ region: "us-east-1", keyId: "alias/covarify-production-plaid-tokens", client });
  const generated = await kms.generateDataKey();
  assert.equal(generated.plaintextKey.byteLength, 32);
  assert.equal(generated.keyVersion, "arn:aws:kms:us-east-1:123456789012:key/key-id");
  await kms.unwrapDataKey(generated.wrappedKey, generated.keyVersion);
  assert.deepEqual(calls[0].input, { KeyId: "alias/covarify-production-plaid-tokens", KeySpec: "AES_256", EncryptionContext: { application: "covarify", purpose: "plaid-access-token" } });
  assert.equal("KeyId" in calls[1].input, false, "decrypt must keep working after an alias is repointed");
  assert.deepEqual(calls[1].input.EncryptionContext, { application: "covarify", purpose: "plaid-access-token" });
});

test("AWS KMS adapter rejects incomplete key material", async () => {
  const client = { async send() { return { Plaintext: new Uint8Array(16), CiphertextBlob: new Uint8Array([1]) }; } };
  const kms = new AwsKmsKeyEncryptionService({ region: "us-east-1", keyId: "alias/covarify-production-plaid-tokens", client });
  await assert.rejects(() => kms.generateDataKey(), /incomplete AES-256/);
});

test("production token encryption fails closed without KMS and rejects the test adapter", () => {
  assert.throws(() => readTokenCipher(), /KMS is not configured/);
  assert.throws(() => new UnitTestKeyEncryptionService("v1", undefined, "production"), /cannot run in Production/);
});

test("exchange service persists ciphertext and never returns the access token", async () => {
  const plaintext = "access-production-sensitive";
  const cipher = new KmsEnvelopePlaidTokenCipher(new UnitTestKeyEncryptionService("v1"));
  let persisted;
  const repository = {
    async findItemByPlaidId() { return null; },
    async createConnection(value) { persisted = value; },
  };
  const client = {
    async itemPublicTokenExchange() { return { data: { access_token: plaintext, item_id: "plaid-item", request_id: "request" } }; },
    async itemGet() { return { data: { item: { institution_id: "ins_1" } } }; },
    async institutionsGetById() { return { data: { institution: { name: "Example Bank" } } }; },
    async accountsGet() { return { data: { accounts: [{ account_id: "account-1", persistent_account_id: "persistent-1", name: "Checking", official_name: "Example Checking", type: "depository", subtype: "checking", mask: "1234", balances: { iso_currency_code: "USD", unofficial_currency_code: null, current: 100, available: 90 } }] } }; },
  };
  const result = await exchangeAndPersistProductionItem({
    config: { ...readProductionPlaidConfig(productionEnvironment()), client }, profile: { userId: "founder-user", profileId: "profile-1", roles: [] },
    publicToken: "public-token", consent: { id: "consent-1", userId: "founder-user", profileId: "profile-1", consentVersion: PLAID_CONSENT_VERSION, productsRequested: ["transactions"], dataPurposes: ["Money Picture"], acceptedAt: new Date().toISOString(), revokedAt: null, source: "connect", ipHash: null }, repository, cipher,
  });
  assert.equal(JSON.stringify(result).includes(plaintext), false);
  assert.equal(JSON.stringify(persisted).includes(plaintext), false);
  assert.notEqual(persisted.item.encryptedAccessToken, plaintext);
  assert.equal(persisted.consent.consentVersion, PLAID_CONSENT_VERSION);
});

test("production webhook rejects missing verification before persistence", async () => {
  const valid = await verifyPlaidWebhook({ verificationHeader: null, rawBody: "{}", client: { webhookVerificationKeyGet() { throw new Error("must not fetch a key"); } } });
  assert.equal(valid, false);
});

test("transactions worker claims, decrypts, paginates, applies deltas, and completes", async () => {
  const job = { id: "job-1", plaidItemId: "item-1", webhookCode: "SYNC_UPDATES_AVAILABLE", attemptCount: 1, leaseToken: "lease-1" };
  const item = { id: "item-1", userId: "user-1", profileId: "profile-1", plaidItemId: "plaid-item", institutionId: null, institutionName: null, environment: "production", encryptedAccessToken: "ciphertext", tokenKeyVersion: "key-v1", status: "active", consentId: "consent-1", createdAt: "2026-07-20T00:00:00Z", updatedAt: "2026-07-20T00:00:00Z", lastSuccessfulSyncAt: null, lastWebhookAt: null, errorCode: null, needsUpdateMode: false, disconnectedAt: null };
  let state = { plaidItemId: "item-1", cursor: null, lastSyncStartedAt: null, lastSyncCompletedAt: null, status: "queued", retryCount: 0, lastErrorCode: null, triggeringWebhookCode: null };
  const deltas = []; let completed = false; let page = 0;
  const repository = {
    async claimSyncJob() { return job; }, async findItemById() { return item; }, async getSyncState() { return state; },
    async updateSyncState(value) { state = value; }, async applyTransactionDelta(value) { deltas.push(value); },
    async completeSyncJob() { completed = true; }, async retrySyncJob() { throw new Error("unexpected retry"); }, async failSyncJob() { throw new Error("unexpected failure"); },
  };
  const transaction = { transaction_id: "tx-1", account_id: "account-1", pending_transaction_id: null, merchant_name: "Shop", name: "Purchase", amount: 12, iso_currency_code: "USD", unofficial_currency_code: null, date: "2026-07-20", authorized_date: null, pending: false, personal_finance_category: null, category: ["Shops"] };
  const config = { environment: "production", client: { async transactionsSync() { page += 1; return { data: page === 1 ? { added: [transaction], modified: [], removed: [], next_cursor: "cursor-1", has_more: true } : { added: [], modified: [], removed: [{ transaction_id: "tx-old" }], next_cursor: "cursor-2", has_more: false } }; } } };
  const result = await runTransactionsSyncWorker({ config, cipher: { async decrypt() { return "access-token"; } }, repository, now: () => new Date("2026-07-20T12:00:00Z") });
  assert.equal(result.outcome, "complete"); assert.equal(page, 2); assert.equal(deltas.length, 2); assert.equal(completed, true);
  assert.equal(state.cursor, "cursor-2"); assert.equal(state.status, "complete"); assert.equal(state.lastSyncStartedAt, "2026-07-20T12:00:00.000Z");
});

test("transactions worker retries transient Plaid failures with bounded jittered backoff", async () => {
  const job = { id: "job-1", plaidItemId: "item-1", webhookCode: "SYNC_UPDATES_AVAILABLE", attemptCount: 2, leaseToken: "lease-1" };
  const item = { id: "item-1", userId: "user-1", environment: "production", encryptedAccessToken: "ciphertext", tokenKeyVersion: "key-v1", status: "active" };
  let state = { plaidItemId: "item-1", cursor: "cursor-1", lastSyncStartedAt: null, lastSyncCompletedAt: null, status: "queued", retryCount: 0, lastErrorCode: null, triggeringWebhookCode: null }; let retry;
  const repository = { async claimSyncJob(){return job;},async findItemById(){return item;},async getSyncState(){return state;},async updateSyncState(v){state=v;},async retrySyncJob(_j,v){retry=v;},async failSyncJob(){throw new Error("unexpected failure");} };
  const error = { response: { data: { error_type: "RATE_LIMIT_EXCEEDED", error_code: "RATE_LIMIT_EXCEEDED" } } };
  const config = { environment: "production", client: { async transactionsSync(){throw error;} } };
  const result = await runTransactionsSyncWorker({ config, cipher: { async decrypt(){return "access-token";} }, repository, now:()=>new Date("2026-07-20T12:00:00Z"), random:()=>0.5 });
  assert.equal(result.outcome,"retry"); assert.equal(state.status,"retry"); assert.equal(retry.safeErrorCode,"RATE_LIMIT_EXCEEDED"); assert.equal(retry.availableAt,"2026-07-20T12:02:00.000Z");
  assert.equal(retryDelaySeconds(5,()=>1),1440);
});
