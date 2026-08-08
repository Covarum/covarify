import { assertClientSafeInput, type CovarifyClient } from "../lib/covarify-client.ts";
import type { CovarifyTurn, PresentationBlock, SemanticAction, TurnInput } from "../lib/turn-contract.ts";

export type FixtureScenario = "competing_needs" | "correction" | "out_of_scope";

const block = (id: string, type: PresentationBlock["type"], body: string, title?: string, emphasis: PresentationBlock["emphasis"] = "supporting"): PresentationBlock => ({ id, type, title, body, emphasis, evidenceIds: [] });
const action = (id: string, type: SemanticAction["type"], label: string, payload: SemanticAction["payload"], consequence: SemanticAction["consequence"] = "READ_ONLY", confirmation: SemanticAction["confirmation"] = "none", reversible = false): SemanticAction => ({ id, type, label, payload, consequence, confirmation, reversible });

const turn = (sequence: number, blocks: PresentationBlock[], actions: SemanticAction[], options: { message?: string; question?: string | null; stopped?: boolean; ambiguity?: CovarifyTurn["understanding"]["ambiguity"] } = {}): CovarifyTurn => ({
  contractVersion: 1,
  identity: { turnId: `fixture-turn-${sequence}`, sessionId: "fixture-native-v1", sequence, timestamp: "2026-08-08T12:00:00.000Z", modality: "guided_action" },
  input: { rawStatement: null, normalizedStatement: null, guidedActionId: null },
  understanding: { intent: "PRIORITIZE", capability: "PRIORITIZE_COMPETING_NEEDS", scope: "FINANCIAL_STATE", scopeDetail: null, referencedEntityIds: [], resolvedReferences: [], confidence: options.ambiguity ? "low" : "high", ambiguity: options.ambiguity || null },
  evidence: { references: [], missing: [], stale: [] },
  financialImpact: { factsRead: [], proposedChanges: [], acceptedSessionChanges: [], derivedCalculations: [], before: [], after: [] },
  decision: { decisionId: `fixture-decision-${sequence}`, type: "NONE", goal: null, constraints: [], factsConsidered: [], answer: { type: "CLARIFICATION", summary: options.message || blocks[0]?.body || "Covarify is ready." }, recommendation: null, quantified: [], allocation: [], reconciliation: null, alternatives: [], tradeoffs: [], consequenceOfDelay: null, uncertainty: [], confidence: options.ambiguity ? "low" : "high", status: options.ambiguity ? "preliminary" : "final", affectedEntityIds: [] },
  response: { primaryMessage: options.message || blocks[0]?.body || "Covarify is ready.", conciseRationale: null, blocks, question: options.question || null, correction: null },
  actions,
  next: { type: options.stopped ? "RESUME_SESSION" : actions.length ? "EXPLORE_OPTION" : "STOP_VALID", bestStep: actions[0]?.label || "Done for now", blocking: Boolean(options.question), stopped: Boolean(options.stopped), waitingForEvidence: false, actionId: actions[0]?.id || null },
  memory: { disposition: "session_only", proposal: null },
  telemetry: { event: "turn_understood", safeAttributes: { mode: "fixture" } },
});

export const competingNeedsQuestion = turn(
  1,
  [
    block("situation", "situation_summary", "You have $900 available before your next paycheck. A car repair, card minimum, utility timing, and upcoming rent are competing for it.", "What needs attention"),
    block("question", "question", "Is the $500 car repair required for you to keep working?", "One thing to confirm", "primary"),
  ],
  [
    action("repair.required.yes", "ANSWER_QUESTION", "Yes — I need it to keep working", { kind: "answer_question", questionId: "repair-required", answerId: "yes" }, "SESSION_REVERSIBLE", "explicit_apply", true),
    action("repair.required.no", "ANSWER_QUESTION", "No — it can wait", { kind: "answer_question", questionId: "repair-required", answerId: "no" }, "SESSION_REVERSIBLE", "explicit_apply", true),
    action("repair.required.unsure", "ANSWER_QUESTION", "I’m not sure", { kind: "answer_question", questionId: "repair-required", answerId: "unsure" }, "SESSION_REVERSIBLE", "explicit_apply", true),
  ],
  { question: "Is the $500 car repair required for you to keep working?" },
);

export const competingNeedsResult = turn(
  2,
  [
    block("answer", "answer", "Recorded for this fixture: the repair protects your ability to work.", "Your answer"),
    block("recommendation", "recommendation", "Protect the work-critical repair, cover the required card minimum, and reserve what remains for current rent.", "Recommended", "primary"),
    block("allocation", "allocation", "$500 car repair\n$75 card minimum\n$325 reserved for upcoming rent", "Allocation"),
    block("reconciliation", "reconciliation", "Available now: $900\nAllocated: $900\nLeft unallocated: $0", "Money remaining"),
    block("rationale", "rationale", "The repair protects income, the minimum protects required standing, and the remaining cash supports housing stability.", "Why this order"),
    block("assumption", "assumption", "This fixture assumes the utility bill is not due before the next paycheck.", "Assumption", "detail"),
    block("evidence", "evidence", "Fixture evidence: user-confirmed repair urgency and deterministic available-cash input.", "Evidence", "detail"),
    block("calculation", "calculation", "$900 − $500 − $75 = $325 reserved for rent.", "Calculation", "detail"),
  ],
  [
    action("turn.stop", "STOP_FOR_NOW", "Done for now", { kind: "stop" }, "SESSION_REVERSIBLE", "explicit_apply", true),
    action("turn.show-evidence", "SHOW_EVIDENCE", "Show evidence", { kind: "show_evidence", evidenceGroupId: "fixture-allocation" }),
    action("turn.show-calculation", "SHOW_CALCULATION", "Show calculation", { kind: "show_calculation", calculationId: "fixture-reconciliation" }),
    action("turn.depth.detailed", "CHANGE_PRESENTATION_DEPTH", "Show more detail", { kind: "change_presentation_depth", depth: "DETAILED" }),
  ],
);

export const competingNeedsDeferredResult = turn(
  2,
  [
    block("answer", "answer", "Recorded for this fixture: the repair can wait.", "Your answer"),
    block("recommendation", "recommendation", "Cover the required card minimum and reserve the rest for upcoming rent.", "Recommended", "primary"),
    block("allocation", "allocation", "$75 card minimum\n$825 reserved for upcoming rent", "Allocation"),
    block("reconciliation", "reconciliation", "Available now: $900\nAllocated: $900\nLeft unallocated: $0", "Money remaining"),
    block("rationale", "rationale", "With the repair deferred, current housing stability receives the remaining available cash.", "Why this order"),
  ],
  [action("turn.stop", "STOP_FOR_NOW", "Done for now", { kind: "stop" }, "SESSION_REVERSIBLE", "explicit_apply", true)],
);

export const uncertaintyResult = turn(
  2,
  [
    block("warning", "warning", "The repair consequence is unconfirmed, so this recommendation remains preliminary.", "Still uncertain", "primary"),
    block("recommendation", "recommendation", "Verify whether delaying the repair would interrupt work before committing that $500.", "Smallest useful next step"),
  ],
  [action("turn.stop", "STOP_FOR_NOW", "Stop here", { kind: "stop" }, "SESSION_REVERSIBLE", "explicit_apply", true)],
);

export const stoppedTurn = turn(3, [block("stopped", "stopping_state", "Your fixture session is paused. No money was moved and no financial state was stored.", "Stopped for now", "primary")], [action("turn.resume", "RESUME", "Resume", { kind: "resume" }, "SESSION_REVERSIBLE", "explicit_apply", true)], { stopped: true });

export const correctionReview = turn(
  1,
  [
    block("correction", "correction_review", "Current repair estimate: $500\nProposed estimate: $400\nContract-provided impact: repair allocation decreases by $100 and rent reserve increases by $100.", "Review the correction", "primary"),
  ],
  [
    action("correction.apply", "APPLY_CORRECTION", "Apply $400", { kind: "apply_correction", changeId: "repair-estimate-400" }, "SESSION_REVERSIBLE", "explicit_apply", true),
    action("correction.cancel", "CANCEL_CORRECTION", "Cancel", { kind: "cancel_correction", changeId: "repair-estimate-400" }, "SESSION_REVERSIBLE", "explicit_apply", true),
  ],
);

export const correctionApplied = turn(
  2,
  [
    block("answer", "answer", "Repair estimate updated for this fixture session: $400.", "Updated", "primary"),
    block("allocation", "allocation", "$400 car repair\n$75 card minimum\n$425 reserved for upcoming rent", "Updated allocation"),
    block("reconciliation", "reconciliation", "Available now: $900\nAllocated: $900\nLeft unallocated: $0", "Money remaining"),
  ],
  [action("correction.undo", "UNDO", "Undo estimate change", { kind: "undo", reversibleActionId: "repair-estimate-400" }, "SESSION_REVERSIBLE", "explicit_apply", true)],
);

export const outOfScopeTurn = turn(1, [block("scope", "warning", "I can help with your financial picture and decisions, but I can’t write a poem. Try asking what needs attention in your money picture.", "Financial focus", "primary")], []);

export const ambiguityTurn = turn(1, [block("ambiguous", "question", "Which account did you mean?", "Choose one")], [], { ambiguity: { message: "More than one account matches.", candidates: [{ entityId: "fixture-checking", fieldId: null, displayLabel: "Checking •••• 1234", confidence: "medium", reason: "Two fixture accounts share the same nickname.", clarificationRequired: true }] } });

export function createFixtureCovarifyClient(initialScenario: FixtureScenario = "competing_needs"): CovarifyClient & { setScenario(scenario: FixtureScenario): void } {
  let scenario = initialScenario;
  let current = scenario === "correction" ? correctionReview : scenario === "out_of_scope" ? outOfScopeTurn : competingNeedsQuestion;
  return {
    mode: "fixture",
    setScenario(next) { scenario = next; current = next === "correction" ? correctionReview : next === "out_of_scope" ? outOfScopeTurn : competingNeedsQuestion; },
    async sendTurn(rawInput: TurnInput) {
      const input = assertClientSafeInput(rawInput);
      if (input.statement?.trim().toLowerCase() === "write me a poem.") current = outOfScopeTurn;
      else if (input.action?.id === "repair.required.yes") current = competingNeedsResult;
      else if (input.action?.id === "repair.required.no") current = competingNeedsDeferredResult;
      else if (input.action?.id === "repair.required.unsure") current = uncertaintyResult;
      else if (input.action?.id === "turn.stop") current = stoppedTurn;
      else if (input.action?.id === "turn.resume") current = competingNeedsResult;
      else if (input.action?.id === "correction.apply") current = correctionApplied;
      else if (input.action?.id === "correction.cancel") current = correctionReview;
      else if (input.action?.id === "correction.undo") current = correctionReview;
      return current;
    },
  };
}
