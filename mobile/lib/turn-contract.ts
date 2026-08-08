export type InputModality = "text" | "reviewed_voice" | "guided_action";
export type PresentationDepth = "GUIDED" | "CONCISE" | "DETAILED";
export type ConsequenceClass = "READ_ONLY" | "SESSION_REVERSIBLE" | "DURABLE_REVERSIBLE" | "EXTERNAL_CONSEQUENTIAL" | "IRREVERSIBLE_OR_HIGH_RISK";
export type ConfirmationRequirement = "none" | "explicit_apply" | "explicit_durable_confirmation" | "strong_confirmation";
export type PresentationBlockType = "situation_summary" | "answer" | "question" | "recommendation" | "allocation" | "reconciliation" | "rationale" | "warning" | "assumption" | "evidence" | "calculation" | "correction_review" | "stopping_state";
export type TurnActionType = "ANSWER_QUESTION" | "APPLY_CORRECTION" | "CANCEL_CORRECTION" | "SHOW_EVIDENCE" | "SHOW_CALCULATION" | "COMPARE_OPTIONS" | "CHANGE_PRESENTATION_DEPTH" | "UNDO" | "STOP_FOR_NOW" | "RESUME" | "PROPOSE_MEMORY" | "CONFIRM_MEMORY";

export type TurnInput = {
  modality: InputModality;
  statement?: string;
  action?: { id: string; payload: SemanticActionPayload };
};

export type SemanticActionPayload =
  | { kind: "apply_correction"; changeId: string }
  | { kind: "cancel_correction"; changeId: string }
  | { kind: "answer_question"; questionId: string; answerId: string }
  | { kind: "change_presentation_depth"; depth: PresentationDepth }
  | { kind: "undo"; reversibleActionId: string }
  | { kind: "show_evidence"; evidenceGroupId: string }
  | { kind: "show_calculation"; calculationId: string }
  | { kind: "compare_options"; decisionId: string }
  | { kind: "stop" }
  | { kind: "resume" }
  | { kind: "propose_memory"; proposalId: string }
  | { kind: "confirm_memory"; proposalId: string };

export type SemanticAction = {
  id: string;
  type: TurnActionType;
  label: string;
  consequence: ConsequenceClass;
  confirmation: ConfirmationRequirement;
  reversible: boolean;
  payload: SemanticActionPayload;
};

export type PresentationBlock = {
  id: string;
  type: PresentationBlockType;
  title?: string;
  body: string;
  emphasis: "primary" | "supporting" | "detail";
  evidenceIds: string[];
};

export type AmbiguityCandidate = {
  entityId: string;
  fieldId: string | null;
  displayLabel: string;
  confidence: "high" | "medium" | "low";
  reason: string;
  clarificationRequired: true;
};

export type CovarifyTurn = {
  contractVersion: 1;
  identity: { turnId: string; sessionId: string; sequence: number; timestamp: string; modality: InputModality };
  understanding: {
    intent: string;
    capability: string;
    scope: string;
    confidence: "high" | "medium" | "low";
    ambiguity: { message: string; candidates: AmbiguityCandidate[] } | null;
  };
  response: {
    primaryMessage: string;
    conciseRationale: string | null;
    blocks: PresentationBlock[];
    question: string | null;
    correction: { changeId: string; message: string } | null;
  };
  actions: SemanticAction[];
  next: { type: string; bestStep: string; blocking: boolean; stopped: boolean; waitingForEvidence: boolean; actionId: string | null };
};

export type ActionInteraction = "execute" | "review" | "unavailable";

export function interactionForAction(action: SemanticAction): ActionInteraction {
  if (action.consequence === "READ_ONLY" && action.confirmation === "none") return "execute";
  if (action.consequence === "SESSION_REVERSIBLE" && action.confirmation === "explicit_apply") return "review";
  return "unavailable";
}
