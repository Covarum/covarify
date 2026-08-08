import type { CovarifyTurn, InputModality, SemanticActionPayload } from "./turn-contract.ts";

export const COVARIFY_TURN_CONTRACT_VERSION = 1 as const;
export type SupportedTurnContractVersion = typeof COVARIFY_TURN_CONTRACT_VERSION;

export type TransportTurnInput = {
  modality: InputModality;
  statement?: string;
  action?: { id: string; payload: SemanticActionPayload };
};

export type TurnTransportRequest = {
  supportedContractVersion: SupportedTurnContractVersion;
  input: TransportTurnInput;
  sessionToken?: string;
};

export type TurnTransportSuccess = {
  ok: true;
  contractVersion: SupportedTurnContractVersion;
  turn: CovarifyTurn;
  sessionToken: string;
};

export type TurnTransportErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "CONTRACT_MISMATCH" | "INVALID_REQUEST" | "STALE_ACTION" | "SESSION_EXPIRED" | "SERVER_ERROR";
export type TurnTransportFailure = { ok: false; contractVersion: SupportedTurnContractVersion; error: TurnTransportErrorCode };
export type TurnTransportResponse = TurnTransportSuccess | TurnTransportFailure;

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const string = (value: unknown): value is string => typeof value === "string";
const nullableString = (value: unknown) => value === null || string(value);
const stringArray = (value: unknown) => Array.isArray(value) && value.every(string);
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every((key) => key in value);
const payload = (value: unknown): value is SemanticActionPayload => {
  if (!record(value) || !string(value.kind)) return false;
  if (["stop", "resume"].includes(value.kind)) return exactKeys(value, ["kind"]);
  if (["apply_correction", "cancel_correction"].includes(value.kind)) return exactKeys(value, ["kind", "changeId"]) && string(value.changeId);
  if (value.kind === "answer_question") return exactKeys(value, ["kind", "questionId", "answerId"]) && string(value.questionId) && string(value.answerId);
  if (value.kind === "change_presentation_depth") return exactKeys(value, ["kind", "depth"]) && ["GUIDED", "CONCISE", "DETAILED"].includes(String(value.depth));
  const singleStringField: Record<string, string> = { undo: "reversibleActionId", show_evidence: "evidenceGroupId", show_calculation: "calculationId", compare_options: "decisionId", propose_memory: "proposalId", confirm_memory: "proposalId" };
  const field = singleStringField[value.kind];
  return Boolean(field) && exactKeys(value, ["kind", field]) && string(value[field]);
};

export function isTransportTurnInput(value: unknown): value is TransportTurnInput {
  if (!record(value) || !["text", "reviewed_voice", "guided_action"].includes(String(value.modality))) return false;
  if (Object.keys(value).some((key) => !["modality", "statement", "action"].includes(key))) return false;
  if (value.statement !== undefined && (!string(value.statement) || value.statement.length > 500)) return false;
  if (value.action !== undefined) {
    if (!record(value.action) || !exactKeys(value.action, ["id", "payload"]) || !string(value.action.id) || !payload(value.action.payload)) return false;
  }
  const hasStatement = typeof value.statement === "string" && Boolean(value.statement.trim());
  return hasStatement !== Boolean(value.action);
}

export function isCovarifyTurn(value: unknown): value is CovarifyTurn {
  if (!record(value) || value.contractVersion !== COVARIFY_TURN_CONTRACT_VERSION) return false;
  if (!record(value.identity) || !string(value.identity.turnId) || !string(value.identity.sessionId) || typeof value.identity.sequence !== "number") return false;
  if (!record(value.understanding) || !string(value.understanding.intent) || !string(value.understanding.capability) || !Array.isArray(value.understanding.referencedEntityIds)) return false;
  if (!record(value.response) || !string(value.response.primaryMessage) || !Array.isArray(value.response.blocks)) return false;
  for (const block of value.response.blocks) if (!record(block) || !string(block.id) || !string(block.type) || !string(block.body) || !stringArray(block.evidenceIds)) return false;
  if (!Array.isArray(value.actions)) return false;
  for (const action of value.actions) if (!record(action) || !string(action.id) || !string(action.type) || !string(action.label) || !string(action.consequence) || !string(action.confirmation) || !record(action.payload) || !string(action.payload.kind)) return false;
  if (!record(value.next) || !string(value.next.type) || !string(value.next.bestStep) || !nullableString(value.next.actionId)) return false;
  return true;
}

export function parseTurnTransportResponse(value: unknown): TurnTransportResponse | null {
  if (!record(value) || value.contractVersion !== COVARIFY_TURN_CONTRACT_VERSION || typeof value.ok !== "boolean") return null;
  if (value.ok === false) return string(value.error) ? value as TurnTransportFailure : null;
  return string(value.sessionToken) && isCovarifyTurn(value.turn) ? value as TurnTransportSuccess : null;
}
