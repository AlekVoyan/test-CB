import { config, type RetrievalMode } from "./config.js";
import { normalizeText } from "./normalize.js";
import { fuseRankings, paragraphKey, paragraphSimilarity, type SemanticIndex } from "./semantic.js";
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
// Cyrillic letters that stand for Latin model letters in Russian/Ukrainian speech ("модель Б").
const CYRILLIC_LETTERS: Record<string, string> = { а: "a", б: "b", с: "c", д: "d" };

/**
 * Lowercased tokens without stopwords. "Model X" becomes the entity token "model_x", and a lone capital
 * letter mid-sentence ("can A handle") becomes the same token, so single-letter model names survive.
 */
export function tokenize(text: string): string[] {
  let t = normalizeText(text);
  t = t.replace(/\bmodel\s+([a-z0-9]+)\b/gi, (_m, id: string) => ` model_${LETTER_ALIASES[id.toLowerCase()] ?? id.toLowerCase()} `);
  // "модель A" / "моделі B" (Russian, Ukrainian) — Latin or Cyrillic letter
  t = t.replace(/(?<!\p{L})модел\p{L}*\s+([A-Za-zАБСДабсд0-9])(?!\p{L})/giu, (_m, id: string) => ` model_${CYRILLIC_LETTERS[id.toLowerCase()] ?? id.toLowerCase()} `);
  t = t.replace(/([^.!?]\s)([A-HJ-Z])(?=[\s?!.,;:)]|$)/g, (_m, pre: string, letter: string) => `${pre}model_${letter.toLowerCase()} `);
  return t
    .toLowerCase()
    .split(/[^\p{L}\p{N}_]+/u)
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
  /** "hybrid": top-k by words and by meaning together, held to a token cap. */
  mode: RetrievalMode | "hybrid";
  /** Units sent to the model, in document order. */
  units: EvidenceUnit[];
  /** All units ranked by BM25 score for the question (highest first). */
  ranked: { unit: EvidenceUnit; score: number }[];
  estimatedTokens: number;
}

export interface SelectOptions {
  mode?: RetrievalMode;
  /** The second pass that lends the best lines' words back to the query. On by default; off to measure it. */
  feedback?: boolean;
  budgetTokens?: number;
  topK?: number;
  history?: Turn[];
  /** Search by meaning: the vector of retrievalQuery() and the loaded documents' passage vectors. Used above the budget. */
  semantic?: { query: Float32Array; index: SemanticIndex };
  /** The token cap of a hybrid selection. */
  evidenceTokens?: number;
}

/** What is searched for: the question, and for a follow-up that carries few words, the question it follows. */
export function retrievalQuery(question: string, history: Turn[] = []): string {
  const last = history[history.length - 1];
  return [question, last?.resolvedQuery ?? "", ...(last?.activeEntities ?? [])].join(" ");
}

/**
 * Words to add to a query that found little on its own. A loose question ("what is it good for", "where does the gas
 * come from") shares almost no words with the text that answers it; the lines it did reach do share words with that
 * text. So the best few lines lend their rarest words back to the query — pseudo-relevance feedback, the classic
 * trick — and the second pass reaches the paragraph the first one missed. No model call: this is arithmetic on the
 * index. Words already in the query, and words common across the corpus, are no help and are left out.
 */
function feedbackTerms(ranked: { unit: EvidenceUnit; score: number }[], asked: Set<string>, all: string[][], count: number): string[] {
  const df = new Map<string, number>();
  for (const doc of all) for (const term of new Set(doc)) df.set(term, (df.get(term) ?? 0) + 1);
  const seen = new Map<string, number>();
  for (const { unit } of ranked.slice(0, 3)) {
    for (const term of new Set(tokenize(unit.text))) {
      if (asked.has(term) || term.length < 4) continue;
      const rarity = Math.log(1 + all.length / ((df.get(term) ?? 0) + 1));
      seen.set(term, (seen.get(term) ?? 0) + rarity);
    }
  }
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, count).map(([term]) => term);
}

export function selectEvidence(docs: IndexedDocument[], question: string, options: SelectOptions = {}): EvidenceSelection {
  const mode = options.mode ?? config.retrievalMode;
  const budget = options.budgetTokens ?? config.evidenceTokenBudget;
  const topK = options.topK ?? config.topK;
  const history = options.history ?? [];
  const last = history[history.length - 1];

  const all = docs.flatMap((d) => d.units);
  // Follow-ups ("and the other one?") carry few words; borrow the previous resolved question and entities.
  const queryText = retrievalQuery(question, history);
  const tokenized = all.map((u) => tokenize(u.text));
  const query = tokenize(queryText);
  const rank = (terms: string[]) => {
    const scores = bm25(terms, tokenized);
    return all.map((unit, i) => ({ unit, score: scores[i] ?? 0 })).sort((a, b) => b.score - a.score);
  };
  let ranked = rank(query);

  const fullTokens = estimateTokens(all);
  if (mode === "full" && fullTokens <= budget) {
    return { mode: "full", units: all, ranked, estimatedTokens: fullTokens };
  }

  // Only a selection needs the second pass: when the whole corpus goes to the model, ranking only orders it. Words
  // lent by lines that matched nothing are noise: a question in another language got the running headers. Search by
  // words alone still needs something to send, so only a hybrid selection skips them.
  const matched = ranked.some((r) => r.score > 0);
  const feedback = options.feedback === false || (options.semantic && !matched) ? [] : feedbackTerms(ranked, new Set(query), tokenized, 6);
  if (feedback.length) ranked = rank([...query, ...feedback]);

  // paragraphs that mention entities from the conversation go along with whatever is chosen
  const entityTokens = new Set((last?.activeEntities ?? []).flatMap((e) => tokenize(e)));
  const withEntities = (chosen: Set<string>) => {
    if (entityTokens.size) for (const u of all) if (tokenize(u.text).some((t) => entityTokens.has(t))) chosen.add(paragraphKey(u));
    return all.filter((u) => chosen.has(paragraphKey(u)));
  };

  if (options.semantic) {
    // Paragraphs ranked by words and by meaning, the two rankings fused, then taken in that order while they fit the
    // token cap: the best one always, at most top-k. A hybrid selection sends no more than a lexical one did.
    const cap = options.evidenceTokens ?? config.semanticSearch.evidenceTokens;
    const byWords = new Map<string, number>();
    for (const { unit, score } of ranked) byWords.set(paragraphKey(unit), Math.max(byWords.get(paragraphKey(unit)) ?? 0, score));
    // Paragraphs that name what the conversation is about rank as a third list rather than being added past the cap: a
    // subject like "ГАЗ-АА" tokenizes to "газ", which the magazine article uses in nearly every paragraph, and adding
    // them all sent 5,400 tokens instead of 1,300.
    const byEntities = new Map<string, number>();
    if (entityTokens.size) {
      for (const u of all) {
        const hits = tokenize(u.text).filter((t) => entityTokens.has(t)).length;
        if (hits) byEntities.set(paragraphKey(u), (byEntities.get(paragraphKey(u)) ?? 0) + hits);
      }
    }
    const fused = fuseRankings([byWords, paragraphSimilarity(options.semantic.query, options.semantic.index), byEntities]);
    const members = new Map<string, EvidenceUnit[]>();
    for (const u of all) members.set(paragraphKey(u), [...(members.get(paragraphKey(u)) ?? []), u]);
    const chosen = new Set<string>();
    let used = 0;
    for (const [key] of [...fused.entries()].sort((a, b) => b[1] - a[1])) {
      if (chosen.size >= topK) break;
      const size = estimateTokens(members.get(key) ?? []);
      if (chosen.size && used + size > cap) continue;
      chosen.add(key);
      used += size;
    }
    const units = all.filter((u) => chosen.has(paragraphKey(u)));
    // The closest passages for a not-found answer follow the fused order too; within a paragraph, the best line by words.
    const lexical = new Map(ranked.map((r) => [r.unit.id, r.score]));
    const hybridRanked = all
      .map((unit) => ({ unit, score: fused.get(paragraphKey(unit)) ?? 0 }))
      .sort((a, b) => b.score - a.score || (lexical.get(b.unit.id) ?? 0) - (lexical.get(a.unit.id) ?? 0));
    return { mode: "hybrid", units, ranked: hybridRanked, estimatedTokens: estimateTokens(units) };
  }

  // top-k paragraphs by their best unit
  const chosen = new Set<string>();
  for (const { unit, score } of ranked) {
    if (chosen.size >= topK || score <= 0) break;
    chosen.add(paragraphKey(unit));
  }
  const units = withEntities(chosen);
  return { mode: "topk", units, ranked, estimatedTokens: estimateTokens(units) };
}

/** Closest passages to show next to a "not found" answer. Never used as citations. */
export function relatedEvidence(selection: EvidenceSelection, count = 2): EvidenceUnit[] {
  return selection.ranked.filter((r) => r.score > 0).slice(0, count).map((r) => r.unit);
}
