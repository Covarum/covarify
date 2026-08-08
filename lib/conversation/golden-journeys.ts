import type { FactValue } from "./turn-contract.ts";

export type GoldenJourneyId = "competing_cash_needs" | "transaction_meaning" | "expected_business_income" | "goal_conflict" | "what_changed" | "contextual_correction";
export type GoldenJourney = { id: GoldenJourneyId; title: string; facts: FactValue[]; entities: string[]; initialRecommendation: string | null };

const fact = (entityId: string, field: string, value: FactValue["value"], status: FactValue["status"] = "confirmed"): FactValue => ({ entityId, field, value, status, evidenceIds: [`fixture:${entityId}:${field}`] });

export const goldenJourneys: Record<GoldenJourneyId, GoldenJourney> = {
  competing_cash_needs: { id: "competing_cash_needs", title: "Competing cash needs", entities: ["repair", "card", "utility", "rent"], initialRecommendation: "Protect required minimums and preserve housing stability.", facts: [fact("cash", "available", 900), fact("repair", "estimate", 500), fact("repair", "work_required", null, "unconfirmed"), fact("card", "minimum", 75), fact("utility", "amount", 180), fact("rent", "upcoming", 3475), fact("rent", "arrears", 7890)] },
  transaction_meaning: { id: "transaction_meaning", title: "Transaction meaning", entities: ["target-312", "callie"], initialRecommendation: null, facts: [fact("target-312", "amount", 312), fact("target-312", "merchant", "Target"), fact("target-312", "meaning", null, "unconfirmed")] },
  expected_business_income: { id: "expected_business_income", title: "Expected business income", entities: ["invoice-2500"], initialRecommendation: "Keep the invoice out of available cash until payment is received.", facts: [fact("invoice-2500", "gross", 2500, "expected"), fact("invoice-2500", "materials", 300), fact("invoice-2500", "received", false), fact("cash", "available_from_invoice", 0, "derived")] },
  goal_conflict: { id: "goal_conflict", title: "Goal conflict", entities: ["card-goal", "camp-deposit"], initialRecommendation: "Protect the time-sensitive camp deposit before accelerating optional card payoff.", facts: [fact("card-goal", "priority", "pay_down"), fact("camp-deposit", "due", "soon"), fact("camp-deposit", "amount", 400)] },
  what_changed: { id: "what_changed", title: "What changed", entities: ["snapshot-current", "snapshot-prior"], initialRecommendation: "Review the material cash decrease and upcoming obligation.", facts: [fact("snapshot-prior", "available_cash", 1200), fact("snapshot-current", "available_cash", 900), fact("snapshot-current", "new_obligation", "utility") ] },
  contextual_correction: { id: "contextual_correction", title: "Contextual correction", entities: ["visa", "mastercard", "repair"], initialRecommendation: null, facts: [fact("payment", "account", "mastercard"), fact("repair", "estimate", 500)] },
};
