import "server-only";
import type { PlaidAuthProvider } from "./auth";
import { authenticateRequest } from "../../supabase/request-auth";
export const supabasePlaidAuthProvider: PlaidAuthProvider = {
  async getAuthenticatedProfile(request) {
    const authentication = await authenticateRequest(request);
    if (!authentication.authenticated) return null;
    return { userId: authentication.user.id, profileId: authentication.user.id, roles: [] };
  },
};
