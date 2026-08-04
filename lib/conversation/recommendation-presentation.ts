import type { RecoveryOption, TargetMode } from "./financial-triage.ts";

export type OptionId = RecoveryOption["name"];
export type RecommendationPresentation = { recommendedId: OptionId; highlightedId: OptionId; rationaleId: OptionId; primaryCtaId: OptionId; previewedId: OptionId | null; proposedId: OptionId | null; confirmedId: OptionId | null };

export function buildRecommendationPresentation(input: { optionIds: OptionId[]; recommendedId: OptionId; previewedId?: OptionId | null; proposedId?: OptionId | null; confirmedId?: OptionId | null }): RecommendationPresentation | null {
  const available = new Set(input.optionIds); const references = [input.recommendedId, input.previewedId, input.proposedId, input.confirmedId].filter((value): value is OptionId => Boolean(value));
  if (!references.every((value) => available.has(value))) return null;
  if (input.proposedId && input.proposedId !== input.recommendedId) return null;
  if (input.confirmedId && input.confirmedId !== input.proposedId) return null;
  return { recommendedId: input.recommendedId, highlightedId: input.recommendedId, rationaleId: input.recommendedId, primaryCtaId: input.recommendedId, previewedId: input.previewedId || null, proposedId: input.proposedId || null, confirmedId: input.confirmedId || null };
}

export const targetModeLabel = (mode: TargetMode): string => ({ fixed_date: "I have a date", suggested_date: "Show me realistic timelines", flexible_timeline: "Keep my timeline flexible", monthly_contribution_target: "Steady monthly progress", as_soon_as_practical: "As soon as practical" })[mode];

export function estimatedTimelineCopy(durationMonths: number, monthlyContribution: number, projectedCompletionDate: string) {
  const month = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${projectedCompletionDate}T12:00:00Z`));
  return { duration: `About ${durationMonths} month${durationMonths === 1 ? "" : "s"}`, catchUp: `Estimated catch-up: around ${month}`, pace: `Based on approximately $${Math.round(monthlyContribution).toLocaleString("en-US")} per month beginning next month.` };
}
