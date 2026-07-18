if (typeof window !== "undefined") throw new Error("Plaid production modules are server-only.");

export type AuthenticatedProfile = { userId: string; profileId: string; roles: readonly string[] };
export type PlaidAuthProvider = { getAuthenticatedProfile(request: Request): Promise<AuthenticatedProfile | null> };

/** Fail-closed until an approved authentication vendor adapter is installed. */
export const unconfiguredPlaidAuthProvider: PlaidAuthProvider = {
  async getAuthenticatedProfile() { return null; },
};
