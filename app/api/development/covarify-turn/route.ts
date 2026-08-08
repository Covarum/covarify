import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAuthorizedFounderUser } from "@/lib/founder-review-auth";
import { loadAuthorizedTransactions } from "@/lib/conversation/authorized-transactions-server";
import { actionAllowed, issueDevelopmentTurnToken, readDevelopmentTurnToken } from "@/lib/conversation/development-turn-token";
import { canonicalTruthFromTransactions } from "@/lib/conversation/financial-truth";
import { createAuthorizedCovarifySession, runCovarifyTurn } from "@/lib/conversation/covarify-orchestrator";
import { COVARIFY_TURN_CONTRACT_VERSION, isCovarifyTurn, isTransportTurnInput, type TurnTransportErrorCode } from "@/lib/conversation/transport-schema";
import { authenticateRequestWithClient } from "@/lib/supabase/request-auth-core";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const failure = (error: TurnTransportErrorCode, status: number) => NextResponse.json({ ok: false, contractVersion: COVARIFY_TURN_CONTRACT_VERSION, error }, { status });
const hasClientAuthority = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasClientAuthority);
  const forbidden = new Set(["userId", "householdId", "accountId", "balance", "financialTruth", "canonicalTruth", "transactions"]);
  return Object.entries(value).some(([key, nested]) => forbidden.has(key) || hasClientAuthority(nested));
};

export async function POST(request: Request) {
  if (process.env.VERCEL_ENV === "production") return failure("FORBIDDEN", 403);
  const auth = await authenticateRequestWithClient(request, await createSupabaseServerClient());
  if (!auth.authenticated) return failure("UNAUTHORIZED", 401);
  const founder = await getAuthorizedFounderUser(auth.user.supabaseUser);
  if (!founder) return failure("FORBIDDEN", 403);

  let body: unknown;
  try { body = await request.json(); } catch { return failure("INVALID_REQUEST", 400); }
  if (!body || typeof body !== "object" || hasClientAuthority(body)) return failure("INVALID_REQUEST", 400);
  const candidate = body as { supportedContractVersion?: unknown; input?: unknown; sessionToken?: unknown };
  if (candidate.supportedContractVersion !== COVARIFY_TURN_CONTRACT_VERSION) return failure("CONTRACT_MISMATCH", 409);
  if (!isTransportTurnInput(candidate.input) || (candidate.sessionToken !== undefined && typeof candidate.sessionToken !== "string")) return failure("INVALID_REQUEST", 400);

  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return failure("SERVER_ERROR", 500);
  const restored = candidate.sessionToken ? readDevelopmentTurnToken({ secret, token: candidate.sessionToken, userId: founder.id }) : null;
  if (restored && !restored.ok) return failure(restored.error, restored.error === "SESSION_EXPIRED" ? 401 : 409);
  if (candidate.input.action && (!restored?.ok || !actionAllowed(restored.session, candidate.input.action))) return failure("STALE_ACTION", 409);

  try {
    const transactions = await loadAuthorizedTransactions(founder.id);
    const truth = canonicalTruthFromTransactions({ userId: founder.id, transactions, asOf: new Date().toISOString(), sourceMode: "authenticated_preview" });
    const sessionId = restored?.ok ? restored.session.sessionId : randomUUID();
    const session = createAuthorizedCovarifySession({ sessionId, truth, authenticatedUserId: founder.id });
    if (restored?.ok) { session.sequence = restored.session.sequence; session.transactionContext = restored.session.context; }
    const turn = runCovarifyTurn(session, candidate.input.modality === "guided_action" ? candidate.input : { ...candidate.input, transaction: { context: session.transactionContext, dataMode: "connected" } });
    if (!isCovarifyTurn(turn) || turn.memory.disposition === "confirmed_memory" || turn.financialImpact.acceptedSessionChanges.length) return failure("INVALID_REQUEST", 400);
    const sessionToken = issueDevelopmentTurnToken({ secret, userId: founder.id, sessionId, sequence: session.sequence, context: session.transactionContext, actions: turn.actions });
    return NextResponse.json({ ok: true, contractVersion: COVARIFY_TURN_CONTRACT_VERSION, turn, sessionToken });
  } catch { return failure("SERVER_ERROR", 500); }
}
