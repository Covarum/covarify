export type GuidanceMode = "guided" | "concise" | "expert";
export type RepairAnswer = "yes" | "no" | "unsure" | null;
export type UtilityTimingAnswer = "yes" | "no" | "unsure" | null;
export type JourneyStep = "repair_question" | "repair_review" | "utility_timing_question" | "utility_timing_review" | "complete";
export type JourneyCompletion = "blocked_by_critical_fact" | "preliminary_answer_reached" | "recommendation_ready" | "user_has_enough_for_now";
export type JourneyPresentation = { mode: GuidanceMode; step: JourneyStep; completedContext: string[]; currentTopic: string; currentQuestion: string | null; recordedFacts: string[]; synthesis: string | null; completion: JourneyCompletion; criticalMissingFacts: string[]; materialNonblockingFacts: string[]; informationalFacts: string[]; nextBestStep: string; stoppingPoint: boolean };

const modeCommands: Array<[RegExp, GuidanceMode]> = [
  [/\b(?:go faster|explain less|skip the walkthrough|keep this concise|just tell me what matters now)\b/i, "concise"],
  [/\b(?:show me everything|show the full picture|show all assumptions|compare everything|let me edit the assumptions|show me the math)\b/i, "expert"],
  [/\b(?:walk me through it|continue step by step|keep this simple)\b/i, "guided"],
];

export function guidanceModeFromStatement(statement: string, current: GuidanceMode): GuidanceMode { return modeCommands.find(([pattern]) => pattern.test(statement))?.[1] || current; }

export function buildJourneyPresentation(input: { mode: GuidanceMode; repairAnswer: RepairAnswer; utilityTimingAnswer?: UtilityTimingAnswer; step?: JourneyStep; stopped?: boolean }): JourneyPresentation {
  const utilityTimingAnswer = input.utilityTimingAnswer ?? null;
  const step: JourneyStep = input.stopped ? "complete" : input.step || (input.repairAnswer == null ? "repair_question" : "repair_review");
  const completedContext = ["Two OLU’KAI payments reviewed with retained evidence", "Rent payment kept separate from the outstanding obligation", "Expected invoice remains unavailable until received"];
  if (step === "utility_timing_question" || step === "utility_timing_review" || step === "complete") completedContext.push(input.repairAnswer === "yes" ? "Repair confirmed as required for work" : input.repairAnswer === "no" ? "Repair confirmed as able to wait" : "Repair consequence remains unconfirmed");
  if (step === "utility_timing_review" || step === "complete") completedContext.push(utilityTimingAnswer === "yes" ? "Utility confirmed due before the next paycheck" : utilityTimingAnswer === "no" ? "Utility confirmed able to wait until after the next paycheck" : "Utility timing remains unconfirmed");
  const currentQuestion = step === "repair_question" ? "Is the $500 car repair required for you to keep working?" : step === "utility_timing_question" ? "Is the $180 utility payment due before your next paycheck?" : null;
  const synthesis = step === "repair_review" ? (input.repairAnswer === "yes" ? "That makes the repair the first priority because it protects your ability to work." : input.repairAnswer === "no" ? "Because the repair can wait, the available cash can be compared against the other immediate needs." : "The repair consequence is still unconfirmed, so the recommendation remains preliminary.") : step === "utility_timing_review" ? (utilityTimingAnswer === "yes" ? "Because the utility is due first, the existing allocation now protects its full $180 before reserving the remainder for rent." : utilityTimingAnswer === "no" ? "Because the utility can wait, the current recommendation keeps the remaining cash reserved for rent." : "Utility timing is still unconfirmed, so the recommendation remains preliminary and the bill should be verified.") : null;
  const criticalMissingFacts = step === "repair_question" ? ["Whether the $500 repair is required to keep working"] : step === "utility_timing_question" ? ["Whether the $180 utility is due before the next paycheck"] : [];
  const recordedFacts = completedContext.slice(3);
  const completion: JourneyCompletion = step === "complete" ? "user_has_enough_for_now" : currentQuestion ? "blocked_by_critical_fact" : input.repairAnswer === "unsure" || utilityTimingAnswer === "unsure" ? "preliminary_answer_reached" : "recommendation_ready";
  const nextBestStep = step === "repair_question" ? "Answer the repair question." : step === "repair_review" ? (input.repairAnswer === "unsure" ? "Verify whether delaying the repair would affect your ability to work." : "Check whether the utility is due before the next paycheck.") : step === "utility_timing_question" ? "Answer the utility timing question." : "Finish for now or adjust the recommendation.";
  return { mode: input.mode, step, completedContext, currentTopic: step.startsWith("utility") ? "Confirm utility timing" : "Decide what the available money should do first", currentQuestion, recordedFacts, synthesis, completion, criticalMissingFacts, materialNonblockingFacts: ["Partial-payment usefulness"], informationalFacts: ["Detailed spending baseline", "Full evidence trace"], nextBestStep, stoppingPoint: step === "utility_timing_review" || step === "complete" };
}
