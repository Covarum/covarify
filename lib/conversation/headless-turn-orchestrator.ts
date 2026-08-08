// @deprecated Fixture harness compatibility only. Product surfaces call runCovarifyTurn.
import { runCovarifyTurn, type CovarifySession, type TurnInput } from "./covarify-orchestrator.ts";
import { createGoldenSession, type GoldenJourneyId } from "./golden-journeys.ts";
export type HeadlessSession = CovarifySession;
export type { TurnInput };
export const createHeadlessSession = (journeyId: GoldenJourneyId) => createGoldenSession(journeyId);
export const runHeadlessTurn = runCovarifyTurn;
