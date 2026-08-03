export type FinancialPriority = "critical" | "urgent" | "important" | "optimization" | "informational";
export type FinancialGap = { obligation: string; requiredAmount: number | null; amountPaid: number | null; remainingAmount: number | null; dueDate: string | null; nextDueDate: string | null; expectedIncome: number | null; availableCash: number | null; protectedObligations: number | null; estimatedShortfall: number | null; confidence: "high" | "medium" | "low"; missingInputs: string[]; evidenceIds: string[]; normalMonthlyAmount?: number | null; paymentType?: "full" | "partial" | "late" | "catch_up" | "extra" | "unsure"; periodsBehind?: number | null };
export type SpendingFlexibility = "protected_essential" | "committed_obligation" | "flexible_essential" | "discretionary" | "potentially_cancellable" | "user_protected" | "unusual_one_time" | "uncertain";
export type SpendingCandidate = { key: string; label: string; category: string; amount: number; transactionIds: string[]; flexibility: SpendingFlexibility; recurring: boolean; userProtected?: boolean; requiredMinimum?: boolean };
export type CandidateLever = { id: string; type: "reduce_category" | "pause_commitment" | "redirect_income" | "apply_refund" | "delay_purchase" | "use_available_cash" | "negotiate_obligation" | "extend_target_date"; label: string; evidenceIds: string[]; estimatedAmount: number | null; timeframe: string; confidence: "high" | "medium" | "low"; impact: string; effort: "low" | "medium" | "high"; reversible: boolean; tradeoff: string; touchesProtectedSpending: boolean; humanHelpAppropriate: boolean };
export type RecoveryOption = { name: "Fastest" | "Balanced" | "Lowest disruption"; targetAmount: number; targetDate: string | null; levers: CandidateLever[]; expectedContribution: number; tradeoffs: string[]; assumptions: string[]; confidence: "high" | "medium" | "low"; projectedCompletionDate: string | null; unresolved: string[] };
export type PlanConstraint = { kind: "protect" | "prefer" | "exclude" | "deadline"; key: string; value: string };
export type RecoveryPlanProposal = { target: string; gap: FinancialGap; options: RecoveryOption[]; constraints: PlanConstraint[]; confirmed: false; activationBlocked: true };
export type PlanProgress = { status: "on_track" | "ahead" | "behind" | "blocked_by_missing_data" | "needs_adjustment" | "completed"; actualContribution: number; expectedContribution: number; remainingGap: number | null; message: string };

export function buildHousingGap(input: { obligation: string; normalMonthlyRent?: number | null; amountPaid?: number | null; outstanding?: number | null; dueDate?: string | null; nextDueDate?: string | null; expectedIncome?: number | null; availableCash?: number | null; protectedObligations?: number | null; evidenceIds: string[]; paymentType?: FinancialGap["paymentType"]; periodsBehind?: number | null }): FinancialGap {
  const missingInputs = [...(input.normalMonthlyRent == null ? ["normal monthly rent"] : []), ...(input.outstanding == null ? ["current amount outstanding"] : [])];
  const knownResources = input.expectedIncome != null && input.availableCash != null && input.protectedObligations != null;
  return { obligation: input.obligation, requiredAmount: input.normalMonthlyRent ?? null, normalMonthlyAmount: input.normalMonthlyRent ?? null, amountPaid: input.amountPaid ?? null, remainingAmount: input.outstanding ?? null, dueDate: input.dueDate ?? null, nextDueDate: input.nextDueDate ?? null, expectedIncome: input.expectedIncome ?? null, availableCash: input.availableCash ?? null, protectedObligations: input.protectedObligations ?? null, estimatedShortfall: input.outstanding != null && knownResources ? Math.max(0, input.outstanding - input.expectedIncome! - input.availableCash! + input.protectedObligations!) : null, confidence: missingInputs.length ? "low" : knownResources ? "high" : "medium", missingInputs, evidenceIds: input.evidenceIds, paymentType: input.paymentType || "unsure", periodsBehind: input.periodsBehind ?? null };
}

export function rankFinancialPriority(input: { housingGap?: FinancialGap | null; utilityShutoff?: boolean; daysUntilDue?: number | null; requiredMinimumMissed?: boolean; optimizationOnly?: boolean }): FinancialPriority {
  if (input.utilityShutoff || (input.housingGap?.remainingAmount != null && input.housingGap.remainingAmount > 0 && (input.daysUntilDue == null || input.daysUntilDue <= 7))) return "critical";
  if (input.housingGap?.remainingAmount != null && input.housingGap.remainingAmount > 0) return "urgent";
  if (input.requiredMinimumMissed) return "important";
  return input.optimizationOnly ? "optimization" : "informational";
}

export function candidateLevers(candidates: SpendingCandidate[], constraints: PlanConstraint[] = []): CandidateLever[] {
  const protectedKeys = new Set(constraints.filter((item) => item.kind === "protect" || item.kind === "exclude").map((item) => item.key.toLowerCase()));
  return candidates.filter((item) => !item.userProtected && !item.requiredMinimum && !protectedKeys.has(item.key.toLowerCase())).filter((item) => ["discretionary", "potentially_cancellable", "flexible_essential"].includes(item.flexibility)).filter((item) => item.recurring && item.flexibility !== "unusual_one_time").map((item) => {
    const cancellable = item.flexibility === "potentially_cancellable";
    const rate = item.flexibility === "discretionary" ? .5 : item.flexibility === "flexible_essential" ? .15 : .8;
    return { id: `lever:${item.key}`, type: cancellable ? "pause_commitment" : "reduce_category", label: item.label, evidenceIds: item.transactionIds, estimatedAmount: Math.round(item.amount * rate * 100) / 100, timeframe: "next month", confidence: item.transactionIds.length >= 2 ? "high" : "medium", impact: `Potentially free about $${(item.amount * rate).toFixed(0)}.`, effort: cancellable ? "medium" : "medium", reversible: true, tradeoff: cancellable ? "Requires the user to verify and make any cancellation." : "Requires lower future spending in this area.", touchesProtectedSpending: false, humanHelpAppropriate: false };
  });
}

const takeUntil = (levers: CandidateLever[], target: number, fraction: number) => { const selected: CandidateLever[] = []; let total = 0; for (const lever of levers) { if (total >= target * fraction) break; selected.push(lever); total += lever.estimatedAmount || 0; } return { selected, total: Math.min(total, target) }; };
export function generateRecoveryOptions(gap: FinancialGap, levers: CandidateLever[], constraints: PlanConstraint[] = []): RecoveryOption[] {
  if (gap.remainingAmount == null || !levers.length) return [];
  const supported = levers.filter((lever) => !lever.touchesProtectedSpending && lever.estimatedAmount != null).sort((a, b) => (b.estimatedAmount || 0) - (a.estimatedAmount || 0));
  const totalSupport = supported.reduce((sum, lever) => sum + (lever.estimatedAmount || 0), 0); if (!totalSupport) return [];
  const specs = totalSupport >= gap.remainingAmount ? [["Fastest", 1], ["Balanced", .75], ["Lowest disruption", .5]] as const : [["Balanced", 1]] as const;
  return specs.map(([name, fraction]) => { const picked = takeUntil(supported, gap.remainingAmount!, fraction); return { name, targetAmount: gap.remainingAmount!, targetDate: constraints.find((item) => item.kind === "deadline")?.value || gap.dueDate, levers: picked.selected, expectedContribution: Math.min(picked.total, totalSupport, gap.remainingAmount!), tradeoffs: picked.selected.map((lever) => lever.tradeoff), assumptions: ["Future activity is similar to the evidence period.", "The user makes any selected changes."], confidence: gap.confidence === "low" ? "low" : picked.selected.every((lever) => lever.confidence === "high") ? "high" : "medium", projectedCompletionDate: null, unresolved: gap.missingInputs } as RecoveryOption; });
}

export function proposeRecoveryPlan(gap: FinancialGap, options: RecoveryOption[], constraints: PlanConstraint[] = []): RecoveryPlanProposal { return { target: gap.obligation, gap, options, constraints, confirmed: false, activationBlocked: true }; }
export function confirmRecoveryPlan(): never { throw new Error("DURABLE_PLAN_PERSISTENCE_REQUIRED"); }
export function monitorPlan(input: { gap: FinancialGap; actualContribution: number; expectedContribution: number; stale: boolean }): PlanProgress {
  const remaining = input.gap.remainingAmount == null ? null : Math.max(0, input.gap.remainingAmount - input.actualContribution);
  if (input.stale || remaining == null) return { status: "blocked_by_missing_data", actualContribution: input.actualContribution, expectedContribution: input.expectedContribution, remainingGap: remaining, message: "Current activity is incomplete, so progress cannot be determined reliably yet." };
  if (remaining === 0) return { status: "completed", actualContribution: input.actualContribution, expectedContribution: input.expectedContribution, remainingGap: 0, message: "The tracked target appears complete based on current activity." };
  const status = input.actualContribution > input.expectedContribution ? "ahead" : input.actualContribution < input.expectedContribution ? "behind" : "on_track";
  return { status, actualContribution: input.actualContribution, expectedContribution: input.expectedContribution, remainingGap: remaining, message: status === "behind" ? "The plan is behind the current target. Would you like to compare an adjustment or extend the deadline?" : `The plan is ${status === "ahead" ? "ahead" : "on track"} based on current activity.` };
}
