import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { generateInsightCandidates, rankInsightCandidates, runMoneyPictureIntelligence, buildCashFlowComparison } from "../lib/money-picture-intelligence.ts";
import { categoryFromPlaidTransaction, normalizePersistedPlaidCategory } from "../lib/plaid/category-normalization.ts";

const baseMetrics = (patch = {}) => ({ generatedAt: "2026-07-23T12:00:00.000Z", period: { currentStart: "2026-06-23", currentEnd: "2026-07-23", priorStart: "2026-05-24", priorEnd: "2026-06-22" }, transactionCount: 100, pendingCount: 0, removedCount: 0, transferCount: 0, internalTransferCount: 0, identifiedInflows: 1000, identifiedOutflows: 900, priorInflows: 1000, priorOutflows: 900, largestExpense: 100, uncategorizedOutflow: 0, categorizedOutflow: 900, completeMonths: [], accounts: [{ id: "account-a", label: "Checking • 1111", transactionCount: 50, identifiedInflows: 500, identifiedOutflows: 450, spendingShare: .5, depositShare: .5, transferCount: 0, currentBalance: null, availableBalance: null, lastActivityDate: "2026-07-22" }, { id: "account-b", label: "Savings • 2222", transactionCount: 50, identifiedInflows: 500, identifiedOutflows: 450, spendingShare: .5, depositShare: .5, transferCount: 0, currentBalance: null, availableBalance: null, lastActivityDate: "2026-07-21" }], syncStatus: "complete", lastSyncAt: "2026-07-23T11:00:00.000Z", ...patch });

test("engine supports zero, one, two, and three primary observation states without filler", () => {
  const zero = runMoneyPictureIntelligence(baseMetrics()); assert.equal(zero.observations.length, 0); assert.match(zero.stableMessage, /stable today/);
  const dominant = [{ ...baseMetrics().accounts[0], transactionCount: 90, identifiedOutflows: 810, spendingShare: .9 }, { ...baseMetrics().accounts[1], transactionCount: 10, identifiedOutflows: 90, spendingShare: .1 }];
  const one = runMoneyPictureIntelligence(baseMetrics({ accounts: dominant })); assert.equal(one.observations.length, 1);
  const two = runMoneyPictureIntelligence(baseMetrics({ accounts: dominant, identifiedInflows: 200, identifiedOutflows: 1200, priorInflows: 1500, priorOutflows: 500 })); assert.equal(two.observations.length, 2);
  const incomplete = runMoneyPictureIntelligence(baseMetrics({ uncategorizedOutflow: 800, categorizedOutflow: 400, accounts: dominant, identifiedInflows: 200, identifiedOutflows: 1200, priorInflows: 1500, priorOutflows: 500 })); assert.equal(incomplete.observations.length, 1); assert.equal(incomplete.rejected.some((item) => item.ruleId === "cashflow.material_change" && item.reason === "confidence_below_threshold"), true);
  const three = runMoneyPictureIntelligence(baseMetrics({ uncategorizedOutflow: 0, categorizedOutflow: 1200, accounts: dominant, identifiedInflows: 200, identifiedOutflows: 1200, priorInflows: 1500, priorOutflows: 500, largestExpense: 300 })); assert.equal(three.observations.length, 3);
});

test("critical alert requires strict stale-sync urgency threshold", () => {
  const result = runMoneyPictureIntelligence(baseMetrics({ lastSyncAt: "2026-07-14T12:00:00.000Z" })); assert.equal(result.criticalAlert?.ruleId, "stability.sync_stale"); assert.equal(result.criticalAlert?.dimensions.urgency >= .9, true);
  const recent = runMoneyPictureIntelligence(baseMetrics({ lastSyncAt: "2026-07-21T12:00:00.000Z", syncStatus: "pending" })); assert.equal(recent.criticalAlert, null);
});

test("ranking is deterministic and confidence and score thresholds reject weak candidates", () => {
  const source = generateInsightCandidates(baseMetrics({ uncategorizedOutflow: 800, categorizedOutflow: 100 }))[0]; const weakConfidence = { ...source, ruleId: "weak-confidence", confidence: .4 }; const weakScore = { ...source, ruleId: "weak-score", score: 20 }; const strong = { ...source, ruleId: "strong", score: 90 };
  const first = rankInsightCandidates([weakScore, strong, weakConfidence], [], baseMetrics().generatedAt); const second = rankInsightCandidates([weakScore, strong, weakConfidence], [], baseMetrics().generatedAt); assert.deepEqual(first, second); assert.deepEqual(first.eligible.map((item) => item.ruleId), ["strong"]); assert.deepEqual(first.rejected.map((item) => item.reason).sort(), ["confidence_below_threshold", "score_below_threshold"]);
});

test("unchanged recently shown observations are suppressed but changed signatures remain eligible", () => {
  const dominant = [{ ...baseMetrics().accounts[0], transactionCount: 90, identifiedOutflows: 810, spendingShare: .9 }, { ...baseMetrics().accounts[1], transactionCount: 10, identifiedOutflows: 90, spendingShare: .1 }];
  const result = runMoneyPictureIntelligence(baseMetrics({ accounts: dominant })); const shown = result.observations[0]; const suppressed = runMoneyPictureIntelligence(baseMetrics({ accounts: dominant }), [{ observationId: shown.observationId, conditionSignature: shown.conditionSignature, shownAt: "2026-07-22T12:00:00.000Z" }]); assert.equal(suppressed.observations.length, 0); const changedAccounts = dominant.map((account, index) => ({ ...account, spendingShare: index === 0 ? .75 : .25 })); const changed = runMoneyPictureIntelligence(baseMetrics({ accounts: changedAccounts }), [{ observationId: shown.observationId, conditionSignature: shown.conditionSignature, shownAt: "2026-07-22T12:00:00.000Z" }]); assert.equal(changed.observations.length, 1);
});

test("account provenance is retained and combined metrics receive transfer-excluded aggregates", () => {
  const candidates = generateInsightCandidates(baseMetrics({ uncategorizedOutflow: 800, categorizedOutflow: 100, transferCount: 4, internalTransferCount: 2, accounts: [{ ...baseMetrics().accounts[0], spendingShare: .9, identifiedOutflows: 810, transactionCount: 90 }, { ...baseMetrics().accounts[1], spendingShare: .1, identifiedOutflows: 90, transactionCount: 10 }] })); const accountCandidate = candidates.find((item) => item.ruleId === "account.outflow_concentration"); assert.deepEqual(accountCandidate.accountScope, ["account-a"]); assert.equal(accountCandidate.aggregates.spendingShare, .9);
});

test("savings observation requires multiple positive complete months and never recommends an amount", () => {
  const insufficient = generateInsightCandidates(baseMetrics({ completeMonths: [{ inflow: 2000, outflow: 1000 }] })); assert.equal(insufficient.some((item) => item.ruleId.startsWith("savings.")), false);
  const twoMonths = generateInsightCandidates(baseMetrics({ completeMonths: [{ inflow: 2000, outflow: 1000 }, { inflow: 1800, outflow: 1200 }] })); assert.equal(twoMonths.some((item) => item.ruleId.startsWith("savings.")), false);
  const sufficient = generateInsightCandidates(baseMetrics({ identifiedInflows: 1500, identifiedOutflows: 900, completeMonths: [{ inflow: 2000, outflow: 1000 }, { inflow: 1800, outflow: 1200 }, { inflow: 1700, outflow: 1100 }] })).find((item) => item.ruleId === "savings.surplus_observed"); assert.ok(sufficient); assert.match(sufficient.qualification, /Observation only/); assert.doesNotMatch(`${sufficient.title} ${sufficient.observed} ${sufficient.meaning}`, /you should|safe amount|you can afford/i);
});

test("empty and partial datasets are stable and null balances never become zero", () => {
  const empty = runMoneyPictureIntelligence(baseMetrics({ transactionCount: 0, identifiedInflows: 0, identifiedOutflows: 0, priorInflows: 0, priorOutflows: 0, accounts: [] })); assert.equal(empty.observations.length, 0); assert.ok(empty.stableMessage);
  const partial = generateInsightCandidates(baseMetrics({ accounts: [{ ...baseMetrics().accounts[0], currentBalance: null, availableBalance: null }], uncategorizedOutflow: 800, categorizedOutflow: 100 })); assert.equal(partial.every((item) => Object.values(item.aggregates).every((value) => value !== undefined)), true);
});

test("incomplete categorization is a quiet data-quality status, not a ranked observation", () => {
  const result = runMoneyPictureIntelligence(baseMetrics({ identifiedOutflows: 900, uncategorizedOutflow: 800, categorizedOutflow: 100 }));
  assert.equal(result.observations.some((item) => item.ruleId === "data.category_coverage"), false);
  assert.equal(result.dataQualityStatus?.title, "Covarify is still organizing your spending");
  assert.doesNotMatch(result.dataQualityStatus?.body || "", /provide|missing from you|failed/i);
});

test("Plaid category provenance is preserved and legacy string rows remain readable", () => {
  assert.deepEqual(categoryFromPlaidTransaction({
    personal_finance_category: { primary: "FOOD_AND_DRINK", detailed: "FOOD_AND_DRINK_RESTAURANT" },
    category: ["Food and Drink", "Restaurants"],
  }), {
    primary: "FOOD_AND_DRINK",
    detailed: "FOOD_AND_DRINK_RESTAURANT",
    source: "personal_finance_category",
    legacy: ["Food and Drink", "Restaurants"],
  });
  assert.deepEqual(normalizePersistedPlaidCategory("FOOD_AND_DRINK"), {
    primary: "FOOD_AND_DRINK",
    detailed: null,
    source: "legacy_persisted_primary",
    legacy: null,
  });
});

test("cash-flow comparison handles positive decline and positive-to-negative change", () => {
  const positive = buildCashFlowComparison(baseMetrics({ identifiedInflows: 2000, identifiedOutflows: 1000, priorInflows: 3000, priorOutflows: 1000 }));
  assert.equal(positive.currentNet, 1000); assert.equal(positive.priorNet, 2000); assert.equal(positive.absoluteChange, 1000); assert.equal(positive.percentageChange, 50); assert.equal(positive.currentPositive, true);
  const negative = buildCashFlowComparison(baseMetrics({ identifiedInflows: 800, identifiedOutflows: 1200, priorInflows: 2000, priorOutflows: 1000 }));
  assert.equal(negative.currentNet, -400); assert.equal(negative.priorNet, 1000); assert.equal(negative.absoluteChange, 1400); assert.equal(negative.percentageChange, 140); assert.equal(negative.currentPositive, false);
  const candidate = generateInsightCandidates(baseMetrics({ identifiedInflows: 800, identifiedOutflows: 1200, priorInflows: 2000, priorOutflows: 1000 })).find((item) => item.ruleId === "cashflow.material_change");
  assert.match(candidate.observed, /identified net cash flow was approximately/); assert.match(candidate.support, /identified inflows.*identified outflows.*net/i); assert.match(candidate.meaning, /spending exceeded identified inflows/i);
});

test("cash-flow comparison omits misleading percentages for zero or negative baselines", () => {
  const zero = buildCashFlowComparison(baseMetrics({ priorInflows: 1000, priorOutflows: 1000 })); assert.equal(zero.percentageChange, null);
  const negative = buildCashFlowComparison(baseMetrics({ priorInflows: 500, priorOutflows: 1000 })); assert.equal(negative.percentageChange, null);
});

test("observation UI provides session dismissal, selectable prompts, and stable-picture copy", () => {
  const source = readFileSync(new URL("../components/account/money-picture-observations.tsx", import.meta.url), "utf8");
  assert.match(source, /useState<Set<string>>/); assert.match(source, /Dismiss .* for this session/); assert.match(source, /user-select:text|question/); assert.match(source, /Your financial picture is stable today/); assert.doesNotMatch(source, /Top 3/);
});
