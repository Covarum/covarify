if (typeof window !== "undefined") throw new Error("Plaid production modules are server-only.");
import { createHash, randomBytes } from "node:crypto";

export type LinkAttempt = { id: string; userId: string; stateHash: string; expiresAt: string; consumedAt: string | null };
export interface LinkAttemptStore {
  create(input: { userId: string; stateHash: string; consentVersion: string; expiresAt: string }): Promise<void>;
  consume(input: { userId: string; stateHash: string; consumedAt: string }): Promise<LinkAttempt | null>;
}
const hash = (state: string) => createHash("sha256").update(state).digest("hex");

export async function createLinkAttempt(store: LinkAttemptStore, userId: string, consentVersion: string, now = new Date()) {
  const state = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();
  await store.create({ userId, stateHash: hash(state), consentVersion, expiresAt });
  return { state, expiresAt };
}

export async function consumeLinkAttempt(store: LinkAttemptStore, userId: string, state: string, now = new Date()) {
  if (!userId || !state) throw new Error("A signed-in connection attempt is required.");
  const attempt = await store.consume({ userId, stateHash: hash(state), consumedAt: now.toISOString() });
  if (!attempt || attempt.userId !== userId || attempt.consumedAt || Date.parse(attempt.expiresAt) <= now.getTime()) {
    throw new Error("The connection attempt is invalid, expired, or already used.");
  }
  return attempt;
}
