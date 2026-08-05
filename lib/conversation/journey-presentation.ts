export type GuidanceMode = "guided" | "concise" | "expert";
export type RepairAnswer = "yes" | "no" | "unsure" | null;
export type JourneyCompletion = "blocked_by_critical_fact" | "preliminary_answer_reached" | "recommendation_ready" | "user_has_enough_for_now";
export type JourneyPresentation = { mode: GuidanceMode; completedContext: string[]; currentTopic: string; currentQuestion: string | null; recordedFacts: string[]; synthesis: string | null; completion: JourneyCompletion; criticalMissingFacts: string[]; materialNonblockingFacts: string[]; informationalFacts: string[]; nextBestStep: string; stoppingPoint: boolean };

const modeCommands: Array<[RegExp, GuidanceMode]> = [
  [/\b(?:go faster|explain less|skip the walkthrough|keep this concise|just tell me what matters now)\b/i, "concise"],
  [/\b(?:show me everything|show the full picture|show all assumptions|compare everything|let me edit the assumptions|show me the math)\b/i, "expert"],
  [/\b(?:walk me through it|continue step by step|keep this simple)\b/i, "guided"],
];

export function guidanceModeFromStatement(statement: string, current: GuidanceMode): GuidanceMode { return modeCommands.find(([pattern]) => pattern.test(statement))?.[1] || current; }

export function buildJourneyPresentation(input: { mode: GuidanceMode; repairAnswer: RepairAnswer; stopped?: boolean }): JourneyPresentation {
  const completedContext = ["Two OLU’KAI payments reviewed with retained evidence", "Rent payment kept separate from the outstanding obligation", "Expected invoice remains unavailable until received"];
  const criticalMissingFacts = input.repairAnswer == null ? ["Whether the $500 repair is required to keep working"] : [];
  const recordedFacts = input.repairAnswer === "yes" ? ["Repair confirmed as required for work", "Card minimum protected", "Approximately $325 reserved for current rent"] : input.repairAnswer === "no" ? ["Repair confirmed as able to wait", "Card minimum protected"] : input.repairAnswer === "unsure" ? ["Repair consequence remains unconfirmed", "Card minimum protected"] : [];
  const synthesis = input.repairAnswer === "yes" ? "That makes the repair the first priority because it protects your ability to work." : input.repairAnswer === "no" ? "Because the repair can wait, the available cash can be compared against the other immediate needs." : input.repairAnswer === "unsure" ? "The repair consequence is still unconfirmed, so the recommendation remains preliminary." : null;
  const completion: JourneyCompletion = input.stopped ? "user_has_enough_for_now" : input.repairAnswer == null ? "blocked_by_critical_fact" : input.repairAnswer === "unsure" ? "preliminary_answer_reached" : "recommendation_ready";
  return { mode: input.mode, completedContext, currentTopic: "Decide what the available money should do first", currentQuestion: criticalMissingFacts.length ? "Is the $500 car repair required for you to keep working?" : null, recordedFacts, synthesis, completion, criticalMissingFacts, materialNonblockingFacts: ["Utility due date", "Partial-payment usefulness"], informationalFacts: ["Detailed spending baseline", "Full evidence trace"], nextBestStep: input.repairAnswer === "unsure" ? "Verify whether delaying the repair would affect your ability to keep working." : input.repairAnswer == null ? "Confirm whether the repair is required for work." : "Review the recommendation and stop when you have enough for now.", stoppingPoint: input.repairAnswer === "yes" || input.repairAnswer === "no" };
}
