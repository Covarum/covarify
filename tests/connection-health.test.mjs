import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { accountClass, buildConnectionHealth, freshnessFor } from "../lib/plaid/production/connection-health.ts";

const now = new Date("2026-08-03T16:00:00.000Z");
const item = (patch = {}) => ({ id: "item-a", institution_name: "TD Bank", status: "active", last_successful_sync_at: "2026-08-03T12:00:00.000Z", error_code: null, needs_update_mode: false, ...patch });
const account = (patch = {}) => ({ plaid_item_id: "item-a", type: "depository", subtype: "checking", updated_at: "2026-08-03T12:00:00.000Z", ...patch });
const sync = (patch = {}) => ({ plaid_item_id: "item-a", sync_status: "complete", last_sync_started_at: "2026-08-03T11:59:00.000Z", last_sync_completed_at: "2026-08-03T12:00:00.000Z", last_error: null, ...patch });

test("account classes and product policies distinguish cash, credit, loans, and investments", () => {
  assert.equal(accountClass("depository", "checking"), "cash");
  assert.equal(accountClass("credit", "credit card"), "credit");
  assert.equal(accountClass("loan", "mortgage"), "loan");
  assert.equal(accountClass("investment", "brokerage"), "investment");
  assert.equal(freshnessFor(["cash"], "2026-08-02T04:00:00.000Z", now), "aging");
  assert.equal(freshnessFor(["investment"], "2026-08-02T04:00:00.000Z", now), "current");
});

test("one or multiple current institutions remain individually current", () => {
  const result = buildConnectionHealth([item(), item({ id: "item-b", institution_name: "Capital One" })], [account(), account({ plaid_item_id: "item-b", type: "credit" })], [sync(), sync({ plaid_item_id: "item-b" })], now);
  assert.deepEqual(result.map((value) => [value.institutionName, value.state]), [["TD Bank", "current"], ["Capital One", "current"]]);
});

test("stale banking is named and refreshable while current Items are not", () => {
  const [health] = buildConnectionHealth([item({ last_successful_sync_at: "2026-07-29T12:00:00.000Z" })], [account()], [sync({ last_sync_completed_at: "2026-07-29T12:00:00.000Z", last_sync_started_at: "2026-07-29T11:59:00.000Z" })], now);
  assert.equal(health.institutionName, "TD Bank"); assert.equal(health.state, "stale"); assert.equal(health.refreshEligible, true);
  assert.equal(buildConnectionHealth([item()], [account()], [sync()], now)[0].refreshEligible, false);
});

test("normally delayed investment data does not become stale or refreshable", () => {
  const [health] = buildConnectionHealth([item({ institution_name: "Acorns", last_successful_sync_at: null })], [account({ type: "investment", subtype: "brokerage", updated_at: "2026-08-01T16:00:00.000Z" })], [sync({ last_sync_completed_at: null })], now);
  assert.equal(health.state, "current"); assert.equal(health.lastInvestmentUpdateAt, "2026-08-01T16:00:00.000Z"); assert.equal(health.refreshEligible, false);
});

test("missing timestamps never become current and active work blocks duplicates", () => {
  assert.equal(buildConnectionHealth([item({ last_successful_sync_at: null })], [account({ updated_at: null })], [sync({ last_sync_completed_at: null, last_sync_started_at: null })], now)[0].state, "unknown");
  const active = buildConnectionHealth([item({ last_successful_sync_at: "2026-07-29T12:00:00.000Z" })], [account()], [sync({ sync_status: "running", last_sync_completed_at: "2026-07-29T12:00:00.000Z" })], now)[0];
  assert.equal(active.state, "syncing"); assert.equal(active.refreshEligible, false);
});

test("reauthentication requires reconnect instead of refresh", () => {
  const [health] = buildConnectionHealth([item({ needs_update_mode: true })], [account()], [sync()], now);
  assert.equal(health.state, "action_required"); assert.equal(health.reconnectRequired, true); assert.equal(health.refreshEligible, false);
});

test("manual refresh is authenticated, owner scoped, deduplicated, partial, and truthful", () => {
  const route = readFileSync(new URL("../app/api/plaid/production/items/refresh/route.ts", import.meta.url), "utf8");
  assert.match(route, /getAuthenticatedUser/); assert.match(route, /\.eq\("user_id", user\.id\)/); assert.match(route, /requested\.length/);
  assert.match(route, /MANUAL_REFRESH_COOLDOWN_MS/); assert.match(route, /manual:\$\{item\.id\}:\$\{bucket\}/); assert.match(route, /Promise\.all/);
  assert.match(route, /Refresh requested/); assert.match(route, /only after fresh data arrives/); assert.doesNotMatch(route, /Updated successfully/);
});

test("existing queue, cursor, webhook, and mobile protections remain explicit", () => {
  const repository = readFileSync(new URL("../lib/plaid/production/supabase-repository.ts", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../lib/plaid/production/services.ts", import.meta.url), "utf8");
  const webhook = readFileSync(new URL("../app/api/plaid/production/webhook/route.ts", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../components/account/connection-health-panel.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../components/account/money-picture.module.css", import.meta.url), "utf8");
  assert.match(repository, /resync_requested:true/); assert.match(repository, /sync_status:"queued"/);
  assert.match(worker, /let cursor = input\.state\.cursor/); assert.match(repository, /onConflict:"plaid_item_id,plaid_transaction_id"/);
  assert.match(webhook, /SYNC_UPDATES_AVAILABLE/); assert.match(panel, /Investment data may be delayed/); assert.doesNotMatch(panel, /error_code|access_token/);
  assert.match(css, /@media\(max-width:560px\).*\.connectionHealth/s); assert.match(panel, /aria-live="polite"/);
});
