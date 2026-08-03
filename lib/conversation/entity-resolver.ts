import type { ConversationEntity } from "./types.ts";

export function resolveConversationEntities(text: string) {
  const entities: ConversationEntity[] = [];
  const gift = /\b((?:birthday|holiday|wedding|graduation|anniversary)\s+gift)\s+for\s+([A-Z][\p{L}'’-]+)\b/iu.exec(text);
  if (gift) { entities.push({ type: "purpose", value: gift[1], confidence: "high" }, { type: "person", value: gift[2], confidence: "high" }); }
  const business = /\bfor\s+([A-Z][\p{L}0-9&.'’-]+)\b/iu.exec(text);
  if (!gift && business && /\b(?:booking app|software|service)\b/i.test(text)) entities.push({ type: "business", value: business[1], confidence: "medium" });
  const amount = text.match(/\$\s?(\d+(?:\.\d{1,2})?)/);
  if (amount) entities.push({ type: "amount", value: amount[1], confidence: "high" });
  return entities;
}
