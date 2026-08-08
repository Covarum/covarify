import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { actionAllowed, issueDevelopmentTurnToken, readDevelopmentTurnToken } from "../lib/conversation/development-turn-token.ts";
import { createAuthorizedCovarifySession, runCovarifyTurn } from "../lib/conversation/covarify-orchestrator.ts";
import { canonicalTruthFromTransactions } from "../lib/conversation/financial-truth.ts";
import { COVARIFY_TURN_CONTRACT_VERSION, isCovarifyTurn, isTransportTurnInput, parseTurnTransportResponse } from "../lib/conversation/transport-schema.ts";

const transaction = (overrides = {}) => ({ id: "tx-1", plaidAccountId: "account-1", accountLabel: "Capital One · 1234", merchantName: "OLU’KAI", name: "OLU’KAI", description: "OLUKAI", amount: 89, currency: "USD", date: "2026-01-10", pending: false, pendingTransactionId: null, category: "GENERAL_MERCHANDISE", sourceCategory: "GENERAL_MERCHANDISE", direction: "outflow", transferRelationship: null, ...overrides });
const truth = () => canonicalTruthFromTransactions({ userId: "founder-1", transactions: [transaction(), transaction({ id: "tx-2", amount: 110, date: "2026-02-10" })], asOf: "2026-08-08T12:00:00.000Z", sourceMode: "authenticated_preview" });

test("server-owned schema is the mobile contract source and accepts valid turns", () => {
  const mobile = readFileSync(new URL("../mobile/lib/turn-contract.ts", import.meta.url), "utf8");
  assert.match(mobile, /lib\/conversation\/turn-contract\.ts/); assert.match(mobile, /lib\/conversation\/transport-schema\.ts/);
  const session = createAuthorizedCovarifySession({ sessionId: "native", truth: truth(), authenticatedUserId: "founder-1" }); const turn = runCovarifyTurn(session, { modality: "text", statement: "How many payments were made to OLU’KAI?" });
  assert.equal(turn.understanding.intent, "TRANSACTION_COUNT"); assert.equal(turn.decision.quantified.find((item) => item.unit === "count")?.value, 2);
  assert.equal(isCovarifyTurn(turn), true); assert.equal(parseTurnTransportResponse({ ok: true, contractVersion: 1, turn, sessionToken: "opaque" })?.ok, true);
});

test("version mismatch and malformed turn fail closed", () => {
  assert.equal(COVARIFY_TURN_CONTRACT_VERSION, 1);
  assert.equal(parseTurnTransportResponse({ ok: true, contractVersion: 2, turn: {}, sessionToken: "opaque" }), null);
  assert.equal(parseTurnTransportResponse({ ok: true, contractVersion: 1, turn: { contractVersion: 1 }, sessionToken: "opaque" }), null);
  assert.equal(isTransportTurnInput({ modality: "text", statement: "hello", financialTruth: {} }), false);
});

test("typed action payload validation rejects mutation", () => {
  assert.equal(isTransportTurnInput({ modality: "guided_action", action: { id: "evidence", payload: { kind: "show_evidence", evidenceGroupId: "group" } } }), true);
  assert.equal(isTransportTurnInput({ modality: "guided_action", action: { id: "evidence", payload: { kind: "show_evidence", evidenceGroupId: "group", accountId: "foreign" } } }), false);
  assert.equal(isTransportTurnInput({ modality: "guided_action", action: { id: "evidence", payload: { kind: "show_evidence" } } }), false);
  assert.equal(isTransportTurnInput({ modality: "text", statement: "count", transaction: { selectedTransactionId: "foreign" } }), false);
  assert.equal(isTransportTurnInput({ modality: "text", statement: "count", canonicalTruth: { sourceMode: "fixture" } }), false);
});

test("encrypted session token preserves server context for natural follow-up", () => {
  const base = truth(); const firstSession = createAuthorizedCovarifySession({ sessionId: "native", truth: base, authenticatedUserId: "founder-1" }); const first = runCovarifyTurn(firstSession, { modality: "text", statement: "How many payments were made to OLU’KAI?" });
  const token = issueDevelopmentTurnToken({ secret: "test-secret", userId: "founder-1", sessionId: firstSession.sessionId, sequence: firstSession.sequence, context: firstSession.transactionContext, actions: first.actions, now: new Date("2026-08-08T12:00:00Z") });
  assert.doesNotMatch(token, /OLU|founder|tx-1/);
  const restored = readDevelopmentTurnToken({ secret: "test-secret", token, userId: "founder-1", now: new Date("2026-08-08T12:01:00Z") }); assert.equal(restored.ok, true);
  const followSession = createAuthorizedCovarifySession({ sessionId: restored.session.sessionId, truth: base, authenticatedUserId: "founder-1" }); followSession.sequence = restored.session.sequence; followSession.transactionContext = restored.session.context;
  const follow = runCovarifyTurn(followSession, { modality: "text", statement: "What do they total?", transaction: { context: followSession.transactionContext, dataMode: "connected" } });
  assert.equal(first.decision.affectedEntityIds.length, 2); assert.equal(follow.understanding.intent, "TRANSACTION_TOTAL"); assert.deepEqual(follow.decision.affectedEntityIds, first.decision.affectedEntityIds); assert.equal(follow.decision.quantified.find((item) => item.unit === "USD")?.value, 199); assert.equal(follow.identity.sequence, 2);
});

test("wrong user, expiry, stale action, and payload replay fail safely", () => {
  const action = { id: "evidence", type: "SHOW_EVIDENCE", label: "Show evidence", consequence: "READ_ONLY", confirmation: "none", reversible: false, payload: { kind: "show_evidence", evidenceGroupId: "group" } };
  const token = issueDevelopmentTurnToken({ secret: "test-secret", userId: "founder-1", sessionId: "native", sequence: 1, context: null, actions: [action], now: new Date("2026-08-08T12:00:00Z") });
  assert.deepEqual(readDevelopmentTurnToken({ secret: "test-secret", token, userId: "other-user", now: new Date("2026-08-08T12:01:00Z") }), { ok: false, error: "STALE_ACTION" });
  assert.deepEqual(readDevelopmentTurnToken({ secret: "test-secret", token, userId: "founder-1", now: new Date("2026-08-08T12:16:00Z") }), { ok: false, error: "SESSION_EXPIRED" });
  const valid = readDevelopmentTurnToken({ secret: "test-secret", token, userId: "founder-1", now: new Date("2026-08-08T12:01:00Z") }); assert.equal(valid.ok, true);
  assert.equal(actionAllowed(valid.session, action), true); assert.equal(actionAllowed(valid.session, { ...action, payload: { ...action.payload, evidenceGroupId: "changed" } }), false); assert.equal(actionAllowed(valid.session, { ...action, id: "unknown" }), false);
});

test("read-only native continuity cannot mutate canonical truth", () => {
  const base = truth(); const snapshot = structuredClone(base); const session = createAuthorizedCovarifySession({ sessionId: "native", truth: base, authenticatedUserId: "founder-1" }); runCovarifyTurn(session, { modality: "text", statement: "How many OLU’KAI transactions do I have?" });
  assert.deepEqual(base, snapshot); assert.deepEqual(session.canonicalTruth, snapshot); assert.deepEqual(session.canonicalTruth.governedMemory, []);
});

test("authenticated native path preserves bounded financial scope", () => {
  const session = createAuthorizedCovarifySession({ sessionId: "native", truth: truth(), authenticatedUserId: "founder-1" }); const turn = runCovarifyTurn(session, { modality: "text", statement: "Write me a poem." });
  assert.equal(turn.understanding.intent, "OUT_OF_SCOPE"); assert.match(turn.response.primaryMessage, /financial/i); assert.equal(turn.actions.some((action) => action.type === "CONFIRM_MEMORY"), false);
});

test("development endpoint uses preview founder auth without production Plaid coupling", () => {
  const route = readFileSync(new URL("../app/api/development/covarify-turn/route.ts", import.meta.url), "utf8");
  const auth = readFileSync(new URL("../lib/founder-review-auth.ts", import.meta.url), "utf8");
  for (const contract of [/authenticateRequestWithClient/, /getAuthorizedFounderPreviewUser\(auth\.user\.supabaseUser\)/, /loadAuthorizedTransactions\(founder\.id\)/, /canonicalTruthFromTransactions/, /createAuthorizedCovarifySession/, /runCovarifyTurn/, /VERCEL_ENV === "production"/, /hasClientAuthority/, /actionAllowed/]) assert.match(route, contract);
  assert.match(auth, /getAuthorizedFounderPreviewUser[\s\S]*isFounderAdmin\(user, process\.env\.COVARIFY_ADMIN_EMAILS\)/);
  assert.match(auth, /getAuthorizedFounderUser[\s\S]*readProductionPlaidConfig\(\)\.allowedUserIds/);
  assert.doesNotMatch(route, /getAuthorizedFounderUser|readProductionPlaidConfig|PLAID_PRODUCTION|console\.(log|info|warn|error)|body\.userId|body\.financialTruth/);
});

test("founder native truth is persisted, user-scoped, and independent of Plaid APIs", () => {
  const loader = readFileSync(new URL("../lib/conversation/authorized-transactions-server.ts", import.meta.url), "utf8");
  for (const contract of [/from\("plaid_items"\)/, /from\("plaid_accounts"\)/, /from\("plaid_transactions"\)/, /eq\("user_id", userId\)/, /eq\("environment", "production"\)/]) assert.match(loader, contract);
  assert.doesNotMatch(loader, /PlaidApi|linkTokenCreate|itemPublicTokenExchange|transactionsSync|PLAID_(?:SANDBOX|PRODUCTION)_SECRET/);
});

test("legacy Plaid sandbox routes are local-only and fail before hosted work", () => {
  for (const path of [
    "../app/api/plaid/create-link-token/route.ts",
    "../app/api/plaid/exchange-public-token/route.ts",
    "../app/api/plaid/webhook/route.ts",
  ]) {
    const route = readFileSync(new URL(path, import.meta.url), "utf8");
    assert.match(route, /export async function POST[\s\S]*if \(process\.env\.VERCEL_ENV\)[\s\S]*status: 404/);
  }
  const productionWebhook = readFileSync(new URL("../app/api/plaid/production/webhook/route.ts", import.meta.url), "utf8");
  assert.match(productionWebhook, /verifyPlaidWebhook/);
  assert.doesNotMatch(productionWebhook, /process\.env\.VERCEL_ENV/);
});
