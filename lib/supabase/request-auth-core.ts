import type { User } from "@supabase/supabase-js";

export type RequestAuthenticationError =
  | "AUTHENTICATION_REQUIRED"
  | "MALFORMED_AUTHORIZATION"
  | "UNSUPPORTED_AUTHORIZATION_SCHEME"
  | "INVALID_BEARER_TOKEN";

export type AuthenticatedCovarifyUser = {
  id: string;
  supabaseUser: User;
};

export type RequestAuthenticationResult =
  | { authenticated: true; method: "bearer" | "cookie"; user: AuthenticatedCovarifyUser }
  | { authenticated: false; error: RequestAuthenticationError };

export type SupabaseRequestAuthClient = {
  auth: {
    getUser(token?: string): Promise<{
      data: { user: User | null };
      error: unknown;
    }>;
  };
};

function parseBearerCredential(value: string):
  | { token: string }
  | { error: "MALFORMED_AUTHORIZATION" | "UNSUPPORTED_AUTHORIZATION_SCHEME" } {
  const separator = value.search(/\s/);
  const scheme = separator === -1 ? value : value.slice(0, separator);

  if (scheme.toLowerCase() !== "bearer") {
    return { error: "UNSUPPORTED_AUTHORIZATION_SCHEME" };
  }

  const token = separator === -1 ? "" : value.slice(separator).trim();
  if (!token || /\s/.test(token)) {
    return { error: "MALFORMED_AUTHORIZATION" };
  }

  return { token };
}

/**
 * An explicitly supplied Authorization credential always takes precedence. A
 * malformed or invalid bearer credential fails closed and never falls back to
 * a valid cookie session.
 */
export async function authenticateRequestWithClient(
  request: Request,
  client: SupabaseRequestAuthClient,
): Promise<RequestAuthenticationResult> {
  const authorization = request.headers.get("authorization");

  if (authorization !== null) {
    const credential = parseBearerCredential(authorization);
    if ("error" in credential) {
      return { authenticated: false, error: credential.error };
    }

    const { data, error } = await client.auth.getUser(credential.token);
    if (error || !data.user) {
      return { authenticated: false, error: "INVALID_BEARER_TOKEN" };
    }

    return {
      authenticated: true,
      method: "bearer",
      user: { id: data.user.id, supabaseUser: data.user },
    };
  }

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) {
    return { authenticated: false, error: "AUTHENTICATION_REQUIRED" };
  }

  return {
    authenticated: true,
    method: "cookie",
    user: { id: data.user.id, supabaseUser: data.user },
  };
}
