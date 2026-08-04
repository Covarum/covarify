import type { MoneyTransaction } from "../money-picture.ts";
import type { ConversationContext } from "./types.ts";

export type ReferenceResolution = { kind: "all" | "subset" | "missing" | "ambiguous"; transactionIds: string[]; reason: string };

export function resolveTransactionReference(text: string, context: ConversationContext | null, transactions: MoneyTransaction[]): ReferenceResolution {
  const ids = context?.transactionIds || [];
  if (!ids.length) return { kind: "missing", transactionIds: [], reason: "No active transaction evidence is available." };
  if (/\b(?:the first one|first payment|first purchase|first charge)\b/i.test(text)) return { kind: "subset", transactionIds: [ids[0]], reason: "Resolved to the first transaction in the active evidence bundle." };
  if (/\b(?:the other one|other payment|other purchase|other charge)\b/i.test(text)) return ids.length === 2 ? { kind: "subset", transactionIds: [ids[1]], reason: "Resolved to the other transaction in the two-item evidence bundle." } : { kind: "ambiguous", transactionIds: [], reason: "The active evidence does not contain exactly two transactions." };
  if (/\b(?:the larger charge|larger payment|larger purchase)\b/i.test(text)) {
    const rows = ids.map((id) => transactions.find((row) => row.id === id)).filter((row): row is MoneyTransaction => Boolean(row));
    const largest = Math.max(...rows.map((row) => Math.abs(row.amount))); const matches = rows.filter((row) => Math.abs(row.amount) === largest);
    return matches.length === 1 ? { kind: "subset", transactionIds: [matches[0].id], reason: "Resolved to the unique largest transaction in the active evidence bundle." } : { kind: "ambiguous", transactionIds: [], reason: "More than one active transaction could be the larger charge." };
  }
  if (/\b(?:that payment|that purchase|that charge|it)\b/i.test(text)) return ids.length === 1 ? { kind: "subset", transactionIds: ids, reason: "Resolved the singular reference to the only active transaction." } : { kind: "ambiguous", transactionIds: [], reason: "The singular reference could identify more than one active transaction." };
  return { kind: "all", transactionIds: [...ids], reason: "Resolved the question to the active conversation subject and its exact evidence bundle." };
}
