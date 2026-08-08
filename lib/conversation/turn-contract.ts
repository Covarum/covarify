export type InputModality = "text" | "reviewed_voice" | "guided_action";
export type PresentationDepth = "GUIDED" | "CONCISE" | "DETAILED";
export type ConsequenceClass = "READ_ONLY" | "SESSION_REVERSIBLE" | "DURABLE_REVERSIBLE" | "EXTERNAL_CONSEQUENTIAL" | "IRREVERSIBLE_OR_HIGH_RISK";
export type ConfirmationRequirement = "none" | "explicit_apply" | "explicit_durable_confirmation" | "strong_confirmation";
export type MemoryDisposition = "no_memory" | "session_only" | "memory_proposal" | "confirmed_memory" | "supersede_candidate" | "revoke_candidate";
export type FinancialEntityType = "ACCOUNT" | "TRANSACTION" | "OBLIGATION" | "LIABILITY" | "INCOME" | "RECEIVABLE" | "CASH_RESOURCE" | "GOAL" | "PERSON" | "HOUSEHOLD" | "DECISION" | "EXPENSE" | "REPAIR";
export type FinancialFieldId = "amount" | "minimum" | "balance" | "due_date" | "estimate" | "merchant" | "meaning" | "category" | "received_status" | "gross" | "materials" | "priority" | "account_reference" | "work_required" | "timing" | "available_amount" | "new_obligation";
export type IntentId = "READ_STATE" | "TRANSACTION_COUNT" | "TRANSACTION_TOTAL" | "TRANSACTION_LIST" | "ACCOUNT_QUESTION" | "TRANSACTION_MEANING" | "CORRECT_FACT" | "CORRECT_REFERENCE" | "ANSWER_QUESTION" | "PRIORITIZE" | "ASSESS_EXPECTED_RESOURCE" | "COMPARE_SNAPSHOTS" | "COMPARE_OPTIONS" | "SHOW_EVIDENCE" | "SHOW_CALCULATION" | "CHANGE_DEPTH" | "STOP" | "RESUME" | "UNDO" | "PROPOSE_MEMORY" | "OUT_OF_SCOPE" | "UNRESOLVED";
export type CapabilityId = "READ_FINANCIAL_STATE" | "CORRECT_FACT" | "CORRECT_REFERENCE" | "ANSWER_BLOCKING_QUESTION" | "PRIORITIZE_COMPETING_NEEDS" | "ASSESS_EXPECTED_RESOURCE" | "COMPARE_FINANCIAL_SNAPSHOTS" | "COMPARE_OPTIONS" | "SHOW_EVIDENCE" | "SHOW_CALCULATION" | "CHANGE_PRESENTATION_DEPTH" | "STOP_FOR_NOW" | "RESUME" | "UNDO" | "PROPOSE_MEMORY" | "OUT_OF_SCOPE";
export type DecisionType = "ALLOCATION" | "EXPECTED_RESOURCE" | "GOAL_PRIORITY" | "SNAPSHOT_CHANGE" | "FACT_CORRECTION" | "TRANSACTION_UNDERSTANDING" | "TRANSACTION_MEANING" | "NONE";
export type RecommendationType = "PROTECT_STABILITY" | "EXCLUDE_EXPECTED_RESOURCE" | "PRIORITIZE_DEADLINE" | "REVIEW_CHANGE" | "NONE";
export type NextStepType = "CONFIRM_PROPOSAL" | "ANSWER_CRITICAL_FACT" | "WAIT_FOR_EVIDENCE" | "REVIEW_RECOMMENDATION" | "EXPLORE_OPTION" | "STOP_VALID" | "RESUME_SESSION" | "NONE";
export type CalculationType = "ALLOCATION" | "RECONCILIATION" | "EXPECTED_OWNER_AVAILABLE" | "SNAPSHOT_DELTA";
export type TurnActionType = "ANSWER_QUESTION" | "APPLY_CORRECTION" | "CANCEL_CORRECTION" | "SHOW_EVIDENCE" | "SHOW_CALCULATION" | "COMPARE_OPTIONS" | "CHANGE_PRESENTATION_DEPTH" | "UNDO" | "STOP_FOR_NOW" | "RESUME" | "PROPOSE_MEMORY" | "CONFIRM_MEMORY";
export type PresentationBlockType = "situation_summary" | "answer" | "question" | "recommendation" | "allocation" | "reconciliation" | "rationale" | "warning" | "assumption" | "evidence" | "calculation" | "correction_review" | "stopping_state";

export type EvidenceReference = { id: string; provenance: "CONNECTED_DATA" | "USER_CONFIRMED" | "DERIVED" | "INFERRED" | "EXPECTED" | "FIXTURE" | "MEMORY_CONFIRMED"; sourceId: string; observedAt: string | null; updatedAt: string | null; freshness: "current" | "stale" | "unknown"; confidence: "high" | "medium" | "low"; ownership: { userId: string; householdId: string | null; scope: "user" | "household" | "business" } };
export type FactValue = { entityId: string; entityType?: FinancialEntityType; field: FinancialFieldId; value: string | number | boolean | null; status: "confirmed" | "unconfirmed" | "derived" | "expected"; evidenceIds: string[] };
export type FinancialEntity = { id: string; type: FinancialEntityType; label: string; aliases: string[]; facts: FactValue[] };
export type StateChange = { changeId: string; entityId: string; field: FinancialFieldId; before: FactValue["value"]; after: FactValue["value"]; status: "proposed" | "accepted_session"; reversible: boolean; affectedEntityIds: string[] };
export type AmbiguityCandidate = { entityId: string; fieldId: FinancialFieldId | null; displayLabel: string; confidence: "high" | "medium" | "low"; reason: string; clarificationRequired: true };
export type SemanticActionPayload = { kind: "apply_correction"; changeId: string } | { kind: "cancel_correction"; changeId: string } | { kind: "answer_question"; questionId: string; answerId: string } | { kind: "change_presentation_depth"; depth: PresentationDepth } | { kind: "undo"; reversibleActionId: string } | { kind: "show_evidence"; evidenceGroupId: string } | { kind: "show_calculation"; calculationId: string } | { kind: "compare_options"; decisionId: string } | { kind: "stop" } | { kind: "resume" } | { kind: "propose_memory"; proposalId: string } | { kind: "confirm_memory"; proposalId: string };
export type SemanticAction = { id: string; type: TurnActionType; label: string; consequence: ConsequenceClass; confirmation: ConfirmationRequirement; reversible: boolean; payload: SemanticActionPayload };
export type PresentationBlock = { id: string; type: PresentationBlockType; title?: string; body: string; emphasis: "primary" | "supporting" | "detail"; evidenceIds: string[] };
export type CanonicalDecisionResult = { decisionId: string; type: DecisionType; goal: string | null; constraints: string[]; factsConsidered: FactValue[]; answer: { type: "TRANSACTION_COUNT" | "TRANSACTION_TOTAL" | "TRANSACTION_LIST" | "ACCOUNT_SUMMARY" | "CLARIFICATION" | "PROPOSAL"; summary: string } | null; recommendation: { type: RecommendationType; summary: string } | null; quantified: Array<{ label: string; value: number; unit: "USD" | "count" | "days" }>; allocation: Array<{ entityId: string; amount: number }>; reconciliation: { available: number; allocated: number; remaining: number } | null; alternatives: string[]; tradeoffs: string[]; consequenceOfDelay: string | null; uncertainty: string[]; confidence: "high" | "medium" | "low"; status: "preliminary" | "final" | "not_applicable"; affectedEntityIds: string[] };

export type CovarifyTurn = {
  contractVersion: 1;
  identity: { turnId: string; sessionId: string; sequence: number; timestamp: string; modality: InputModality };
  input: { rawStatement: string | null; normalizedStatement: string | null; guidedActionId: string | null };
  understanding: { intent: IntentId; capability: CapabilityId; scope: "FINANCIAL_STATE" | "TRANSACTION" | "RESOURCE" | "GOAL" | "PRESENTATION" | "SESSION" | "OUT_OF_SCOPE"; scopeDetail: "ALL_AVAILABLE_HISTORY" | "EXPLICIT_PERIOD" | "SPECIFIC_TRANSACTION" | "VISIBLE_CONTEXT" | "CLARIFICATION_REQUIRED" | null; referencedEntityIds: string[]; resolvedReferences: Array<{ phrase: string; entityId: string; fieldId: FinancialFieldId | null; confidence: "high" | "medium" }>; confidence: "high" | "medium" | "low"; ambiguity: { message: string; candidates: AmbiguityCandidate[] } | null };
  evidence: { references: EvidenceReference[]; missing: string[]; stale: string[] };
  financialImpact: { factsRead: FactValue[]; proposedChanges: StateChange[]; acceptedSessionChanges: StateChange[]; derivedCalculations: Array<{ id: string; type: CalculationType; expression: string; result: number; evidenceIds: string[] }>; before: FactValue[]; after: FactValue[] };
  decision: CanonicalDecisionResult;
  response: { primaryMessage: string; conciseRationale: string | null; blocks: PresentationBlock[]; question: string | null; correction: { changeId: string; message: string } | null };
  actions: SemanticAction[];
  next: { type: NextStepType; bestStep: string; blocking: boolean; stopped: boolean; waitingForEvidence: boolean; actionId: string | null };
  memory: { disposition: MemoryDisposition; proposal: { proposalId: string; fact: FactValue; sourceTurnId: string } | null };
  telemetry: { event: "turn_understood" | "clarification_requested" | "recommendation_presented" | "correction_proposed" | "correction_applied" | "correction_cancelled" | "undo_used" | "stopped_for_now" | "resumed" | "trust_error_detected"; safeAttributes: Record<string, string | boolean> };
};

export function confirmationFor(consequence: ConsequenceClass): ConfirmationRequirement { if (consequence === "READ_ONLY") return "none"; if (consequence === "SESSION_REVERSIBLE") return "explicit_apply"; if (consequence === "DURABLE_REVERSIBLE") return "explicit_durable_confirmation"; return "strong_confirmation"; }
export function assertTurnInvariants(turn: CovarifyTurn): CovarifyTurn {
  const unresolved = new Set(turn.evidence.missing);
  for (const fact of [...turn.financialImpact.factsRead, ...turn.financialImpact.after]) if (fact.status === "confirmed" && unresolved.has(`${fact.entityId}.${fact.field}`)) throw new Error("T2_CONFIRMED_FACT_UNRESOLVED");
  if (turn.financialImpact.proposedChanges.some((change) => turn.financialImpact.acceptedSessionChanges.some((accepted) => accepted.changeId === change.changeId))) throw new Error("T3_PROPOSED_CHANGE_ALREADY_ACCEPTED");
  if (turn.actions.some((action) => action.confirmation !== confirmationFor(action.consequence))) throw new Error("CONFIRMATION_CLASS_MISMATCH");
  if (turn.actions.some((action) => !action.id || !action.type || !action.payload.kind)) throw new Error("ACTION_ID_REQUIRED");
  if (!turn.response.primaryMessage.trim()) throw new Error("T5_VISIBLE_FEEDBACK_REQUIRED");
  if (turn.memory.disposition === "confirmed_memory" && !turn.memory.proposal) throw new Error("CONFIRMED_MEMORY_PROPOSAL_REQUIRED");
  if (turn.financialImpact.acceptedSessionChanges.some((change) => change.affectedEntityIds.some((id) => id !== change.entityId)) && turn.decision.affectedEntityIds.some((id) => !turn.financialImpact.acceptedSessionChanges.some((change) => change.affectedEntityIds.includes(id)))) throw new Error("T8_UNRELATED_STATE_CHANGED");
  if (turn.decision.reconciliation && turn.decision.reconciliation.available !== turn.decision.reconciliation.allocated + turn.decision.reconciliation.remaining) throw new Error("T1_RECONCILIATION_CONTRADICTION");
  return turn;
}
