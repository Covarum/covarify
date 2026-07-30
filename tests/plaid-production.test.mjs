import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
import { ACCOUNT_DELETION_DAYS, AUDIT_RETENTION_YEARS, BACKUP_RETENTION_DAYS, SYNC_JOB_RETENTION_DAYS, WEBHOOK_RETENTION_DAYS } from "../lib/account-deletion/policy.ts";
import { sanitizeLinkDiagnostic } from "../lib/plaid/production/link-diagnostics.ts";
import { annotateInternalTransfers, buildAccountAnalytics, buildAccountObservations, buildMoneyPicture, classifyTransaction, filterTransactions, formatTransactionDisplayAmount, sortTransactions, summarizeFilteredTransactions } from "../lib/money-picture.ts";
import { accountTypeLabel, buildConnectedAccountSummary } from "../lib/money-picture-overview.ts";
import { RECENT_ACTIVITY_PAGE_SIZE } from "../lib/recent-activity-pagination.ts";
import { buildConnectionSummary } from "../lib/plaid/production/connection-summary.ts";

const productionEnvironment = () => ({
  PLAID_CLIENT_ID: "client-id", PLAID_SANDBOX_SECRET: "sandbox-secret", PLAID_PRODUCTION_SECRET: "production-secret",
  PLAID_ENV: "production", PLAID_PRODUCTS: "transactions", PLAID_COUNTRY_CODES: "US", PLAID_CLIENT_NAME: "Covarify",
  PLAID_WEBHOOK_URL: "https://www.covarify.com/api/plaid/production/webhook", PLAID_REDIRECT_URI: "https://www.covarify.com/connect/oauth",
  PLAID_PRODUCTION_CONNECTIONS_ENABLED: "false", PLAID_PRODUCTION_ALLOWED_USER_IDS: "founder-user",
});

test("founder workspace scopes and aggregates all owned Plaid Items", () => {
  const accountPage = readFileSync(new URL("../app/account/page.tsx", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../components/account/authenticated-workspace.tsx", import.meta.url), "utf8");
  assert.match(accountPage, /const itemIds = items\.map\(\(item\) => item\.id\)/);
  assert.match(accountPage, /from\("transaction_sync_states"\).*\.in\("plaid_item_id", itemIds\)/s);
  assert.doesNotMatch(accountPage, /from\("transaction_sync_states"\).*\.eq\("user_id"/s);
  assert.match(accountPage, /const accountRows = \(accounts\.data \|\| \[\]\)\.map/);
  assert.match(accountPage, /\.in\("plaid_item_id", itemIds\)/);
  assert.match(workspace, /connected accounts/i);
  assert.match(workspace, /Add another institution/);
  assert.match(workspace, /account\.institution/);
  assert.match(workspace, /financialData\.accounts\.map/);
});

test("connect page preserves first-time onboarding and distinguishes additional institutions", () => {
  const page = readFileSync(new URL("../app/connect/page.tsx", import.meta.url), "utf8");
  const link = readFileSync(new URL("../components/plaid/production-link.tsx", import.meta.url), "utf8");
  assert.match(page, /\.in\("status", \["active", "pending"\]\)/);
  assert.match(page, /const isAdditionalConnection = institutionCount > 0/);
  assert.match(page, /Build your Money Picture/);
  assert.match(page, /Your Financial Connections/);
  assert.match(link, /Your existing institutions will stay connected/);
  assert.match(link, /will not replace or disconnect any bank, credit card, or other connected account/);
  assert.match(page, /institution\.name/);
  assert.match(page, /institution\.accountCount/);
  assert.match(page, /institution\.lastSyncedAt/);
  assert.doesNotMatch(page, /TD Bank/);
  assert.match(link, /isAdditionalConnection \? "Connect another institution" : "Continue securely with Plaid"/);
  assert.match(link, /\/api\/plaid\/production\/create-link-token/);
  assert.match(link, /\/api\/plaid\/production\/exchange-public-token/);
  assert.match(link, /window\.location\.assign\(`\/connect\?connected=\$\{encodeURIComponent\(result\.itemId\)\}`\)/);
  assert.match(page, /connected successfully/);
  assert.match(page, /connectedInstitutions\.find\(\(institution\) => institution\.itemIds\.includes\(connectedItemId\)\)/);
  assert.match(page, /View your updated Money Picture/);
  assert.match(page, /this summary is still updating/);
  assert.match(readFileSync(new URL("../app/api/plaid/production/exchange-public-token/route.ts", import.meta.url), "utf8"), /revalidatePath\("\/connect"\)/);
});

test("connection summary counts active and pending production institutions and accounts accurately", () => {
  const items = [
    { id: "td-item", institution_id: "ins-td", institution_name: "TD Bank", environment: "production", status: "active", last_successful_sync_at: "2026-07-29T20:00:00Z" },
    { id: "capital-item", institution_id: "ins-capital", institution_name: "Capital One", environment: "production", status: "pending", last_successful_sync_at: null },
  ];
  const accounts = [
    { plaid_item_id: "td-item", active_status: "active" },
    { plaid_item_id: "td-item", active_status: "active" },
    { plaid_item_id: "capital-item", active_status: "active" },
  ];
  const summary = buildConnectionSummary(items, accounts);
  assert.equal(summary.institutionCount, 2);
  assert.equal(summary.accountCount, 3);
  assert.deepEqual(summary.connectedInstitutions.map(({ name, accountCount, status }) => ({ name, accountCount, status })), [
    { name: "TD Bank", accountCount: 2, status: "connected" },
    { name: "Capital One", accountCount: 1, status: "syncing" },
  ]);
  assert.deepEqual(summary.connectedInstitutions.flatMap((institution) => institution.itemIds), ["td-item", "capital-item"]);
});

test("connection summary deduplicates by stable institution ID and excludes unavailable Items", () => {
  const items = [
    { id: "one", institution_id: "ins-shared", institution_name: "Example Bank", environment: "production", status: "active", last_successful_sync_at: null },
    { id: "two", institution_id: "ins-shared", institution_name: "Example Bank", environment: "production", status: "active", last_successful_sync_at: null },
    { id: "three", institution_id: null, institution_name: "Example Bank", environment: "production", status: "active", last_successful_sync_at: null },
    { id: "removed", institution_id: "ins-removed", institution_name: "Removed Bank", environment: "production", status: "disconnected", last_successful_sync_at: null },
    { id: "error", institution_id: "ins-error", institution_name: "Error Bank", environment: "production", status: "error", last_successful_sync_at: null },
    { id: "sandbox", institution_id: "ins-sandbox", institution_name: "Sandbox Bank", environment: "sandbox", status: "active", last_successful_sync_at: null },
  ];
  const accounts = items.map((item) => ({ plaid_item_id: item.id, active_status: "active" }));
  const summary = buildConnectionSummary(items, accounts);
  assert.equal(summary.institutionCount, 2);
  assert.equal(summary.accountCount, 3);
  assert.deepEqual(summary.connectedInstitutions[0].itemIds, ["one", "two"]);
  assert.deepEqual(summary.connectedInstitutions[1].itemIds, ["three"]);
});

test("Money Picture classification excludes transfers and pending rows from spending", () => {
  const base = { id: "1", plaidAccountId: "account", name: "Entry", currency: "USD", date: "2026-07-20", pendingTransactionId: null, detailedCategory: null };
  assert.equal(classifyTransaction({ ...base, amount: 25, pending: false, category: "FOOD_AND_DRINK" }), "outflow");
  assert.equal(classifyTransaction({ ...base, amount: -100, pending: false, category: "INCOME" }), "inflow");
  assert.equal(classifyTransaction({ ...base, amount: 100, pending: false, category: "TRANSFER_OUT" }), "transfer");
  assert.equal(classifyTransaction({ ...base, amount: 25, pending: true, category: "FOOD_AND_DRINK" }), "pending");
  assert.equal(classifyTransaction({ ...base, name: "Purchase refund", amount: -25, pending: false, category: "GENERAL_MERCHANDISE" }), "refund");
  const picture = buildMoneyPicture([{ ...base, amount: 25, pending: false, category: "FOOD_AND_DRINK" }, { ...base, id: "2", amount: 100, pending: false, category: "TRANSFER_OUT" }, { ...base, id: "3", amount: 12, pending: true, category: "FOOD_AND_DRINK" }], new Date("2026-07-22T00:00:00Z"));
  assert.equal(picture.spending, 25); assert.equal(picture.spendingByCategory[0].amount, 25);
});

test("transaction display amounts translate Plaid signs without changing source values", () => {
  const base = { id: "display", plaidAccountId: "account", accountLabel: "Checking • 1111", name: "Entry", currency: "USD", date: "2026-07-20", pending: false, pendingTransactionId: null, detailedCategory: null, transferRelationship: null };
  const cases = [
    [{ ...base, amount: -1017.6, category: "INCOME", direction: "inflow" }, "+$1,017.60", "Money in: $1,017.60"],
    [{ ...base, amount: 48.55, category: "FOOD_AND_DRINK", direction: "outflow" }, "−$48.55", "Money out: $48.55"],
    [{ ...base, name: "Purchase refund", amount: -25, category: "GENERAL_MERCHANDISE", direction: "inflow" }, "+$25.00", "Refund: $25.00"],
    [{ ...base, amount: -100, category: "TRANSFER_IN", direction: "inflow" }, "+$100.00", "Transfer in: $100.00"],
    [{ ...base, amount: 100, category: "TRANSFER_OUT", direction: "outflow" }, "−$100.00", "Transfer out: $100.00"],
    [{ ...base, amount: -0.01, category: "INCOME", direction: "inflow" }, "+$0.01", "Money in: $0.01"],
  ];
  for (const [transaction, displayAmount, accessibleText] of cases) {
    const originalAmount = transaction.amount;
    const display = formatTransactionDisplayAmount(transaction);
    assert.equal(display.displayAmount, displayAmount);
    assert.equal(display.accessibleText, accessibleText);
    assert.equal(transaction.amount, originalAmount);
    assert.doesNotMatch(display.displayAmount, /^[+−]-/);
  }
});

test("account analytics retain provenance and exclude matched internal transfers", () => {
  const base = { name: "Entry", accountLabel: "Account A • 1111", currency: "USD", pending: false, pendingTransactionId: null, detailedCategory: null, direction: "outflow", transferRelationship: null };
  const rows = annotateInternalTransfers([{ ...base, id: "out", plaidAccountId: "a", amount: 100, date: "2026-07-20", category: "TRANSFER_OUT" }, { ...base, id: "in", plaidAccountId: "b", accountLabel: "Account B • 2222", amount: -100, direction: "inflow", date: "2026-07-21", category: "TRANSFER_IN" }, { ...base, id: "spend", plaidAccountId: "a", amount: 25, date: "2026-07-21", category: "FOOD_AND_DRINK" }]);
  assert.equal(rows[0].transferRelationship, "internal"); assert.equal(rows[1].transferRelationship, "internal");
  const picture = buildMoneyPicture(rows, new Date("2026-07-22T00:00:00Z")); assert.equal(picture.spending, 25); assert.equal(picture.income, 0);
  const analytics = buildAccountAnalytics(rows); assert.equal(analytics.length, 2); assert.equal(analytics.find((account) => account.accountId === "a").transfersOut, 1); assert.equal(buildAccountObservations(analytics).every((observation) => !observation.title.includes("undefined")), true);
});

test("Money Picture filters preserve deterministic newest-first input without duplicates", () => {
  const rows = Array.from({ length: 50 }, (_, index) => ({ id: String(50 - index), plaidAccountId: index % 2 ? "a" : "b", name: `Merchant ${index}`, amount: index + 1, currency: "USD", date: `2026-07-${String(22 - Math.floor(index / 3)).padStart(2, "0")}`, pending: false, pendingTransactionId: null, category: index % 2 ? "FOOD_AND_DRINK" : "TRAVEL", detailedCategory: null }));
  const filtered = filterTransactions(rows, { accountId: "a", category: "FOOD_AND_DRINK" }, new Date("2026-07-22T00:00:00Z"));
  assert.equal(filtered.length, 25);
  assert.equal(new Set(filtered.map((row) => row.id)).size, filtered.length);
  for (let index = 1; index < filtered.length; index += 1) {
    assert.ok(filtered[index - 1].date >= filtered[index].date);
    if (filtered[index - 1].date === filtered[index].date) {
      assert.ok(Math.abs(filtered[index - 1].amount) >= Math.abs(filtered[index].amount));
    }
  }
});

test("filtered summaries use human-readable direction and the full filtered result set", () => {
  const base = {
    plaidAccountId: "a",
    accountLabel: "Checking • 1111",
    currency: "USD",
    pending: false,
    pendingTransactionId: null,
    detailedCategory: null,
    transferRelationship: null,
  };
  const rows = [
    { ...base, id: "1", name: "Payroll A", amount: -1017.6, date: "2026-07-20", category: "INCOME", direction: "inflow" },
    { ...base, id: "2", name: "Payroll B", amount: -729.74, date: "2026-07-10", category: "INCOME", direction: "inflow" },
    { ...base, id: "3", name: "Payroll C", amount: -236.5, date: "2026-07-01", category: "INCOME", direction: "inflow" },
    { ...base, id: "4", name: "Grocer", amount: 80, date: "2026-07-15", category: "FOOD_AND_DRINK", direction: "outflow" },
    { ...base, id: "5", plaidAccountId: "b", name: "Other grocer", amount: 20, date: "2026-06-15", category: "FOOD_AND_DRINK", direction: "outflow" },
  ];
  const income = summarizeFilteredTransactions(
    filterTransactions(rows, { category: "INCOME" }),
  );
  assert.equal(income.count, 3);
  assert.equal(income.kind, "inflow");
  assert.equal(income.aggregateAmount, 1983.84);

  const spending = summarizeFilteredTransactions(
    filterTransactions(rows, { accountId: "a", category: "FOOD_AND_DRINK" }),
  );
  assert.deepEqual(
    { count: spending.count, kind: spending.kind, amount: spending.aggregateAmount },
    { count: 1, kind: "spending", amount: 80 },
  );

  const searched = summarizeFilteredTransactions(
    filterTransactions(rows, {
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      search: "payroll",
    }),
  );
  assert.equal(searched.count, 3);
  assert.equal(searched.aggregateAmount, 1983.84);

  const mixed = summarizeFilteredTransactions(
    filterTransactions(rows, {
      accountId: "a",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
    }),
  );
  assert.equal(mixed.kind, "mixed");
  assert.equal(mixed.aggregateAmount, 1903.84);
  assert.equal(mixed.identifiedInflows, 1983.84);
  assert.equal(mixed.identifiedOutflows, 80);
});

test("summary aggregation is independent of pagination and does not double count loaded rows", () => {
  const rows = Array.from({ length: 40 }, (_, index) => ({
    id: String(index),
    plaidAccountId: "a",
    accountLabel: "Checking • 1111",
    name: `Income ${index}`,
    amount: -10,
    currency: "USD",
    date: "2026-07-20",
    pending: false,
    pendingTransactionId: null,
    category: "INCOME",
    detailedCategory: null,
    direction: "inflow",
    transferRelationship: null,
  }));
  const full = summarizeFilteredTransactions(rows);
  const first = rows.slice(0, RECENT_ACTIVITY_PAGE_SIZE);
  const second = rows.slice(RECENT_ACTIVITY_PAGE_SIZE, RECENT_ACTIVITY_PAGE_SIZE * 2);
  const third = rows.slice(RECENT_ACTIVITY_PAGE_SIZE * 2, RECENT_ACTIVITY_PAGE_SIZE * 3);
  assert.equal(RECENT_ACTIVITY_PAGE_SIZE, 10);
  assert.equal(first.length, 10);
  assert.equal(second.length, 10);
  assert.equal(third.length, 10);
  assert.equal(new Set([...first, ...second, ...third].map((row) => row.id)).size, 30);
  assert.deepEqual([...first, ...second, ...third].map((row) => row.id), rows.slice(0, 30).map((row) => row.id));
  assert.equal(full.count, 40);
  assert.equal(full.aggregateAmount, 400);
  assert.deepEqual(summarizeFilteredTransactions(rows), full);
});

test("pending-only and empty filtered views remain explicit", () => {
  const pending = summarizeFilteredTransactions([{
    id: "pending",
    plaidAccountId: "a",
    accountLabel: "Checking • 1111",
    name: "Pending purchase",
    amount: 25,
    currency: "USD",
    date: "2026-07-20",
    pending: true,
    pendingTransactionId: null,
    category: "FOOD_AND_DRINK",
    detailedCategory: null,
    direction: "outflow",
    transferRelationship: null,
  }]);
  assert.equal(pending.count, 1);
  assert.equal(pending.kind, "mixed");
  assert.equal(pending.aggregateAmount, -25);
  assert.equal(summarizeFilteredTransactions([]).count, 0);
  const component = readFileSync("components/account/recent-activity.tsx", "utf8");
  assert.match(component, /No matching transactions/);
  assert.match(component, /rows\.length \? <FilteredSummary/);
});

test("Recent Activity sorts the complete filtered set deterministically before limiting", () => {
  const rows = [
    { id: "c", plaidAccountId: "a", accountLabel: "Checking", name: "Large", description: "Rent payment", amount: 1700, currency: "USD", date: "2026-07-29", pending: false, pendingTransactionId: null, category: "RENT_AND_UTILITIES", effectiveParentCategory: "Housing", effectiveSubcategory: "Rent", detailedCategory: null, direction: "outflow", transferRelationship: null },
    { id: "b", plaidAccountId: "a", accountLabel: "Checking", name: "Medium B", description: "Wine shop", amount: 176.43, currency: "USD", date: "2026-07-30", pending: false, pendingTransactionId: null, category: "FOOD_AND_DRINK", effectiveParentCategory: "Food & Drink", effectiveSubcategory: "Liquor", detailedCategory: null, direction: "outflow", transferRelationship: null },
    { id: "a", plaidAccountId: "a", accountLabel: "Checking", name: "Medium A", description: "Wine shop", amount: 176.43, currency: "USD", date: "2026-07-30", pending: false, pendingTransactionId: null, category: "FOOD_AND_DRINK", effectiveParentCategory: "Food & Drink", effectiveSubcategory: "Liquor", detailedCategory: null, direction: "outflow", transferRelationship: null },
    { id: "d", plaidAccountId: "b", accountLabel: "Card", name: "Small", description: "Corner store", amount: 12, currency: "USD", date: "2026-07-28", pending: false, pendingTransactionId: null, category: "GENERAL_MERCHANDISE", detailedCategory: null, direction: "outflow", transferRelationship: null },
  ];
  assert.deepEqual(sortTransactions(rows, "newest").map(({ id }) => id), ["a", "b", "c", "d"]);
  assert.deepEqual(sortTransactions(rows, "oldest").map(({ id }) => id), ["d", "c", "a", "b"]);
  assert.deepEqual(sortTransactions(rows, "highest").map(({ id }) => id), ["c", "a", "b", "d"]);
  assert.deepEqual(sortTransactions(rows, "lowest").map(({ id }) => id), ["d", "a", "b", "c"]);
  assert.deepEqual(
    filterTransactions(rows, {
      accountId: "a",
      category: "Food & Drink → Liquor",
      search: "wine",
      sort: "highest",
    }).map(({ id }) => id),
    ["a", "b"],
  );
  assert.deepEqual(sortTransactions(rows, "highest").slice(0, 2).map(({ id }) => id), ["c", "a"]);
});

test("Money Picture exposes one accessible sticky period control and a four-control activity toolbar", () => {
  const selector = readFileSync("components/account/financial-period-selector.tsx", "utf8");
  const activity = readFileSync("components/account/recent-activity.tsx", "utf8");
  const workspace = readFileSync("components/account/authenticated-workspace.tsx", "utf8");
  const css = readFileSync("components/account/money-picture.module.css", "utf8");
  const route = readFileSync("app/api/account/transactions/route.ts", "utf8");
  assert.match(selector, /aria-expanded=\{expanded\}/);
  assert.match(selector, /router\.push\(href, \{ scroll: false \}\)/);
  assert.match(selector, /Updating period/);
  assert.match(css, /\.periodSelector\{position:sticky;z-index:15;top:78px/);
  assert.match(css, /@media\(max-width:1050px\)\{\.periodSelector\{top:0\}\}/);
  assert.match(css, /@media\(max-width:600px\).*periodControlBar.*min-height:42px/s);
  assert.match(css, /\.categoryBackdrop\{position:fixed;z-index:1000/);
  assert.doesNotMatch(workspace, /<RecentActivity key=/);
  assert.match(activity, /Sort by/);
  assert.match(activity, /Newest first/);
  assert.match(activity, /Oldest first/);
  assert.match(activity, /Highest amount/);
  assert.match(activity, /Lowest amount/);
  assert.match(activity, /No matching transactions/);
  assert.match(activity, /filtersRef/);
  assert.match(route, /filterTransactions\(effectiveRows, body\.filters \|\| \{\}\)/);
  assert.match(css, /\.mp-filters\{display:grid;grid-template-columns:repeat\(4/);
  assert.match(css, /@media\(max-width:560px\).*\.mp-filters\{grid-template-columns:1fr\}/s);
});

test("Money Picture empty and partial states do not invent balances", () => {
  const workspace = readFileSync(new URL("../components/account/authenticated-workspace.tsx", import.meta.url), "utf8");
  const empty = buildMoneyPicture([], new Date("2026-07-22T00:00:00Z"));
  assert.equal(empty.spending, 0); assert.equal(empty.spendingByCategory.length, 0); assert.match(workspace, /currentBalance === null \? "Not available yet"/); assert.match(workspace, /valueOrUnavailable/);
});

test("transaction browsing remains authenticated, owner-scoped, cursor ordered, and read-only", () => {
  const route = readFileSync(new URL("../app/api/account/transactions/route.ts", import.meta.url), "utf8");
  assert.match(route, /if \(!user\).*401/s); assert.match(route, /\.eq\("user_id", user\.id\)/); assert.match(route, /\.is\("removed_at", null\)/); assert.match(route, /order\("transaction_date", \{ ascending: false \}\)\.order\("id", \{ ascending: false \}\)/); assert.doesNotMatch(route, /\.(insert|update|upsert|delete)\(/);
  assert.match(route, /slice\(start, start \+ RECENT_ACTIVITY_PAGE_SIZE\)/);
  const accountPage = readFileSync(new URL("../app/account/page.tsx", import.meta.url), "utf8");
  assert.match(accountPage, /activityRows\.slice\(0, RECENT_ACTIVITY_PAGE_SIZE\)/);
  const component = readFileSync(new URL("../components/account/recent-activity.tsx", import.meta.url), "utf8");
  assert.match(component, /id="recent-activity-heading">Recent activity</);
  assert.match(component, /Showing \$\{rows\.length\} of \$\{count\}/);
  assert.match(component, /new Map/);
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
  assert.equal(PLAID_CONSENT_VERSION, "plaid-production-consent-v2-2026-07-22");
  assert.equal(isCurrentPlaidConsentVersion(PLAID_CONSENT_VERSION), true);
  assert.equal(isCurrentPlaidConsentVersion("obsolete-consent-version"), false);
});

test("approved production deletion and retention periods are fixed", () => {
  assert.deepEqual({ deletion: ACCOUNT_DELETION_DAYS, backups: BACKUP_RETENTION_DAYS, webhooks: WEBHOOK_RETENTION_DAYS, syncJobs: SYNC_JOB_RETENTION_DAYS, auditYears: AUDIT_RETENTION_YEARS }, { deletion: 30, backups: 35, webhooks: 90, syncJobs: 30, auditYears: 7 });
});

test("production rollout requires both the global gate and exact UUID allowlist membership", async () => {
  const { assertProductionConnectionAllowed } = await import("../lib/plaid/production/config.ts");
  const disabled = readProductionPlaidConfig(productionEnvironment());
  assert.throws(() => assertProductionConnectionAllowed(disabled, "founder-user"), /not enabled/);
  const enabled = readProductionPlaidConfig({ ...productionEnvironment(), PLAID_PRODUCTION_CONNECTIONS_ENABLED: "true" });
  assert.throws(() => assertProductionConnectionAllowed(enabled, "different-user"), /not enabled for/);
  assert.doesNotThrow(() => assertProductionConnectionAllowed(enabled, "founder-user"));
});

test("authenticated founder can create Link tokens for additional production Plaid Items", () => {
  const route = readFileSync("app/api/plaid/production/create-link-token/route.ts", "utf8");
  assert.doesNotMatch(route, /PRODUCTION_ITEM_LIMIT_REACHED|assertFounderPilotItemLimit|hasProductionPlaidItem/);
  assert.match(route, /assertProductionConnectionAllowed\(config, profile\.userId\)/);
  assert.match(route, /createProductionLinkToken\(config, profile\)/);
});

test("Money Picture overview separates connected cash, credit debt, loans, and investments", () => {
  const summary = buildConnectedAccountSummary([
    { id: "cash", institution: "Bank A", type: "depository", subtype: "checking", currentBalance: 1200, availableBalance: 1000 },
    { id: "card", institution: "Bank A", type: "credit", subtype: "credit card", currentBalance: 350, availableBalance: 4650 },
    { id: "loan", institution: "Lender B", type: "loan", subtype: "student", currentBalance: 8000, availableBalance: null },
    { id: "brokerage", institution: "Broker C", type: "investment", subtype: "brokerage", currentBalance: 5000, availableBalance: null },
  ]);
  assert.equal(summary.availableCash, 1000);
  assert.equal(summary.creditCardDebt, 350);
  assert.equal(summary.otherDebt, 8000);
  assert.equal(summary.investments, 5000);
  assert.equal(summary.institutionCount, 3);
  assert.equal(summary.accountCount, 4);
});

test("available credit is never counted as cash and unknown balances remain unknown", () => {
  const creditOnly = buildConnectedAccountSummary([
    { id: "card", institution: "Bank", type: "credit", subtype: "credit card", currentBalance: 200, availableBalance: 9800 },
  ]);
  assert.equal(creditOnly.availableCash, null);
  assert.equal(creditOnly.creditCardDebt, 200);
  const partialCash = buildConnectedAccountSummary([
    { id: "known", institution: "Bank", type: "depository", subtype: "checking", currentBalance: 100, availableBalance: 90 },
    { id: "unknown", institution: "Bank", type: "depository", subtype: "savings", currentBalance: null, availableBalance: null },
  ]);
  assert.equal(partialCash.availableCash, null);
});

test("account labels are consumer-facing instead of raw Plaid account enums", () => {
  assert.equal(accountTypeLabel({ type: "depository", subtype: "checking" }), "Cash account");
  assert.equal(accountTypeLabel({ type: "credit", subtype: "credit card" }), "Credit card");
  assert.equal(accountTypeLabel({ type: "investment", subtype: "brokerage" }), "Investment");
});

test("Money Picture hierarchy keeps detail accessible and mobile layout explicit", async () => {
  const workspace = readFileSync(new URL("../components/account/authenticated-workspace.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../components/account/money-picture.module.css", import.meta.url), "utf8");
  const order = [
    "Money Picture overview",
    "<MoneyPictureObservations",
    "Money in and money out",
    "Accounts and obligations",
    "<RecentActivity",
    "Explore your financial life",
  ].map((text) => workspace.indexOf(text));
  assert.equal(order.every((position) => position >= 0), true);
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.match(workspace, /View all accounts/);
  assert.match(workspace, /All transactions/);
  assert.match(workspace, /Not available yet/);
  assert.doesNotMatch(workspace, /Total available balance/);
  assert.match(css, /@media\(max-width:560px\).*primaryMetrics\{grid-template-columns:1fr\}/s);
  assert.match(css, /overflow-x:auto/);
});

test("a section read failure does not collapse the entire Money Picture", () => {
  const page = readFileSync(new URL("../app/account/page.tsx", import.meta.url), "utf8");
  const workspace = readFileSync(new URL("../components/account/authenticated-workspace.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(page, /const readFailed = \[accounts\.error, transactions\.error, sync\.error\]/);
  assert.match(page, /sectionStatus: \{ accountsUnavailable: Boolean\(accounts\.error\), activityUnavailable: Boolean\(transactions\.error\), syncUnavailable: Boolean\(sync\.error\) \}/);
  assert.match(workspace, /What matters is temporarily unavailable/);
  assert.match(workspace, /Recent activity is temporarily unavailable/);
  assert.match(workspace, /Your connected accounts remain available/);
});

test("database schema removes the founder-era one-production-Item constraint", () => {
  const founderLimitMigration = readFileSync("supabase/migrations/20260722214000_founder_pilot_single_production_item.sql", "utf8");
  const multiItemMigration = readFileSync("supabase/migrations/20260729223000_allow_multiple_production_plaid_items.sql", "utf8");
  assert.match(founderLimitMigration, /create unique index if not exists plaid_items_one_production_per_user_idx/);
  assert.match(founderLimitMigration, /on public\.plaid_items \(user_id\)/);
  assert.match(founderLimitMigration, /where environment = 'production'/);
  assert.equal(multiItemMigration.trim(), "drop index if exists public.plaid_items_one_production_per_user_idx;");
});

test("connection recovery targets only the existing Item through Update Mode", () => {
  const route = readFileSync("app/api/plaid/production/items/[id]/update-link-token/route.ts", "utf8");
  const recovery = readFileSync("components/plaid/connection-recovery.tsx", "utf8");
  assert.match(route, /findOwnedItem\(id, profile\.userId\)/);
  assert.match(route, /access_token: accessToken/);
  assert.doesNotMatch(route, /publicTokenExchange|exchange-public-token|createConnection|insert\(/);
  assert.match(recovery, /if \(busy \|\| linkToken\) return/);
  assert.match(recovery, /items\/\$\{encodeURIComponent\(itemId\)\}\/update-link-token/);
  assert.match(recovery, /window\.location\.assign\("\/account\?connection=refreshed"\)/);
  assert.doesNotMatch(recovery, /exchange-public-token|public_token/);
});

test("Plaid Link diagnostics retain only bounded non-sensitive identifiers", () => {
  assert.deepEqual(sanitizeLinkDiagnostic({ event_name: "ERROR", error_code: "INSTITUTION_NOT_RESPONDING", error_type: "INSTITUTION_ERROR", institution_id: "ins_123", link_session_id: "session-123", request_id: "request-123", public_token: "must-not-be-retained", account: "must-not-be-retained" }), {
    eventName: "ERROR", errorCode: "INSTITUTION_NOT_RESPONDING", errorType: "INSTITUTION_ERROR", institutionId: "ins_123", linkSessionId: "session-123", requestId: "request-123",
  });
  assert.equal(sanitizeLinkDiagnostic({ event_name: "ERROR", error_code: "contains sensitive spaces" })?.errorCode, null);
  assert.equal(sanitizeLinkDiagnostic({ event_name: "" }), null);
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
  assert.deepEqual(deltas[0].added[0].rawCategory, { primary: "Shops", detailed: null, source: "legacy_category", legacy: ["Shops"] });
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
