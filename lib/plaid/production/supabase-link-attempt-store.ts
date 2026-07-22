import "server-only";
import { createSupabaseAdminClient } from "../../supabase/admin";
import type { LinkAttempt, LinkAttemptStore } from "./link-state";

type LinkAttemptRow = {
  id: string;
  user_id: string;
  state_hash: string;
  expires_at: string;
};

export function createSupabaseLinkAttemptStore(): LinkAttemptStore {
  const db = createSupabaseAdminClient();
  return {
    async create(input) {
      const { error } = await db.from("plaid_link_attempts").insert({
        user_id: input.userId,
        state_hash: input.stateHash,
        consent_version: input.consentVersion,
        expires_at: input.expiresAt,
      });
      if (error) throw new Error("Plaid Link attempt could not be persisted.");
    },
    async consume(input) {
      const { data, error } = await db.from("plaid_link_attempts")
        .update({ status: "consumed", consumed_at: input.consumedAt })
        .eq("user_id", input.userId)
        .eq("state_hash", input.stateHash)
        .eq("status", "created")
        .is("consumed_at", null)
        .gt("expires_at", input.consumedAt)
        .select("id,user_id,state_hash,expires_at")
        .maybeSingle();
      if (error) throw new Error("Plaid Link attempt could not be consumed.");
      if (!data) return null;
      const row = data as LinkAttemptRow;
      return { id: row.id, userId: row.user_id, stateHash: row.state_hash, expiresAt: row.expires_at, consumedAt: null } satisfies LinkAttempt;
    },
  };
}

