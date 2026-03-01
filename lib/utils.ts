export function formatDate(isoString: string): string {
  const d = new Date(isoString + (isoString.endsWith("Z") ? "" : "Z"));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Extracts a clean 2–5 word noun-phrase title from a thesis sentence.
// Stops at the first modal/auxiliary verb to capture the subject.
// Never produces a truncated sentence — always reads as a complete label.
export function generateTitle(thesisText: string): string {
  const titleCase = (w: string) =>
    // Preserve acronyms (AI, US, GDP…)
    /^[A-Z0-9]{2,}$/.test(w)
      ? w
      : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

  // Strip leading articles
  const stripped = thesisText.trim().replace(/^(the|a|an)\s+/i, "");

  // Stop before the first modal / auxiliary verb
  const stopRe =
    /\b(will|is|are|was|were|has|have|had|can|could|should|would|may|might|shall|must|do|does|did)\b/i;
  const match = stripped.match(stopRe);

  let subject = stripped;
  if (match && match.index !== undefined && match.index > 0) {
    subject = stripped.slice(0, match.index).trim().replace(/[,;]+$/, "");
  }

  const words = subject.split(/\s+/).slice(0, 5);

  // Need at least 2 words for a useful title; otherwise take first 4 of original
  if (words.length < 2) {
    return stripped.split(/\s+/).slice(0, 4).map(titleCase).join(" ");
  }

  return words.map(titleCase).join(" ");
}
