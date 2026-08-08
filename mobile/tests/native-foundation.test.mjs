import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { competingNeedsDeferredResult, competingNeedsQuestion, competingNeedsResult, correctionApplied, correctionReview, createFixtureCovarifyClient, outOfScopeTurn, stoppedTurn, uncertaintyResult } from "../fixtures/turn-fixtures.ts";
import { interactionForAction } from "../lib/turn-contract.ts";

const renderer = readFileSync(new URL("../components/semantic-turn-renderer.tsx", import.meta.url), "utf8");
const ask = readFileSync(new URL("../app/(app)/ask.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/(app)/_layout.tsx", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../lib/covarify-client.ts", import.meta.url), "utf8");
const authenticatedClientSource = readFileSync(new URL("../lib/authenticated-covarify-client.ts", import.meta.url), "utf8");

test("Turn blocks render generically without journey-specific financial logic", () => {
  assert.match(renderer, /turn\.response\.blocks\.filter/);
  assert.match(renderer, /<SemanticBlock key=\{item\.id\} block=\{item\}/);
  assert.doesNotMatch(renderer, /repair|rent|utility|card minimum|\$900|allocation\s*[+\-*/]/i);
  const supported = new Set(["situation_summary", "answer", "question", "recommendation", "allocation", "reconciliation", "rationale", "warning", "assumption", "evidence", "calculation", "correction_review", "stopping_state"]);
  const fixtureTypes = new Set([competingNeedsQuestion, competingNeedsResult, competingNeedsDeferredResult, correctionReview, correctionApplied, outOfScopeTurn, stoppedTurn, uncertaintyResult].flatMap((turn) => turn.response.blocks.map((block) => block.type)));
  for (const type of supported) assert.ok(renderer.includes(type) || fixtureTypes.has(type));
});

test("SemanticActions dispatch stable IDs and typed payloads", async () => {
  const client = createFixtureCovarifyClient();
  const selected = competingNeedsQuestion.actions[0];
  const result = await client.sendTurn({ modality: "guided_action", action: { id: selected.id, payload: selected.payload } });
  assert.equal(selected.id, "repair.required.yes");
  assert.deepEqual(selected.payload, { kind: "answer_question", questionId: "repair-required", answerId: "yes" });
  assert.equal(result.response.blocks.some((block) => block.type === "allocation"), true);
  assert.match(ask, /action: \{ id: action\.id, payload: action\.payload \}/);
});

test("fixture proof covers every approved Phase 1 semantic action", () => {
  const actions = new Set([competingNeedsQuestion, competingNeedsResult, correctionReview, correctionApplied, stoppedTurn].flatMap((turn) => turn.actions.map((action) => action.type)));
  for (const type of ["ANSWER_QUESTION", "APPLY_CORRECTION", "CANCEL_CORRECTION", "SHOW_EVIDENCE", "SHOW_CALCULATION", "CHANGE_PRESENTATION_DEPTH", "UNDO", "STOP_FOR_NOW", "RESUME"]) assert.ok(actions.has(type), `${type} fixture missing`);
});

test("confirmation UX follows contract consequence rather than labels", () => {
  assert.equal(interactionForAction(competingNeedsQuestion.actions[0]), "review");
  assert.equal(interactionForAction(competingNeedsResult.actions.find((action) => action.type === "SHOW_EVIDENCE")), "execute");
  assert.equal(interactionForAction(correctionReview.actions[0]), "review");
  assert.equal(interactionForAction({ ...correctionReview.actions[0], consequence: "EXTERNAL_CONSEQUENTIAL", confirmation: "strong_confirmation" }), "unavailable");
  assert.match(renderer, /interactionForAction\(item\)/);
  assert.doesNotMatch(renderer, /label\.(includes|match)|switch\s*\(item\.label\)/);
});

test("recommendations and allocations are rendered, never parsed or recalculated", () => {
  assert.match(renderer, /block\.type === "allocation" \|\| block\.type === "reconciliation"/);
  assert.doesNotMatch(renderer, /parseFloat|parseInt|reduce\(|recommendation.*(includes|split|match)/);
  assert.equal(correctionApplied.response.blocks.find((block) => block.type === "allocation")?.body.includes("$425"), true);
});

test("Undo and correction are driven only by semantic actions", async () => {
  const client = createFixtureCovarifyClient("correction");
  const applied = await client.sendTurn({ modality: "guided_action", action: { id: correctionReview.actions[0].id, payload: correctionReview.actions[0].payload } });
  const undo = applied.actions.find((action) => action.type === "UNDO");
  assert.ok(undo);
  const restored = await client.sendTurn({ modality: "guided_action", action: { id: undo.id, payload: undo.payload } });
  assert.equal(restored.response.blocks[0].type, "correction_review");
});

test("ambiguity and bounded out-of-scope responses have native rendering paths", () => {
  assert.match(renderer, /turn\.understanding\.ambiguity\.candidates\.map/);
  assert.match(renderer, /candidate\.displayLabel/);
  assert.match(outOfScopeTurn.response.primaryMessage, /can’t write a poem/);
  assert.doesNotMatch(ask, /general assistant|OpenAI|ChatGPT/);
});

test("Dynamic Type, VoiceOver, touch targets, and Reduce Motion are explicit", () => {
  assert.doesNotMatch(renderer + ask, /numberOfLines|maxFontSizeMultiplier=\{[0-9]/);
  for (const contract of [/accessibilityLabel/, /accessibilityState/, /accessibilityLiveRegion/, /minHeight: 4[48]/, /AccessibilityInfo\.isReduceMotionEnabled/, /reduceMotionChanged/, /animationType=\{reduceMotion \? "none"/]) assert.match(renderer + ask, contract);
});

test("fixture transport is replaceable and rejects trusted financial truth", async () => {
  assert.match(clientSource, /export interface CovarifyClient/);
  assert.match(clientSource, /sendTurn\(input: TurnInput\): Promise<CovarifyTurn>/);
  assert.match(clientSource, /CLIENT_FINANCIAL_TRUTH_NOT_ALLOWED/);
  const client = createFixtureCovarifyClient();
  assert.equal(client.mode, "fixture");
  await assert.rejects(client.sendTurn({ modality: "text", statement: "hi", financialTruth: {} }), /CLIENT_FINANCIAL_TRUTH_NOT_ALLOWED/);
});

test("navigation preserves local visual position and exposes the four native areas", () => {
  for (const title of ["Today", "Ask Covarify", "Money", "Decisions"]) assert.match(layout, new RegExp(`title: "${title}"`));
  assert.match(ask, /contentOffset=\{\{ x: 0, y: scrollPosition \}\}/);
  assert.match(ask, /setScrollPosition\(event\.nativeEvent\.contentOffset\.y\)/);
});

test("native surface contains no authorization, financial engine, secret, or sensitive logging", () => {
  const surface = renderer + ask + clientSource;
  assert.doesNotMatch(surface, /access_token|service_role|PLAID_SECRET|console\.(log|info)|calculateAllocation|runCovarifyTurn|CanonicalFinancialTruth/);
  assert.match(ask, /FIXTURE MODE · NO REAL FINANCIAL DATA/);
  assert.match(ask, /does not record or transmit audio/);
});

test("fixture and authenticated development transports share one CovarifyClient contract", () => {
  assert.match(clientSource, /mode: "fixture" \| "authenticated_development"/);
  assert.match(authenticatedClientSource, /createAuthenticatedCovarifyClient[\s\S]*: CovarifyClient/);
  assert.match(authenticatedClientSource, /supportedContractVersion: COVARIFY_TURN_CONTRACT_VERSION/);
  assert.match(authenticatedClientSource, /parseTurnTransportResponse/);
  assert.doesNotMatch(authenticatedClientSource, /balance|allocation|recommendation|financialTruth|userId|accountId/);
});

test("connected mode is explicit and cannot silently fall back to fixtures", () => {
  assert.match(ask, /mode === "fixture" \? fixtureClient : authenticatedClient\.current/);
  assert.match(ask, /Use connected development/); assert.match(ask, /CONNECTED DEVELOPMENT · READ ONLY/);
  assert.match(ask, /End connected session/);
  assert.match(ask, /mode === "fixture" \? <View accessibilityRole="toolbar" accessibilityLabel="Fixture examples"/);
  assert.doesNotMatch(authenticatedClientSource, /createFixtureCovarifyClient|fallback/);
});

test("connected lifecycle preserves drafts, avoids automatic retry, and exposes safe recovery", () => {
  for (const contract of [/setSubmittedStatements/, /setLoading\(true\)/, /Still checking your authorized financial picture/, /setDraft\(input\.statement\)/, /Retry read-only question/, /send\(retryInput, false\)/, /AccessibilityInfo\.setAccessibilityFocus/]) assert.match(ask, contract);
  assert.doesNotMatch(authenticatedClientSource, /while\s*\(|setInterval|console\.(log|info|warn|error)/);
  for (const code of ["OFFLINE", "TIMEOUT", "UNAUTHORIZED", "FORBIDDEN", "CONTRACT_MISMATCH", "INVALID_RESPONSE", "SERVER_ERROR", "STALE_ACTION", "SESSION_EXPIRED"]) assert.match(clientSource + ask, new RegExp(code));
});
