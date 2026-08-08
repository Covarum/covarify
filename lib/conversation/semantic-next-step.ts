import type { CovarifyTurn, SemanticAction } from "./turn-contract.ts";
export function selectSemanticNextStep(input: { proposal: boolean; criticalQuestion: string | null; waiting: boolean; decisionReview: boolean; optionalAction: SemanticAction | null; stopped: boolean }): CovarifyTurn["next"] {
  if (input.proposal) return { type: "CONFIRM_PROPOSAL", bestStep: "Review and apply or cancel the proposed correction.", blocking: true, stopped: false, waitingForEvidence: false, actionId: "correction.apply" };
  if (input.criticalQuestion) return { type: "ANSWER_CRITICAL_FACT", bestStep: input.criticalQuestion, blocking: true, stopped: false, waitingForEvidence: false, actionId: "clarification.answer" };
  if (input.waiting) return { type: "WAIT_FOR_EVIDENCE", bestStep: "Provide or verify the missing evidence.", blocking: true, stopped: false, waitingForEvidence: true, actionId: null };
  if (input.decisionReview) return { type: "REVIEW_RECOMMENDATION", bestStep: "Review the recommendation.", blocking: false, stopped: false, waitingForEvidence: false, actionId: input.optionalAction?.id || null };
  if (input.optionalAction) return { type: "EXPLORE_OPTION", bestStep: input.optionalAction.label, blocking: false, stopped: false, waitingForEvidence: false, actionId: input.optionalAction.id };
  if (input.stopped) return { type: "RESUME_SESSION", bestStep: "Resume when ready.", blocking: false, stopped: true, waitingForEvidence: false, actionId: "session.resume" };
  return { type: "STOP_VALID", bestStep: "Stop when you have enough.", blocking: false, stopped: false, waitingForEvidence: false, actionId: "session.stop" };
}
