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

/**
 * Splits an answer into pieces synthesized one after another. The first piece is short, so the first sound comes
 * quickly; the others are synthesized while the one before plays. A cut falls at a sentence end if there is one, else
 * after a comma, semicolon or colon, else between words; a piece cut between words gets a comma, so the voice keeps
 * the sentence going.
 */
export function speechPieces(text: string, firstMax: number, restMax: number): string[] {
  const pieces: string[] = [];
  let rest = text.replace(/\s+/g, " ").trim();
  while (rest) {
    const max = pieces.length ? restMax : firstMax;
    if (rest.length <= max) {
      pieces.push(rest);
      break;
    }
    const { at, between } = cutPoint(rest.slice(0, max + 1));
    const head = rest.slice(0, at).trim();
    pieces.push(between ? `${head},` : head);
    rest = rest.slice(at).trim();
  }
  return pieces;
}

/** The last good cut in the window, never in its first third. */
function cutPoint(window: string): { at: number; between: boolean } {
  const floor = Math.floor(window.length / 3);
  const patterns: [RegExp, boolean][] = [
    [/[.!?…]["»”)]*\s/g, false],
    [/[,;:]\s/g, false],
    [/\s/g, true],
  ];
  for (const [pattern, between] of patterns) {
    let at = -1;
    for (const m of window.matchAll(pattern)) if (m.index! >= floor) at = m.index! + m[0].length;
    if (at > 0) return { at, between };
  }
  return { at: window.length - 1, between: true };
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
