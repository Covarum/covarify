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
import { readFileSync } from "node:fs";
import { isFounderAdmin } from "../lib/waitlist-core.ts";
import { assessVoiceTurn, resolveMerchantCorrection, transcriptNeedsExplicitReview } from "../lib/conversation/transcript-review.ts";

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

test("fixture mode identifies simulated data without changing connected answer semantics", () => {
  const fixture = orchestrateConversation({ ...request("How many payments were made to OLU’KAI?"), dataMode: "fixture" });
  const connected = orchestrateConversation(request("How many payments were made to OLU’KAI?"));
  assert.match(fixture.message, /^In this test scenario, I found 2 OLU’KAI payments totaling \$199\.00\./);
  assert.doesNotMatch(fixture.message, /connected history/i);
  assert.match(connected.message, /currently available|available history/i);
});

test("sensitive or uncertain voice transcripts always require explicit review", () => {
  for (const transcript of ["The eighty-nine dollar one was a birthday gift for Caleb.", "My son.", "Use the card ending in 4242", "Confirm that change", "Catch up by September 1"]) assert.equal(transcriptNeedsExplicitReview(transcript, 0.99), true);
  assert.equal(transcriptNeedsExplicitReview("Which card did I use?", 0.5), true);
});

test("safe final read-only voice questions are eligible for transport auto-send", () => {
  const result = assessVoiceTurn({ transcript: "How many payments were made to OLU’KAI?", confidence: 0.96, pendingProposal: false, knownMerchants: ["OLU’KAI"] });
  assert.equal(result.autoSend, true); assert.equal(result.reviewRequired, false);
  assert.equal(assessVoiceTurn({ transcript: "Which card did I use?", confidence: 0.94, pendingProposal: false }).autoSend, true);
});

test("uncertain merchants, retries, concatenation, and consequential confirmations stay held", () => {
  const correction = assessVoiceTurn({ transcript: "How many payments were made to elujay?", confidence: 0.97, pendingProposal: false, knownMerchants: ["OLU’KAI"] });
  assert.equal(correction.autoSend, false); assert.equal(correction.correction.canonical, "OLU’KAI"); assert.match(correction.correction.correctedTranscript, /OLU’KAI/);
  const alternate = assessVoiceTurn({ transcript: "How many payments were made to ukulele?", confidence: 0.42, pendingProposal: false, knownMerchants: ["OLU’KAI"] });
  assert.equal(alternate.autoSend, false); assert.equal(alternate.correction.heard, "ukulele"); assert.equal(alternate.correction.canonical, "OLU’KAI");
  assert.equal(assessVoiceTurn({ transcript: "How many payments were made to OLU’KAI? How many payments were made to OLU’KAI?", confidence: 0.98, pendingProposal: false }).autoSend, false);
  assert.equal(assessVoiceTurn({ transcript: "Which card did I use?", confidence: 0.98, pendingProposal: false, lastSubmittedTranscript: "Which card did I use?" }).autoSend, false);
  for (const transcript of ["Yes", "Yes, classify it.", "Use that plan.", "Remember Caleb is my son.", "Move the money."]) assert.equal(assessVoiceTurn({ transcript, confidence: 0.99, pendingProposal: true }).autoSend, false);
});

test("merchant correction is bounded, phonetic, generalized, and ambiguity-safe", () => {
  const known = ["OLU’KAI"];
  for (const heard of ["elujay", "ukulele", "eulogy", "olukai", "olu kai", "ooh-luh-kai", "oolooguy"]) {
    const correction = resolveMerchantCorrection(`How many payments were made to ${heard}?`, known);
    assert.equal(correction?.heard, heard); assert.equal(correction?.canonical, "OLU’KAI"); assert.match(correction?.correctedTranscript || "", /OLU’KAI/);
  }
  assert.equal(resolveMerchantCorrection("How many payments were made to eulogy?", ["OLU’KAI", "Eulogy"]), null);
  assert.equal(resolveMerchantCorrection("How many payments were made to something unrelated?", known), null);
});

test("account follow-up reuses the exact prior result", () => {
  const first = orchestrateConversation(request("How many payments were made to OLU’KAI?"));
  const followUp = orchestrateConversation(request("Which card did I use?", first.context));
  assert.equal(followUp.intent.type, "account_question");
  assert.match(followUp.message, /Capital One/);
  assert.equal(followUp.context.transactionIds.length, 2);
  assert.equal(followUp.message, "You used Capital One ending in 1234 for 2 payments.");
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
  assert.equal(chosen.nextBestStep.type, "review_transaction");
  assert.match(chosen.nextBestStep.label, /transaction update/);
  assert.equal(chosen.proposal.memoryCandidate, undefined);
});

test("person relationship memory is a separate user-scoped confirmation proposal", () => {
  const first = orchestrateConversation(request("How many payments were made to OLU’KAI?"));
  const gift = orchestrateConversation(request("The $89 one was a birthday gift for Caleb.", first.context));
  assert.match(gift.message, /Who is Caleb/); assert.equal(gift.proposal.memoryCandidate, undefined);
  const relationship = orchestrateConversation(request("My son.", gift.context));
  assert.equal(relationship.kind, "structured_proposal"); assert.equal(relationship.proposal.title, "Proposed person relationship");
  assert.deepEqual(relationship.proposal.values, [{ label: "Person", value: "Caleb" }, { label: "Relationship", value: "Son" }]);
  assert.equal(relationship.proposal.memoryCandidate.scope, "user"); assert.equal(relationship.proposal.memoryCandidate.status, "proposed"); assert.equal(relationship.proposal.memoryCandidate.retrievalRule, "confirmed_only");
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
  assert.deepEqual(gap.missingInputs, ["normal monthly rent", "current amount outstanding", "target catch-up date"]);
  assert.equal(gap.estimatedShortfall, null);
});

test("target timing and whole-picture protection block false zero/high-confidence gaps", () => {
  const missingDate = buildHousingGap({ obligation: "Rent", normalMonthlyRent: 2200, amountPaid: 1700, outstanding: 500, expectedIncome: 1800, availableCash: 1000, protectedReserve: 1000, protectedObligations: 75, upcomingObligations: 725, recurringCommitments: 200, essentialSpending: 800, evidenceIds: ["rent"] });
  assert.equal(missingDate.estimatedShortfall, null); assert.equal(missingDate.confidence, "low"); assert.ok(missingDate.missingInputs.includes("target catch-up date"));
  const incompletePicture = buildHousingGap({ obligation: "Rent", normalMonthlyRent: 2200, amountPaid: 1700, outstanding: 500, targetCatchUpDate: "2026-09-01", expectedIncome: 1800, availableCash: 1000, evidenceIds: ["rent"] });
  assert.equal(incompletePicture.estimatedShortfall, null); assert.equal(incompletePicture.availableForGoal, null); assert.equal(incompletePicture.confidence, "low");
});

test("gross cash is protected before calculating the rent recovery shortfall", () => {
  const gap = completeGap();
  assert.equal(gap.availableCash, 1000); assert.equal(gap.protectedReserve, 1000); assert.equal(gap.availableForGoal, 0); assert.equal(gap.estimatedShortfall, 500); assert.equal(gap.confidence, "high");
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

const completeGap = (overrides = {}) => buildHousingGap({ obligation: "Rent catch-up", normalMonthlyRent: 2200, amountPaid: 1700, outstanding: 500, targetCatchUpDate: "2026-09-01", expectedIncome: 1800, availableCash: 1000, protectedReserve: 1000, protectedObligations: 75, upcomingObligations: 725, recurringCommitments: 200, essentialSpending: 800, evidenceIds: ["rent", "cash", "obligations"], ...overrides });

test("option generation is evidence-bounded, constraint-aware, and does not invent three plans", () => {
  const gap = completeGap();
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
  const gap = completeGap();
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
  const gap = completeGap({ outstanding: 300 });
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

test("authenticated founder preview renders both controlled conversation flows", () => {
  const page = readFileSync(new URL("../app/account/transaction-understanding/preview/page.tsx", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../components/account/conversation-strategy-preview.tsx", import.meta.url), "utf8");
  assert.match(page, /getAuthenticatedUser/); assert.match(page, /getAuthorizedFounderPreviewUser/); assert.match(page, /ConversationStrategyPreview/);
  for (const copy of ["How many payments were made to OLU’KAI?", "Which card did I use?", "birthday gift for Caleb", "Rent recovery strategy preview"]) assert.match(ui, new RegExp(copy.replace(/[?]/g, "\\?")));
});

test("founder preview uses the canonical admin allowlist without weakening Plaid authorization", () => {
  const auth = readFileSync(new URL("../lib/founder-review-auth.ts", import.meta.url), "utf8");
  assert.match(auth, /getAuthorizedFounderPreviewUser/); assert.match(auth, /isFounderAdmin\(user, process\.env\.COVARIFY_ADMIN_EMAILS\)/);
  assert.match(auth, /getAuthorizedFounderUser[\s\S]*readProductionPlaidConfig\(\)\.allowedUserIds/);
});

test("authorized founder matches exactly while another authenticated account does not", () => {
  const allowlist = "founder@example.com";
  assert.equal(isFounderAdmin({ email: " Founder@Example.com " }, allowlist), true);
  assert.equal(isFounderAdmin({ email: "reviewer@example.com" }, allowlist), false);
  assert.equal(isFounderAdmin({ email: null }, allowlist), false);
});

test("authenticated unauthorized preview is bounded and never redirects into AccountPage", () => {
  const page = readFileSync(new URL("../app/account/transaction-understanding/preview/page.tsx", import.meta.url), "utf8");
  assert.match(page, /This account is not authorized for the founder preview/); assert.match(page, /No financial or account data was loaded/);
  assert.doesNotMatch(page, /redirect\("\/account"\)/); assert.doesNotMatch(page, /AuthenticatedWorkspace|AccountPage|loadRecurringCommitmentDecisionMap|recurring-commitments-server/);
});

test("preview introduces no authentication bypass or capture query", () => {
  const page = readFileSync(new URL("../app/account/transaction-understanding/preview/page.tsx", import.meta.url), "utf8");
  assert.match(page, /redirect\("\/login\?next=\/account\/transaction-understanding\/preview"\)/);
  assert.doesNotMatch(page, /capture=|localCapture|NODE_ENV/);
});

test("preview preserves confirmation and no-plan-activation boundaries", () => {
  const ui = readFileSync(new URL("../components/account/conversation-strategy-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /Proposal · confirmation required/); assert.match(ui, /No durable change occurs/); assert.match(ui, /Plan activation and durable saving are not available/); assert.match(ui, /disabled>Activate plan/);
  assert.doesNotMatch(ui, /fetch\(|record_|insert\(|upsert\(/);
});

test("strategy preview exposes rationale, alternatives, evidence, constraints, stale semantics, and one primary step pattern", () => {
  const ui = readFileSync(new URL("../components/account/conversation-strategy-preview.tsx", import.meta.url), "utf8");
  for (const copy of ["Recommended", "Alternative", "Why ", "Evidence and assumptions", "Protect Callie’s activities", "Missing information", "Next best step"]) assert.match(ui, new RegExp(copy));
  assert.match(ui, /aria-label="Primary next best step"/); assert.match(ui, /aria-label="Whole-picture situation preview"/); assert.match(ui, /aria-label="Proposed change requiring confirmation"/);
});

test("preview CSS stacks options at mobile width without horizontal comparison scrolling", () => {
  const css = readFileSync(new URL("../components/account/conversation-strategy-preview.module.css", import.meta.url), "utf8");
  assert.match(css, /@media\(max-width:700px\)/); assert.match(css, /\.inputs,\.situation,\.options\{grid-template-columns:1fr\}/); assert.match(css, /min-height:44px/); assert.match(css, /prefers-reduced-motion/); assert.doesNotMatch(css, /overflow-x:\s*(?:auto|scroll)/);
});

test("preview supports keyboard submission and screen-reader state labels", () => {
  const ui = readFileSync(new URL("../components/account/conversation-strategy-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /event\.ctrlKey \|\| event\.metaKey/); assert.match(ui, /aria-live="polite"/); assert.match(ui, /aria-pressed=/); assert.match(ui, /aria-label="Strategy options"/);
});

test("typed, reviewed voice, and guided taps converge on one shared send path", () => {
  const ui = readFileSync(new URL("../components/account/conversation-strategy-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /const send = useCallback\(\(raw = text/);
  assert.match(ui, /onClick=\{\(\) => send\(prompt, "tap"\)\}/);
  assert.match(ui, /onFinalTranscript[\s\S]*setText\(transcript\)/);
  assert.match(ui, /onClick=\{\(\) => send\(\)\}/);
  assert.equal((ui.match(/orchestrateConversation\(/g) || []).length, 1);
});

test("voice adapter is review-first and preserves drafts on unsupported, denied, and partial recognition", () => {
  const adapter = readFileSync(new URL("../components/account/use-browser-speech.ts", import.meta.url), "utf8");
  assert.match(adapter, /speechWindow\.SpeechRecognition \|\| speechWindow\.webkitSpeechRecognition/);
  assert.match(adapter, /if \(!result\.isFinal\) continue/);
  assert.match(adapter, /onFinalTranscript\(transcript/);
  assert.doesNotMatch(adapter, /orchestrateConversation|FinancialMemory|fetch\(|localStorage|sessionStorage|MediaRecorder|getUserMedia/);
  assert.match(adapter, /access was denied\. No final transcript was added; your draft is unchanged/);
  assert.match(adapter, /Voice recognition is unavailable in this browser\. Keep typing/);
});

test("voice recognition lifecycle copy distinguishes added, replaced, merchant-held, absent, denied, and failed transcripts", () => {
  const adapter = readFileSync(new URL("../components/account/use-browser-speech.ts", import.meta.url), "utf8");
  for (const copy of ["Final transcript added to the Message draft", "Final transcript replaced the prior unsubmitted voice attempt", "Final transcript added and held for review because the merchant could not be confirmed", "Recognition ended without a final transcript", "Microphone access was denied", "Voice recognition failed before a usable final transcript was added"]) assert.match(adapter, new RegExp(copy));
  assert.doesNotMatch(adapter, /stopped without changing your conversation|Recognition failed after a final transcript was added/);
});

test("speech output reads rendered response exactly and can always be interrupted", () => {
  const ui = readFileSync(new URL("../components/account/conversation-strategy-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /new SpeechSynthesisUtterance\(response\.message\)/);
  assert.match(ui, /speechSynthesis\.cancel\(\)/);
  assert.match(ui, /useBrowserSpeech\(\{ onFinalTranscript, stopSpeaking \}\)/);
  assert.match(ui, /useState\(false\).*speaking/); assert.match(ui, /Speak responses/); assert.match(ui, /Browser fallback/); assert.match(ui, /browser-generated speech is non-production/); assert.match(ui, /Stop speaking/);
});

test("founder simulation and browser speech privacy disclosures remain visible", () => {
  const ui = readFileSync(new URL("../components/account/conversation-strategy-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /Founder simulation/); assert.match(ui, /controlled test data, not your connected financial accounts/);
  assert.match(ui, /remote speech service/); assert.match(ui, /Audio is not stored by this Covarify preview/);
  assert.match(ui, /View simulated supporting evidence/); assert.doesNotMatch(ui, /on-device processing/i);
});

test("modality changes preserve exact conversation evidence and pending proposals", () => {
  const spokenCount = orchestrateConversation({ ...request("How many payments were made to OLU’KAI?"), dataMode: "fixture" });
  const typedCard = orchestrateConversation({ ...request("Which card did I use?", spokenCount.context), dataMode: "fixture" });
  const spokenGift = orchestrateConversation({ ...request("The $89 one was a birthday gift for Caleb.", typedCard.context), dataMode: "fixture" });
  const tappedRelationship = orchestrateConversation({ ...request("My son.", spokenGift.context), dataMode: "fixture" });
  assert.deepEqual(typedCard.context.transactionIds, spokenCount.evidence.transactionIds);
  assert.deepEqual(spokenGift.proposal.transactionIds, spokenCount.evidence.transactionIds.slice(0, 1));
  assert.equal(spokenGift.context.pendingEntities[0].value, "Caleb");
  assert.equal(tappedRelationship.proposal.memoryCandidate.subject, "Caleb");
  assert.equal(tappedRelationship.proposal.memoryCandidate.status, "proposed");
});

test("voice controls remain accessible and stack at the 390px breakpoint", () => {
  const ui = readFileSync(new URL("../components/account/conversation-strategy-preview.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../components/account/conversation-strategy-preview.module.css", import.meta.url), "utf8");
  assert.match(ui, /aria-label=\{voice\.listening \? "Stop microphone" : "Start microphone"\}/); assert.match(ui, /aria-pressed=\{voice\.listening\}/);
  assert.match(ui, /aria-label="Voice input controls"/); assert.match(ui, /aria-live="polite"/);
  assert.match(css, /@media\(max-width:700px\)/); assert.match(css, /\.prompts,\.goal,\.voiceControls,\.reviewActions\{display:grid\}/); assert.match(css, /min-height:44px/);
});

test("voice retry replaces its draft while typed text requires an explicit merge choice", () => {
  const ui = readFileSync(new URL("../components/account/conversation-strategy-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /if \(text\.trim\(\) && draftOrigin === "typed"\)/); assert.match(ui, /setText\(transcript\)/);
  for (const label of ["Replace draft", "Append", "Cancel"]) assert.match(ui, new RegExp(label));
  assert.match(ui, /setText\(""\); setTranscriptMeta\(null\)/); assert.match(ui, /setDraftOrigin\(null\)/);
});

test("voice auto-send defaults on, can be disabled, and never creates durable memory", () => {
  const ui = readFileSync(new URL("../components/account/conversation-strategy-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /useState\(true\).*draftOrigin/); assert.match(ui, /Voice auto-send/); assert.match(ui, /checked=\{voiceAutoSend\}/); assert.match(ui, /checked=\{!voiceAutoSend\}/);
  assert.match(ui, /voiceAutoSend && assessment\.autoSend/); assert.match(ui, /send\(transcript, "voice"\)/);
  assert.doesNotMatch(ui, /FinancialMemory|fetch\(|localStorage|sessionStorage|insert\(|upsert\(/);
});

test("unresolved merchant correction remains visible and uses shared send only after acceptance", () => {
  const ui = readFileSync(new URL("../components/account/conversation-strategy-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /I heard “\{transcriptMeta\.correction\.heard\}\.” Did you mean \{transcriptMeta\.correction\.canonical\}/);
  for (const action of ["Yes, use ", "Edit transcript", "Try again"]) assert.match(ui, new RegExp(action));
  assert.match(ui, /if \(voiceAutoSend\) send\(corrected, "voice"\)/); assert.match(ui, /Voice auto-send is Off; select Send when ready/);
  assert.match(ui, /setText\(transcript\)/); assert.equal((ui.match(/orchestrateConversation\(/g) || []).length, 1);
  assert.doesNotMatch(ui, /FinancialMemory|localStorage|sessionStorage|insert\(|upsert\(/);
});

test("accepted correction closes the only active turn while preserving history and evidence context", () => {
  const ui = readFileSync(new URL("../components/account/conversation-strategy-preview.tsx", import.meta.url), "utf8");
  const adapter = readFileSync(new URL("../components/account/use-browser-speech.ts", import.meta.url), "utf8");
  assert.match(ui, /setTurns\(\(current\) => \[\.\.\.current, \{ role: "user", text: statement \}, \{ role: "covarify", text: result\.message \}\]\)/);
  assert.match(ui, /setContext\(result\.context\)/);
  for (const reset of [/setText\(""\)/, /setTranscriptMeta\(null\)/, /setIncomingVoiceDraft\(null\)/, /setDraftOrigin\(null\)/]) assert.match(ui, reset);
  assert.match(ui, /resetVoiceTurn\.current\(\)/);
  assert.match(ui, /useEffect\(\(\) => \{ resetVoiceTurn\.current = voice\.resetActiveTurn/);
  assert.match(adapter, /recognitionRef\.current\?\.abort\?\.\(\)/);
  assert.match(adapter, /Microphone ready for a new turn\. You can type at any time/);
  assert.equal((ui.match(/transcriptMeta \? <section/g) || []).length, 1);
});

test("a new unsupported merchant turn cannot inherit the accepted OLU’KAI correction", () => {
  const first = orchestrateConversation({ ...request("How many payments were made to OLU’KAI?"), dataMode: "fixture" });
  const target = orchestrateConversation({ ...request("How many payments were made to Target?", first.context), dataMode: "fixture" });
  assert.deepEqual(first.context.transactionIds, first.evidence.transactionIds);
  assert.match(target.message, /Target/i);
  assert.doesNotMatch(target.message, /Did you mean OLU’KAI/i);
  assert.equal(target.context.sessionId, first.context.sessionId);
});

test("rent preview is a sequential state machine and cannot render future active inputs", () => {
  const ui = readFileSync(new URL("../components/account/conversation-strategy-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /inputStep === 0[\s\S]*inputStep === 1[\s\S]*When do you want to be caught up/);
  assert.match(ui, /setInputStep\(\(step\) => Math\.min\(3, step \+ 1\)\)/); assert.match(ui, /User-provided confirmed facts/);
  assert.doesNotMatch(ui, /className=\{styles\.inputs\}/);
});

test("completed rent inputs produce levers, options, rationale, and constraint recalculation", () => {
  const gap = completeGap(); const all = candidateLevers([{ key: "callie", label: "Callie’s activities", category: "Family", amount: 180, transactionIds: ["c1", "c2"], flexibility: "discretionary", recurring: true }, { key: "delivery", label: "Delivery", category: "Food", amount: 700, transactionIds: ["d1", "d2"], flexibility: "discretionary", recurring: true }]);
  const options = generateRecoveryOptions(gap, all); assert.ok(options.length >= 1);
  const protectedLevers = candidateLevers([{ key: "callie", label: "Callie’s activities", category: "Family", amount: 180, transactionIds: ["c1", "c2"], flexibility: "discretionary", recurring: true }, { key: "delivery", label: "Delivery", category: "Food", amount: 700, transactionIds: ["d1", "d2"], flexibility: "discretionary", recurring: true }], [{ kind: "protect", key: "callie", value: "Callie’s activities" }]);
  assert.equal(protectedLevers.some((lever) => lever.label.includes("Callie")), false); assert.notEqual(protectedLevers.length, all.length);
});
