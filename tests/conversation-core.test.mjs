import test from "node:test";
import assert from "node:assert/strict";
import { orchestrateConversation } from "../lib/conversation/orchestrator.ts";
import { routeConversationIntent } from "../lib/conversation/intent-router.ts";
import { resolveConversationScope } from "../lib/conversation/scope-resolver.ts";
import { resolveConversationEntities } from "../lib/conversation/entity-resolver.ts";
import { validConversationContext } from "../lib/conversation/conversation-context.ts";
import { buildHousingGap, candidateLevers, confirmRecoveryPlan, generateRecoveryOptions, monitorPlan, proposeRecoveryPlan, rankFinancialPriority } from "../lib/conversation/financial-triage.ts";
import { competingGoalClarification } from "../lib/conversation/goals.ts";
import { assembleWholePicture } from "../lib/conversation/whole-picture.ts";
import { applyStrategyConstraints, recommendPersonalizedStrategy } from "../lib/conversation/strategy-engine.ts";
import { selectNextBestStep } from "../lib/conversation/next-best-step.ts";

const transaction = (overrides = {}) => ({ id: "tx-1", plaidAccountId: "account-1", accountLabel: "Capital One · 1234", merchantName: null, name: "OLU’KAI", description: "VISA DDA PUR AP 469216 SP AFF OLUKAI *", amount: 89, currency: "USD", date: "2026-01-10", pending: false, pendingTransactionId: null, category: "GENERAL_MERCHANDISE", sourceCategory: "GENERAL_MERCHANDISE", direction: "outflow", transferRelationship: null, ...overrides });
const request = (text, context = null) => ({ text, userId: "user-1", sessionId: "session-1", now: new Date("2026-08-03T12:00:00Z"), context, transactions: [transaction(), transaction({ id: "tx-2", amount: 110, date: "2026-02-10" }), transaction({ id: "refund", amount: -20, direction: "inflow", date: "2026-03-10", sourceCategory: "REFUND" })] });

test("all transaction questions use canonical deterministic intents", () => {
  assert.equal(routeConversationIntent("How many payments were made to OLU’KAI?").type, "transaction_count");
  assert.equal(routeConversationIntent("How much did I spend at OLU'KAI?").type, "transaction_total");
  assert.equal(routeConversationIntent("Show every OLU'KAI payment.").type, "transaction_list");
});

test("unspecified history ignores the Money Picture period", () => {
  assert.equal(resolveConversationScope("How many OLU’KAI payments were made?").type, "all_available_history");
  assert.equal(resolveConversationScope("How many this quarter?", new Date("2026-08-03T12:00:00Z")).type, "explicit_period");
});

test("noisy OLU'KAI descriptors count posted outflows and separate refunds", () => {
  const result = orchestrateConversation(request("How many payments were made to OLU’KAI?"));
  assert.equal(result.kind, "direct_answer");
  assert.equal(result.evidence.transactionIds.length, 2);
  assert.match(result.message, /2 payments/);
  assert.match(result.message, /refund was kept separate/);
});

test("account follow-up reuses the exact prior result", () => {
  const first = orchestrateConversation(request("How many payments were made to OLU’KAI?"));
  const followUp = orchestrateConversation(request("Which card did I use?", first.context));
  assert.equal(followUp.intent.type, "account_question");
  assert.match(followUp.message, /Capital One/);
  assert.equal(followUp.context.transactionIds.length, 2);
});

test("gift language resolves a person, never a business, and proposes without writing", () => {
  const entities = resolveConversationEntities("One was a birthday gift for Caleb.");
  assert.deepEqual(entities.map((entity) => entity.type), ["purpose", "person"]);
  const first = orchestrateConversation(request("How many payments were made to OLU’KAI?"));
  const ambiguous = orchestrateConversation(request("One was a birthday gift for Caleb.", first.context));
  assert.equal(ambiguous.kind, "clarification_question");
  const chosen = orchestrateConversation(request("The $89 one was a birthday gift for Caleb.", first.context));
  assert.equal(chosen.kind, "structured_proposal");
  assert.equal(chosen.proposal.confirmationRequired, true);
  assert.match(JSON.stringify(chosen.proposal.values), /Shopping → Gifts/);
});

test("expired or cross-user contexts are rejected", () => {
  const first = orchestrateConversation(request("How many payments were made to OLU’KAI?"));
  assert.equal(validConversationContext(first.context, "other-user", "session-1"), null);
  assert.equal(validConversationContext({ ...first.context, expiresAt: "2020-01-01T00:00:00Z" }, "user-1", "session-1", new Date("2026-08-03T12:00:00Z")), null);
});

test("business service context stays a proposal and makes no tax claim", () => {
  const result = orchestrateConversation({ ...request("Calendly is my booking app for Covarum."), transactions: [transaction({ id: "calendly", merchantName: "Calendly", name: "Calendly", description: "CALENDLY", amount: 16 })] });
  assert.equal(result.kind, "structured_proposal");
  assert.match(JSON.stringify(result.proposal.values), /Covarum/);
  assert.match(JSON.stringify(result.proposal.values), /Business → Software & Services/);
  assert.doesNotMatch(JSON.stringify(result), /deduct|tax/i);
});

test("partial rent keeps payment and obligation separate and clarifies missing gap facts", () => {
  const gap = buildHousingGap({ obligation: "The Heights rent", amountPaid: 1700, paymentType: "partial", evidenceIds: ["rent-payment"] });
  assert.equal(gap.amountPaid, 1700); assert.equal(gap.normalMonthlyAmount, null); assert.equal(gap.remainingAmount, null);
  assert.deepEqual(gap.missingInputs, ["normal monthly rent", "current amount outstanding"]);
  assert.equal(gap.estimatedShortfall, null);
});

test("urgent housing stability outranks optimization", () => {
  const gap = buildHousingGap({ obligation: "Rent", normalMonthlyRent: 2200, amountPaid: 1700, outstanding: 500, evidenceIds: ["rent"] });
  assert.equal(rankFinancialPriority({ housingGap: gap, daysUntilDue: 2, optimizationOnly: true }), "critical");
});

test("lever engine protects essentials, minimums, user constraints, and one-time expenses", () => {
  const candidates = [
    { key: "groceries", label: "Groceries", category: "Food", amount: 500, transactionIds: ["g"], flexibility: "protected_essential", recurring: true },
    { key: "minimum", label: "Card minimum", category: "Debt", amount: 100, transactionIds: ["m"], flexibility: "committed_obligation", recurring: true, requiredMinimum: true },
    { key: "callie", label: "Callie's activities", category: "Family", amount: 120, transactionIds: ["c"], flexibility: "discretionary", recurring: true },
    { key: "gift", label: "Birthday gift", category: "Shopping", amount: 89, transactionIds: ["gift"], flexibility: "unusual_one_time", recurring: false },
    { key: "uber-eats", label: "Uber Eats", category: "Food delivery", amount: 700, transactionIds: ["u1", "u2", "u3"], flexibility: "discretionary", recurring: true },
  ];
  const levers = candidateLevers(candidates, [{ kind: "protect", key: "callie", value: "Do not cut Callie's activities" }]);
  assert.deepEqual(levers.map((lever) => lever.label), ["Uber Eats"]);
  assert.equal(levers[0].estimatedAmount, 350); assert.deepEqual(levers[0].evidenceIds, ["u1", "u2", "u3"]);
});

test("option generation is evidence-bounded, constraint-aware, and does not invent three plans", () => {
  const gap = buildHousingGap({ obligation: "Rent catch-up", normalMonthlyRent: 2200, amountPaid: 1700, outstanding: 500, dueDate: "2026-09-01", evidenceIds: ["rent"] });
  const levers = candidateLevers([{ key: "uber", label: "Uber Eats", category: "Delivery", amount: 700, transactionIds: ["1", "2"], flexibility: "discretionary", recurring: true }, { key: "subs", label: "Optional subscriptions", category: "Subscriptions", amount: 50, transactionIds: ["3", "4"], flexibility: "potentially_cancellable", recurring: true }]);
  const options = generateRecoveryOptions(gap, levers, [{ kind: "deadline", key: "deadline", value: "2026-09-01" }]);
  assert.equal(options.length, 1); assert.ok(options[0].expectedContribution <= levers.reduce((sum, lever) => sum + lever.estimatedAmount, 0));
  assert.equal(options[0].targetDate, "2026-09-01");
});

test("recovery proposals cannot activate without durable confirmed persistence", () => {
  const gap = buildHousingGap({ obligation: "Rent", normalMonthlyRent: 2200, amountPaid: 1700, outstanding: 500, evidenceIds: ["rent"] });
  const proposal = proposeRecoveryPlan(gap, [], []); assert.equal(proposal.confirmed, false); assert.equal(proposal.activationBlocked, true);
  assert.throws(() => confirmRecoveryPlan(), /DURABLE_PLAN_PERSISTENCE_REQUIRED/);
});

test("monitoring uses actual activity, handles stale data, and offers calm adjustment", () => {
  const gap = buildHousingGap({ obligation: "Rent", normalMonthlyRent: 2200, amountPaid: 1700, outstanding: 500, evidenceIds: ["rent"] });
  assert.equal(monitorPlan({ gap, actualContribution: 100, expectedContribution: 200, stale: false }).status, "behind");
  assert.match(monitorPlan({ gap, actualContribution: 100, expectedContribution: 200, stale: false }).message, /adjustment|extend/i);
  assert.equal(monitorPlan({ gap, actualContribution: 100, expectedContribution: 200, stale: true }).status, "blocked_by_missing_data");
});

const goal = (overrides = {}) => ({ id: "goal-1", userId: "user-1", type: "housing_catch_up", label: "Catch up on rent", targetAmount: 500, targetDate: "2026-09-01", priority: 1, status: "confirmed", confirmedAt: "2026-08-03T12:00:00Z", evidenceIds: ["rent"], assumptions: [], ...overrides });
const situation = (overrides = {}) => assembleWholePicture({ userId: "user-1", accounts: [{ id: "cash", kind: "cash", currentBalance: 1200, availableBalance: 1000, minimumPayment: null, fresh: true }, { id: "card", kind: "credit", currentBalance: 2000, availableBalance: 3000, minimumPayment: 75, fresh: true }, { id: "invest", kind: "investment", currentBalance: 10000, availableBalance: null, minimumPayment: null, fresh: true }], expectedIncome: 1800, recentCashFlow: 100, protectedObligations: 1500, evidenceIds: ["cash", "income"], ...overrides });

test("whole-picture situation excludes investments and available credit from cash", () => {
  const current = situation(); assert.equal(current.availableCash, 1000); assert.equal(current.investmentsExcluded, 10000); assert.equal(current.requiredMinimums, 75);
});

test("unknown and stale whole-picture values lower confidence instead of becoming zero", () => {
  const current = assembleWholePicture({ userId: "user-1", accounts: [{ id: "cash", kind: "cash", currentBalance: null, availableBalance: null, minimumPayment: null, fresh: false }], evidenceIds: [] });
  assert.equal(current.availableCash, null); assert.equal(current.confidence, "low"); assert.deepEqual(current.staleAccountIds, ["cash"]);
});

test("generic strategy is rejected without a confirmed goal and whole-picture evidence", () => {
  assert.throws(() => recommendPersonalizedStrategy({ goal: goal({ status: "candidate", confirmedAt: null }), situation: situation(), options: [], constraints: [] }), /CONFIRMED_GOAL_REQUIRED/);
  assert.throws(() => recommendPersonalizedStrategy({ goal: goal(), situation: { ...situation(), evidenceIds: [] }, options: [], constraints: [] }), /EVIDENCE_BACKED_OPTIONS_REQUIRED|WHOLE_PICTURE_EVIDENCE_REQUIRED/);
});

test("competing unranked goals require one priority clarification", () => {
  assert.match(competingGoalClarification([goal({ priority: null }), goal({ id: "goal-2", type: "debt_payoff", label: "Pay off card", priority: null })]), /Which goal should come first/);
});

test("identical facts with different goals produce different strategy rankings", () => {
  const gap = buildHousingGap({ obligation: "Rent", normalMonthlyRent: 2200, amountPaid: 1700, outstanding: 500, evidenceIds: ["rent"] });
  const levers = candidateLevers([{ key: "delivery", label: "Delivery", category: "Food", amount: 700, transactionIds: ["d1", "d2"], flexibility: "discretionary", recurring: true }, { key: "subscriptions", label: "Subscriptions", category: "Subscriptions", amount: 100, transactionIds: ["s1", "s2"], flexibility: "potentially_cancellable", recurring: true }]);
  const options = generateRecoveryOptions(gap, levers);
  const housing = recommendPersonalizedStrategy({ goal: goal(), situation: situation(), options, constraints: [] });
  const reserve = recommendPersonalizedStrategy({ goal: goal({ id: "reserve", type: "emergency_reserve", label: "Build reserve" }), situation: situation(), options, constraints: [] });
  assert.notEqual(housing.whyHighest[0], reserve.whyHighest[0]); assert.equal(housing.genericAdviceRejected, true);
});

test("constraints materially remove protected levers and recalculate options", () => {
  const levers = candidateLevers([{ key: "delivery", label: "Delivery", category: "Food", amount: 700, transactionIds: ["d1", "d2"], flexibility: "discretionary", recurring: true }, { key: "gym", label: "Gym", category: "Subscription", amount: 50, transactionIds: ["g1", "g2"], flexibility: "potentially_cancellable", recurring: true }]);
  assert.equal(applyStrategyConstraints(levers, [{ kind: "protect", key: "gym", value: "Do not cancel the gym" }]).length, 1);
});

test("recommended strategies explain ranking, retain alternatives, and preserve protections", () => {
  const gap = buildHousingGap({ obligation: "Rent", normalMonthlyRent: 2200, amountPaid: 1700, outstanding: 300, evidenceIds: ["rent"] });
  const levers = candidateLevers([{ key: "delivery", label: "Delivery", category: "Food", amount: 700, transactionIds: ["d1", "d2"], flexibility: "discretionary", recurring: true }, { key: "subscriptions", label: "Subscriptions", category: "Subscriptions", amount: 100, transactionIds: ["s1", "s2"], flexibility: "potentially_cancellable", recurring: true }]);
  const options = generateRecoveryOptions(gap, levers, [{ kind: "protect", key: "groceries", value: "Groceries" }]);
  const strategy = recommendPersonalizedStrategy({ goal: goal({ targetAmount: 300 }), situation: situation(), options, constraints: [{ kind: "protect", key: "groceries", value: "Groceries" }] });
  assert.ok(strategy.whyHighest.length >= 2); assert.ok(strategy.alternatives.length >= 1); assert.deepEqual(strategy.protected, ["Groceries"]); assert.ok(strategy.tradeoffs.length);
});

test("every supported turn evaluates one primary next step and no-action is valid", () => {
  const result = orchestrateConversation(request("How many payments were made to OLU’KAI?")); assert.equal(typeof result.nextBestStep.type, "string");
  assert.equal(selectNextBestStep({}).type, "no_action"); assert.equal(selectNextBestStep({ stale: true }).type, "wait_for_data");
  assert.equal(selectNextBestStep({ optionsReady: true, priority: "urgent" }).type, "compare_options");
});

test("behind plans offer adjustment and mutating strategy steps require confirmation", () => {
  assert.equal(selectNextBestStep({ activePlanStatus: "behind" }).type, "adjust_plan"); assert.equal(selectNextBestStep({ activePlanStatus: "behind" }).confirmationRequired, true);
  assert.equal(selectNextBestStep({ strategyReady: true }).confirmationRequired, true);
});

test("strategy and next-step copy avoids shame, guarantees, tax, legal, and investment advice", () => {
  const copy = JSON.stringify([selectNextBestStep({ optionsReady: true }), selectNextBestStep({ activePlanStatus: "behind" })]);
  assert.doesNotMatch(copy, /lazy|failure|guarantee|deductible|legal conclusion|buy|sell/i);
});
