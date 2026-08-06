export type GuidanceMode = "guided" | "concise" | "expert";
export type RepairAnswer = "yes" | "no" | "unsure" | null;
export type UtilityTimingAnswer = "yes" | "no" | "unsure" | null;
export type JourneyStep = "repair_question" | "repair_review" | "utility_timing_question" | "utility_timing_review" | "complete";
export type JourneyCompletion = "blocked_by_critical_fact" | "preliminary_answer_reached" | "recommendation_ready" | "user_has_enough_for_now";
export type JourneyPresentation = { mode: GuidanceMode; step: JourneyStep; completedContext: string[]; currentTopic: string; currentQuestion: string | null; recordedFacts: string[]; synthesis: string | null; completion: JourneyCompletion; criticalMissingFacts: string[]; materialNonblockingFacts: string[]; informationalFacts: string[]; nextBestStep: string; stoppingPoint: boolean };
export type JourneyEditInterpretation = { type: "repair_amount_proposal"; amount: number } | { type: "repair_amount_clarification" } | { type: "unsupported" };
type OutcomeLine = { needId: string; title: string; allocated: number };

const modeCommands: Array<[RegExp, GuidanceMode]> = [
  [/\b(?:go faster|explain less|skip the walkthrough|keep this concise|just tell me what matters now)\b/i, "concise"],
  [/\b(?:show me everything|show the full picture|show all assumptions|compare everything|let me edit the assumptions|show me the math)\b/i, "expert"],
  [/\b(?:walk me through it|continue step by step|keep this simple)\b/i, "guided"],
];

export function guidanceModeFromStatement(statement: string, current: GuidanceMode): GuidanceMode { return modeCommands.find(([pattern]) => pattern.test(statement))?.[1] || current; }

export function interpretJourneyEdit(statement: string): JourneyEditInterpretation {
  const editVerb = /\b(?:change|set|update|edit|make)\b/i.test(statement);
  const repairReference = /\b(?:car|car repair|repair)\b/i.test(statement);
  if (!editVerb || !repairReference) return { type: "unsupported" };
  const amount = statement.match(/(?:\$\s*)?(\d[\d,]*(?:\.\d{1,2})?)/)?.[1];
  if (!amount) return { type: "repair_amount_clarification" };
  const normalized = Number(amount.replaceAll(",", ""));
  return Number.isFinite(normalized) && normalized >= 0 ? { type: "repair_amount_proposal", amount: normalized } : { type: "repair_amount_clarification" };
}

export function buildOutcomeCopy(input: { repairAnswer: RepairAnswer; utilityTimingAnswer: UtilityTimingAnswer; allocations: OutcomeLine[] }) {
  const rentReserve = input.allocations.find((line) => line.needId === "current-rent")?.allocated || 0;
  const repairAmount = input.allocations.find((line) => line.needId === "repair")?.allocated || 0;
  const utilityAmount = input.allocations.find((line) => line.needId === "utility")?.allocated || 0;
  const rationale = input.repairAnswer === "yes"
    ? `The repair comes first because you confirmed it is required to keep working. ${repairAmount ? `$${repairAmount} is allocated to it. ` : ""}The remaining priorities leave $${rentReserve} reserved for rent.`
    : input.repairAnswer === "no"
      ? `Because you confirmed the repair can wait, the current allocation protects the card minimum${utilityAmount ? " and utility payment" : ""}, then reserves $${rentReserve} for rent.`
      : `Whether the repair protects your ability to work is still unconfirmed. This remains preliminary, and $${rentReserve} is the current rent reserve until that consequence is verified.`;
  const utilityTiming = input.utilityTimingAnswer === "yes" ? "Confirmed: the utility is due before the next paycheck." : input.utilityTimingAnswer === "no" ? "Confirmed: the utility can wait until after the next paycheck." : "Unconfirmed: verify whether the utility is due before the next paycheck.";
  const unresolvedFacts = [input.repairAnswer === "unsure" ? "Whether the repair is required to keep working." : null, input.utilityTimingAnswer === "unsure" ? "Whether the utility is due before the next paycheck." : null, "The effect of a partial rent payment."].filter((item): item is string => Boolean(item));
  return { rationale, utilityTiming, unresolvedFacts, preliminary: input.repairAnswer === "unsure" || input.utilityTimingAnswer === "unsure" };
}

export function buildJourneyPresentation(input: { mode: GuidanceMode; repairAnswer: RepairAnswer; utilityTimingAnswer?: UtilityTimingAnswer; repairAmount?: number; step?: JourneyStep; stopped?: boolean }): JourneyPresentation {
  const utilityTimingAnswer = input.utilityTimingAnswer ?? null;
  const step: JourneyStep = input.stopped ? "complete" : input.step || (input.repairAnswer == null ? "repair_question" : "repair_review");
  const completedContext = ["Two OLU’KAI payments reviewed with retained evidence", "Rent payment kept separate from the outstanding obligation", "Expected invoice remains unavailable until received"];
  if (step === "utility_timing_question" || step === "utility_timing_review" || step === "complete") completedContext.push(input.repairAnswer === "yes" ? "Repair confirmed as required for work" : input.repairAnswer === "no" ? "Repair confirmed as able to wait" : "Repair consequence remains unconfirmed");
  if (step === "utility_timing_review" || step === "complete") completedContext.push(utilityTimingAnswer === "yes" ? "Utility confirmed due before the next paycheck" : utilityTimingAnswer === "no" ? "Utility confirmed able to wait until after the next paycheck" : "Utility timing remains unconfirmed");
  const repairAmount = input.repairAmount ?? 500;
  const currentQuestion = step === "repair_question" ? `Is the $${repairAmount} car repair required for you to keep working?` : step === "utility_timing_question" ? "Is the $180 utility payment due before your next paycheck?" : null;
  const synthesis = step === "repair_review" ? (input.repairAnswer === "yes" ? "That makes the repair the first priority because it protects your ability to work." : input.repairAnswer === "no" ? "Because the repair can wait, the available cash can be compared against the other immediate needs." : "The repair consequence is still unconfirmed, so the recommendation remains preliminary.") : step === "utility_timing_review" ? (utilityTimingAnswer === "yes" ? "Because the utility is due first, the existing allocation now protects its full $180 before reserving the remainder for rent." : utilityTimingAnswer === "no" ? "Because the utility can wait, the current recommendation keeps the remaining cash reserved for rent." : "Utility timing is still unconfirmed, so the recommendation remains preliminary and the bill should be verified.") : null;
  const criticalMissingFacts = step === "repair_question" ? [`Whether the $${repairAmount} repair is required to keep working`] : step === "utility_timing_question" ? ["Whether the $180 utility is due before the next paycheck"] : [];
  const recordedFacts = completedContext.slice(3);
  const completion: JourneyCompletion = step === "complete" ? "user_has_enough_for_now" : currentQuestion ? "blocked_by_critical_fact" : input.repairAnswer === "unsure" || utilityTimingAnswer === "unsure" ? "preliminary_answer_reached" : "recommendation_ready";
  const nextBestStep = step === "repair_question" ? "Answer the repair question." : step === "repair_review" ? (input.repairAnswer === "unsure" ? "Verify whether delaying the repair would affect your ability to work." : "Check whether the utility is due before the next paycheck.") : step === "utility_timing_question" ? "Answer the utility timing question." : "Finish for now or adjust the recommendation.";
  return { mode: input.mode, step, completedContext, currentTopic: step.startsWith("utility") ? "Confirm utility timing" : "Decide what the available money should do first", currentQuestion, recordedFacts, synthesis, completion, criticalMissingFacts, materialNonblockingFacts: ["Partial-payment usefulness"], informationalFacts: ["Detailed spending baseline", "Full evidence trace"], nextBestStep, stoppingPoint: step === "utility_timing_review" || step === "complete" };
}
