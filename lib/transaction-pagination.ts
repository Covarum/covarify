import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

type CursorValue = { date: string; id: string };
const secret = () => { const value = process.env.CRON_SECRET; if (!value) throw new Error("TRANSACTION_CURSOR_CONFIGURATION_MISSING"); return value; };
export function encodeTransactionCursor(value: CursorValue) { const body = Buffer.from(JSON.stringify(value)).toString("base64url"); const signature = createHmac("sha256", secret()).update(body).digest("base64url"); return `${body}.${signature}`; }
export function decodeTransactionCursor(cursor: string): CursorValue { const [body, signature] = cursor.split("."); if (!body || !signature) throw new Error("INVALID_TRANSACTION_CURSOR"); const expected = createHmac("sha256", secret()).update(body).digest(); const actual = Buffer.from(signature, "base64url"); if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error("INVALID_TRANSACTION_CURSOR"); const value = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); if (!value?.date || !value?.id) throw new Error("INVALID_TRANSACTION_CURSOR"); return value; }
