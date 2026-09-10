// The single normalization used everywhere a quote is compared with page text.
export function normalizeText(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/­/g, "") // soft hyphen
    .replace(/[‐‑‒−]/g, "-") // hyphen and minus variants (en/em dashes are kept)
    .replace(/\s+/g, " ")
    .trim();
}

// Speech recognition writes a spoken letter as a word ("model bee"). "be" is left out on purpose:
// "Should the model be reset?" must stay as it is.
const SPOKEN_LETTERS: Record<string, string> = { ay: "A", eh: "A", bee: "B", see: "C", sea: "C", cee: "C", dee: "D" };

/** Restores single-letter model names that speech recognition spelled out as words. */
export function normalizeSpokenQuestion(question: string): string {
  return question.replace(
    /\b(model)\s+(ay|eh|bee|see|sea|cee|dee)\b/gi,
    (_m, word: string, letter: string) => `${word} ${SPOKEN_LETTERS[letter.toLowerCase()]}`,
  );
}
