import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  answerObservationQuestion,
  buildObservationExplanation,
} from "../lib/money-picture-explanations.ts";
import { buildMoneyPictureIntelligenceBundle } from "../lib/money-picture-intelligence-adapter.ts";

const observation = (ruleId, accountScope = ["account-a", "account-b"]) => ({
  ruleId,
  observationId: `${ruleId}:scope:2026-07-23`,
  conditionSignature: "condition",
  title:
    ruleId === "cashflow.material_change"
      ? "Your identified cash flow declined"
      : "Most spending activity runs through one account",
  observed: "Observed aggregate.",
  meaning: "Meaning.",
  period: "June 23 through July 23, 2026",
  support: "Supporting aggregate.",
  qualification: "High confidence.",
  question: "What changed?",
  accountScope,
  aggregates: {},
  confidence: .9,
  score: 80,
  critical: false,
  generatedAt: "2026-07-23T12:00:00.000Z",
  expiresAt: "2026-07-30T12:00:00.000Z",
  reevaluateWhen: "Metrics change",
  dimensions: {
    impact: .8,
    urgency: .5,
    confidence: .9,
    usefulness: .8,
    relevance: .8,
    novelty: 1,
    actionability: .7,
    completeness: 1,
  },
});

const row = (patch = {}) => ({
  id: crypto.randomUUID(),
  plaidAccountId: "account-a",
  accountLabel: "Checking • 1111",
  name: "Merchant",
  amount: 50,
  currency: "USD",
  date: "2026-07-10",
  pending: false,
  pendingTransactionId: null,
  category: "FOOD_AND_DRINK",
  detailedCategory: null,
  direction: "outflow",
  transferRelationship: null,
  ...patch,
});

const transactions = [
  row({ id: "current-food-1", name: "Cafe", amount: 300 }),
  row({ id: "current-food-2", name: "Cafe", amount: 200, date: "2026-07-11" }),
  row({ id: "current-travel", name: "Travel merchant", amount: 400, category: "TRAVEL" }),
  row({ id: "current-income", name: "Deposit", amount: -700, category: "INCOME" }),
  row({ id: "current-transfer", name: "Transfer", amount: 250, category: "TRANSFER_OUT", transferRelationship: "external" }),
  row({ id: "prior-food", name: "Cafe", amount: 100, date: "2026-06-10" }),
  row({ id: "prior-income", name: "Deposit", amount: -1400, category: "INCOME", date: "2026-06-12" }),
  row({ id: "account-b", plaidAccountId: "account-b", accountLabel: "Savings • 2222", amount: 40 }),
];

test("cash-flow explanation payload is deterministic, separated, and aggregate-only", () => {
  const first = buildObservationExplanation(
    observation("cashflow.material_change"),
    transactions,
  );
  const second = buildObservationExplanation(
    observation("cashflow.material_change"),
    transactions,
  );
  assert.deepEqual(first, second);
  assert.ok(first.supportingMetrics.length >= 4);
  assert.ok(first.supportingCategories.length);
  assert.ok(first.supportingMerchants.length);
  assert.ok(first.explanationBullets.length);
  assert.equal(first.supportedQuestions.length, 5);
  assert.equal(first.signals.unusualIncomeChange.flagged, true);
  assert.ok(first.signals.unusualSpending.length);
  assert.equal(first.signals.largestExpense, 400);
  assert.equal(
    first.supportingTransactions.every(
      (group) =>
        !Object.hasOwn(group, "name") &&
        !Object.hasOwn(group, "description") &&
        !Object.hasOwn(group, "transactionId"),
    ),
    true,
  );
});

test("cash-flow supported questions resolve only through deterministic adapters", () => {
  const payload = buildObservationExplanation(
    observation("cashflow.material_change"),
    transactions,
  );
  for (const question of payload.supportedQuestions) {
    const answer = answerObservationQuestion(payload, question.id);
    assert.ok(answer);
    assert.ok(answer.evidence.length || question.id === "merchants_increased");
    assert.doesNotMatch(
      `${answer.answer} ${answer.qualification}`,
      /\byou should\b|investment advice|tax strategy|borrow/i,
    );
  }
  assert.equal(answerObservationQuestion(payload, "free_form_question"), null);
});

test("operating-account payload retains provenance and avoids account-switch recommendations", () => {
  const accountRows = [
    row({ id: "bill-1", date: "2026-06-25", name: "Utility", amount: 100 }),
    row({ id: "bill-2", date: "2026-07-20", name: "Utility", amount: 105 }),
    row({ id: "income-1", date: "2026-06-26", name: "Payroll", amount: -1000, category: "INCOME" }),
    row({ id: "income-2", date: "2026-07-21", name: "Payroll", amount: -1000, category: "INCOME" }),
    row({ id: "other", plaidAccountId: "account-b", accountLabel: "Savings • 2222", amount: 25 }),
  ];
  const payload = buildObservationExplanation(
    observation("account.outflow_concentration", ["account-a"]),
    accountRows,
  );
  assert.equal(payload.accountScope[0], "account-a");
  assert.equal(payload.supportingAccounts[0].label, "Checking • 1111");
  assert.equal(payload.supportingAccounts[0].recurringBillCount, 1);
  assert.equal(payload.supportingAccounts[0].recurringDepositCount, 1);
  const move = answerObservationQuestion(payload, "move_bills");
  assert.match(move.answer, /cannot reliably estimate/);
  assert.doesNotMatch(move.answer, /\byou should\b/i);
  const bills = answerObservationQuestion(payload, "bills_from_account");
  assert.match(bills.evidence[0], /Utility/);
});

test("conversation UI is contextual and contains no general-purpose chat input", () => {
  const source = readFileSync(
    new URL(
      "../components/account/money-picture-observations.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(source, /activeExplanation/);
  assert.match(source, /supportedQuestions/);
  assert.match(source, /answerObservationQuestion/);
  assert.match(source, /Understand this/);
  assert.doesNotMatch(source, /Ask Covarify/);
  assert.doesNotMatch(source, /<input|<textarea|contentEditable/);
});

test("guided explanation precedes bounded follow-up options and restores focus", () => {
  const source = readFileSync(
    new URL(
      "../components/account/money-picture-observations.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.ok(source.indexOf("<GuidedExplanation") < source.indexOf("supportedQuestions.map"));
  assert.match(source, /triggerRef\.current\?\.focus/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /event\.key !== "Tab"/);
  assert.match(source, /aria-modal="true"/);
});

test("each live rule exposes only its approved guided questions", () => {
  const cashFlow = buildObservationExplanation(
    observation("cashflow.material_change"),
    transactions,
  );
  assert.deepEqual(
    cashFlow.supportedQuestions.map((question) => question.id),
    [
      "income_change",
      "spending_change",
      "categories_changed",
      "one_purchase",
      "compare_periods",
    ],
  );
  const account = buildObservationExplanation(
    observation("account.outflow_concentration"),
    transactions,
  );
  assert.deepEqual(
    account.supportedQuestions.map((question) => question.id),
    [
      "income_to_account",
      "bills_from_account",
      "operating_account",
      "move_bills",
      "recommendation_needs",
    ],
  );
  assert.equal(answerObservationQuestion(cashFlow, "unsupported"), null);
});

test("guided cash-flow driver is deterministic and account role stays inferred", () => {
  const cashFlow = buildObservationExplanation(
    observation("cashflow.material_change"),
    transactions,
  );
  const comparison = answerObservationQuestion(cashFlow, "compare_periods");
  const inflowChange = Math.abs(
    cashFlow.supportingMetrics.find((metric) => metric.key === "inflows")
      .change,
  );
  const outflowChange = Math.abs(
    cashFlow.supportingMetrics.find((metric) => metric.key === "outflows")
      .change,
  );
  assert.match(
    comparison.answer,
    inflowChange > outflowChange
      ? /identified inflows/
      : /identified outflows/,
  );
  const account = buildObservationExplanation(
    observation("account.outflow_concentration"),
    transactions,
  );
  const usage = answerObservationQuestion(account, "operating_account");
  assert.match(usage.answer, /inferred, not assigned/);
  assert.doesNotMatch(usage.answer, /\byou should\b|best|optimal/i);
});

test("guided UX remains responsive, makes zero external LLM calls, and performs no mutation", () => {
  const component = readFileSync(
    new URL(
      "../components/account/money-picture-observations.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const styles = readFileSync(
    new URL(
      "../components/account/money-picture-observations.module.css",
      import.meta.url,
    ),
    "utf8",
  );
  const explanation = readFileSync(
    new URL("../lib/money-picture-explanations.ts", import.meta.url),
    "utf8",
  );
  assert.match(styles, /@media\(max-width:480px\)/);
  assert.doesNotMatch(
    `${component}\n${explanation}`,
    /openai|anthropic|chat\/completions|responses\.create|fetch\(/i,
  );
  assert.doesNotMatch(
    `${component}\n${explanation}`,
    /\.insert\(|\.update\(|\.delete\(|\.upsert\(|transactions\/sync/i,
  );
});

test("comparison periods use inclusive UTC calendar-day boundaries", () => {
  const boundaryRows = [
    row({ id: "current-boundary", date: "2026-06-23", amount: 100 }),
    row({ id: "prior-boundary", date: "2026-05-24", amount: 200 }),
  ];
  const payload = buildObservationExplanation(
    observation("cashflow.material_change"),
    boundaryRows,
  );
  const outflows = payload.supportingMetrics.find(
    (metric) => metric.key === "outflows",
  );
  assert.equal(outflows.current, 100);
  assert.equal(outflows.prior, 200);
});

test("observation, explanation, and comparison response share canonical headline metrics", () => {
  const { intelligence, explanations } =
    buildMoneyPictureIntelligenceBundle(transactions, {
      syncStatus: "complete",
      lastSyncAt: "2026-07-23T11:00:00.000Z",
      now: new Date("2026-07-23T12:00:00.000Z"),
    });
  const card = intelligence.observations.find(
    (item) => item.ruleId === "cashflow.material_change",
  );
  const panel = explanations.find(
    (item) => item.observationId === card.observationId,
  );
  assert.ok(card.canonicalMetrics);
  assert.deepEqual(panel.canonicalMetrics, card.canonicalMetrics);
  const canonical = card.canonicalMetrics;
  assert.equal(card.aggregates.currentInflows, canonical.current.inflows);
  assert.equal(card.aggregates.currentOutflows, canonical.current.outflows);
  assert.equal(card.aggregates.currentNet, canonical.current.net);
  assert.equal(card.aggregates.priorInflows, canonical.prior.inflows);
  assert.equal(card.aggregates.priorOutflows, canonical.prior.outflows);
  assert.equal(card.aggregates.priorNet, canonical.prior.net);
  assert.equal(card.aggregates.absoluteChange, canonical.absoluteChange);
  assert.equal(
    panel.supportingMetrics.find((item) => item.key === "inflows").current,
    canonical.current.inflows,
  );
  assert.equal(
    panel.supportingMetrics.find((item) => item.key === "outflows").current,
    canonical.current.outflows,
  );
  assert.equal(
    panel.supportingMetrics.find((item) => item.key === "net_cash_flow").current,
    canonical.current.net,
  );
  assert.equal(panel.period, card.period);
  assert.match(card.period, /June 23 through July 23, 2026/);
  assert.match(card.period, /May 24 through June 22, 2026/);
  const comparison = answerObservationQuestion(panel, "compare_periods");
  const displayMoney = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  assert.ok(
    comparison.evidence.join(" ").includes(displayMoney(canonical.prior.net)),
  );
  assert.ok(
    comparison.evidence.join(" ").includes(displayMoney(canonical.current.net)),
  );
});
