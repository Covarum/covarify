import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { resolveFinancialPeriod } from "../lib/financial-periods.ts";
import { buildCategoryIntelligence } from "../lib/category-intelligence.ts";
import { buildScopedMoneyPicture } from "../lib/money-picture.ts";

const row = (overrides = {}) => ({
  id: crypto.randomUUID(),
  plaidAccountId: "account-a",
  accountLabel: "TD Checking • 1234",
  name: "Example merchant",
  amount: 25,
  currency: "USD",
  date: "2026-07-10",
  pending: false,
  pendingTransactionId: null,
  category: "FOOD_AND_DRINK",
  detailedCategory: "FOOD_AND_DRINK_RESTAURANT",
  direction: "outflow",
  transferRelationship: null,
  ...overrides,
});

const period = resolveFinancialPeriod(
  { kind: "preset", key: "this-month" },
  new Date("2026-07-28T12:00:00Z"),
);

test("category total and shares reconcile with the canonical scoped snapshot", () => {
  const current = [
    row({ amount: 60 }),
    row({
      id: "second",
      plaidAccountId: "account-b",
      accountLabel: "TD Savings • 5678",
      amount: 40,
      category: "LOAN_PAYMENTS",
      detailedCategory: "LOAN_PAYMENTS_CAR_PAYMENT",
    }),
    row({ id: "pending", amount: 500, pending: true }),
    row({
      id: "transfer",
      amount: 300,
      category: "TRANSFER_OUT",
      transferRelationship: "external",
    }),
    row({ id: "refund", amount: -10, name: "Refund" }),
  ];
  const canonical = buildScopedMoneyPicture(current, [], period);
  const payload = buildCategoryIntelligence(current, [], period);
  assert.equal(payload.totalIdentifiedSpending, canonical.spending);
  assert.equal(payload.totalIdentifiedSpending, 100);
  assert.equal(payload.categories[0].currentShare, 60);
  assert.equal(
    payload.categories[0].meaning,
    "This was your largest identified spending category during the selected period.",
  );
  assert.equal(
    payload.categories[1].meaning,
    "Most identified activity came from one connected account.",
  );
  assert.equal(
    Math.round(
      payload.categories.reduce((sum, category) => sum + category.currentShare, 0),
    ),
    100,
  );
});

test("parent totals include assigned subcategories and uncategorized parent activity", () => {
  const period = { key: "custom", label: "July", start: "2026-07-01", end: "2026-07-31", priorStart: "2026-06-01", priorEnd: "2026-06-30" };
  const rows = [
    row({ id: "liquor", amount: 176.43, effectiveParentCategory: "Food & Drink", effectiveSubcategory: "Liquor" }),
    row({ id: "coffee", amount: 54.57, effectiveParentCategory: "Food & Drink", effectiveSubcategory: "Coffee" }),
    row({ id: "no-subcategory", amount: 100, effectiveParentCategory: "Food & Drink", effectiveSubcategory: null, detailedCategory: null }),
  ];
  const payload = buildCategoryIntelligence(rows, [], period, []);
  const food = payload.categories.find((category) => category.categoryId === "FOOD_AND_DRINK");
  assert.equal(food.currentAmount, 331);
  assert.deepEqual(food.subcategories.map(({ label, amount }) => ({ label, amount })), [
    { label: "Liquor", amount: 176.43 },
    { label: "Coffee", amount: 54.57 },
  ]);
});

test("prior comparisons avoid misleading zero baselines", () => {
  const current = [row({ amount: 100 })];
  const newlyAppeared = buildCategoryIntelligence(current, [], period).categories[0];
  assert.equal(newlyAppeared.comparison, "new");
  assert.equal(newlyAppeared.changePercentage, null);
  const compared = buildCategoryIntelligence(
    current,
    [row({ id: "prior", date: "2026-06-10", amount: 80 })],
    period,
  ).categories[0];
  assert.equal(compared.comparison, "increased");
  assert.equal(compared.changeAmount, 20);
  assert.equal(compared.changePercentage, 25);
});

test("account provenance is preserved with masked labels", () => {
  const payload = buildCategoryIntelligence(
    [
      row({ amount: 75 }),
      row({
        id: "other",
        amount: 25,
        plaidAccountId: "account-b",
        accountLabel: "TD Savings • 5678",
      }),
    ],
    [],
    period,
  );
  assert.deepEqual(
    payload.categories[0].accountDistribution.map((account) => [
      account.accountLabel,
      account.share,
    ]),
    [
      ["TD Checking • 1234", 75],
      ["TD Savings • 5678", 25],
    ],
  );
  assert.equal(JSON.stringify(payload).includes("account-a"), false);
});

test("food detail is source-backed and never fabricated without detail", () => {
  const detailed = buildCategoryIntelligence(
    [row({ amount: 50 }), row({ id: "unknown", amount: 20, detailedCategory: null })],
    [],
    period,
  ).categories[0];
  assert.deepEqual(detailed.subcategories.map((item) => item.label), ["Dining"]);
  assert.equal(detailed.subcategories[0].inferred, false);
});

test("Financial Events remain supporting evidence and user context stays distinct", async () => {
  const event = {
    id: "event-safe",
    categorySummary: ["FOOD_AND_DRINK"],
  };
  const payload = buildCategoryIntelligence(
    [row()],
    [],
    period,
    [event],
  );
  assert.equal(payload.categories[0].relatedEventCount, 1);
  const component = await readFile(
    new URL("../components/account/category-intelligence.tsx", import.meta.url),
    "utf8",
  );
  assert.match(component, /Category:<\/strong>/);
  assert.match(component, /Related event:<\/strong>/);
  assert.match(component, /User context:<\/strong>/);
});

test("category UI uses the safe separator, explicit total, keyboard buttons, and focus restoration", async () => {
  const [component, workspace, recent, css] = await Promise.all([
    readFile(
      new URL("../components/account/category-intelligence.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../components/account/authenticated-workspace.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../components/account/recent-activity.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../components/account/money-picture.module.css", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(component, /Total identified spending/);
  assert.match(component, /displaySeparated\(/);
  assert.match(component, /Transfers and pending activity excluded/);
  assert.doesNotMatch(`${component}${workspace}${recent}`, /Â|Ã|â€¢|·/);
  assert.match(component, /type="button"/);
  assert.match(component, /\.focus\(\)/);
  assert.match(component, /covarify:category-filter/);
  assert.match(recent, /covarify:category-filter/);
  assert.match(recent, /request\(null, next, true\)/);
  assert.match(css, /@media\(max-width:720px\)/);
  assert.match(css, /overflow:auto/);
});

test("category intelligence performs no Plaid call or production mutation", async () => {
  const sources = await Promise.all([
    readFile(new URL("../lib/category-intelligence.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../components/account/category-intelligence.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  const text = sources.join("\n");
  assert.doesNotMatch(text, /plaidClient|linkToken|transactionsSync|supabase|insert\(|update\(|delete\(/i);
});
