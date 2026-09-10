import { config, type RetrievalMode } from "./config.js";
import { normalizeText } from "./normalize.js";
import type { EvidenceUnit, IndexedDocument, Turn } from "./types.js";

const STOPWORDS = new Set(
  (
    "a an the is are was were be been being of to in on at for by with from and or but if then than this that " +
    "these those it its as do does did how what which who whom whose when where why can could should would will " +
    "shall may might must i me my we our you your he she they them their there here about into over under up down " +
    "out not no yes so any all each much many"
  ).split(" "),
);

// Speech recognition often writes a spoken letter as a word ("model bee").
const LETTER_ALIASES: Record<string, string> = { ay: "a", eh: "a", bee: "b", be: "b", see: "c", sea: "c", cee: "c", dee: "d" };

/**
 * Lowercased tokens without stopwords. "Model X" becomes the entity token "model_x", and a lone capital
 * letter mid-sentence ("can A handle") becomes the same token, so single-letter model names survive.
 */
export function tokenize(text: string): string[] {
  let t = normalizeText(text);
  t = t.replace(/\bmodel\s+([a-z0-9]+)\b/gi, (_m, id: string) => ` model_${LETTER_ALIASES[id.toLowerCase()] ?? id.toLowerCase()} `);
  t = t.replace(/([^.!?]\s)([A-HJ-Z])(?=[\s?!.,;:)]|$)/g, (_m, pre: string, letter: string) => `${pre}model_${letter.toLowerCase()} `);
  return t
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((tok) => tok.length > 0 && !STOPWORDS.has(tok));
}

/** Okapi BM25 score of every document (token list) for the query. */
export function bm25(query: string[], docs: string[][], k1 = 1.2, b = 0.75): number[] {
  const n = docs.length;
  if (n === 0) return [];
  const avgLen = docs.reduce((sum, d) => sum + d.length, 0) / n || 1;
  const df = new Map<string, number>();
  for (const doc of docs) for (const tok of new Set(doc)) df.set(tok, (df.get(tok) ?? 0) + 1);
  const terms = [...new Set(query)];
  return docs.map((doc) => {
    const tf = new Map<string, number>();
    for (const tok of doc) tf.set(tok, (tf.get(tok) ?? 0) + 1);
    let score = 0;
    for (const term of terms) {
      const f = tf.get(term);
      if (!f) continue;
      const idf = Math.log(1 + (n - (df.get(term) ?? 0) + 0.5) / ((df.get(term) ?? 0) + 0.5));
      score += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * doc.length) / avgLen));
    }
    return score;
  });
}

export function estimateTokens(units: EvidenceUnit[]): number {
  return Math.ceil(units.reduce((sum, u) => sum + u.id.length + u.text.length + 4, 0) / 4);
}

export interface EvidenceSelection {
  mode: RetrievalMode;
  /** Units sent to the model, in document order. */
  units: EvidenceUnit[];
  /** All units ranked by BM25 score for the question (highest first). */
  ranked: { unit: EvidenceUnit; score: number }[];
  estimatedTokens: number;
}

export interface SelectOptions {
  mode?: RetrievalMode;
  budgetTokens?: number;
  topK?: number;
  history?: Turn[];
}

export function selectEvidence(docs: IndexedDocument[], question: string, options: SelectOptions = {}): EvidenceSelection {
  const mode = options.mode ?? config.retrievalMode;
  const budget = options.budgetTokens ?? config.evidenceTokenBudget;
  const topK = options.topK ?? config.topK;
  const history = options.history ?? [];
  const last = history[history.length - 1];

  const all = docs.flatMap((d) => d.units);
  // Follow-ups ("and the other one?") carry few words; borrow the previous resolved question and entities.
  const queryText = [question, last?.resolvedQuery ?? "", ...(last?.activeEntities ?? [])].join(" ");
  const scores = bm25(tokenize(queryText), all.map((u) => tokenize(u.text)));
  const ranked = all
    .map((unit, i) => ({ unit, score: scores[i] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  const fullTokens = estimateTokens(all);
  if (mode === "full" && fullTokens <= budget) {
    return { mode: "full", units: all, ranked, estimatedTokens: fullTokens };
  }

  // top-k paragraphs by their best unit, plus paragraphs that mention entities from the conversation
  const paragraphKey = (u: EvidenceUnit) => `${u.documentId}#${u.page}#${u.paragraph}`;
  const chosen = new Set<string>();
  for (const { unit, score } of ranked) {
    if (chosen.size >= topK || score <= 0) break;
    chosen.add(paragraphKey(unit));
  }
  const entityTokens = new Set((last?.activeEntities ?? []).flatMap((e) => tokenize(e)));
  if (entityTokens.size) {
    for (const u of all) if (tokenize(u.text).some((t) => entityTokens.has(t))) chosen.add(paragraphKey(u));
  }
  const units = all.filter((u) => chosen.has(paragraphKey(u)));
  return { mode: "topk", units, ranked, estimatedTokens: estimateTokens(units) };
}

/** Closest passages to show next to a "not found" answer. Never used as citations. */
export function relatedEvidence(selection: EvidenceSelection, count = 2): EvidenceUnit[] {
  return selection.ranked.filter((r) => r.score > 0).slice(0, count).map((r) => r.unit);
}
