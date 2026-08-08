import test from "node:test";
import assert from "node:assert/strict";
import { orchestrateConversation } from "../lib/conversation/orchestrator.ts";
import { routeConversationIntent } from "../lib/conversation/intent-router.ts";
import { resolveConversationScope } from "../lib/conversation/scope-resolver.ts";
import { resolveConversationEntities } from "../lib/conversation/entity-resolver.ts";
import { validConversationContext } from "../lib/conversation/conversation-context.ts";
import { assertMutuallyExclusiveEvidence, buildHousingGap, candidateLevers, confirmRecoveryPlan, expectedIncomeWithinWindow, generateRecoveryOptions, generateTimelineOptions, monitorPlan, proposeRecoveryPlan, rankFinancialPriority } from "../lib/conversation/financial-triage.ts";
import { competingGoalClarification } from "../lib/conversation/goals.ts";
import { assembleWholePicture } from "../lib/conversation/whole-picture.ts";
import { applyStrategyConstraints, recommendPersonalizedStrategy } from "../lib/conversation/strategy-engine.ts";
import { selectNextBestStep } from "../lib/conversation/next-best-step.ts";
import { readFileSync } from "node:fs";
import { isFounderAdmin } from "../lib/waitlist-core.ts";
import { assessVoiceTurn, resolveMerchantCorrection, transcriptNeedsExplicitReview } from "../lib/conversation/transcript-review.ts";
import { resolveTransactionReference } from "../lib/conversation/reference-resolver.ts";
import { buildRecommendationPresentation, estimatedTimelineCopy, targetModeLabel } from "../lib/conversation/recommendation-presentation.ts";
import { allocateNextDollar, correctIncomeReliability, crisisNextStep, detectPlanConflict, founderAllocationFixture, governedMemoryMapping, realDataReadinessContract, reconcileAllocation, simulateAllocation, waitOrNoAction } from "../lib/conversation/allocation-intelligence.ts";
import { allocationWithOffAccountCash, allocationWithReceivedOwnerFunds, applyCashUpdate, cashIncomeFixture, conservativeCashEstimate, normalizeCashAmount, offAccountMemoryMapping, ownerAvailable, parseCashAction, parseContextualValue, receivableFixture, reconcileCashIncome, reconcileDeposit, reconcileReceivable, reconcileReceivedChange, simulateReceivable, validateCashAction } from "../lib/conversation/off-account-resources.ts";
import { buildJourneyPresentation, buildOutcomeCopy, guidanceModeFromStatement, interpretJourneyEdit, presentRepairAmountChange } from "../lib/conversation/journey-presentation.ts";
import { createHeadlessSession, runHeadlessTurn } from "../lib/conversation/headless-turn-orchestrator.ts";
import { goldenJourneys } from "../lib/conversation/golden-journeys.ts";
import { assertTurnInvariants, confirmationFor } from "../lib/conversation/turn-contract.ts";
import { runCovarifyTurn } from "../lib/conversation/covarify-orchestrator.ts";
import { capabilityRegistry } from "../lib/conversation/capability-registry.ts";
import { runAdaptiveJourneyShadow } from "../lib/conversation/adaptive-journey-shadow.ts";
import { canonicalTruthFromTransactions } from "../lib/conversation/financial-truth.ts";
import { compareAuthenticatedTransactionShadow } from "../lib/conversation/authenticated-transaction-shadow.ts";
import { createAuthorizedCovarifySession, legacyTransactionProjection } from "../lib/conversation/covarify-orchestrator.ts";

const semantic = (turn) => ({ intent: turn.understanding.intent, proposed: turn.financialImpact.proposedChanges.map(({ entityId, field, after }) => ({ entityId, field, after })), actions: turn.actions.map(({ id, type, consequence, confirmation }) => ({ id, type, consequence, confirmation })) });

test("Turn Contract is UI-independent and authoritative orchestration never imports golden fixtures", () => {
  const source = readFileSync(new URL("../lib/conversation/turn-contract.ts", import.meta.url), "utf8") + readFileSync(new URL("../lib/conversation/covarify-orchestrator.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /from ["']react|JSX|HTMLElement|window\.|document\./);
  assert.doesNotMatch(source, /golden-journeys|GoldenJourneyId|competing_cash_needs|transaction_meaning|expected_business_income|goal_conflict|what_changed|contextual_correction/);
  for (const journeyId of Object.keys(goldenJourneys)) {
    const turn = runHeadlessTurn(createHeadlessSession(journeyId), { modality: "text", statement: journeyId === "what_changed" ? "What changed since last week?" : "Help me with this.", now: "2026-08-08T00:00:00.000Z" });
    assert.equal(turn.contractVersion, 1); assert.equal(turn.identity.sessionId, `golden:${journeyId}`); assert.ok(turn.response.primaryMessage);
  }
});

test("text, guided, and reviewed voice resolve to the same correction action", () => {
  const text = runHeadlessTurn(createHeadlessSession("competing_cash_needs"), { modality: "text", statement: "The car is only $400" });
  const voice = runHeadlessTurn(createHeadlessSession("competing_cash_needs"), { modality: "reviewed_voice", statement: "The car is only $400" });
  const guided = runHeadlessTurn(createHeadlessSession("competing_cash_needs"), { modality: "guided_action", action: { id: "fact.correct.propose", payload: { kind: "propose_correction", entityId: "repair", field: "estimate", value: 400 } } });
  assert.deepEqual(semantic(text), semantic(voice)); assert.deepEqual(semantic(text), semantic(guided));
  assert.equal(text.financialImpact.proposedChanges[0].after, 400); assert.equal(text.financialImpact.acceptedSessionChanges.length, 0);
});

test("correction proposal does not mutate before Apply and Undo restores prior state", () => {
  const state = createHeadlessSession("competing_cash_needs");
  const proposed = runHeadlessTurn(state, { modality: "text", statement: "That repair is $400" });
  assert.equal(state.facts.find((item) => item.entityId === "repair" && item.field === "estimate").value, 500);
  assert.equal(proposed.actions[0].id, "correction.apply"); assert.equal(proposed.actions[0].consequence, "SESSION_REVERSIBLE"); assert.equal(proposed.actions[0].confirmation, "explicit_apply");
  const applied = runHeadlessTurn(state, { modality: "guided_action", action: { id: "correction.apply", payload: { kind: "apply_correction", changeId: proposed.financialImpact.proposedChanges[0].changeId } } });
  assert.equal(state.facts.find((item) => item.entityId === "repair" && item.field === "estimate").value, 400); assert.equal(applied.financialImpact.acceptedSessionChanges[0].before, 500);
  assert.equal(applied.financialImpact.before.find((item) => item.entityId === "repair" && item.field === "estimate").value, 500); assert.equal(applied.financialImpact.after.find((item) => item.entityId === "repair" && item.field === "estimate").value, 400);
  runHeadlessTurn(state, { modality: "guided_action", action: { id: "correction.undo", payload: { kind: "undo", reversibleActionId: applied.financialImpact.acceptedSessionChanges[0].changeId } } });
  assert.equal(state.facts.find((item) => item.entityId === "repair" && item.field === "estimate").value, 500);
});

test("expected resources stay unavailable until received", () => {
  const turn = runHeadlessTurn(createHeadlessSession("expected_business_income"), { modality: "text", statement: "I'm getting a $2,500 invoice paid Friday, but $300 is materials." });
  assert.match(turn.response.primaryMessage, /expected, not available cash/i); assert.equal(turn.financialImpact.factsRead.find((item) => item.entityId === "cash" && item.field === "available_amount").value, 0);
  assert.match(turn.decision.constraints[0], /unavailable until received/i);
});

test("transaction meaning creates a typed memory proposal without canonical memory", () => {
  const turn = runHeadlessTurn(createHeadlessSession("transaction_meaning"), { modality: "reviewed_voice", statement: "That $312 Target charge was back-to-school stuff for Callie." });
  assert.equal(turn.memory.disposition, "memory_proposal"); assert.equal(turn.memory.proposal.fact.status, "unconfirmed"); assert.equal(turn.memory.proposal.fact.value, "back-to-school for Callie");
  assert.equal(turn.financialImpact.acceptedSessionChanges.length, 0); assert.doesNotMatch(JSON.stringify(turn.financialImpact.after), /back-to-school for Callie/);
});

test("ambiguity, unsupported input, stopping, and depth changes have visible bounded semantics", () => {
  const ambiguous = runHeadlessTurn(createHeadlessSession("goal_conflict"), { modality: "text", statement: "Change that amount." });
  assert.equal(ambiguous.understanding.intent, "CORRECT_FACT"); assert.ok(ambiguous.understanding.ambiguity); assert.equal(ambiguous.next.blocking, true); assert.ok(ambiguous.response.question);
  const unsupported = runHeadlessTurn(createHeadlessSession("competing_cash_needs"), { modality: "text", statement: "Order a pizza." });
  assert.equal(unsupported.understanding.intent, "OUT_OF_SCOPE"); assert.match(unsupported.response.primaryMessage, /focused on helping/i);
  const state = createHeadlessSession("goal_conflict"); const before = structuredClone(state.facts);
  runHeadlessTurn(state, { modality: "text", statement: "Show me the math." }); assert.equal(state.presentationDepth, "DETAILED"); assert.deepEqual(state.facts, before);
  const stopped = runHeadlessTurn(state, { modality: "guided_action", action: { id: "session.stop" } }); assert.equal(stopped.next.stopped, true); assert.equal(stopped.actions[0].id, "session.resume");
});

test("recommendation and rationale share one decision object and actions obey consequence policy", () => {
  const turn = runHeadlessTurn(createHeadlessSession("goal_conflict"), { modality: "text", statement: "I want to pay down my card, but a camp deposit is due." });
  assert.match(turn.decision.recommendation.summary, /camp deposit/i); assert.match(turn.response.conciseRationale, /camp place/i);
  for (const item of turn.actions) assert.equal(item.confirmation, confirmationFor(item.consequence));
  assert.equal(assertTurnInvariants(turn), turn);
});

test("capability registry is generalized and client-safe", () => {
  for (const id of ["READ_FINANCIAL_STATE", "CORRECT_FACT", "CORRECT_REFERENCE", "ANSWER_BLOCKING_QUESTION", "PRIORITIZE_COMPETING_NEEDS", "ASSESS_EXPECTED_RESOURCE", "COMPARE_FINANCIAL_SNAPSHOTS", "COMPARE_OPTIONS", "SHOW_EVIDENCE", "SHOW_CALCULATION", "CHANGE_PRESENTATION_DEPTH", "STOP_FOR_NOW", "RESUME", "UNDO", "PROPOSE_MEMORY"]) {
    const capability = capabilityRegistry[id]; assert.equal(capability.id, id); assert.equal(capability.confirmation, confirmationFor(capability.consequence)); assert.ok(capability.operation); assert.ok(capability.presenterInput);
  }
});

test("one generic correction engine handles amounts across financial domains", () => {
  const cases = [
    ["competing_cash_needs", "repair is $400", "repair", "estimate", 400], ["competing_cash_needs", "card minimum is $90", "card", "minimum", 90], ["competing_cash_needs", "utility is $200", "utility", "amount", 200],
    ["expected_business_income", "the invoice is actually $2,800", "invoice-2500", "gross", 2800], ["expected_business_income", "materials are $350", "invoice-2500", "materials", 350], ["goal_conflict", "the camp deposit is $450", "camp-deposit", "amount", 450],
  ];
  for (const [journey, statement, entityId, field, value] of cases) { const turn = runCovarifyTurn(createHeadlessSession(journey), { modality: "text", statement }); const change = turn.financialImpact.proposedChanges[0]; assert.equal(turn.understanding.capability, "CORRECT_FACT"); assert.deepEqual([change.entityId, change.field, change.after], [entityId, field, value]); assert.equal(turn.actions[0].payload.kind, "apply_correction"); }
});

test("T1, T8, and T9 protect reconciliation, correction scope, and modality continuity", () => {
  const state = createHeadlessSession("competing_cash_needs"); state.facts = state.facts.map((fact) => fact.entityId === "repair" && fact.field === "work_required" ? { ...fact, value: false, status: "confirmed" } : fact); const text = runCovarifyTurn(state, { modality: "text", statement: "repair is $400" });
  assert.equal(text.decision.reconciliation.available, text.decision.reconciliation.allocated + text.decision.reconciliation.remaining);
  const applied = runCovarifyTurn(state, { modality: "guided_action", action: { id: "correction.apply", payload: text.actions[0].payload } });
  const changed = applied.financialImpact.after.filter((fact, index) => fact.value !== applied.financialImpact.before[index].value); assert.deepEqual(changed.map((fact) => `${fact.entityId}.${fact.field}`), ["repair.estimate"]);
  const voice = runCovarifyTurn(state, { modality: "reviewed_voice", statement: "make that $450" }); assert.equal(voice.financialImpact.proposedChanges[0].entityId, "repair"); assert.equal(voice.financialImpact.proposedChanges[0].after, 450);
});

test("typed ambiguity is renderable and shadow integration passes without changing visible UX", () => {
  const ambiguous = runCovarifyTurn(createHeadlessSession("competing_cash_needs"), { modality: "text", statement: "change that amount to $450" });
  assert.ok(ambiguous.understanding.ambiguity.candidates.length >= 2); for (const candidate of ambiguous.understanding.ambiguity.candidates) { assert.ok(candidate.entityId); assert.ok(candidate.displayLabel); assert.equal(candidate.clarificationRequired, true); }
  assert.equal(runAdaptiveJourneyShadow().passed, true);
});

const transaction = (overrides = {}) => ({ id: "tx-1", plaidAccountId: "account-1", accountLabel: "Capital One · 1234", merchantName: null, name: "OLU’KAI", description: "VISA DDA PUR AP 469216 SP AFF OLUKAI *", amount: 89, currency: "USD", date: "2026-01-10", pending: false, pendingTransactionId: null, category: "GENERAL_MERCHANDISE", sourceCategory: "GENERAL_MERCHANDISE", direction: "outflow", transferRelationship: null, ...overrides });
const request = (text, context = null) => ({ text, userId: "user-1", sessionId: "session-1", now: new Date("2026-08-03T12:00:00Z"), context, transactions: [transaction(), transaction({ id: "tx-2", amount: 110, date: "2026-02-10" }), transaction({ id: "refund", amount: -20, direction: "inflow", date: "2026-03-10", sourceCategory: "REFUND" })] });

const authenticatedTruth = () => canonicalTruthFromTransactions({ userId: "user-1", transactions: request("").transactions, asOf: "2026-08-08T12:00:00.000Z", sourceMode: "authenticated_preview" });

test("legacy transaction machinery is behind the authoritative facade with exact read-only parity", () => {
  const truth = authenticatedTruth(); const session = createAuthorizedCovarifySession({ sessionId: "session-1", truth, authenticatedUserId: "user-1" }); const input = { modality: "text", statement: "How many payments were made to OLU’KAI?", now: "2026-08-08T12:00:00.000Z" };
  const turn = runCovarifyTurn(session, input); const projection = legacyTransactionProjection(session); const legacy = orchestrateConversation(request(input.statement));
  assert.equal(turn.understanding.intent, "TRANSACTION_COUNT"); assert.equal(turn.understanding.scopeDetail, "ALL_AVAILABLE_HISTORY"); assert.equal(turn.response.primaryMessage, legacy.message); assert.deepEqual(turn.decision.affectedEntityIds, legacy.evidence.transactionIds); assert.equal(projection.message, legacy.message);
  const shadow = compareAuthenticatedTransactionShadow({ truth, authenticatedUserId: "user-1", sessionId: "session-1", statement: input.statement, authoritativeTurn: turn, authoritativeLegacy: projection }); assert.equal(shadow.passed, true); assert.deepEqual(shadow.failedChecks, []);
});

test("authorized truth cannot be substituted by surface identity or entity payload", () => {
  const truth = authenticatedTruth(); assert.throws(() => createAuthorizedCovarifySession({ sessionId: "session-1", truth, authenticatedUserId: "other-user" }), /AUTHORIZED_FINANCIAL_TRUTH_REQUIRED/);
  const session = createAuthorizedCovarifySession({ sessionId: "session-1", truth, authenticatedUserId: "user-1" }); const turn = runCovarifyTurn(session, { modality: "text", statement: "Which account did this payment use?", transaction: { selectedTransactionId: "another-users-transaction" } });
  assert.equal(turn.understanding.scope, "TRANSACTION"); assert.doesNotMatch(JSON.stringify(turn), /another-users-transaction/); assert.ok(turn.response.primaryMessage);
});

test("session overlays never mutate base Canonical Financial Truth", () => {
  const state = createHeadlessSession("competing_cash_needs"); const base = structuredClone(state.canonicalTruth.facts); const proposed = runCovarifyTurn(state, { modality: "text", statement: "repair is $400" }); runCovarifyTurn(state, { modality: "guided_action", action: { id: "correction.apply", payload: proposed.actions[0].payload } });
  assert.deepEqual(state.canonicalTruth.facts, base); assert.equal(state.facts.find((fact) => fact.entityId === "repair" && fact.field === "estimate").value, 400); assert.equal(state.canonicalTruth.facts.find((fact) => fact.entityId === "repair" && fact.field === "estimate").value, 500);
});

test("fixture and authenticated truth use the same facade and modality cannot change authorization semantics", () => {
  const truth = authenticatedTruth(); const textSession = createAuthorizedCovarifySession({ sessionId: "text", truth, authenticatedUserId: "user-1" }); const voiceSession = createAuthorizedCovarifySession({ sessionId: "voice", truth, authenticatedUserId: "user-1" });
  const text = runCovarifyTurn(textSession, { modality: "text", statement: "How many payments were made to OLU’KAI?" }); const voice = runCovarifyTurn(voiceSession, { modality: "reviewed_voice", statement: "How many payments were made to OLU’KAI?" });
  assert.equal(text.understanding.capability, voice.understanding.capability); assert.deepEqual(text.decision.quantified, voice.decision.quantified); assert.deepEqual(text.decision.affectedEntityIds, voice.decision.affectedEntityIds);
  const fixture = runCovarifyTurn(createHeadlessSession("competing_cash_needs"), { modality: "text", statement: "repair is $400" }); assert.equal(fixture.contractVersion, text.contractVersion);
});

test("provenance survives truth through transaction adapter and Turn Contract", () => {
  const truth = authenticatedTruth(); const session = createAuthorizedCovarifySession({ sessionId: "provenance", truth, authenticatedUserId: "user-1" }); const turn = runCovarifyTurn(session, { modality: "text", statement: "How many payments were made to OLU’KAI?" });
  assert.ok(turn.evidence.references.length); for (const evidence of turn.evidence.references) { assert.equal(evidence.provenance, "CONNECTED_DATA"); assert.equal(evidence.ownership.userId, "user-1"); assert.ok(evidence.sourceId); assert.equal(evidence.freshness, "current"); }
  assert.ok(turn.decision.factsConsidered.every((fact) => fact.evidenceIds.every((id) => turn.evidence.references.some((evidence) => evidence.sourceId === id))));
});

test("authoritative transaction meaning remains a non-durable memory proposal", () => {
  const truth = canonicalTruthFromTransactions({ userId: "user-1", transactions: [transaction({ id: "target-312", name: "Target", merchantName: "Target", amount: 312 })], asOf: "2026-08-08T12:00:00.000Z", sourceMode: "authenticated_preview" }); const session = createAuthorizedCovarifySession({ sessionId: "memory", truth, authenticatedUserId: "user-1" });
  runCovarifyTurn(session, { modality: "text", statement: "How many payments were made to Target?" }); const turn = runCovarifyTurn(session, { modality: "text", statement: "That $312 Target charge was back-to-school stuff for Callie." });
  assert.equal(turn.memory.disposition, "memory_proposal"); assert.equal(turn.memory.proposal.fact.status, "unconfirmed"); assert.equal(turn.financialImpact.acceptedSessionChanges.length, 0); assert.deepEqual(session.canonicalTruth.governedMemory, []);
});

test("authenticated API selects only runCovarifyTurn as its conversation entry point", () => {
  const source = readFileSync(new URL("../app/api/account/transaction-understanding/route.ts", import.meta.url), "utf8"); assert.match(source, /runCovarifyTurn\(session/); assert.doesNotMatch(source, /import \{ orchestrateConversation \}/); assert.match(readFileSync(new URL("../lib/conversation/orchestrator.ts", import.meta.url), "utf8"), /@deprecated Internal TRANSACTION_UNDERSTANDING adapter machinery/);
});

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
  assert.deepEqual(gap.missingInputs, ["normal monthly rent", "current amount outstanding"]);
  assert.equal(gap.estimatedShortfall, null);
});

test("missing user date does not block a financially complete gap but incomplete evidence returns unknown", () => {
  const missingDate = buildHousingGap({ obligation: "Rent", normalMonthlyRent: 2200, amountPaid: 1700, outstanding: 500, expectedIncome: 1800, availableCash: 1000, protectedReserve: 1000, protectedObligations: 75, upcomingObligations: 725, recurringCommitments: 200, essentialSpending: 800, evidenceIds: ["rent"] });
  assert.equal(missingDate.estimatedShortfall, 500); assert.equal(missingDate.confidence, "high"); assert.equal(missingDate.targetCatchUpDate, null); assert.doesNotMatch(missingDate.missingInputs.join(), /date/);
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
  assert.match(page, /getAuthenticatedUser/); assert.match(page, /getAuthorizedFounderPreviewUser/); assert.match(page, /AdaptiveJourneyPreview/);
  for (const copy of ["How many payments were made to OLU’KAI?", "Which card did I use?", "birthday gift for Caleb", "Rent recovery strategy preview"]) assert.match(ui, new RegExp(copy.replace(/[?]/g, "\\?")));
});

test("authenticated founder preview renders one adaptive continuous journey", () => {
  const page = readFileSync(new URL("../app/account/transaction-understanding/preview/page.tsx", import.meta.url), "utf8");
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  assert.match(page, /AdaptiveJourneyPreview/); assert.doesNotMatch(page, /<ConversationStrategyPreview|<TransactionUnderstandingPreview|from "@\/components\/account\/(?:conversation-strategy-preview|transaction-understanding-preview)"/);
  for (const copy of ["What Covarify already knows", "One answer could change the recommendation", "What changed", "Current recommendation", "Next"]) assert.match(ui, new RegExp(copy));
});

test("journey modes alter presentation without changing financial facts", () => {
  assert.equal(guidanceModeFromStatement("Go faster", "guided"), "concise");
  assert.equal(guidanceModeFromStatement("Show me the math", "guided"), "expert");
  assert.equal(guidanceModeFromStatement("Walk me through it", "expert"), "guided");
  const guided = buildJourneyPresentation({ mode: "guided", repairAnswer: "yes" });
  const expert = buildJourneyPresentation({ mode: "expert", repairAnswer: "yes" });
  assert.deepEqual(guided.recordedFacts, expert.recordedFacts); assert.equal(guided.nextBestStep, expert.nextBestStep);
});

test("critical journey question cannot be skipped in any guidance mode", () => {
  for (const mode of ["guided", "concise", "expert"]) {
    const journey = buildJourneyPresentation({ mode, repairAnswer: null });
    assert.equal(journey.completion, "blocked_by_critical_fact"); assert.match(journey.currentQuestion, /repair required.*keep working/i); assert.equal(journey.criticalMissingFacts.length, 1);
  }
});

test("answered turns synthesize, advance, and expose a session-only stopping point", () => {
  for (const answer of ["yes", "no", "unsure"]) assert.ok(buildJourneyPresentation({ mode: "guided", repairAnswer: answer, step: "repair_review" }).synthesis);
  const repairReview = buildJourneyPresentation({ mode: "guided", repairAnswer: "yes", step: "repair_review" });
  assert.equal(repairReview.completion, "recommendation_ready"); assert.equal(repairReview.stoppingPoint, false); assert.match(repairReview.nextBestStep, /utility/i);
  const ready = buildJourneyPresentation({ mode: "guided", repairAnswer: "yes", utilityTimingAnswer: "yes", step: "utility_timing_review" });
  assert.equal(ready.stoppingPoint, true); assert.equal(ready.currentQuestion, null); assert.ok(ready.synthesis);
  assert.equal(buildJourneyPresentation({ mode: "guided", repairAnswer: "yes", utilityTimingAnswer: "yes", stopped: true }).completion, "user_has_enough_for_now");
});

test("consumer journey removes prototype labels and keeps diagnostics below its boundary", () => {
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  for (const label of ["Flow A", "Flow B", "Flow C", "Scenario A", "Scenario B", "Resource Extension"]) assert.doesNotMatch(ui, new RegExp(label));
  assert.ok(ui.indexOf("controlled, read-only preview") < ui.indexOf("Founder testing tools")); assert.match(ui, /<details className=\{styles\.founderTools\}>/);
  assert.doesNotMatch(ui, /localStorage|sessionStorage|fetch\(|FinancialMemory|insert\(|upsert\(/);
});

test("adaptive journey uses one shared typed and voice statement path", () => {
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /onFinalTranscript: \(transcript\) => applyStatement\(transcript\)/); assert.match(ui, /applyStatement\(statement\)/);
  assert.match(ui, /aria-pressed=\{mode === item\.id\}/); assert.match(ui, /Stop here/); assert.match(ui, /You have a workable next step/);
});

test("unanswered repair choices are neutral, complete, and never preselected", () => {
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  for (const answer of ["Yes — I need it to keep working", "No — it can wait", "I’m not sure"]) assert.match(ui, new RegExp(answer));
  assert.equal((ui.match(/className=\{styles\.choice\} aria-pressed=\{activatingAnswer ===/g) || []).length, 3);
  assert.match(ui, /useState<RepairAnswer>\(null\)/); assert.match(ui, /setActivatingAnswer\(answer\)/); assert.match(ui, /setTimeout\(\(\) => \{ setActivatingAnswer\(null\); if \(journeyStep === "utility_timing_question"\)/);
  assert.doesNotMatch(ui, /className=\{styles\.primary\}[^>]*>Yes — I need it to keep working/); assert.match(ui, /No — it can wait/);
});

test("active guidance is a quiet current preference rather than an unanswered prompt", () => {
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /useState<GuidanceMode>\("guided"\)/); assert.match(ui, /Guidance: <strong>\{modeLabel\}<\/strong>/);
  assert.match(ui, /aria-pressed=\{mode === item\.id\}/); assert.doesNotMatch(ui, /How would you like to work/);
});

test("answered state replaces choices with confirmation, synthesis, and a genuinely new next action", () => {
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /journeyStep === "repair_review"/); assert.match(ui, /<Confirmation title=/);
  assert.match(ui, /You confirmed/); assert.match(ui, /What changed/); assert.match(ui, /Confirm whether the utility is due before your next paycheck/);
  assert.doesNotMatch(ui, /Next Best Step/);
});

test("change restores focus and undo retains the prior confirmed answer", () => {
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /requestAnimationFrame\(\(\) => repairQuestionRef\.current\?\.focus\(\)\)/);
  assert.match(ui, /setPriorRepairAnswer\(\(current\) => repairAnswer \?\? current\)/); assert.match(ui, /setRepairAnswer\(priorRepairAnswer\)/);
  assert.match(ui, /setPriorUtilityAnswer\(\(current\) => utilityTimingAnswer \?\? current\)/); assert.match(ui, /setUtilityTimingAnswer\(priorUtilityAnswer\)/);
});

test("bounded questions subordinate the composer while preserving text and voice", () => {
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /<summary>Answer another way<\/summary><Composer/); assert.match(ui, /!activeQuestion && journeyStep !== "utility_timing_review" \? <section className=\{styles\.standardComposer\}/);
  assert.match(ui, /Microphone/); assert.match(ui, /placeholder="Type an answer or guidance request"/);
});

test("post-repair action advances once into the canonical utility timing question", () => {
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /const openUtilityQuestion = \(\) =>/); assert.match(ui, /if \(transitionLockRef\.current\) return/);
  assert.match(ui, /setJourneyStep\("utility_timing_question"\)/); assert.match(ui, /disabled=\{transitioning\}/);
  assert.match(ui, /Check utility timing/); assert.doesNotMatch(ui, />Continue<\/button>/);
  assert.equal(buildJourneyPresentation({ mode: "guided", repairAnswer: "yes", step: "utility_timing_question" }).currentQuestion, "Is the $180 utility payment due before your next paycheck?");
});

test("utility transition preserves repair context and updates focus and orientation", () => {
  const utility = buildJourneyPresentation({ mode: "guided", repairAnswer: "yes", step: "utility_timing_question" });
  assert.equal(utility.step, "utility_timing_question"); assert.match(utility.currentQuestion, /\$180 utility/); assert.match(utility.completedContext.at(-1), /Repair confirmed/);
  assert.equal(utility.currentTopic, "Confirm utility timing"); assert.equal(utility.criticalMissingFacts.length, 1);
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /utilityQuestionRef\.current/); assert.match(ui, /scrollIntoView/); assert.match(ui, /prefers-reduced-motion: reduce/);
});

test("utility choices are neutral and accepted answers reuse approved allocation behavior", () => {
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  for (const answer of ["Yes — it is due first", "No — it can wait until after", "I’m not sure"]) assert.match(ui, new RegExp(answer));
  assert.match(ui, /protectUtility: utilityTimingAnswer === "yes"/);
  const existing = allocateNextDollar({ repairRequiredForWork: true, protectUtility: true });
  const unchanged = allocateNextDollar({ repairRequiredForWork: true, protectUtility: true });
  assert.deepEqual(unchanged, existing);
});

test("all guidance modes share the utility transition and stopping contract", () => {
  for (const mode of ["guided", "concise", "expert"]) {
    const question = buildJourneyPresentation({ mode, repairAnswer: "yes", step: "utility_timing_question" });
    const answered = buildJourneyPresentation({ mode, repairAnswer: "yes", utilityTimingAnswer: "yes", step: "utility_timing_review" });
    assert.equal(question.currentQuestion, "Is the $180 utility payment due before your next paycheck?"); assert.equal(answered.stoppingPoint, true); assert.equal(answered.nextBestStep, "Finish for now or adjust the recommendation.");
  }
});

test("typed and reviewed voice answers resolve against the same active utility question", () => {
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /onFinalTranscript: \(transcript\) => applyStatement\(transcript\)/);
  assert.match(ui, /if \(journeyStep === "utility_timing_question"\) recordUtilityAnswer\(answer\)/);
  assert.match(ui, /utilityTimingAnswer === "unsure"/); assert.match(ui, /You have a workable next step/); assert.match(ui, />Done for now<\/button>/);
});

test("post-utility state renders one unified final outcome without a duplicate recommendation", () => {
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /recommendation && journeyStep === "repair_review"/);
  assert.match(ui, /journeyStep === "utility_timing_review" \? <section className=\{`\$\{styles\.completion\}/);
  assert.doesNotMatch(ui, /journeyStep === "utility_timing_review" \? <><section className=\{styles\.completedTurn\}/);
  assert.match(ui, /You have a workable next step/); assert.match(ui, /Nothing has been moved or saved/);
});

test("final utility allocations retain the existing approved yes and no results", () => {
  const yes = allocateNextDollar({ repairRequiredForWork: true, protectUtility: true }).options[0].allocations.filter((item) => item.allocated > 0);
  assert.deepEqual(yes.map((item) => [item.needId, item.allocated]), [["repair", 500], ["card-minimum", 75], ["utility", 180], ["current-rent", 145]]);
  const no = allocateNextDollar({ repairRequiredForWork: true, protectUtility: false }).options[0].allocations.filter((item) => item.allocated > 0);
  assert.deepEqual(no.map((item) => [item.needId, item.allocated]), [["repair", 500], ["card-minimum", 75], ["current-rent", 325]]);
});

test("final outcome reconciles canonical available and allocated values without hiding over-allocation", () => {
  for (const protectUtility of [true, false]) {
    const result = allocateNextDollar({ repairRequiredForWork: true, protectUtility });
    const option = result.options.find((item) => item.id === result.recommendedId) || null;
    const reconciliation = reconcileAllocation(result, option);
    assert.deepEqual(reconciliation, { available: 900, allocated: 900, leftUnallocated: 0, exceedsAvailable: false });
    assert.equal(option?.allocations.find((item) => item.needId === "current-rent")?.allocated, protectUtility ? 145 : 325);
  }
  const result = allocateNextDollar({ repairRequiredForWork: true, protectUtility: true });
  const invalidOption = { ...result.options[0], allocations: result.options[0].allocations.map((line) => line.needId === "current-rent" ? { ...line, allocated: line.allocated + 1 } : line) };
  assert.deepEqual(reconcileAllocation(result, invalidOption), { available: 900, allocated: 901, leftUnallocated: 0, exceedsAvailable: true });
});

test("completion and stopped summaries show reconciliation from the allocation result", () => {
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  for (const copy of ["Available now", "Allocated", "Left unallocated", "Allocation", "Nothing has been moved or saved"]) assert.match(ui, new RegExp(copy));
  assert.match(ui, /reconcileAllocation\(allocation, recommendation\)/); assert.match(ui, /reconciliation\.available/); assert.match(ui, /reconciliation\.allocated/); assert.match(ui, /reconciliation\.leftUnallocated/);
  assert.match(ui, /reconciliation\.exceedsAvailable \? <div className=\{styles\.reconciliationError\} role="alert"/);
  assert.match(ui, /if \(stopped\)[\s\S]*\{moneyReconciliation\}[\s\S]*\{allocationSummary\}/);
});

test("preliminary utility amount stays conditional while confirmed timing remains consistent", () => {
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /utilityConditionalAmount/); assert.match(ui, /utility amount is not a confirmed allocation/);
  assert.match(buildOutcomeCopy({ repairAnswer: "yes", utilityTimingAnswer: "yes", allocations: [] }).utilityTiming, /Confirmed: the utility is due/);
  assert.match(buildOutcomeCopy({ repairAnswer: "yes", utilityTimingAnswer: "no", allocations: [] }).utilityTiming, /Confirmed: the utility can wait/);
  assert.match(buildOutcomeCopy({ repairAnswer: "yes", utilityTimingAnswer: "unsure", allocations: [] }).utilityTiming, /Unconfirmed/);
  assert.match(ui, /outcomeCopy\.unresolvedFacts/);
  assert.doesNotMatch(ui, /utilityTimingAnswer === "unsure" \? "Utility timing still needs verification\." : allocation\.limitation/);
});

test("all nine repair and utility answer combinations use canonical outcome copy", () => {
  for (const repairAnswer of ["yes", "no", "unsure"]) for (const utilityTimingAnswer of ["yes", "no", "unsure"]) {
    const result = allocateNextDollar({ repairRequiredForWork: repairAnswer === "yes", protectUtility: utilityTimingAnswer === "yes" });
    const allocations = result.options[0].allocations;
    const copy = buildOutcomeCopy({ repairAnswer, utilityTimingAnswer, allocations });
    const rentReserve = allocations.find((line) => line.needId === "current-rent").allocated;
    assert.match(copy.rationale, new RegExp(`\\$${rentReserve}`));
    assert.equal(copy.preliminary, repairAnswer === "unsure" || utilityTimingAnswer === "unsure");
    if (repairAnswer === "yes") assert.match(copy.rationale, /repair comes first.*required to keep working/i);
    if (repairAnswer === "no") { assert.match(copy.rationale, /repair can wait/i); assert.doesNotMatch(copy.rationale, /repair comes first|repair.*protects.*work/i); }
    if (repairAnswer === "unsure") { assert.match(copy.rationale, /still unconfirmed|preliminary/i); assert.doesNotMatch(copy.rationale, /repair comes first|repair can wait/i); }
    if (utilityTimingAnswer === "yes") { assert.match(copy.utilityTiming, /^Confirmed:.*due before/); assert.ok(!copy.unresolvedFacts.some((fact) => /utility/i.test(fact))); }
    if (utilityTimingAnswer === "no") { assert.match(copy.utilityTiming, /^Confirmed:.*wait until after/); assert.ok(!copy.unresolvedFacts.some((fact) => /utility/i.test(fact))); }
    if (utilityTimingAnswer === "unsure") { assert.match(copy.utilityTiming, /^Unconfirmed:/); assert.ok(copy.unresolvedFacts.some((fact) => /utility/i.test(fact))); }
    assert.equal(allocations.reduce((sum, line) => sum + line.allocated, 0), result.availableBeforeNextIncome);
  }
});

test("repair no plus utility yes defers repair and reconciles the correct rent reserve", () => {
  const result = allocateNextDollar({ repairRequiredForWork: false, protectUtility: true });
  const allocations = result.options[0].allocations;
  assert.deepEqual(allocations.filter((line) => line.allocated > 0).map((line) => [line.needId, line.allocated]), [["card-minimum", 75], ["utility", 180], ["current-rent", 645]]);
  const copy = buildOutcomeCopy({ repairAnswer: "no", utilityTimingAnswer: "yes", allocations });
  assert.match(copy.rationale, /repair can wait/); assert.match(copy.rationale, /\$645/); assert.doesNotMatch(copy.rationale, /\$145|repair comes first|protects your ability to work/);
  assert.deepEqual(reconcileAllocation(result, result.options[0]), { available: 900, allocated: 900, leftUnallocated: 0, exceedsAvailable: false });
});

test("conversational repair edits propose, confirm, reject, clarify, and never silently disappear", () => {
  assert.deepEqual(interpretJourneyEdit("change car to $400"), { type: "repair_amount_proposal", amount: 400 });
  assert.deepEqual(interpretJourneyEdit("change the car repair"), { type: "repair_amount_clarification" });
  assert.deepEqual(interpretJourneyEdit("change rent to $400"), { type: "unsupported" });
  const before = allocateNextDollar({ repairRequiredForWork: true, repairAmount: 500, protectUtility: true });
  const after = allocateNextDollar({ repairRequiredForWork: true, repairAmount: 400, protectUtility: true });
  assert.equal(before.options[0].allocations.find((line) => line.needId === "repair").allocated, 500);
  assert.equal(after.options[0].allocations.find((line) => line.needId === "repair").allocated, 400);
  assert.equal(after.options[0].allocations.find((line) => line.needId === "current-rent").allocated, 245);
  assert.match(buildOutcomeCopy({ repairAnswer: "yes", utilityTimingAnswer: "yes", allocations: after.options[0].allocations }).rationale, /\$400/);
  assert.deepEqual(reconcileAllocation(after, after.options[0]), { available: 900, allocated: 900, leftUnallocated: 0, exceedsAvailable: false });
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  for (const contract of [/Change the car-repair amount from/, /Yes, change it/, />No<\//, /That’s not what I meant/, /setRepairAmount\(pendingCorrection\.amount\)/, /Kept the repair estimate at/, /Undo repair amount change/, /This preview cannot apply that request/, /outcome !== "added"/, /aria-live="polite"/]) assert.match(ui, contract);
  assert.match(ui, /onFinalTranscript: \(transcript\) => applyStatement\(transcript\)/); assert.match(ui, /Nothing is moved, activated, or saved to Financial Memory/);
});

test("repair edit synthesis comes from before-and-after allocation comparison", () => {
  const result = (repairRequiredForWork, repairAmount, protectUtility = false) => allocateNextDollar({ repairRequiredForWork, repairAmount, protectUtility });
  const impact = (repairAnswer, beforeAmount, afterAmount, utilityTimingAnswer = "no") => {
    const prior = result(repairAnswer === "yes", beforeAmount, utilityTimingAnswer === "yes");
    const updated = result(repairAnswer === "yes", afterAmount, utilityTimingAnswer === "yes");
    return presentRepairAmountChange({ before: beforeAmount, after: afterAmount, priorAllocations: prior.options[0].allocations, updatedAllocations: updated.options[0].allocations, priorRecommendationId: prior.recommendedId, updatedRecommendationId: updated.recommendedId, repairAnswer, utilityTimingAnswer });
  };
  const deferredDecrease = impact("no", 500, 400); assert.equal(deferredDecrease.allocationChanged, false); assert.match(deferredDecrease.synthesis, /currently deferred.*allocation does not change/i); assert.doesNotMatch(deferredDecrease.synthesis, /frees|additional.*available/i);
  const deferredIncrease = impact("no", 500, 600); assert.equal(deferredIncrease.allocationChanged, false); assert.match(deferredIncrease.synthesis, /allocation does not change/i); assert.doesNotMatch(deferredIncrease.synthesis, /uses an additional|reduced available/i);
  const requiredDecrease = impact("yes", 500, 400); assert.equal(requiredDecrease.allocationChanged, true); assert.deepEqual(requiredDecrease.allocationDeltas.map((line) => [line.needId, line.delta]), [["repair", -100], ["current-rent", 100]]); assert.match(requiredDecrease.synthesis, /frees \$100.*rent reserve.*\$100/i);
  const requiredIncrease = impact("yes", 400, 500); assert.deepEqual(requiredIncrease.allocationDeltas.map((line) => [line.needId, line.delta]), [["repair", 100], ["current-rent", -100]]); assert.match(requiredIncrease.synthesis, /uses an additional \$100.*rent reserve.*decreases by \$100/i);
  const unsure = impact("unsure", 500, 400, "unsure"); assert.equal(unsure.preliminary, true); assert.match(unsure.synthesis, /remains preliminary/i);
});

test("correction proposal is the focused active turn above secondary outcome actions", () => {
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  assert.ok(ui.indexOf("styles.outcomeSummary") < ui.indexOf("styles.correction") && ui.indexOf("styles.correction") < ui.indexOf("styles.mainActions"));
  assert.match(ui, /correctionRef\.current\?\.focus\(\)/); assert.match(ui, /correctionRef\.current\?\.scrollIntoView/);
  assert.match(ui, /pendingCorrection \? styles\.withActiveCorrection/); assert.match(ui, /disabled=\{Boolean\(pendingCorrection\)\}/);
  const css = readFileSync(new URL("../components/account/adaptive-journey-preview.module.css", import.meta.url), "utf8");
  assert.match(css, /\.withActiveCorrection \.outcomeSummary\{opacity:/);
});

test("final actions are consolidated, specific, and expose only supported adjustments", () => {
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  for (const label of ["Done for now", "Change an answer or amount", "Review details", "More actions", "Undo utility timing answer", "Undo repair urgency answer", "Undo repair amount change", "Restart this decision"]) assert.match(ui, new RegExp(label));
  assert.doesNotMatch(ui, /Adjust recommendation|Undo last answer/);
  for (const label of ["Repair urgency", "Repair estimate", "Utility timing"]) assert.match(ui, new RegExp(label));
  assert.doesNotMatch(ui, />Available amount</);
  assert.match(ui, /changeRepairAnswer\(\)/); assert.match(ui, /openRepairAmountAdjustment/); assert.match(ui, /changeUtilityAnswer\(\)/);
  assert.match(ui, /utilityTimingAnswer \? <button onClick=\{undoUtilityAnswer\}/); assert.match(ui, /priorRepairAmount != null \? <button onClick=\{undoRepairAmount\}/);
});

test("guidance menu is isolated, closes after selection, and preserves journey state", () => {
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /className=\{styles\.guidanceControl\}/); assert.match(ui, /showGuidanceMenu \? <div className=\{styles\.guidanceMenu\}/);
  assert.match(ui, /setMode\(nextMode\); setShowGuidanceMenu\(false\)/); assert.match(ui, /guidanceButtonRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(ui, /<details className=\{styles\.guidance\}>/); assert.doesNotMatch(ui, /selectGuidanceMode[^{]*\{[^}]*setRepairAnswer/);
  const css = readFileSync(new URL("../components/account/adaptive-journey-preview.module.css", import.meta.url), "utf8");
  assert.match(css, /\.guidanceMenu\{position:absolute/);
});

test("completed outcome reduces procedural scaffolding and remains mobile accessible", () => {
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /Your money picture/); assert.match(ui, /Why this recommendation/);
  assert.match(ui, /journeyStep !== "utility_timing_review" \? <details className=\{styles\.known\}/);
  const css = readFileSync(new URL("../components/account/adaptive-journey-preview.module.css", import.meta.url), "utf8");
  assert.match(css, /@media\(max-width:700px\)/); assert.match(css, /min-height:44px/); assert.doesNotMatch(css, /overflow-x:\s*(?:auto|scroll)/);
});

test("reconciliation remains readable at narrow widths and 200 percent zoom", () => {
  const css = readFileSync(new URL("../components/account/adaptive-journey-preview.module.css", import.meta.url), "utf8");
  assert.match(css, /\.reconciliation\{display:grid/); assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /\.reconciliation\{grid-template-columns:1fr\}/); assert.match(css, /minmax\(0,1fr\) auto/);
  assert.doesNotMatch(css, /overflow-x:\s*(?:auto|scroll)/);
});

test("uncertain utility timing remains preliminary with a bounded verification step", () => {
  const presentation = buildJourneyPresentation({ mode: "guided", repairAnswer: "yes", utilityTimingAnswer: "unsure", step: "utility_timing_review" });
  assert.equal(presentation.completion, "preliminary_answer_reached"); assert.match(presentation.synthesis, /preliminary/i);
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /You have a preliminary next step/); assert.match(ui, /Utility timing remains unconfirmed/); assert.match(ui, /utility amount is not a confirmed allocation/); assert.match(ui, /Verify whether it is due before your next paycheck/);
});

test("final outcome owns focus and reduced-motion-aware scrolling", () => {
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /finalOutcomeRef\.current/); assert.match(ui, /heading\?\.focus\(\)/); assert.match(ui, /heading\?\.scrollIntoView/);
  assert.match(ui, /prefers-reduced-motion: reduce/); assert.match(ui, /ref=\{finalOutcomeRef\} tabIndex=\{-1\}/);
});

test("completion actions preserve session state and reveal details without duplicating summary", () => {
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, />Done for now<\/button>/); assert.match(ui, /setStopped\(true\)/); assert.match(ui, />Resume<\/button>/);
  assert.match(ui, /setStopped\(false\); setShowFinalDetails\(true\)/);
  assert.match(ui, /setPriorUtilityAnswer\(utilityTimingAnswer\); setActivatingAnswer\(utilityTimingAnswer\)/);
  assert.doesNotMatch(ui, /changeUtilityAnswer[^\n]*setUtilityTimingAnswer\(null\)/);
  assert.match(ui, /aria-expanded=\{showFinalDetails\}/); assert.match(ui, /Recommendation details/);
});

test("final composer is subordinate and remains keyboard and voice accessible", () => {
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /<details className=\{styles\.finalComposer\}><summary>Ask or change something<\/summary><Composer/);
  assert.match(ui, /event\.key === "Enter"/); assert.match(ui, /Microphone/);
  const css = readFileSync(new URL("../components/account/adaptive-journey-preview.module.css", import.meta.url), "utf8");
  assert.match(css, /\.finalComposer/); assert.match(css, /min-height:44px/); assert.doesNotMatch(css, /overflow-x:\s*(?:auto|scroll)/);
});

test("concise, expert, and stopping states preserve reasoning without developer state language", () => {
  const ui = readFileSync(new URL("../components/account/adaptive-journey-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /mode === "concise"/); assert.match(ui, /Your situation/); assert.match(ui, /mode === "expert"/); assert.match(ui, /Full financial reasoning/);
  for (const section of ["Goal and available resources", "Timing and required obligations", "Protected priorities", "Assumptions and missing facts", "Evidence and calculation"]) assert.match(ui, new RegExp(section));
  assert.match(ui, /Nothing has been moved or saved/); assert.match(ui, /Done for now/); assert.match(ui, /Resume/); assert.doesNotMatch(ui, /state machine|raw enum|internal ID/i);
});

test("interaction tokens distinguish neutral, selected, confirmed, warning, recommendation, completion, and focus", () => {
  const css = readFileSync(new URL("../components/account/adaptive-journey-preview.module.css", import.meta.url), "utf8");
  for (const token of ["--brand", "--line", "--surface", "--confirmed", "--warning", "--focus"]) assert.match(css, new RegExp(token));
  assert.match(css, /\.choice\[aria-pressed=true\]/); assert.match(css, /\.confirmed/); assert.match(css, /\.warning/); assert.match(css, /\.recommendation/); assert.match(css, /\.completion/); assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/); assert.match(css, /min-height:44px/); assert.doesNotMatch(css, /overflow-x:\s*(?:auto|scroll)/);
});

test("adaptive journey remains mobile-first and accessible at 390px", () => {
  const css = readFileSync(new URL("../components/account/adaptive-journey-preview.module.css", import.meta.url), "utf8");
  assert.match(css, /@media\(max-width:700px\)/); assert.match(css, /min-height:44px/); assert.match(css, /overflow-x:hidden/); assert.match(css, /grid-template-columns:1fr/); assert.doesNotMatch(css, /overflow-x:\s*(?:auto|scroll)/);
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
  for (const copy of ["Recommended", "Alternative", "Why ", "Show details", "Protect Callie’s activities", "Missing financial evidence", "Flow B next step"]) assert.match(ui, new RegExp(copy));
  assert.match(ui, /aria-label="Flow B next step"/); assert.match(ui, /aria-label="Whole-picture situation preview"/); assert.match(ui, /aria-label="Proposed change requiring confirmation"/);
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
  assert.match(css, /@media\(max-width:700px\)/); assert.match(css, /\.prompts,\.goal,\.voiceControls,\.reviewActions,\.modeActions\{display:grid\}/); assert.match(css, /min-height:44px/);
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
  assert.match(ui, /inputStep === 0[\s\S]*How much is currently outstanding/);
  assert.match(ui, /inputStep >= 2 && !targetMode[\s\S]*I have a date[\s\S]*Show me realistic timelines/);
  assert.match(ui, /targetMode === "fixed_date" && !deadline[\s\S]*When do you want to be caught up/);
  assert.match(ui, /setInputStep\(\(step\) => Math\.min\(2, step \+ 1\)\)/); assert.match(ui, /User-provided confirmed facts/);
  assert.doesNotMatch(ui, /className=\{styles\.inputs\}/);
});

test("completed rent inputs produce levers, options, rationale, and constraint recalculation", () => {
  const gap = completeGap(); const all = candidateLevers([{ key: "callie", label: "Callie’s activities", category: "Family", amount: 180, transactionIds: ["c1", "c2"], flexibility: "discretionary", recurring: true }, { key: "delivery", label: "Delivery", category: "Food", amount: 700, transactionIds: ["d1", "d2"], flexibility: "discretionary", recurring: true }]);
  const options = generateRecoveryOptions(gap, all); assert.ok(options.length >= 1);
  const protectedLevers = candidateLevers([{ key: "callie", label: "Callie’s activities", category: "Family", amount: 180, transactionIds: ["c1", "c2"], flexibility: "discretionary", recurring: true }, { key: "delivery", label: "Delivery", category: "Food", amount: 700, transactionIds: ["d1", "d2"], flexibility: "discretionary", recurring: true }], [{ kind: "protect", key: "callie", value: "Callie’s activities" }]);
  assert.equal(protectedLevers.some((lever) => lever.label.includes("Callie")), false); assert.notEqual(protectedLevers.length, all.length);
});

test("target modes stay distinct and a suggested or flexible timeline never becomes a fixed date", () => {
  const ui = readFileSync(new URL("../components/account/conversation-strategy-preview.tsx", import.meta.url), "utf8");
  const triage = readFileSync(new URL("../lib/conversation/financial-triage.ts", import.meta.url), "utf8");
  for (const mode of ["fixed_date", "suggested_date", "flexible_timeline", "monthly_contribution_target", "as_soon_as_practical"]) assert.match(ui, new RegExp(mode));
  assert.match(ui, /targetDate: targetMode === "fixed_date" \? deadline \|\| null : null/);
  assert.match(triage, /suggested: true, confirmed: false/);
});

test("missing fixed date still permits quantified suggested timeline options", () => {
  const gap = completeGap({ targetCatchUpDate: null, analysisWindow: { start: "2026-08-04", end: "2026-09-03" } });
  const levers = candidateLevers([{ key: "delivery", label: "Delivery", category: "Food", amount: 700, transactionIds: ["d1", "d2"], flexibility: "discretionary", recurring: true }]);
  const options = generateTimelineOptions({ gap, levers, mode: "suggested_date", asOf: "2026-08-04" });
  assert.ok(options.length); assert.equal(gap.targetCatchUpDate, null);
  for (const option of options) { assert.ok(option.durationMonths > 0); assert.ok(option.contributionPerMonth > 0); assert.ok(option.projectedCompletionDate); assert.equal(option.confirmed, false); }
});

test("monthly contribution and as-soon-as-practical modes retain different contracts", () => {
  const gap = completeGap({ targetCatchUpDate: null }); const levers = candidateLevers([{ key: "delivery", label: "Delivery", category: "Food", amount: 700, transactionIds: ["d1", "d2"], flexibility: "discretionary", recurring: true }]);
  const monthly = generateTimelineOptions({ gap, levers, mode: "monthly_contribution_target", monthlyContribution: 125, asOf: "2026-08-04" });
  const fastest = generateTimelineOptions({ gap, levers, mode: "as_soon_as_practical", asOf: "2026-08-04" });
  assert.equal(monthly[0].targetMode, "monthly_contribution_target"); assert.equal(monthly[0].contributionPerMonth, 125);
  assert.equal(fastest[0].targetMode, "as_soon_as_practical"); assert.equal(fastest.length, 1); assert.notEqual(fastest[0].contributionPerMonth, monthly[0].contributionPerMonth);
});

test("analysis-window income, exclusive obligations, and reconciliation are auditable", () => {
  const income = expectedIncomeWithinWindow([{ amount: 900, expectedDate: "2026-08-15", evidenceId: "pay-1" }, { amount: 900, expectedDate: "2026-09-15", evidenceId: "pay-2" }], { start: "2026-08-04", end: "2026-09-03" });
  assert.equal(income.amount, 900); assert.deepEqual(income.evidenceIds, ["pay-1"]);
  assert.throws(() => assertMutuallyExclusiveEvidence({ upcoming_obligations: ["same"], recurring_commitments: ["same"] }), /OVERLAPPING_OBLIGATION_EVIDENCE/);
  const gap = completeGap({ expectedIncome: income.amount, analysisWindow: income.window });
  assert.equal(gap.availableForGoal, 0); assert.equal(gap.estimatedShortfall, gap.remainingAmount);
  assert.deepEqual(gap.reconciliation.map((line) => line.label), ["Known cash", "Less protected reserve", "Plus expected income", "Less protected obligations", "Less upcoming obligations", "Less recurring commitments", "Less essential spending", "Equals available for goal", "Outstanding amount", "Equals remaining gap"]);
});

test("Callie protection materially recalculates timeline amounts and dates", () => {
  const gap = completeGap({ outstanding: 800, targetCatchUpDate: null }); const candidates = [{ key: "callie", label: "Callie’s activities", category: "Family", amount: 180, transactionIds: ["c1", "c2"], flexibility: "discretionary", recurring: true }, { key: "delivery", label: "Delivery", category: "Food", amount: 700, transactionIds: ["d1", "d2"], flexibility: "discretionary", recurring: true }];
  const open = generateTimelineOptions({ gap, levers: candidateLevers(candidates), mode: "suggested_date", asOf: "2026-08-04" });
  const constraints = [{ kind: "protect", key: "callie", value: "Callie’s activities" }]; const protectedOptions = generateTimelineOptions({ gap, levers: candidateLevers(candidates, constraints), constraints, mode: "suggested_date", asOf: "2026-08-04" });
  assert.notEqual(open[0].contributionPerMonth, protectedOptions[0].contributionPerMonth); assert.notEqual(open[0].projectedCompletionDate, protectedOptions[0].projectedCompletionDate); assert.deepEqual(protectedOptions[0].protectedExpenses, ["Callie’s activities"]);
});

test("Next Best Step follows goal facts, target mode, and proposal confirmation", () => {
  const base = { evidenceIds: ["rent"], priority: "urgent" };
  assert.match(selectNextBestStep({ ...base, goalConfirmationRequired: true }).label, /Confirm the housing/);
  assert.equal(selectNextBestStep({ ...base, missingInputs: ["normal monthly rent"] }).label, "Provide normal monthly rent");
  assert.equal(selectNextBestStep({ ...base, timelineChoiceRequired: true }).label, "Choose how to set the recovery timeline");
  assert.equal(selectNextBestStep({ ...base, targetMode: "fixed_date", optionsReady: false }).label, "Provide target date");
  assert.equal(selectNextBestStep({ ...base, targetMode: "fixed_date", fixedDateProvided: true, optionsReady: false }).label, "Review fixed-date feasibility");
  assert.equal(selectNextBestStep({ ...base, targetMode: "suggested_date", optionsReady: true, proposedTargetReady: true }).label, "Review and confirm the proposed target");
});

test("Flow B remains session-only, accessible, and cannot activate a plan", () => {
  const ui = readFileSync(new URL("../components/account/conversation-strategy-preview.tsx", import.meta.url), "utf8"); const css = readFileSync(new URL("../components/account/conversation-strategy-preview.module.css", import.meta.url), "utf8");
  for (const copy of ["I have a date", "Show me realistic timelines", "I want steady monthly progress", "As soon as practical", "No target selected", "not saved or activated"]) assert.match(ui, new RegExp(copy));
  assert.match(ui, /aria-label="Choose recovery timeline approach"/); assert.match(ui, /autoFocus/); assert.match(css, /@media\(max-width:700px\)/); assert.match(css, /min-height:44px/);
  assert.doesNotMatch(ui, /FinancialMemory|localStorage|sessionStorage|fetch\(|insert\(|upsert\(/);
});

test("natural account follow-up paraphrases share one bounded read-only intent", () => {
  const context = orchestrateConversation(request("How many payments were made to OLU’KAI?")).context;
  for (const phrase of ["Which card did I use?", "What card did I use?", "What card did I use for this?", "Which account paid for these?", "Where did those payments come from?", "Did I use more than one card?"]) {
    const intent = routeConversationIntent(phrase, context); assert.equal(intent.type, "account_question"); assert.equal(intent.factual, true); assert.equal(intent.mutating, false); assert.equal(intent.clarificationRequired, false);
  }
});

test("What card did I use for this reuses exact prior OLU’KAI evidence and may auto-send", () => {
  const transactions = [transaction({ id: "capital", accountLabel: "Capital One · 4242", amount: 89 }), transaction({ id: "td", accountLabel: "TD Checking · 9214", amount: 110 })];
  const first = orchestrateConversation({ ...request("How many payments were made to OLU’KAI?"), transactions });
  const followUp = orchestrateConversation({ ...request("What card did I use for this?", first.context), transactions });
  assert.equal(followUp.message, "You used Capital One ending in 4242 for one payment and TD Checking ending in 9214 for the other.");
  assert.deepEqual(followUp.context.transactionIds, first.evidence.transactionIds);
  assert.deepEqual(followUp.nextBestStep.evidenceIds, first.evidence.transactionIds);
  assert.equal(assessVoiceTurn({ transcript: "What card did I use for this?", confidence: .98, pendingProposal: false, activeContext: first.context }).autoSend, true);
});

test("missing and ambiguous reference antecedents ask rather than guess", () => {
  const missing = orchestrateConversation(request("What card did I use for this?")); assert.equal(missing.kind, "clarification_question"); assert.match(missing.message, /What payments are you referring to/);
  const first = orchestrateConversation(request("How many payments were made to OLU’KAI?"));
  const ambiguous = orchestrateConversation(request("What card did I use for that payment?", first.context)); assert.equal(ambiguous.kind, "clarification_question"); assert.match(ambiguous.message, /Which payment do you mean/);
  assert.equal(assessVoiceTurn({ transcript: "What card did I use for this?", confidence: .98, pendingProposal: false }).autoSend, false);
});

test("bounded references support unique relatives and cannot leak after a topic change", () => {
  const transactions = [transaction({ id: "small", amount: 89 }), transaction({ id: "large", amount: 110 })]; const first = orchestrateConversation({ ...request("How many payments were made to OLU’KAI?"), transactions });
  assert.deepEqual(resolveTransactionReference("the first one", first.context, transactions).transactionIds, ["small"]);
  assert.deepEqual(resolveTransactionReference("the other one", first.context, transactions).transactionIds, ["large"]);
  assert.deepEqual(resolveTransactionReference("the larger charge", first.context, transactions).transactionIds, ["large"]);
  const changed = orchestrateConversation({ ...request("How many payments were made to Target?", first.context), transactions });
  const afterChange = orchestrateConversation({ ...request("What card did I use for this?", changed.context), transactions }); assert.equal(afterChange.kind, "clarification_question");
});

test("consequential reference requests remain review-gated", () => {
  const context = orchestrateConversation(request("How many payments were made to OLU’KAI?")).context;
  const assessment = assessVoiceTurn({ transcript: "Categorize that payment as a gift.", confidence: .99, pendingProposal: false, activeContext: context });
  assert.equal(assessment.autoSend, false); assert.equal(assessment.reviewRequired, true);
});

test("Callie protection follows candidate-lever disclosure and remains temporary", () => {
  const ui = readFileSync(new URL("../components/account/conversation-strategy-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /\{options\.length \? <section className=\{styles\.protectionBlock\}/);
  assert.match(ui, /Protect Callie’s activities/); assert.match(ui, /Exclude this expense from the recovery options/); assert.match(ui, /Plan-specific/);
  assert.match(ui, /candidateLevers\(spend, constraints\)/); assert.match(ui, /generateTimelineOptions\(\{ gap, levers, constraints/);
  assert.doesNotMatch(ui, /FinancialMemory|localStorage|sessionStorage|insert\(|upsert\(/);
});

test("Flow B facts and protection control reflow cleanly at 390px", () => {
  const ui = readFileSync(new URL("../components/account/conversation-strategy-preview.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../components/account/conversation-strategy-preview.module.css", import.meta.url), "utf8");
  for (const label of ["Normal monthly rent", "Currently outstanding", "Target approach"]) assert.ok(ui.includes(label));
  assert.match(ui, /confirmedFacts[\s\S]*<article><div><strong>Normal monthly rent<\/strong><span>/);
  assert.match(css, /\.confirmedFacts article>div\{display:grid;gap:/); assert.match(css, /@media\(max-width:700px\)\{\.confirmedFacts article\{grid-template-columns:1fr/);
  assert.match(css, /\.confirmedFacts article button\{[^}]*white-space:nowrap/); assert.match(css, /\.confirmedFacts article span\{overflow-wrap:anywhere/);
  assert.match(ui, /className=\{styles\.protectionControl\}/); assert.match(ui, /type="checkbox" checked=\{protectCallie\}/); assert.match(ui, /role="status" aria-live="polite"/);
  assert.match(ui, /Callie’s activities are included under Protected priorities/); assert.match(ui, />Undo</);
  assert.doesNotMatch(ui, /Plan-scoped protected priority/); assert.doesNotMatch(css, /overflow-x:\s*(?:auto|scroll)/);
  assert.match(css, /min-height:44px/);
});

test("canonical recommendation identity aligns highlight, rationale, CTA, and proposed target", () => {
  const state = buildRecommendationPresentation({ optionIds: ["Fastest", "Balanced", "Lowest disruption"], recommendedId: "Fastest", previewedId: "Balanced", proposedId: "Fastest" });
  assert.equal(state.recommendedId, "Fastest"); assert.equal(state.highlightedId, state.recommendedId); assert.equal(state.rationaleId, state.recommendedId); assert.equal(state.primaryCtaId, state.recommendedId); assert.equal(state.proposedId, state.recommendedId);
  assert.equal(state.previewedId, "Balanced"); assert.equal(state.confirmedId, null);
});

test("inconsistent recommendation references fail safely", () => {
  assert.equal(buildRecommendationPresentation({ optionIds: ["Fastest", "Balanced"], recommendedId: "Fastest", proposedId: "Balanced" }), null);
  assert.equal(buildRecommendationPresentation({ optionIds: ["Fastest"], recommendedId: "Fastest", previewedId: "Lowest disruption" }), null);
  assert.equal(buildRecommendationPresentation({ optionIds: ["Fastest"], recommendedId: "Fastest", confirmedId: "Fastest" }), null);
});

test("target modes use consumer language and estimated dates avoid unsupported precision", () => {
  assert.deepEqual(["fixed_date", "suggested_date", "flexible_timeline", "monthly_contribution_target", "as_soon_as_practical"].map(targetModeLabel), ["I have a date", "Show me realistic timelines", "Keep my timeline flexible", "Steady monthly progress", "As soon as practical"]);
  const estimate = estimatedTimelineCopy(13, 612, "2027-09-04"); assert.equal(estimate.duration, "About 13 months"); assert.equal(estimate.catchUp, "Estimated catch-up: around September 2027"); assert.match(estimate.pace, /approximately \$612 per month beginning next month/); assert.doesNotMatch(Object.values(estimate).join(" "), /2027-09-04/);
  const ui = readFileSync(new URL("../components/account/conversation-strategy-preview.tsx", import.meta.url), "utf8"); assert.doesNotMatch(ui, /targetMode\.replaceAll/); assert.doesNotMatch(ui, /estimated \{timeline\.projectedCompletionDate\}/);
});

test("Flow-scoped guidance and recommendation states remain distinct", () => {
  const ui = readFileSync(new URL("../components/account/conversation-strategy-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /Flow A complete/); assert.match(ui, /aria-label="Flow B next step"/); assert.doesNotMatch(ui, />Next best step</);
  assert.match(ui, /previewedOptionId/); assert.match(ui, /proposedTargetId/); assert.match(ui, /confirmedTargetId/);
  assert.match(ui, /Currently previewing:[\s\S]*does not change Covarify’s/); assert.match(ui, /setPreviewedOptionId\(option\.name\); setOptionReviewed\(true\)/);
  assert.doesNotMatch(ui, /setPreviewedOptionId\(option\.name\)[^\n]*setProposedTargetId/);
});

test("Callie rationale explains changed or retained recommendation without durable writes", () => {
  const ui = readFileSync(new URL("../components/account/conversation-strategy-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /remains recommended because it still contributes the most while preserving Callie’s activities/); assert.match(ui, /recommendation changed from/);
  assert.match(ui, /Protected:/); assert.match(ui, /candidateLevers\(spend, constraints\)/);
  assert.doesNotMatch(ui, /FinancialMemory|localStorage|sessionStorage|fetch\(|insert\(|upsert\(/);
});

test("whole-picture allocation detects competing needs and preserves obligation identity", () => {
  const fixture = founderAllocationFixture();
  assert.ok(fixture.needs.length >= 6);
  assert.notEqual(fixture.needs.find((need) => need.type === "current_housing").id, fixture.needs.find((need) => need.type === "housing_arrears").id);
  const minimum = fixture.needs.find((need) => need.type === "debt_minimum");
  assert.equal(minimum.amountRequired, 75); assert.equal(minimum.fullAmount, 2400); assert.equal(minimum.partialPaymentUsefulness, "verified_not_useful");
});

test("one recognized blocking question gates final strategy but not orientation", () => {
  const result = allocateNextDollar({ repairRequiredForWork: null });
  assert.equal(result.blockingQuestion.prompt, "Is the $500 repair required for you to keep working?");
  assert.equal(result.guidance, "enough_to_orient"); assert.match(result.simpleExplanation, /I found the repair, card minimum/);
  assert.equal(result.options.length, 0); assert.equal(result.durableWriteBlocked, true);
});

test("income-protecting repair outranks arrears and allocation stays within cash", () => {
  const result = allocateNextDollar({ repairRequiredForWork: true }); const option = result.options[0];
  assert.equal(option.allocations.find((line) => line.needId === "repair").allocated, 500);
  assert.equal(option.allocations.find((line) => line.needId === "rent-arrears").allocated, 0);
  assert.equal(option.allocations.reduce((sum, line) => sum + line.allocated, 0), 900);
  assert.match(result.simpleExplanation, /ability to work/); assert.equal(result.guidance, "preliminary_recommendation"); assert.ok(result.limitation);
});

test("timing and resource classification exclude uncertain or non-cash resources", () => {
  const fixture = founderAllocationFixture(); const excluded = Object.fromEntries(fixture.resources.filter((item) => !item.included).map((item) => [item.kind, item]));
  for (const kind of ["uncertain_income", "credit", "investment"]) assert.ok(excluded[kind].exclusionReason);
  assert.equal(allocateNextDollar({ fixture, repairRequiredForWork: true }).availableBeforeNextIncome, 900);
  assert.equal(fixture.income.find((item) => item.kind === "uncertain_commission").available, false);
  const timeline = allocateNextDollar({ fixture, repairRequiredForWork: true }).timeline; assert.ok(timeline.find((event) => event.id === "need:repair")); assert.ok(timeline.find((event) => event.id === "paycheck")); assert.ok(timeline.findIndex((event) => event.id === "need:card-minimum") < timeline.findIndex((event) => event.id === "paycheck"));
});

test("transfers and business funds are contractually unavailable unless explicitly included", () => {
  const fixture = founderAllocationFixture();
  fixture.resources.push({ id: "transfer", title: "Savings transfer", amount: 500, kind: "transfer", availableDate: fixture.asOf, confidence: "high", evidenceIds: ["transfer-1"], included: false, exclusionReason: "A transfer is not new income.", deduplicationKey: "transfer:1" });
  fixture.resources.push({ id: "business", title: "Business account", amount: 700, kind: "business", availableDate: fixture.asOf, confidence: "high", evidenceIds: ["business-1"], included: false, exclusionReason: "Business funds are not automatically personal funds.", deduplicationKey: "business:1" });
  assert.equal(allocateNextDollar({ fixture, repairRequiredForWork: true }).availableBeforeNextIncome, 900);
});

test("utility protection recalculates the allocation without double counting", () => {
  const baseline = allocateNextDollar({ repairRequiredForWork: true }); const protectedResult = allocateNextDollar({ repairRequiredForWork: true, protectUtility: true });
  assert.equal(baseline.options[0].allocations.find((line) => line.needId === "utility").allocated, 0);
  assert.equal(protectedResult.options[0].allocations.find((line) => line.needId === "utility").allocated, 180);
  assert.equal(protectedResult.options[0].allocations.reduce((sum, line) => sum + line.allocated, 0), 900);
  assert.equal(new Set(protectedResult.options[0].allocations.map((line) => line.needId)).size, protectedResult.options[0].allocations.length);
});

test("consequence uncertainty and partial-payment limitations remain explicit", () => {
  const result = allocateNextDollar({ repairRequiredForWork: true });
  const utility = result.consequences.find((item) => item.needId === "utility"); const arrears = result.consequences.find((item) => item.needId === "rent-arrears");
  assert.equal(utility.basis, "uncertain_requires_verification"); assert.match(utility.verificationStep, /official utility bill/);
  assert.match(arrears.verificationStep, /partial payment/); assert.doesNotMatch(utility.description, /will|guaranteed/i);
});

test("what-if changes one assumption and preserves an inactive baseline", () => {
  const baseline = allocateNextDollar({ repairRequiredForWork: true, protectUtility: true }); const scenario = simulateAllocation(baseline, 240);
  assert.equal(scenario.baselineId, baseline.recommendedId); assert.equal(scenario.activated, false); assert.equal(scenario.memoryWriteBlocked, true);
  assert.equal(scenario.result.options[0].expectedAfterNextIncome - baseline.options[0].expectedAfterNextIncome, 240);
  assert.equal(baseline.options[0].simulated, false);
});

test("user challenge preserves baseline and recalculates income confidence safely", () => {
  const baseline = allocateNextDollar({ repairRequiredForWork: true }); const corrected = correctIncomeReliability(baseline, "That commission is not guaranteed.");
  assert.equal(corrected.baselinePreserved, true); assert.match(corrected.acceptedCorrection, /remains excluded/); assert.equal(corrected.result, baseline); assert.equal(corrected.durableWriteBlocked, true);
});

test("plan conflicts, wait states, and crisis narrowing are first-class", () => {
  const conflict = detectPlanConflict([{ id: "rent", monthlyResourceIds: ["surplus"], amount: 400 }, { id: "debt", monthlyResourceIds: ["surplus"], amount: 400 }]);
  assert.equal(conflict.conflict, true); assert.match(conflict.message, /cannot both remain on schedule/);
  assert.equal(waitOrNoAction({ pendingDeposit: true }).type, "wait"); assert.equal(waitOrNoAction({ noNeed: true }).type, "no_action");
  const crisis = crisisNextStep("utility_shutoff"); assert.equal(crisis.longRangeOptimizationHidden, true); assert.equal(crisis.legalConclusion, false); assert.match(crisis.oneAction, /verify/);
});

test("memory and real-data contracts retain confirmation and provenance boundaries", () => {
  const mapping = governedMemoryMapping(); assert.ok(mapping.find((item) => item.disposition === "temporary")); assert.ok(mapping.find((item) => item.disposition === "never_canonical"));
  const durable = mapping.find((item) => item.disposition === "durable_after_confirmation"); assert.equal(durable.confirmationRequired, true); assert.ok(durable.requiredFields.includes("revocation"));
  const readiness = realDataReadinessContract(); assert.ok(readiness.inputs.includes("missing institutions")); assert.deepEqual(Object.keys(readiness.evidence), ["sourceRecordIds", "calculationPeriod", "freshness", "status", "inclusionReason", "exclusionReason", "deduplicationKey"]);
});

test("Flow C remains session-only, progressively disclosed, and accessible at 390px", () => {
  const ui = readFileSync(new URL("../components/account/whole-picture-allocation-preview.tsx", import.meta.url), "utf8"); const css = readFileSync(new URL("../components/account/conversation-strategy-preview.module.css", import.meta.url), "utf8");
  for (const copy of ["One blocking question", "Help me decide quickly", "Review the details", "Simulated · baseline unchanged · not active", "Your place is saved for this session", "Show full calculation", "Founder testing tools"]) assert.match(ui, new RegExp(copy));
  assert.match(ui, /aria-live="polite"/); assert.match(ui, /aria-label="Preliminary allocation"/); assert.match(css, /@media\(max-width:700px\)/); assert.match(css, /\.allocationList/); assert.match(css, /min-height:44px/);
  assert.doesNotMatch(ui, /fetch\(|localStorage|sessionStorage|insert\(|upsert\(|FinancialMemory/);
});

test("expected cash is future-only while confirmed cash increases current resources", () => {
  const expected = cashIncomeFixture(); assert.equal(reconcileCashIncome(expected).totalAvailableContribution, 0); assert.equal(allocationWithOffAccountCash(expected).availableBeforeNextIncome, 900);
  const received = cashIncomeFixture({ expected: false, grossAmount: 240, cashOnHand: 240, confirmed: true, state: "confirmed_cash_on_hand", confidence: "high" });
  assert.equal(reconcileCashIncome(received).totalAvailableContribution, 240); assert.equal(allocationWithOffAccountCash(received).availableBeforeNextIncome, 1140);
});

test("spent and protected cash reduce allocation without collapsing earned, received, and available", () => {
  const cash = cashIncomeFixture({ expected: false, grossAmount: 240, cashOnHand: 50, alreadySpent: 90, protectedAmount: 100, confirmed: true, state: "protected", confidence: "high" }); const result = reconcileCashIncome(cash);
  assert.deepEqual({ earned: result.earned, received: result.received, spent: result.spent, protected: result.protected, available: result.totalAvailableContribution }, { earned: 240, received: 240, spent: 90, protected: 100, available: 50 });
  assert.equal(allocationWithOffAccountCash(cash).availableBeforeNextIncome, 950);
});

test("cash deposit is a movement, not a second income event", () => {
  const deposited = cashIncomeFixture({ expected: false, grossAmount: 240, cashOnHand: 0, deposited: 150, alreadySpent: 90, confirmed: true, state: "deposited", confidence: "high" }); const result = reconcileCashIncome(deposited);
  assert.equal(result.availableOffAccount, 0); assert.equal(result.availableDeposited, 150); assert.equal(result.totalAvailableContribution, 150); assert.equal(result.countedKeys.length, 1);
  const trace = reconcileDeposit({ sourceKey: deposited.reconciliationKey, receiptAmount: 150, depositAmount: 150 }); assert.equal(trace.countedIncome, 150); assert.deepEqual(trace.duplicatesPrevented, ["deposit"]);
});

test("variable cash planning uses the conservative range unless the user overrides it", () => {
  assert.equal(conservativeCashEstimate({ low: 140, typical: 200, high: 260, userOverride: null }).planningEstimate, 140);
  assert.equal(conservativeCashEstimate({ low: 140, typical: 200, high: 260, userOverride: 190 }).planningEstimate, 190);
});

test("owner-available calculation deducts business costs and reserve exactly once", () => {
  const result = ownerAvailable({ gross: 2500, businessCosts: 300, taxReserveRate: .25 });
  assert.deepEqual(result, { gross: 2500, businessCosts: 300, taxReserve: 625, vendorObligations: 0, businessProtected: 0, ownerAvailable: 1575 });
});

test("scheduled receivable affects future planning but is never current personal cash", () => {
  const result = reconcileReceivable(receivableFixture(), { start: "2026-08-04", end: "2026-08-20" });
  assert.equal(result.gross, 2500); assert.equal(result.expectedOwnerAvailable, 1575); assert.equal(result.currentPersonalCash, 0); assert.equal(result.futurePlanningAmount, 1575); assert.equal(result.includedInFutureWindow, true);
});

test("partial receipt updates remaining receivable and exposes only received owner-available funds", () => {
  const partial = receivableFixture({ amountPaid: 1250, remainingAmount: 1250, state: "partially_received" }); const result = reconcileReceivable(partial, { start: "2026-08-04", end: "2026-08-20" });
  assert.equal(result.received, 1250); assert.equal(result.remaining, 1250); assert.equal(result.businessCostsApplied, 300); assert.equal(result.taxReserveApplied, 312.5); assert.equal(result.currentPersonalCash, 637.5); assert.equal(result.countedKeys.length, 1);
  const allocation = allocationWithReceivedOwnerFunds(result); assert.equal(allocation.availableBeforeNextIncome, 1537.5); assert.equal(allocation.options[0].allocations.reduce((sum, line) => sum + line.allocated, 0), 1537.5);
});

test("late and disputed receivables leave active expected cash and lower confidence", () => {
  const late = simulateReceivable(receivableFixture(), "two_weeks_late"); const disputed = simulateReceivable(receivableFixture(), "disputed");
  for (const scenario of [late, disputed]) { assert.equal(scenario.result.futurePlanningAmount, 0); assert.equal(scenario.result.currentPersonalCash, 0); assert.equal(scenario.result.confidence, "low"); assert.equal(scenario.activated, false); assert.equal(scenario.memoryWriteBlocked, true); }
});

test("invoice payment and deposit reconcile to one economic inflow", () => {
  const paid = simulateReceivable(receivableFixture(), "pays_friday").result; assert.equal(paid.received, 2500); assert.equal(paid.remaining, 0); assert.equal(paid.currentPersonalCash, 1575);
  const deposit = reconcileDeposit({ sourceKey: "receivable:invoice-1042", receiptAmount: 2500, depositAmount: 2500, transferAmount: 1575 });
  assert.equal(deposit.countedIncome, 2500); assert.equal(deposit.countedKeys.length, 1); assert.deepEqual(deposit.duplicatesPrevented, ["deposit", "transfer"]);
});

test("cash and receivable reconciliation keys remain distinct", () => {
  const cash = cashIncomeFixture({ expected: false, grossAmount: 150, deposited: 150, confirmed: true, state: "deposited" }); const invoice = receivableFixture({ amountPaid: 1250, state: "partially_received" });
  assert.notEqual(reconcileCashIncome(cash).countedKeys[0], reconcileReceivable(invoice, { start: "2026-08-04", end: "2026-08-20" }).countedKeys[0]);
});

test("off-account facts remain governed candidates and never persist automatically", () => {
  const memory = offAccountMemoryMapping(); assert.equal(memory.persistenceImplemented, false); assert.ok(memory.temporary.includes("expected tips")); assert.ok(memory.durableCandidatesAfterConfirmation.includes("received payment")); assert.ok(memory.neverCanonical.includes("raw voice transcript")); assert.ok(memory.requiredFields.includes("supersession"));
});

test("cash and receivable fixture UX is minimal, responsive, and read-only", () => {
  const ui = readFileSync(new URL("../components/account/off-account-resource-preview.tsx", import.meta.url), "utf8"); const css = readFileSync(new URL("../components/account/conversation-strategy-preview.module.css", import.meta.url), "utf8");
  for (const copy of ["How much cash did you receive?", "How much of it do you still have available?", "Your answer", "Change · Undo", "Cash from tips", "About", "What if only half is paid?", "Simulated · baseline preserved · not active", "See how this could change the plan"]) assert.ok(ui.includes(copy));
  assert.match(ui, /aria-live="polite"/); assert.match(ui, /aria-label="Cash summary"/); assert.match(ui, /aria-pressed/); assert.match(css, /\.resourceSummary/); assert.match(css, /\.cashHeadline/); assert.match(css, /@media\(max-width:700px\)/);
  assert.doesNotMatch(ui, /fetch\(|localStorage|sessionStorage|insert\(|upsert\(|FinancialMemory/);
});

test("cash amount normalization accepts arbitrary numeric, word, approximate, and contextual values", () => {
  assert.deepEqual(normalizeCashAmount("$237.45"), { ok: true, amount: 237.45, approximate: false, source: "numeric" });
  assert.deepEqual(normalizeCashAmount("ninety dollars"), { ok: true, amount: 90, approximate: false, source: "words" });
  assert.deepEqual(normalizeCashAmount("about ninety"), { ok: true, amount: 90, approximate: true, source: "words" });
  assert.deepEqual(normalizeCashAmount("half", 240), { ok: true, amount: 120, approximate: false, source: "fraction" });
  assert.deepEqual(normalizeCashAmount("all of it", 240), { ok: true, amount: 240, approximate: false, source: "full" });
  assert.deepEqual(normalizeCashAmount("none remaining", 240), { ok: true, amount: 0, approximate: false, source: "none" });
  assert.deepEqual(normalizeCashAmount("I made $240 and still have all of it"), { ok: true, amount: 240, approximate: false, source: "numeric" });
  assert.equal(normalizeCashAmount("half").ok, false);
});

test("natural cash statements resolve action and remaining cash derives spent cash", () => {
  const received = parseCashAction("I made $240", { expectedKind: "received" }); const remaining = parseCashAction("I still have $150", { expectedKind: "remaining", receivedAmount: 240 }); const spentAction = parseCashAction("I spent about half", { expectedKind: "spent", receivedAmount: 240 }); const deposit = parseCashAction("I deposited $100", { expectedKind: "deposited", receivedAmount: 240, remainingAmount: 150 }); const protectedAction = parseCashAction("Keep $75 for groceries", { expectedKind: "protected", receivedAmount: 240, remainingAmount: 150 });
  assert.equal(received.ok && received.kind, "received"); assert.equal(remaining.ok && remaining.kind, "remaining"); assert.equal(spentAction.ok && spentAction.kind, "spent"); assert.equal(deposit.ok && deposit.kind, "deposited"); assert.equal(protectedAction.ok && protectedAction.kind, "protected"); assert.equal(remaining.ok && 240 - remaining.amount, 90); assert.equal(spentAction.ok && spentAction.amount, 120); assert.equal(protectedAction.ok && protectedAction.amount, 75);
});

test("cash validation blocks impossible amounts before reconciliation", () => {
  const current = { received: 240, remaining: 150, deposited: null, protected: null };
  assert.equal(validateCashAction(parseCashAction("I spent $300", { expectedKind: "spent", receivedAmount: 240 }), current).ok, false);
  assert.equal(validateCashAction(parseCashAction("I deposited $151", { expectedKind: "deposited", receivedAmount: 240, remainingAmount: 150 }), current).ok, false);
  assert.equal(validateCashAction(parseCashAction("Keep $200", { expectedKind: "protected", receivedAmount: 240, remainingAmount: 150 }), current).ok, false);
});

test("cash applied state visibly confirms values and provides Change and Undo without persistence", () => {
  const ui = readFileSync(new URL("../components/account/off-account-resource-preview.tsx", import.meta.url), "utf8");
  for (const contract of [/Recorded for this preview:/, /Allocation recalculated/, /Resulting available cash:/, /aria-live="polite"/, /aria-pressed=/, />Change</, />Undo</, /setCashValues/, /setPriorByAction/, /restored the prior cash state/]) assert.match(ui, contract);
  assert.match(ui, /Final transcript added/); assert.match(ui, /Answer by voice/); assert.doesNotMatch(ui, /FinancialMemory|localStorage|sessionStorage|fetch\(/);
});

test("conversational cash flow closes completed questions and reconciles upstream changes explicitly", () => {
  const ui = readFileSync(new URL("../components/account/off-account-resource-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /cashComplete/); assert.match(ui, /!cashComplete \|\| editingAction \|\| pendingReview \|\| pendingUpstream/);
  assert.match(ui, /setActiveAction\("remaining"\)/); assert.match(ui, /Recalculate from remaining amount/); assert.match(ui, /Recalculate from amount used/); assert.match(ui, /Clear dependent amounts and ask again/); assert.match(ui, />Cancel</);
  assert.match(ui, /Cash from tips/); assert.match(ui, />Used</); assert.match(ui, /is available for this plan/); assert.match(ui, /Show calculation/);
});

test("received-cash reconciliation preserves one coherent state and rejects impossible choices", () => {
  const current = { received: 240, remaining: 150, deposited: 100, protected: 75 };
  assert.deepEqual(reconcileReceivedChange(current, 300, "preserve_remaining"), { ok: true, values: { received: 300, remaining: 150, deposited: null, protected: null } });
  assert.deepEqual(reconcileReceivedChange(current, 300, "preserve_spent"), { ok: true, values: { received: 300, remaining: 210, deposited: null, protected: null } });
  assert.deepEqual(reconcileReceivedChange(current, 300, "clear_dependents"), { ok: true, values: { received: 300, remaining: null, deposited: null, protected: null } });
  assert.equal(reconcileReceivedChange(current, 100, "preserve_remaining").ok, false);
  assert.equal(reconcileReceivedChange(current, 80, "preserve_spent").ok, false);
});

test("mobile consolidation exposes one primary path, exact goal copy, and collapsed diagnostics", () => {
  const strategy = readFileSync(new URL("../components/account/conversation-strategy-preview.tsx", import.meta.url), "utf8");
  const allocation = readFileSync(new URL("../components/account/whole-picture-allocation-preview.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../components/account/conversation-strategy-preview.module.css", import.meta.url), "utf8");
  assert.match(allocation, /Help me decide quickly/); assert.match(allocation, /Review the details/); assert.match(allocation, /Pause for now/);
  assert.match(allocation, /Use this exact goal: keep upcoming rent current while making steady progress on the past-due balance/);
  assert.match(strategy, /Use this exact goal: keep upcoming rent current while making steady progress on the past-due balance/);
  assert.match(strategy, /Show details/); assert.match(allocation, /Founder testing tools/); assert.match(css, /overflow-x:hidden/); assert.match(css, /min-height:44px/);
});

test("true quick mode hides detailed resources while detailed mode reveals them", () => {
  const ui = readFileSync(new URL("../components/account/whole-picture-allocation-preview.tsx", import.meta.url), "utf8");
  assert.match(ui, /reviewPath === "details" \? <section className=\{styles\.knownNeeds\}/);
  assert.match(ui, /reviewPath === "details" \? <OffAccountResourcePreview \/>/);
  assert.match(ui, /reviewPath && repairAnswer == null/); assert.match(ui, /Preliminary allocation/); assert.match(ui, /Flow C next step/);
  assert.doesNotMatch(ui, /Confirm allocation — not available/); assert.doesNotMatch(ui, /type="button" disabled>Confirm allocation/);
  assert.match(ui, /Preview only/); assert.match(ui, /Nothing has been saved, activated, or moved/);
});

test("quick-mode blocking question is actionable and closes into a recorded decision", () => {
  const ui = readFileSync(new URL("../components/account/whole-picture-allocation-preview.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../components/account/conversation-strategy-preview.module.css", import.meta.url), "utf8");
  assert.match(ui, /Is the \$500 car repair required for you to keep working\?/);
  for (const choice of ["Yes — I need it to keep working", "No — it can wait", "I’m not sure"]) assert.ok(ui.includes(choice));
  assert.match(ui, /className=\{styles\.primary\}[\s\S]*Yes — I need it to keep working/);
  assert.match(ui, /setRepairAnswer\("yes"\); setRepairRequired\(true\)/); assert.match(ui, /setRepairAnswer\("no"\); setRepairRequired\(false\)/); assert.match(ui, /setRepairAnswer\("unsure"\); setRepairRequired\(null\)/);
  assert.match(ui, /reviewPath && repairAnswer == null/); assert.match(ui, /reviewPath && repairAnswer \? <div className=\{styles\.recordedDecision\}/);
  assert.match(ui, /The repair is required to keep working/); assert.match(ui, /The repair can wait/); assert.match(ui, /The repair consequence is not confirmed/);
  assert.match(ui, /Preliminary guidance/); assert.match(ui, /Verify whether delaying the repair would affect your ability to keep working/);
  assert.match(ui, />Change</); assert.match(ui, />Undo</); assert.match(ui, /aria-live="polite"/); assert.match(css, /\.recordedDecision button\{min-height:44px/);
  assert.doesNotMatch(ui, /fetch\(|localStorage|sessionStorage|insert\(|upsert\(|FinancialMemory/);
});

test("founder testing tools remain collapsed after the consumer journey and preview boundary", () => {
  const ui = readFileSync(new URL("../components/account/whole-picture-allocation-preview.tsx", import.meta.url), "utf8");
  const boundary = ui.indexOf("Preview only"); const tools = ui.indexOf("Founder testing tools");
  assert.ok(boundary >= 0); assert.ok(tools > boundary); assert.match(ui, /<details className=\{styles\.founderTools\}><summary>Founder testing tools<\/summary>/);
  assert.doesNotMatch(ui, /<details[^>]*open[^>]*className=\{styles\.founderTools\}/);
});

test("mobile detail surfaces are compact, collapsed, and separated from the consumer journey", () => {
  const cash = readFileSync(new URL("../components/account/off-account-resource-preview.tsx", import.meta.url), "utf8");
  const allocation = readFileSync(new URL("../components/account/whole-picture-allocation-preview.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../components/account/conversation-strategy-preview.module.css", import.meta.url), "utf8");
  assert.match(cash, /cashComplete \? <div className=\{styles\.cashHeadline\}/); assert.match(cash, /Cash from tips/); assert.match(cash, /Change · Undo/);
  assert.match(cash, /cashComplete \|\| editingAction/); assert.match(cash, /See how this could change the plan/); assert.match(cash, /invoiceScenarios/);
  assert.match(allocation, /knownNeeds[\s\S]*fixture\.needs\.map[\s\S]*<p key=/); assert.match(allocation, /Founder testing tools/); assert.match(allocation, /className=\{styles\.founderTools\}/);
  assert.match(css, /\.knownNeeds>div\{display:grid;gap:0\}/); assert.match(css, /\.cashHeadline\{display:grid;gap:/); assert.doesNotMatch(css, /\.cashHeadline\{[^}]*repeat\(4/);
  assert.match(css, /@media\(max-width:700px\)/); assert.match(css, /overflow-x:hidden/); assert.match(css, /min-height:44px/);
});

test("typed parser context distinguishes money from time and preserves transcript metadata", () => {
  const moneyValue = parseContextualValue("2:40", "money_amount", { provenance: "browser_transcript" }); const timeValue = parseContextualValue("2:40", "time"); const compact = parseContextualValue("I made about two forty", "money_amount");
  assert.equal(moneyValue.ok && moneyValue.normalizedCandidate, 240); assert.equal(moneyValue.parserContext, "money_amount"); assert.equal(moneyValue.rawTranscript, "2:40");
  assert.equal(timeValue.ok && timeValue.normalizedCandidate, "2:40"); assert.equal(timeValue.parserContext, "time");
  assert.equal(compact.ok && compact.normalizedCandidate, 240); assert.equal(compact.ok && compact.approximate, true);
  assert.deepEqual(normalizeCashAmount("two forty and fifty cents"), { ok: true, amount: 240.5, approximate: false, source: "words" });
});

test("ambiguous money stays pending while clean updates share one governed state transition", () => {
  const ambiguous = parseContextualValue("two forty five", "money_amount"); const multiple = parseContextualValue("I made $240 and spent $90", "money_amount"); const missing = parseContextualValue("around two hundred something", "money_amount");
  assert.equal(ambiguous.ok, false); assert.equal(multiple.ok, false); assert.equal(missing.ok, false); assert.notEqual(ambiguous.ok ? ambiguous.normalizedCandidate : undefined, 0);
  const parsed = parseCashAction("I made about two forty", { expectedKind: "received" }); const applied = applyCashUpdate({ received: null, remaining: null, deposited: null, protected: null }, parsed);
  assert.equal(applied.ok && applied.values.received, 240); assert.equal(parsed.ok && parsed.candidate.parserContext, "money_amount");
});

test("cash voice auto-apply is bounded, reversible, accessible, and session-only", () => {
  const ui = readFileSync(new URL("../components/account/off-account-resource-preview.tsx", import.meta.url), "utf8");
  for (const contract of [/useState\(true\)/, /voiceAutoSend && safeKind/, /!parsed\.candidate\.reviewRequired/, /commitCashAction\(parsed, "voice"\)/, /Voice auto-send/, /Auto-applied/, /setActiveAction\("remaining"\)/, />Change</, />Undo</, /aria-live="polite"/, /Awaiting review/, /No amount recorded/, /Keep current amount/, /correctionProvenance: "user_accepted"/]) assert.match(ui, contract);
  assert.doesNotMatch(ui, /localStorage|sessionStorage|FinancialMemory|fetch\(/);
});

test("active cash field owns mapping and incompatible wording requests clarification", () => {
  const remaining = parseCashAction("I still have $150", { activeField: "cash_remaining", receivedAmount: 240 }); const all = parseCashAction("I have all of it", { activeField: "cash_remaining", receivedAmount: 240 }); const conflict = parseCashAction("I made about 2:40", { activeField: "cash_remaining", receivedAmount: 240 });
  assert.equal(remaining.ok && remaining.kind, "remaining"); assert.equal(remaining.ok && remaining.field, "cash_remaining"); assert.equal(remaining.ok && remaining.amount, 150);
  assert.equal(all.ok && all.amount, 240); assert.equal(conflict.ok, false); assert.equal(!conflict.ok && conflict.fieldConflict?.spokenField, "cash_received"); assert.equal(!conflict.ok && conflict.fieldConflict?.activeField, "cash_remaining"); assert.equal(!conflict.ok && conflict.fieldConflict?.amount, 240);
});

test("field clarification can apply either bounded choice without implicit routing", () => {
  const current = { received: 240, remaining: null, deposited: null, protected: null }; const receivedChoice = parseCashAction("$240", { activeField: "cash_received" }); const remainingChoice = parseCashAction("$240", { activeField: "cash_remaining", receivedAmount: 240 });
  const unchanged = applyCashUpdate(current, receivedChoice); const completed = applyCashUpdate(current, remainingChoice);
  assert.equal(unchanged.ok && unchanged.noOp, true); assert.deepEqual(unchanged.ok && unchanged.values, current); assert.equal(completed.ok && completed.noOp, false); assert.equal(completed.ok && completed.values.remaining, 240);
});

test("equal replacement is a no-op and unresolved remaining cash never renders false zero", () => {
  const ui = readFileSync(new URL("../components/account/off-account-resource-preview.tsx", import.meta.url), "utf8");
  for (const contract of [/if \(applied\.noOp\)/, /No change or undo history was added/, /Received \{money\(pendingReview\.suggestedAmount\)\}/, /Still have \{money\(pendingReview\.suggestedAmount\)\}/, /Awaiting clarification/, /Current valid cash state unchanged/, /remaining == null \? "No amount recorded"/, /Confirm how much cash remains before recalculating the plan/]) assert.match(ui, contract);
  assert.match(ui, /if \(applied\.noOp\)[\s\S]*return true;[\s\S]*setPriorByAction/); assert.doesNotMatch(ui, /FinancialMemory|localStorage|sessionStorage|fetch\(/);
});
