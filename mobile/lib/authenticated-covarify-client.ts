import { covarifyApiFetch } from "./api";
import { assertClientSafeInput, CovarifyTransportError, type CovarifyClient, type CovarifyTransportErrorCode } from "./covarify-client";
import { COVARIFY_TURN_CONTRACT_VERSION, parseTurnTransportResponse } from "./turn-contract";

const serverError = (value: string): CovarifyTransportErrorCode => ["UNAUTHORIZED", "FORBIDDEN", "CONTRACT_MISMATCH", "STALE_ACTION", "SESSION_EXPIRED"].includes(value) ? value as CovarifyTransportErrorCode : "SERVER_ERROR";

export function createAuthenticatedCovarifyClient(options: { timeoutMs?: number } = {}): CovarifyClient {
  let sessionToken: string | undefined;
  return {
    mode: "authenticated_development",
    async sendTurn(rawInput) {
      const input = assertClientSafeInput(rawInput); const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15_000);
      try {
        const response = await covarifyApiFetch("/api/development/covarify-turn", { method: "POST", signal: controller.signal, body: JSON.stringify({ supportedContractVersion: COVARIFY_TURN_CONTRACT_VERSION, input, ...(sessionToken ? { sessionToken } : {}) }) });
        const value: unknown = await response.json().catch(() => null);
        if (value && typeof value === "object" && "contractVersion" in value && value.contractVersion !== COVARIFY_TURN_CONTRACT_VERSION) throw new CovarifyTransportError("CONTRACT_MISMATCH");
        const parsed = parseTurnTransportResponse(value);
        if (!parsed) throw new CovarifyTransportError("INVALID_RESPONSE");
        if (!parsed.ok) throw new CovarifyTransportError(serverError(parsed.error));
        sessionToken = parsed.sessionToken;
        return parsed.turn;
      } catch (error) {
        if (error instanceof CovarifyTransportError) throw error;
        if (error instanceof Error && error.name === "AbortError") throw new CovarifyTransportError("TIMEOUT");
        throw new CovarifyTransportError("OFFLINE");
      } finally { clearTimeout(timeout); }
    },
  };
}
