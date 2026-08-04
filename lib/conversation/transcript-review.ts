const sensitiveTranscriptPatterns = [
  /(?:\$|\b(?:dollars?|cents?|hundred|thousand)\b|\b\d+(?:[.,]\d+)?\b)/i,
  /\b(?:today|tomorrow|yesterday|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december|deadline|due)\b/i,
  /\b(?:account|card|checking|savings|ending in|last four)\b/i,
  /\b(?:merchant|store|restaurant|payment|purchase|charge)\b/i,
  /\b(?:son|daughter|child|spouse|partner|friend|mother|father|sister|brother)\b/i,
  /\b(?:category|categorize|classify|change|gift|business|personal)\b/i,
  /\b(?:confirm|yes|approve|accept|apply|save|remember|activate)\b/i,
];

export const transcriptNeedsExplicitReview = (transcript: string, confidence: number | null) =>
  confidence == null || confidence < 0.9 || sensitiveTranscriptPatterns.some((pattern) => pattern.test(transcript));
