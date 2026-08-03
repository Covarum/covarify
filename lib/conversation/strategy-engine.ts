import { confirmedGoal, type FinancialGoal } from "./goals.ts";
import type { CandidateLever, PlanConstraint, RecoveryOption } from "./financial-triage.ts";
import type { WholePictureSituation } from "./whole-picture.ts";

export type RecommendedStrategy = { goalId: string; recommended: RecoveryOption; alternatives: RecoveryOption[]; whyHighest: string[]; protected: string[]; tradeoffs: string[]; assumptions: string[]; confidence: "high" | "medium" | "low"; changesIf: string[]; progressMeasure: string; genericAdviceRejected: true };

const constraintKeys = (constraints: PlanConstraint[]) => new Set(constraints.filter((item) => item.kind === "protect" || item.kind === "exclude").map((item) => item.key.toLowerCase()));
export function applyStrategyConstraints(levers: CandidateLever[], constraints: PlanConstraint[]) { const blocked = constraintKeys(constraints); return levers.filter((lever) => !blocked.has(lever.id.replace(/^lever:/, "").toLowerCase()) && !blocked.has(lever.label.toLowerCase())); }

export function recommendPersonalizedStrategy(input: { goal: FinancialGoal; situation: WholePictureSituation; options: RecoveryOption[]; constraints: PlanConstraint[] }): RecommendedStrategy {
  if (!confirmedGoal(input.goal)) throw new Error("CONFIRMED_GOAL_REQUIRED");
  if (!input.options.length) throw new Error("EVIDENCE_BACKED_OPTIONS_REQUIRED");
  if (!input.situation.evidenceIds.length) throw new Error("WHOLE_PICTURE_EVIDENCE_REQUIRED");
  const protectedLabels = input.constraints.filter((item) => item.kind === "protect" || item.kind === "exclude").map((item) => item.value);
  const ranked = [...input.options].sort((a, b) => {
    const aFit = a.expectedContribution - a.levers.length * (input.goal.type === "housing_catch_up" ? 5 : 15);
    const bFit = b.expectedContribution - b.levers.length * (input.goal.type === "housing_catch_up" ? 5 : 15);
    return bFit - aFit;
  });
  const recommended = ranked[0];
  return { goalId: input.goal.id, recommended, alternatives: ranked.slice(1), whyHighest: [`It contributes ${recommended.expectedContribution.toFixed(0)} toward ${input.goal.label}.`, `It uses ${recommended.levers.length} evidence-backed ${recommended.levers.length === 1 ? "lever" : "levers"} while preserving confirmed constraints.`, ...(ranked[1] ? [`The next option contributes ${ranked[1].expectedContribution.toFixed(0)} with different disruption or timing.`] : [])], protected: protectedLabels, tradeoffs: recommended.tradeoffs, assumptions: recommended.assumptions, confidence: input.situation.confidence === "low" || recommended.confidence === "low" ? "low" : recommended.confidence, changesIf: ["account data becomes stale", "income or obligations change", "the goal or a protected priority changes"], progressMeasure: `Actual contributions toward ${input.goal.label} compared with the confirmed milestones.`, genericAdviceRejected: true };
}
