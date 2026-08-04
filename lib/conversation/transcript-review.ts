export type TranscriptCorrection = { heard: string; canonical: string; correctedTranscript: string; kind: "merchant" | "person" };
export type VoiceTurnAssessment = { autoSend: boolean; reviewRequired: boolean; reason: string; correction: TranscriptCorrection | null };

const normalize = (value: string) => value.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const consequential = /\b(?:yes|confirm|approve|accept|apply|save|remember|activate|classify|categorize|cancel|move|transfer|use that plan|apply that rule)\b/i;
const sensitive = /(?:\$|\b(?:dollars?|cents?|hundred|thousand)\b|\b\d+(?:[.,]\d+)?\b|\b(?:today|tomorrow|yesterday|deadline|due|ending in|last four|son|daughter|child|spouse|partner|friend|category|categorize|classify|gift|business|personal)\b)/i;
const safeReadOnly = /^(?:how many|how much|which (?:card|account)|show (?:me )?(?:the |my )?(?:transactions|payments|purchases)|what (?:am i|did i|was i)|where did i|when did i|did i)\b/i;
const incomplete = /(?:\b(?:and|or|to|for|because|with|the|a|my)\s*$|\.\.\.$)/i;

const correctionFor = (transcript: string): TranscriptCorrection | null => {
  const merchant = transcript.match(/\b(?:elujay|olu jay|olu guy|olukai)\b/i)?.[0];
  if (merchant && normalize(merchant) !== "olukai") return { heard: merchant, canonical: "OLU’KAI", correctedTranscript: transcript.replace(merchant, "OLU’KAI"), kind: "merchant" };
  const person = transcript.match(/\b(?:calvin|callum|kayla)\b/i)?.[0];
  if (person) return { heard: person, canonical: "Caleb", correctedTranscript: transcript.replace(person, "Caleb"), kind: "person" };
  return null;
};

const appearsConcatenated = (transcript: string) => {
  const clean = normalize(transcript);
  const starts = clean.match(/\b(?:how many|how much|which card|show me|what am i)\b/g) || [];
  return starts.length > 1 || /(.{18,})\s+\1/i.test(clean);
};

export function assessVoiceTurn(input: { transcript: string; confidence: number | null; pendingProposal: boolean; lastSubmittedTranscript?: string | null; knownMerchants?: string[] }): VoiceTurnAssessment {
  const transcript = input.transcript.trim();
  const correction = correctionFor(transcript);
  if (!transcript || incomplete.test(transcript)) return { autoSend: false, reviewRequired: true, reason: "The voice turn appears incomplete.", correction };
  if (input.confidence == null || input.confidence < 0.9) return { autoSend: false, reviewRequired: true, reason: "Recognition confidence is too low for automatic submission.", correction };
  if (correction) return { autoSend: false, reviewRequired: true, reason: `Confirm the ${correction.kind} before sending.`, correction };
  if (appearsConcatenated(transcript)) return { autoSend: false, reviewRequired: true, reason: "This may contain more than one voice attempt.", correction: null };
  if (input.lastSubmittedTranscript && normalize(input.lastSubmittedTranscript) === normalize(transcript)) return { autoSend: false, reviewRequired: true, reason: "This matches the prior submitted voice turn.", correction: null };
  if (input.pendingProposal || consequential.test(transcript)) return { autoSend: false, reviewRequired: true, reason: "Consequential or confirmation language requires visible review.", correction: null };
  if (sensitive.test(transcript)) return { autoSend: false, reviewRequired: true, reason: "Financially meaningful details require review.", correction: null };
  const merchantReference = transcript.match(/\b(?:to|at)\s+([\p{L}0-9’' -]+?)(?:\?|\.|$)/iu)?.[1]?.trim();
  if (merchantReference && input.knownMerchants?.length && !input.knownMerchants.some((merchant) => normalize(merchant) === normalize(merchantReference))) return { autoSend: false, reviewRequired: true, reason: "The merchant could not be resolved against the available evidence.", correction: null };
  if (!safeReadOnly.test(transcript)) return { autoSend: false, reviewRequired: true, reason: "The request is not a bounded read-only voice question.", correction: null };
  return { autoSend: true, reviewRequired: false, reason: "Safe completed read-only voice turn.", correction: null };
}

export const transcriptNeedsExplicitReview = (transcript: string, confidence: number | null) => assessVoiceTurn({ transcript, confidence, pendingProposal: false }).reviewRequired;
