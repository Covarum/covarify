import "server-only";
import type { PlaidAuthProvider } from "./auth";
import { createSupabaseServerClient } from "../../supabase/server";
export const supabasePlaidAuthProvider: PlaidAuthProvider = {
  async getAuthenticatedProfile() {
    const { data, error } = await (await createSupabaseServerClient()).auth.getUser();
    if (error || !data.user) return null;
    return { userId: data.user.id, profileId: data.user.id, roles: [] };
  },
};
