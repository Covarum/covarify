import { confirmationFor, type CapabilityId, type ConsequenceClass, type FinancialEntityType, type FinancialFieldId, type IntentId } from "./turn-contract.ts";

export type CapabilityDefinition = { id: CapabilityId; intents: IntentId[]; entityTypes: FinancialEntityType[] | "any"; fields: FinancialFieldId[] | "any"; consequence: ConsequenceClass; confirmation: ReturnType<typeof confirmationFor>; operation: "read" | "correct" | "answer" | "decide" | "present" | "session" | "memory" | "redirect"; undo: boolean; presenterInput: "decision" | "proposal" | "clarification" | "session" };
const define = (id: CapabilityId, intents: IntentId[], consequence: ConsequenceClass, operation: CapabilityDefinition["operation"], presenterInput: CapabilityDefinition["presenterInput"], entityTypes: CapabilityDefinition["entityTypes"] = "any", fields: CapabilityDefinition["fields"] = "any", undo = false): CapabilityDefinition => ({ id, intents, consequence, confirmation: confirmationFor(consequence), operation, presenterInput, entityTypes, fields, undo });
export const capabilityRegistry: Record<CapabilityId, CapabilityDefinition> = {
  READ_FINANCIAL_STATE: define("READ_FINANCIAL_STATE", ["READ_STATE", "TRANSACTION_COUNT", "TRANSACTION_TOTAL", "TRANSACTION_LIST", "ACCOUNT_QUESTION"], "READ_ONLY", "read", "decision"),
  CORRECT_FACT: define("CORRECT_FACT", ["CORRECT_FACT"], "SESSION_REVERSIBLE", "correct", "proposal", "any", ["amount", "minimum", "estimate", "gross", "materials"], true),
  CORRECT_REFERENCE: define("CORRECT_REFERENCE", ["CORRECT_REFERENCE"], "SESSION_REVERSIBLE", "correct", "proposal", ["ACCOUNT", "TRANSACTION"], ["account_reference"], true),
  ANSWER_BLOCKING_QUESTION: define("ANSWER_BLOCKING_QUESTION", ["ANSWER_QUESTION"], "SESSION_REVERSIBLE", "answer", "decision", "any", ["work_required", "timing"], true),
  PRIORITIZE_COMPETING_NEEDS: define("PRIORITIZE_COMPETING_NEEDS", ["PRIORITIZE"], "READ_ONLY", "decide", "decision"),
  ASSESS_EXPECTED_RESOURCE: define("ASSESS_EXPECTED_RESOURCE", ["ASSESS_EXPECTED_RESOURCE"], "READ_ONLY", "decide", "decision", ["RECEIVABLE"], "any"),
  COMPARE_FINANCIAL_SNAPSHOTS: define("COMPARE_FINANCIAL_SNAPSHOTS", ["COMPARE_SNAPSHOTS"], "READ_ONLY", "decide", "decision"),
  COMPARE_OPTIONS: define("COMPARE_OPTIONS", ["COMPARE_OPTIONS"], "READ_ONLY", "decide", "decision"),
  SHOW_EVIDENCE: define("SHOW_EVIDENCE", ["SHOW_EVIDENCE"], "READ_ONLY", "present", "decision"), SHOW_CALCULATION: define("SHOW_CALCULATION", ["SHOW_CALCULATION"], "READ_ONLY", "present", "decision"),
  CHANGE_PRESENTATION_DEPTH: define("CHANGE_PRESENTATION_DEPTH", ["CHANGE_DEPTH"], "SESSION_REVERSIBLE", "present", "session", "any", "any", true),
  STOP_FOR_NOW: define("STOP_FOR_NOW", ["STOP"], "SESSION_REVERSIBLE", "session", "session", "any", "any", true), RESUME: define("RESUME", ["RESUME"], "SESSION_REVERSIBLE", "session", "session", "any", "any", true), UNDO: define("UNDO", ["UNDO"], "SESSION_REVERSIBLE", "session", "session", "any", "any", true),
  PROPOSE_MEMORY: define("PROPOSE_MEMORY", ["PROPOSE_MEMORY", "TRANSACTION_MEANING"], "READ_ONLY", "memory", "proposal"), OUT_OF_SCOPE: define("OUT_OF_SCOPE", ["OUT_OF_SCOPE", "UNRESOLVED"], "READ_ONLY", "redirect", "clarification"),
};
export const capabilityForIntent = (intent: IntentId) => Object.values(capabilityRegistry).find((item) => item.intents.includes(intent)) || capabilityRegistry.OUT_OF_SCOPE;
