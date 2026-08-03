import type { ConversationEntity, ConversationProposal } from "./types.ts";

export function planNamedContextProposal(statement: string, entities: ConversationEntity[], transactionIds: string[]): ConversationProposal {
  const person = entities.find((entity) => entity.type === "person"); const business = entities.find((entity) => entity.type === "business"); const purpose = entities.find((entity) => entity.type === "purpose");
  const values = [...(purpose ? [{ label: "Purpose", value: purpose.value }] : []), ...(person ? [{ label: "Recipient", value: person.value }] : []), ...(business ? [{ label: "Business context", value: business.value }] : []), ...(purpose ? [{ label: "Suggested category", value: "Shopping → Gifts" }] : business ? [{ label: "Suggested category", value: "Business → Software & Services" }] : [])];
  return { kind: "named_context", title: "Proposed transaction meaning", values, evidence: [statement], changes: ["The selected transaction’s confirmed meaning"], unchanged: ["The source bank transaction", "Other transactions", "Future merchant rules"], transactionIds, confirmationRequired: true };
}
