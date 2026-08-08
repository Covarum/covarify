import type { CovarifyTurn, TurnInput } from "./turn-contract.ts";

export interface CovarifyClient {
  readonly mode: "fixture" | "authenticated_development";
  sendTurn(input: TurnInput): Promise<CovarifyTurn>;
}

export type CovarifyTransportErrorCode = "OFFLINE" | "TIMEOUT" | "UNAUTHORIZED" | "FORBIDDEN" | "CONTRACT_MISMATCH" | "INVALID_RESPONSE" | "SERVER_ERROR" | "STALE_ACTION" | "SESSION_EXPIRED";
export class CovarifyTransportError extends Error {
  readonly code: CovarifyTransportErrorCode;
  constructor(code: CovarifyTransportErrorCode) { super(code); this.code = code; this.name = "CovarifyTransportError"; }
}

export function assertClientSafeInput(input: TurnInput): TurnInput {
  const unsafe = input as TurnInput & { balance?: unknown; financialTruth?: unknown; userId?: unknown; accountId?: unknown };
  if (unsafe.balance !== undefined || unsafe.financialTruth !== undefined || unsafe.userId !== undefined || unsafe.accountId !== undefined) {
    throw new Error("CLIENT_FINANCIAL_TRUTH_NOT_ALLOWED");
  }
  return input;
}
