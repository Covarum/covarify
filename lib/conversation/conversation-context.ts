import type { ConversationContext, ConversationScope } from "./types.ts";

export const CONTEXT_TTL_MS = 30 * 60 * 1000;
export function validConversationContext(context: ConversationContext | null | undefined, userId: string, sessionId: string, now = new Date()) {
  return context?.version === 1 && context.userId === userId && context.sessionId === sessionId && Date.parse(context.expiresAt) > now.getTime() ? context : null;
}
export function createConversationContext(input: { userId: string; sessionId: string; merchant: string | null; scope: ConversationScope; transactionIds: string[]; count: number; total: number; accounts: Array<{ label: string; count: number }>; now: Date }): ConversationContext {
  return { version: 1, userId: input.userId, sessionId: input.sessionId, expiresAt: new Date(input.now.getTime() + CONTEXT_TTL_MS).toISOString(), merchant: input.merchant, scope: input.scope, transactionIds: input.transactionIds, count: input.count, total: input.total, accounts: input.accounts, evidenceTimestamp: input.now.toISOString() };
}
