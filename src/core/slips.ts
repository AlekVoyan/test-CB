// Slips in a question ("nozzel", a misheard word): surfaced when the model corrected one without saying so.
import type { Language } from "./config.js";
import type { EvidenceUnit } from "./types.js";

// ё and е are one letter here: "твёрдого" restated as "твердого" is not a slip the model fixed.
const words = (text: string) => text.toLowerCase().replace(/ё/g, "е").match(/\p{L}+/gu) ?? [];

/** Edit distance that counts a swap of two neighbouring letters as one edit ("nozzel" → "nozzle" is 1). */
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const row = d[i]!;
      const up = d[i - 1]!;
      row[j] = Math.min(up[j]! + 1, row[j - 1]! + 1, up[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j]!, d[i - 2]![j - 2]! + 1);
    }
  }
  return d[a.length]![b.length]!;
}

/**
 * The model restates every question as resolvedQuery. When it fixed a slip there, the fixed word is in the documents,
 * the original is not, and the two are a letter or two apart. Returns the fixed word when exactly one such pair
 * exists; paraphrases, inflections ("filters" → "filter") and words the documents use are never flagged.
 */
export function findCorrectedSlip(question: string, resolvedQuery: string, evidence: EvidenceUnit[]): string | null {
  const vocabulary = new Set(evidence.flatMap((u) => words(u.text)));
  const asked = new Set(words(question));
  const restated = new Set(words(resolvedQuery));
  const slips = [...asked].filter((w) => w.length >= 4 && !restated.has(w) && !vocabulary.has(w));
  const fixes = [...restated].filter((w) => !asked.has(w) && vocabulary.has(w));
  const pairs = slips.flatMap((slip) =>
    fixes.filter((fix) => !fix.startsWith(slip) && !slip.startsWith(fix) && editDistance(slip, fix) <= (slip.length >= 6 ? 2 : 1)),
  );
  return pairs.length === 1 ? pairs[0]! : null;
}

const PREFIX: Record<Language, (term: string) => string> = {
  en: (term) => `Assuming you meant “${term}”:`,
  ru: (term) => `Если вы имели в виду «${term}»:`,
  uk: (term) => `Якщо ви мали на увазі «${term}»:`,
};

/** Opening words that name the assumption, in the answer language. */
export const assumptionPrefix = (language: Language, term: string) => PREFIX[language](term);
