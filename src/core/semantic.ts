// Search by meaning, the part that is plain arithmetic: the passages a document is embedded in, and how a question's
// vector ranks paragraphs. The model itself runs in the browser (src/web/embedder.ts); this module never loads it, so
// the eval and the unit tests run without it.
import type { EvidenceUnit } from "./types.js";

/** Lines are cited, paragraphs are chosen: the key of the paragraph a line belongs to. */
export const paragraphKey = (u: Pick<EvidenceUnit, "documentId" | "page" | "paragraph">) => `${u.documentId}#${u.page}#${u.paragraph}`;

export interface Passage {
  /** The paragraph it belongs to. */
  key: string;
  text: string;
}

/**
 * The passages to embed. A line of a magazine column is a fragment ("ГАЗ-" | "АА, ЗИС-5") with no meaning of its own
 * to compare, and embedding lines found fewer answering lines than searching by words did. So a passage is a run of
 * consecutive lines of one paragraph up to `maxChars`, and a long paragraph is covered by windows overlapping by half,
 * so no statement is only ever seen cut in two.
 */
export function passagesOf(units: EvidenceUnit[], maxChars: number): Passage[] {
  const paragraphs = new Map<string, EvidenceUnit[]>();
  for (const u of units) {
    const list = paragraphs.get(paragraphKey(u));
    if (list) list.push(u);
    else paragraphs.set(paragraphKey(u), [u]);
  }
  const out: Passage[] = [];
  for (const [key, lines] of paragraphs) {
    for (let start = 0; start < lines.length; ) {
      let end = start;
      let chars = 0;
      while (end < lines.length && (end === start || chars + lines[end]!.text.length + 1 <= maxChars)) chars += lines[end++]!.text.length + 1;
      out.push({ key, text: lines.slice(start, end).map((l) => l.text).join(" ") });
      if (end >= lines.length) break;
      start = Math.max(start + 1, Math.floor((start + end) / 2));
    }
  }
  return out;
}

/** The loaded documents' passage vectors (unit length), with the paragraph each one belongs to. */
export interface SemanticIndex {
  keys: string[];
  vectors: Float32Array[];
}

/** Each paragraph's similarity to the question: the best of its passages. Vectors are unit length, so a dot product. */
export function paragraphSimilarity(query: Float32Array, index: SemanticIndex): Map<string, number> {
  const out = new Map<string, number>();
  index.vectors.forEach((vector, i) => {
    let dot = 0;
    for (let d = 0; d < vector.length; d++) dot += vector[d]! * query[d]!;
    const key = index.keys[i]!;
    out.set(key, Math.max(out.get(key) ?? -Infinity, dot));
  });
  return out;
}

/**
 * Reciprocal rank fusion: a paragraph scores by its place in each ranking (1 / (k + place)), so word scores and
 * similarities need no common scale, and a paragraph near the top of both beats one at the top of only one.
 */
export function fuseRankings(rankings: Map<string, number>[], k = 60): Map<string, number> {
  const fused = new Map<string, number>();
  for (const scores of rankings) {
    [...scores.entries()]
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])
      .forEach(([key], place) => fused.set(key, (fused.get(key) ?? 0) + 1 / (k + place)));
  }
  return fused;
}
