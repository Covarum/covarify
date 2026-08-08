import type { CovarifyTurn, TurnInput } from "./turn-contract.ts";

export interface CovarifyClient {
  readonly mode: "fixture" | "production";
  sendTurn(input: TurnInput): Promise<CovarifyTurn>;
}

export function assertClientSafeInput(input: TurnInput): TurnInput {
  const unsafe = input as TurnInput & { balance?: unknown; financialTruth?: unknown; userId?: unknown; accountId?: unknown };
  if (unsafe.balance !== undefined || unsafe.financialTruth !== undefined || unsafe.userId !== undefined || unsafe.accountId !== undefined) {
    throw new Error("CLIENT_FINANCIAL_TRUTH_NOT_ALLOWED");
  }
  return input;
}
