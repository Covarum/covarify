import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { ConversationContext } from "./types.ts";
import type { SemanticAction } from "./turn-contract.ts";

const TOKEN_VERSION = 1;
const TOKEN_TTL_MS = 15 * 60 * 1000;

export type DevelopmentTurnSession = {
  version: 1;
  userId: string;
  sessionId: string;
  sequence: number;
  issuedAt: string;
  expiresAt: string;
  context: ConversationContext | null;
  allowedActions: Array<{ id: string; payloadHash: string }>;
};

const keyFor = (secret: string) => createHash("sha256").update("covarify-development-turn-token:v1\0").update(secret).digest();
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(",")}}`;
  return JSON.stringify(value);
};
export const actionPayloadHash = (payload: unknown) => createHash("sha256").update(stable(payload)).digest("base64url");

export function issueDevelopmentTurnToken(input: { secret: string; userId: string; sessionId: string; sequence: number; context: ConversationContext | null; actions: SemanticAction[]; now?: Date }) {
  if (!input.secret) throw new Error("DEVELOPMENT_TURN_TOKEN_SECRET_REQUIRED");
  const now = input.now || new Date();
  const payload: DevelopmentTurnSession = { version: TOKEN_VERSION, userId: input.userId, sessionId: input.sessionId, sequence: input.sequence, issuedAt: now.toISOString(), expiresAt: new Date(now.getTime() + TOKEN_TTL_MS).toISOString(), context: input.context, allowedActions: input.actions.map((action) => ({ id: action.id, payloadHash: actionPayloadHash(action.payload) })) };
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", keyFor(input.secret), iv); const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]); const tag = cipher.getAuthTag();
  return `${TOKEN_VERSION}.${iv.toString("base64url")}.${encrypted.toString("base64url")}.${tag.toString("base64url")}`;
}

export function readDevelopmentTurnToken(input: { secret: string; token: string; userId: string; now?: Date }): { ok: true; session: DevelopmentTurnSession } | { ok: false; error: "STALE_ACTION" | "SESSION_EXPIRED" } {
  try {
    const [version, ivValue, encryptedValue, tagValue, extra] = input.token.split(".");
    if (version !== String(TOKEN_VERSION) || !ivValue || !encryptedValue || !tagValue || extra) return { ok: false, error: "STALE_ACTION" };
    const decipher = createDecipheriv("aes-256-gcm", keyFor(input.secret), Buffer.from(ivValue, "base64url")); decipher.setAuthTag(Buffer.from(tagValue, "base64url")); const decoded = Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8"); const session = JSON.parse(decoded) as DevelopmentTurnSession;
    const expected = Buffer.from(input.userId); const actual = Buffer.from(session.userId || "");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual) || session.version !== TOKEN_VERSION) return { ok: false, error: "STALE_ACTION" };
    if (Date.parse(session.expiresAt) <= (input.now || new Date()).getTime()) return { ok: false, error: "SESSION_EXPIRED" };
    return { ok: true, session };
  } catch { return { ok: false, error: "STALE_ACTION" }; }
}

export function actionAllowed(session: DevelopmentTurnSession, action: { id: string; payload: unknown }) {
  const hash = actionPayloadHash(action.payload);
  return session.allowedActions.some((allowed) => allowed.id === action.id && allowed.payloadHash === hash);
}
