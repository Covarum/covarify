export function bestClarification(unresolved: string[], candidates = 0) {
  if (unresolved.includes("transaction")) return candidates ? "Which payment was it?" : "Which transaction did you mean?";
  if (unresolved.includes("merchant")) return "Which merchant should I look for?";
  return "What would you like to know or change about your financial activity?";
}
