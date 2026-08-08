import type { SemanticAction } from "../../lib/conversation/turn-contract.ts";

export type { AmbiguityCandidate, ConfirmationRequirement, ConsequenceClass, CovarifyTurn, InputModality, PresentationBlock, PresentationBlockType, PresentationDepth, SemanticAction, SemanticActionPayload, TurnActionType } from "../../lib/conversation/turn-contract.ts";
export type { TransportTurnInput as TurnInput } from "../../lib/conversation/transport-schema.ts";
export { COVARIFY_TURN_CONTRACT_VERSION, isCovarifyTurn, parseTurnTransportResponse } from "../../lib/conversation/transport-schema.ts";

export type ActionInteraction = "execute" | "review" | "unavailable";

export function interactionForAction(action: SemanticAction): ActionInteraction {
  if (action.consequence === "READ_ONLY" && action.confirmation === "none") return "execute";
  if (action.consequence === "SESSION_REVERSIBLE" && action.confirmation === "explicit_apply") return "review";
  return "unavailable";
}
