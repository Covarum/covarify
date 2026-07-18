import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { unconfiguredPlaidAuthProvider } from "../lib/plaid/production/auth.ts";
import { AesGcmPlaidTokenCipher } from "../lib/plaid/production/encryption.ts";
import { readProductionPlaidConfig } from "../lib/plaid/production/config.ts";
import { exchangeAndPersistProductionItem } from "../lib/plaid/production/services.ts";
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

test("versioned token cipher encrypts at rest and supports decryption", () => {
  const cipher = new AesGcmPlaidTokenCipher("v1", new Map([["v1", randomBytes(32)]]));
  const plaintext = "access-production-sensitive";
  const encrypted = cipher.encrypt(plaintext);
  assert.equal(encrypted.keyVersion, "v1");
  assert.equal(encrypted.ciphertext.includes(plaintext), false);
  assert.equal(cipher.decrypt(encrypted), plaintext);
});

test("exchange service persists ciphertext and never returns the access token", async () => {
  const plaintext = "access-production-sensitive";
  const cipher = new AesGcmPlaidTokenCipher("v1", new Map([["v1", randomBytes(32)]]));
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
