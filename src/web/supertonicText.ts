// Text preparation for Supertonic 3, ported from its web example (MIT, © 2025 Supertone Inc.).

const EMOJI =
  /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]+/gu;

const REPLACEMENTS: [string, string][] = [
  ["–", "-"],
  ["‑", "-"],
  ["—", "-"],
  ["_", " "],
  ["“", '"'],
  ["”", '"'],
  ["‘", "'"],
  ["’", "'"],
  ["´", "'"],
  ["`", "'"],
  ["[", " "],
  ["]", " "],
  ["|", " "],
  ["/", " "],
  ["#", " "],
  ["→", " "],
  ["←", " "],
];
const EXPRESSIONS: [string, string][] = [
  ["@", " at "],
  ["e.g.,", "for example, "],
  ["i.e.,", "that is, "],
];

/** Normalizes a piece of text the way the model was trained on and wraps it in its language tag. */
export function prepareText(text: string, lang: string): string {
  let t = text.normalize("NFKD").replace(EMOJI, "");
  for (const [from, to] of REPLACEMENTS) t = t.replaceAll(from, to);
  t = t.replace(/[♥☆♡©\\]/g, "");
  for (const [from, to] of EXPRESSIONS) t = t.replaceAll(from, to);
  t = t.replace(/ ([,.!?;:'])/g, "$1");
  t = t.replace(/"{2,}/g, '"').replace(/'{2,}/g, "'");
  t = t.replace(/\s+/g, " ").trim();
  if (!/[.!?;:,'"')\]}…。」』】〉》›»]$/.test(t)) t += ".";
  return `<${lang}>${t}</${lang}>`;
}

/** Splits text at sentence ends into pieces of at most maxLen characters (a longer sentence stays whole). */
export function chunkText(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  for (const paragraph of text.trim().split(/\n\s*\n+/)) {
    const p = paragraph.trim();
    if (!p) continue;
    const sentences = p.split(
      /(?<!Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.|Sr\.|Jr\.|Ph\.D\.|etc\.|e\.g\.|i\.e\.|vs\.|Inc\.|Ltd\.|Co\.|Corp\.|St\.|Ave\.|Blvd\.)(?<!\b[A-Z]\.)(?<=[.!?])\s+/,
    );
    let current = "";
    for (const sentence of sentences) {
      if (current.length + sentence.length + 1 <= maxLen) current += (current ? " " : "") + sentence;
      else {
        if (current) chunks.push(current.trim());
        current = sentence;
      }
    }
    if (current) chunks.push(current.trim());
  }
  return chunks;
}

/** Ids for the text encoder: the model's indexer maps each UTF-16 code unit to an id; unknown ones become -1. */
export function textIds(prepared: string, indexer: (number | null)[]): BigInt64Array {
  const ids = new BigInt64Array(prepared.length);
  for (let i = 0; i < prepared.length; i++) {
    const code = prepared.codePointAt(i)!;
    ids[i] = BigInt((code < indexer.length ? indexer[code] : null) ?? -1);
  }
  return ids;
}
