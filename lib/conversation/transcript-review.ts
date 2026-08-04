export type TranscriptCorrection = { heard: string; canonical: string; correctedTranscript: string; kind: "merchant" | "person" };
export type VoiceTurnAssessment = { autoSend: boolean; reviewRequired: boolean; reason: string; correction: TranscriptCorrection | null };

const normalize = (value: string) => value.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const consequential = /\b(?:yes|confirm|approve|accept|apply|save|remember|activate|classify|categorize|cancel|move|transfer|use that plan|apply that rule)\b/i;
const sensitive = /(?:\$|\b(?:dollars?|cents?|hundred|thousand)\b|\b\d+(?:[.,]\d+)?\b|\b(?:today|tomorrow|yesterday|deadline|due|ending in|last four|son|daughter|child|spouse|partner|friend|category|categorize|classify|gift|business|personal)\b)/i;
const safeReadOnly = /^(?:how many|how much|which (?:card|account)|show (?:me )?(?:the |my )?(?:transactions|payments|purchases)|what (?:am i|did i|was i)|where did i|when did i|did i)\b/i;
const incomplete = /(?:\b(?:and|or|to|for|because|with|the|a|my)\s*$|\.\.\.$)/i;

const compact = (value: string) => normalize(value).replace(/\s+/g, "");
const phonetic = (value: string) => compact(value).replace(/ooh|ough/g, "u").replace(/ph/g, "f").replace(/(?:ch|sh|th)/g, (sound) => sound[0]).replace(/[cqgj]/g, "k").replace(/[aeiouyhw]/g, "").replace(/(.)\1+/g, "$1");
const editSimilarity = (left: string, right: string) => {
  if (left === right) return 1;
  if (!left.length || !right.length) return 0;
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = row[0]; row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const prior = row[rightIndex]; row[rightIndex] = Math.min(row[rightIndex] + 1, row[rightIndex - 1] + 1, diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)); diagonal = prior;
    }
  }
  return 1 - row[right.length] / Math.max(left.length, right.length);
};
const phoneticBagSimilarity = (left: string, right: string) => editSimilarity([...left].sort().join(""), [...right].sort().join(""));
const merchantSimilarity = (heard: string, candidate: string) => {
  const heardCompact = compact(heard); const candidateCompact = compact(candidate); const heardPhonetic = phonetic(heard); const candidatePhonetic = phonetic(candidate);
  return Math.max(editSimilarity(heardCompact, candidateCompact), editSimilarity(heardPhonetic, candidatePhonetic) * .9, phoneticBagSimilarity(heardPhonetic, candidatePhonetic) * .8);
};
export const extractMerchantPhrase = (transcript: string) => transcript.match(/\b(?:to|at|from)\s+([\p{L}0-9’' -]+?)(?:\?|\.|,|$)/iu)?.[1]?.trim() || null;
export function resolveMerchantCorrection(transcript: string, knownMerchants: string[]): TranscriptCorrection | null {
  const heard = extractMerchantPhrase(transcript); if (!heard || !knownMerchants.length) return null;
  const unique = [...new Set(knownMerchants.map((merchant) => merchant.trim()).filter(Boolean))];
  if (unique.some((merchant) => merchant.toLocaleLowerCase() === heard.toLocaleLowerCase())) return null;
  const ranked = unique.map((canonical) => ({ canonical, score: merchantSimilarity(heard, canonical) })).sort((left, right) => right.score - left.score);
  const best = ranked[0]; const runnerUp = ranked[1];
  if (!best || best.score < .72 || (runnerUp && best.score - runnerUp.score < .12)) return null;
  return { heard, canonical: best.canonical, correctedTranscript: transcript.replace(heard, best.canonical), kind: "merchant" };
}
const correctionFor = (transcript: string, knownMerchants: string[]): TranscriptCorrection | null => {
  const merchant = resolveMerchantCorrection(transcript, knownMerchants);
  if (merchant) return merchant;
  const person = transcript.match(/\b(?:calvin|callum|kayla)\b/i)?.[0];
  if (person) return { heard: person, canonical: "Caleb", correctedTranscript: transcript.replace(person, "Caleb"), kind: "person" };
  return null;
};

const appearsConcatenated = (transcript: string) => {
  const clean = normalize(transcript);
  const starts = clean.match(/\b(?:how many|how much|which card|show me|what am i)\b/g) || [];
  return starts.length > 1 || /(.{18,})\s+\1/i.test(clean);
};

export function assessVoiceTurn(input: { transcript: string; confidence: number | null; pendingProposal: boolean; lastSubmittedTranscript?: string | null; knownMerchants?: string[]; activeContext?: ConversationContext | null }): VoiceTurnAssessment {
  const transcript = input.transcript.trim();
  const correction = correctionFor(transcript, input.knownMerchants || []);
  if (!transcript || incomplete.test(transcript)) return { autoSend: false, reviewRequired: true, reason: "The voice turn appears incomplete.", correction };
  if (input.confidence == null || input.confidence < 0.9) return { autoSend: false, reviewRequired: true, reason: "Recognition confidence is too low for automatic submission.", correction };
  if (correction) return { autoSend: false, reviewRequired: true, reason: `Confirm the ${correction.kind} before sending.`, correction };
  if (appearsConcatenated(transcript)) return { autoSend: false, reviewRequired: true, reason: "This may contain more than one voice attempt.", correction: null };
  if (input.lastSubmittedTranscript && normalize(input.lastSubmittedTranscript) === normalize(transcript)) return { autoSend: false, reviewRequired: true, reason: "This matches the prior submitted voice turn.", correction: null };
  if (input.pendingProposal || consequential.test(transcript)) return { autoSend: false, reviewRequired: true, reason: "Consequential or confirmation language requires visible review.", correction: null };
  if (sensitive.test(transcript)) return { autoSend: false, reviewRequired: true, reason: "Financially meaningful details require review.", correction: null };
  const merchantReference = transcript.match(/\b(?:to|at)\s+([\p{L}0-9’' -]+?)(?:\?|\.|$)/iu)?.[1]?.trim();
  if (merchantReference && input.knownMerchants?.length && !input.knownMerchants.some((merchant) => normalize(merchant) === normalize(merchantReference))) return { autoSend: false, reviewRequired: true, reason: "The merchant could not be resolved against the available evidence.", correction: null };
  const resolvedIntent = routeConversationIntent(transcript, input.activeContext);
  const boundedContextFollowUp = resolvedIntent.factual && !resolvedIntent.mutating && !resolvedIntent.clarificationRequired && resolvedIntent.type === "account_question" && Boolean(input.activeContext?.transactionIds.length);
  if (!safeReadOnly.test(transcript) && !boundedContextFollowUp) return { autoSend: false, reviewRequired: true, reason: "The request is not a bounded read-only voice question.", correction: null };
  return { autoSend: true, reviewRequired: false, reason: "Safe completed read-only voice turn.", correction: null };
}

export const transcriptNeedsExplicitReview = (transcript: string, confidence: number | null) => assessVoiceTurn({ transcript, confidence, pendingProposal: false }).reviewRequired;
import { routeConversationIntent } from "./intent-router.ts";
import type { ConversationContext } from "./types.ts";
