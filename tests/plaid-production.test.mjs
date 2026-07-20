import assert from "node:assert/strict";
import test from "node:test";
import { unconfiguredPlaidAuthProvider } from "../lib/plaid/production/auth.ts";
import { KmsEnvelopePlaidTokenCipher, UnitTestKeyEncryptionService, readTokenCipher } from "../lib/plaid/production/encryption.ts";
import { readProductionPlaidConfig } from "../lib/plaid/production/config.ts";
import { exchangeAndPersistProductionItem } from "../lib/plaid/production/services.ts";
import { consumeLinkAttempt, createLinkAttempt } from "../lib/plaid/production/link-state.ts";
import { verifyPlaidWebhook } from "../lib/plaid/production/webhook-verification.ts";

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
    publicToken: "public-token", consent: { id: "consent-1", userId: "founder-user", profileId: "profile-1", consentVersion: "v1", productsRequested: ["transactions"], dataPurposes: ["Money Picture"], acceptedAt: new Date().toISOString(), revokedAt: null, source: "connect", ipHash: null }, repository, cipher,
  });
  assert.equal(JSON.stringify(result).includes(plaintext), false);
  assert.equal(JSON.stringify(persisted).includes(plaintext), false);
  assert.notEqual(persisted.item.encryptedAccessToken, plaintext);
});

test("production webhook rejects missing verification before persistence", async () => {
  const valid = await verifyPlaidWebhook({ verificationHeader: null, rawBody: "{}", client: { webhookVerificationKeyGet() { throw new Error("must not fetch a key"); } } });
  assert.equal(valid, false);
});
