export const CONVERSATION_SAFETY_RULES = Object.freeze(["raw_plaid_immutable", "confirmation_before_write", "owner_scoped_evidence", "no_tax_legal_investment_claims", "no_private_ids_in_copy"] as const);
export function assertReadOnlyTool(readOnly: boolean) { if (!readOnly) throw new Error("CONFIRMATION_REQUIRED"); }
