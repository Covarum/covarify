import type { PaymentScenario } from "./talk-to-covarify";

export type DecisionStatus = "suggestion" | "pending_confirmation" | "applied" | "reversed" | "expired" | "scenario_only";
export type DecisionSource = "voice" | "typed" | "manual_control" | "covarify_suggestion";
export type DecisionScope = "This week" | "This billing cycle" | "Until end of month" | "Until cash flow is neutral" | "Custom date" | "Ongoing until changed";

export type DecisionRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  title: string;
  interpreted_command: string;
  source: DecisionSource;
  profile_name: string;
  status: DecisionStatus;
  decision_type: "category_reduction" | "merchant_pause" | "protected_obligation" | "payment_strategy" | "multi_category_plan";
  scope_start: string;
  scope_end: string;
  affected_category: string;
  affected_merchant: string;
  affected_debt: string;
  estimated_cash_impact: number;
  estimated_gap_impact: number;
  confidence: number;
  requires_confirmation: boolean;
  explanation: string;
  previous_value: string;
  new_value: string;
  undo_available: boolean;
};

export type DecisionAction =
  | { kind: "set_reduction"; category: string; amount: number }
  | { kind: "pause_merchant"; category: string; merchant: string; amount: number; choice?: "pause" | "reduce" }
  | { kind: "protect_merchant"; category: string; merchant: string }
  | { kind: "set_payment"; scenario: PaymentScenario; amount?: number }
  | { kind: "apply_suggestion"; items: { category: string; amount: number }[] }
  | { kind: "set_transaction"; category: string; transaction: { id: string; name: string; amount: number; date: string; category: string }; choice: "none" | "skip" | "reduce" | "protect" };

export type DecisionDraft = Omit<DecisionRecord, "id" | "created_at" | "updated_at" | "status" | "scope_start" | "scope_end" | "undo_available"> & {
  preferred_status?: DecisionStatus;
};

export type DecisionRequestResult = { applied: boolean; record: DecisionRecord };

// TODO(decision-ledger): Add authenticated user profiles, household member roles,
// speaker verification, encrypted decision persistence, shared-household approval
// permissions and notifications, immutable audit history, and compliance/legal review.
