import assert from "node:assert/strict";
import test from "node:test";

import {
  parseFinancialPeriodSelection,
  resolveFinancialPeriod,
  transactionInPeriod,
} from "../lib/financial-periods.ts";
import { buildCanonicalScopedFinancialMetrics } from "../lib/money-picture-canonical-metrics.ts";
import { buildMoneyPictureIntelligenceBundle } from "../lib/money-picture-intelligence-adapter.ts";
import { buildFinancialEventLayer } from "../lib/financial-events.ts";

const now = new Date("2026-07-27T15:00:00Z");

const expected = {
  "last-30-days": ["2026-06-28", "2026-07-27", "2026-05-29", "2026-06-27"],
  "last-60-days": ["2026-05-29", "2026-07-27", "2026-03-30", "2026-05-28"],
  "last-90-days": ["2026-04-29", "2026-07-27", "2026-01-29", "2026-04-28"],
  "last-6-months": ["2026-01-28", "2026-07-27", "2025-07-31", "2026-01-27"],
  "last-12-months": ["2025-07-28", "2026-07-27", "2024-07-28", "2025-07-27"],
  "this-month": ["2026-07-01", "2026-07-27", "2026-06-01", "2026-06-27"],
  "last-month": ["2026-06-01", "2026-06-30", "2026-05-01", "2026-05-31"],
  "this-quarter": ["2026-07-01", "2026-07-27", "2026-04-01", "2026-04-27"],
  "last-quarter": ["2026-04-01", "2026-06-30", "2026-01-01", "2026-03-31"],
  "year-to-date": ["2026-01-01", "2026-07-27", "2025-01-01", "2025-07-27"],
  "last-calendar-year": ["2025-01-01", "2025-12-31", "2024-01-01", "2024-12-31"],
};

for (const [key, [start, end, priorStart, priorEnd]] of Object.entries(expected)) {
  test(`${key} resolves to inclusive UTC boundaries`, () => {
    const period = resolveFinancialPeriod({ key }, now);
    assert.equal(period.start, start);
    assert.equal(period.end, end);
    assert.equal(period.priorStart, priorStart);
    assert.equal(period.priorEnd, priorEnd);
  });
}

test("leap-year and year boundaries remain valid", () => {
  assert.deepEqual(
    resolveFinancialPeriod(
      { key: "last-month" },
      new Date("2024-03-15T12:00:00Z"),
    ),
    {
      key: "last-month",
      label: "Last month",
      start: "2024-02-01",
      end: "2024-02-29",
      priorStart: "2024-01-01",
      priorEnd: "2024-01-31",
      asOf: "2024-03-15",
      futureKind: "preset",
    },
  );
  const lastYear = resolveFinancialPeriod(
    { key: "last-calendar-year" },
    new Date("2025-01-01T00:00:00Z"),
  );
  assert.equal(lastYear.start, "2024-01-01");
  assert.equal(lastYear.end, "2024-12-31");
});

test("rolling month ranges clamp safely at month and leap-year boundaries", () => {
  assert.equal(
    resolveFinancialPeriod(
      { key: "last-6-months" },
      new Date("2024-08-31T12:00:00Z"),
    ).start,
    "2024-02-29",
  );
  assert.equal(
    resolveFinancialPeriod(
      { key: "last-12-months" },
      new Date("2025-02-28T12:00:00Z"),
    ).start,
    "2024-02-29",
  );
});

test("custom ranges validate order, dates, and future boundaries", () => {
  const custom = resolveFinancialPeriod(
    { key: "custom", start: "2026-02-01", end: "2026-02-28" },
    now,
  );
  assert.equal(custom.start, "2026-02-01");
  assert.equal(custom.end, "2026-02-28");
  for (const selection of [
    { key: "custom", start: "2026-02-30", end: "2026-03-01" },
    { key: "custom", start: "2026-03-02", end: "2026-03-01" },
    { key: "custom", start: "2027-01-01", end: "2027-01-02" },
  ]) {
    assert.throws(() => resolveFinancialPeriod(selection, now));
  }
});

test("unknown query values default safely and empty periods stay empty", () => {
  assert.deepEqual(parseFinancialPeriodSelection({ period: "unknown" }), {
    key: "this-month",
  });
  const period = resolveFinancialPeriod({ key: "this-month" }, now);
  assert.equal(
    ["2026-06-30", "2026-07-28"].filter((date) =>
      transactionInPeriod(date, period),
    ).length,
    0,
  );
});

const row = (id, date, amount, category = "FOOD_AND_DRINK") => ({
  id,
  plaidAccountId: "account-a",
  accountLabel: "Checking • 1111",
  name: id,
  amount,
  currency: "USD",
  date,
  pending: false,
  pendingTransactionId: null,
  category,
  detailedCategory: null,
  direction: amount < 0 ? "inflow" : "outflow",
  transferRelationship: null,
});

test("one resolved period synchronizes canonical metrics, observations, explanations, and events", () => {
  const period = resolveFinancialPeriod({ key: "last-30-days" }, now);
  const rows = [
    row("current-income", "2026-07-20", -1000, "INCOME"),
    row("current-expense", "2026-07-10", 700),
    row("prior-income", "2026-06-15", -2000, "INCOME"),
    row("prior-expense", "2026-06-10", 600),
    row("outside", "2025-01-01", 900),
  ];
  const canonical = buildCanonicalScopedFinancialMetrics(rows, { now, period });
  assert.equal(canonical.currentRows.length, 2);
  assert.equal(canonical.priorRows.length, 2);
  assert.equal(canonical.metrics.period.currentStart, period.start);
  assert.equal(canonical.metrics.period.currentEnd, period.end);
  const bundle = buildMoneyPictureIntelligenceBundle(rows, {
    syncStatus: "complete",
    lastSyncAt: now.toISOString(),
    now,
    period,
  });
  const cashFlow = bundle.intelligence.observations.find(
    (observation) => observation.ruleId === "cashflow.material_change",
  );
  assert.ok(cashFlow);
  assert.equal(cashFlow.canonicalMetrics.period.currentStart, period.start);
  const explanation = bundle.explanations.find(
    (item) => item.observationId === cashFlow.observationId,
  );
  assert.deepEqual(explanation.canonicalMetrics, cashFlow.canonicalMetrics);
  const events = buildFinancialEventLayer(canonical.currentRows);
  const currentIds = new Set(
    canonical.currentRows.map((transaction) => transaction.id),
  );
  assert.equal(
    events.events.every((event) =>
      event.relatedTransactionIds.every((id) => currentIds.has(id)),
    ),
    true,
  );
  assert.equal(
    events.recurringPaymentReview.every((review) =>
      review.sourceTransactionIds.every((id) => currentIds.has(id)),
    ),
    true,
  );
});
