export type FinancialGoalType = "housing_catch_up" | "cash_flow_stability" | "debt_payoff" | "emergency_reserve" | "recurring_cost_reduction" | "credit_utilization_improvement" | "purchase_savings" | "education_funding" | "retirement_preparation" | "family_protection" | "business_expense_organization" | "custom";
export type GoalStatus = "candidate" | "confirmed" | "paused" | "completed" | "canceled";
export type FinancialGoal = { id: string; userId: string; type: FinancialGoalType; label: string; targetAmount: number | null; targetDate: string | null; priority: number | null; status: GoalStatus; confirmedAt: string | null; evidenceIds: string[]; assumptions: string[] };

export function confirmedGoal(goal: FinancialGoal | null | undefined): goal is FinancialGoal & { status: "confirmed"; confirmedAt: string } {
  return goal?.status === "confirmed" && Boolean(goal.confirmedAt);
}

export function competingGoalClarification(goals: FinancialGoal[]) {
  const active = goals.filter(confirmedGoal).filter((goal) => goal.priority == null);
  return active.length > 1 ? `Which goal should come first: ${active.map((goal) => goal.label).join(" or ")}?` : null;
}
