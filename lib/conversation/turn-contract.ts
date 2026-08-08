export type InputModality = "text" | "reviewed_voice" | "guided_action";
export type PresentationDepth = "GUIDED" | "CONCISE" | "DETAILED";
export type ConsequenceClass = "READ_ONLY" | "SESSION_REVERSIBLE" | "DURABLE_REVERSIBLE" | "EXTERNAL_CONSEQUENTIAL" | "IRREVERSIBLE_OR_HIGH_RISK";
export type ConfirmationRequirement = "none" | "explicit_apply" | "explicit_durable_confirmation" | "strong_confirmation";
export type MemoryDisposition = "no_memory" | "session_only" | "memory_proposal" | "confirmed_memory" | "supersede_candidate" | "revoke_candidate";
export type TurnActionType = "ANSWER_QUESTION" | "APPLY_CORRECTION" | "CANCEL_CORRECTION" | "SHOW_EVIDENCE" | "SHOW_CALCULATION" | "COMPARE_OPTIONS" | "CHANGE_PRESENTATION_DEPTH" | "UNDO" | "STOP_FOR_NOW" | "RESUME" | "PROPOSE_MEMORY" | "CONFIRM_MEMORY";
export type PresentationBlockType = "situation_summary" | "answer" | "question" | "recommendation" | "allocation" | "reconciliation" | "rationale" | "warning" | "assumption" | "evidence" | "calculation" | "correction_review" | "stopping_state";

export type EvidenceReference = { id: string; provenance: "connected_data" | "user_confirmed" | "inferred" | "derived" | "fixture"; freshness: "current" | "stale" | "unknown"; confidence: "high" | "medium" | "low" };
export type FactValue = { entityId: string; field: string; value: string | number | boolean | null; status: "confirmed" | "unconfirmed" | "derived" | "expected"; evidenceIds: string[] };
export type StateChange = { changeId: string; entityId: string; field: string; before: FactValue["value"]; after: FactValue["value"]; status: "proposed" | "accepted_session"; reversible: boolean };
export type SemanticAction = { id: string; type: TurnActionType; label: string; consequence: ConsequenceClass; confirmation: ConfirmationRequirement; reversible: boolean; payload: Record<string, string | number | boolean | null> };
export type PresentationBlock = { id: string; type: PresentationBlockType; title?: string; body: string; emphasis: "primary" | "supporting" | "detail"; evidenceIds: string[] };

export type CovarifyTurn = {
  contractVersion: 1;
  identity: { turnId: string; sessionId: string; sequence: number; timestamp: string; modality: InputModality };
  input: { rawStatement: string | null; normalizedStatement: string | null; guidedActionId: string | null };
  understanding: { intent: string; scope: string; referencedEntityIds: string[]; resolvedReferences: Array<{ phrase: string; entityId: string; confidence: "high" | "medium" }>; confidence: "high" | "medium" | "low"; ambiguity: string | null };
  evidence: { references: EvidenceReference[]; missing: string[]; stale: string[] };
  financialImpact: { factsRead: FactValue[]; proposedChanges: StateChange[]; acceptedSessionChanges: StateChange[]; derivedCalculations: Array<{ id: string; expression: string; result: number; evidenceIds: string[] }>; before: FactValue[]; after: FactValue[] };
  decision: { decisionId: string | null; goal: string | null; constraints: string[]; recommendation: string | null; rationale: string | null; alternatives: string[]; tradeoffs: string[]; consequenceOfDelay: string | null; confidence: "high" | "medium" | "low"; status: "preliminary" | "final" | "not_applicable" };
  response: { primaryMessage: string; conciseRationale: string | null; blocks: PresentationBlock[]; question: string | null; correction: { changeId: string; message: string } | null };
  actions: SemanticAction[];
  next: { bestStep: string; blocking: boolean; stopped: boolean; waitingForEvidence: boolean };
  memory: { disposition: MemoryDisposition; proposal: { proposalId: string; fact: FactValue; sourceTurnId: string } | null };
  telemetry: { event: "turn_understood" | "clarification_requested" | "recommendation_presented" | "correction_proposed" | "correction_applied" | "undo_used" | "stopped_for_now" | "resumed" | "trust_error_detected"; safeAttributes: Record<string, string | boolean> };
};

export function confirmationFor(consequence: ConsequenceClass): ConfirmationRequirement {
  if (consequence === "READ_ONLY") return "none";
  if (consequence === "SESSION_REVERSIBLE") return "explicit_apply";
  if (consequence === "DURABLE_REVERSIBLE") return "explicit_durable_confirmation";
  return "strong_confirmation";
}

export function assertTurnInvariants(turn: CovarifyTurn): CovarifyTurn {
  const unresolved = new Set(turn.evidence.missing);
  for (const fact of [...turn.financialImpact.factsRead, ...turn.financialImpact.after]) {
    if (fact.status === "confirmed" && unresolved.has(`${fact.entityId}.${fact.field}`)) throw new Error("T2_CONFIRMED_FACT_UNRESOLVED");
  }
  if (turn.financialImpact.proposedChanges.some((change) => turn.financialImpact.acceptedSessionChanges.some((accepted) => accepted.changeId === change.changeId))) throw new Error("T3_PROPOSED_CHANGE_ALREADY_ACCEPTED");
  if (turn.actions.some((action) => action.confirmation !== confirmationFor(action.consequence))) throw new Error("CONFIRMATION_CLASS_MISMATCH");
  if (turn.actions.some((action) => !action.id || !action.type)) throw new Error("ACTION_ID_REQUIRED");
  if (!turn.response.primaryMessage.trim()) throw new Error("T5_VISIBLE_FEEDBACK_REQUIRED");
  if (turn.memory.disposition === "confirmed_memory" && !turn.memory.proposal) throw new Error("CONFIRMED_MEMORY_PROPOSAL_REQUIRED");
  return turn;
}
