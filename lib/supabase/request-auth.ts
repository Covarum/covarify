import "server-only";
import { createSupabaseServerClient } from "./server";
import {
  authenticateRequestWithClient,
  type RequestAuthenticationResult,
} from "./request-auth-core";

export type {
  AuthenticatedCovarifyUser,
  RequestAuthenticationError,
  RequestAuthenticationResult,
} from "./request-auth-core";

/**
 * Authenticates browser requests with the existing Supabase cookie session and
 * mobile requests with a Supabase access token verified by auth.getUser(token).
 */
export async function authenticateRequest(request: Request): Promise<RequestAuthenticationResult> {
  return authenticateRequestWithClient(request, await createSupabaseServerClient());
}
