// Which model a question is about, settled in code. A manual that describes Model A and Model B gives different
// answers for each, so "What is the limit?" has to be asked back, and the reply "Model B." has to be read as the
// answer to that question. Left to the free model, both went wrong often enough to be the weakest pair in the eval:
// it sometimes asked which limit rather than which model, and then could not connect "Model B." to what it had asked
// (R1b passed 4 of 9 runs). Two prompt fixes each traded one of the two tests for the other. Here the question is
// asked back when the lines that answer it differ by model, and a short reply is joined to the question it answers
// before anything is sent — no model call for the first, an unambiguous question for the second.
import type { Language } from "./config.js";
import { normalizeSpokenQuestion } from "./normalize.js";
import { tokenize } from "./retriever.js";
import type { AnswerResult, EvidenceUnit, Turn } from "./types.js";

const WORDS = /[\p{L}\p{N}]+/gu;

// Function words long enough to pass the length check, which would otherwise match half the manual.
const FUNCTION_WORDS = new Set([
  "what", "which", "when", "where", "does", "should", "could", "would", "have", "with", "from", "this", "that", "there",
  "about", "your", "much", "many", "they", "them", "their", "will", "been", "into", "than", "then", "some",
  "какой", "какая", "какое", "какие", "сколько", "который", "нужно", "можно", "этот", "этой", "есть", "если", "чтобы",
  "який", "яка", "яке", "які", "скільки", "потрібно", "можна", "якщо",
]);

// The word "model" itself says nothing about what is asked: every line that names a model shares it, so "How many
// models are there?" would reach all of them and be asked back.
const MODEL_WORD = /^(models?|модел\p{L}*)$/u;

/** The words that carry a question's meaning, and the lines that share them. */
const meaningful = (text: string) =>
  [...new Set((text.toLowerCase().match(WORDS) ?? []).filter((w) => w.length >= 4 && !FUNCTION_WORDS.has(w) && !MODEL_WORD.test(w)))];

/** Two forms of one word: "limit" and "Limits", "load" and "loads". No stemmer — a shared start is enough here. */
function sameWord(a: string, b: string): boolean {
  const shorter = Math.min(a.length, b.length);
  const need = Math.min(5, shorter);
  return shorter >= 4 && a.slice(0, need) === b.slice(0, need);
}

// Short words that follow "model" in a sentence without naming one: "the model is reset".
const NOT_A_NAME = new Set(["is", "it", "to", "in", "on", "at", "of", "or", "an", "as", "by", "no", "so", "do", "up", "if", "my", "we", "me", "he", "us", "am"]);

/** Whether a question or reply names a model itself: "Model B", "model bee", "модель Б", or "can A handle". */
export function namesModel(text: string): boolean {
  return tokenize(normalizeSpokenQuestion(text)).some((t) => {
    const name = /^model_([\p{L}\p{N}]{1,2})$/u.exec(t)?.[1];
    return !!name && !NOT_A_NAME.has(name);
  });
}

// A model as a document writes it: the word, then a capital letter or a number. Case matters in a document — "the
// model is reset" names nothing — while a question, spoken and transcribed, is read loosely by namesModel above.
const DOCUMENT_MODEL = /(?<![\p{L}\p{N}])([Mm]odel|[Мм]одел\p{L}*)\s+([A-ZА-ЯІЇЄҐ0-9][A-Z0-9]?)(?![\p{L}\p{N}])/gu;
const SAME_LETTER: Record<string, string> = { А: "A", Б: "B", В: "V", С: "C", Д: "D" };

/** The models one line names, by key ("A"), each with the way the document writes it ("Model A"). */
function modelsIn(text: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const m of text.matchAll(DOCUMENT_MODEL)) {
    const key = [...m[2]!].map((c) => SAME_LETTER[c] ?? c).join("");
    if (!found.has(key)) found.set(key, `${m[1]} ${m[2]}`);
  }
  return found;
}

/** A heading: short, and not ending like a sentence. Its section is everything up to the next heading. */
const isHeading = (text: string) => text.trim().length <= 60 && /\p{L}/u.test(text) && !/[.;:,!?]$/u.test(text.trim());

/**
 * The models a question has to be asked back about, or none. It is asked back when the question names no model, the
 * conversation has not settled one, and the lines that come closest to the question say different things for
 * different models. "What is the limit?" reaches the heading "Load Limits", whose section gives Model A 20 units and
 * Model B 12; "What is the minimum load?" reaches one line that covers both models, so it goes to the model as it is.
 */
export function whichModel(question: string, history: Turn[], units: EvidenceUnit[]): string[] {
  if (namesModel(question)) return [];
  const last = history[history.length - 1];
  if (last && (last.status === "needs_clarification" || last.activeEntities.length || namesModel(`${last.question} ${last.resolvedQuery}`)))
    return [];

  const asked = meaningful(question);
  if (!asked.length) return [];
  const scores = units.map((u) => {
    const words = meaningful(u.text);
    return asked.filter((q) => words.some((w) => sameWord(q, w))).length;
  });
  const best = Math.max(0, ...scores);
  if (best === 0) return [];

  // The closest lines, and for a closest heading the lines of its section.
  const pool = new Set<number>();
  units.forEach((unit, i) => {
    if (scores[i] !== best) return;
    pool.add(i);
    if (!isHeading(unit.text)) return;
    for (let j = i + 1; j < units.length && units[j]!.documentId === unit.documentId && !isHeading(units[j]!.text); j++) pool.add(j);
  });

  // What each model's own lines say, with the model's name taken out: the same words for every model is one fact.
  const said = new Map<string, { label: string; lines: Set<string> }>();
  for (const i of pool) {
    const text = units[i]!.text;
    const models = modelsIn(text);
    if (models.size !== 1) continue;
    const [key, label] = [...models][0]!;
    const rest = text.replace(DOCUMENT_MODEL, "").replace(/\s+/g, " ").trim().toLowerCase();
    const entry = said.get(key) ?? { label, lines: new Set<string>() };
    entry.lines.add(rest);
    said.set(key, entry);
  }
  if (said.size < 2) return [];
  const versions = new Set([...said.values()].map((e) => [...e.lines].sort().join("\n")));
  if (versions.size < 2) return [];
  return [...said.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, e]) => e.label);
}

/**
 * A short reply to a clarifying question, joined to the question it answers: "What is the limit? — Model B." The
 * reply has to name a model or one of the options the clarification offered; anything else is a new question.
 */
export function clarifiedQuestion(reply: string, history: Turn[]): string | null {
  const last = history[history.length - 1];
  if (!last || last.status !== "needs_clarification") return null;
  const words = reply.match(WORDS) ?? [];
  if (!words.length || words.length > 5) return null;
  // A reply of its own ("What about the reservoir?") is a question, not a choice.
  if (words.length >= 3 && reply.trim().endsWith("?")) return null;
  const offered = meaningful(last.answer);
  const picks = namesModel(reply) || meaningful(reply).some((w) => offered.some((o) => sameWord(w, o)));
  if (!picks) return null;
  const bare = (text: string) => text.trim().replace(/[?.!…\s]+$/u, "");
  return `${bare(last.question)} — ${bare(reply)}?`;
}

const WHICH: Record<Language, { ask: (options: string) => string; or: string }> = {
  en: { ask: (o) => `Which model do you mean — ${o}?`, or: "or" },
  ru: { ask: (o) => `Какую модель вы имеете в виду — ${o}?`, or: "или" },
  uk: { ask: (o) => `Яку модель ви маєте на увазі — ${o}?`, or: "чи" },
};

/** "Which model do you mean — Model A or Model B?" */
export function whichModelQuestion(language: Language, models: string[]): string {
  const { ask, or } = WHICH[language];
  const rest = [...models];
  const last = rest.pop()!;
  return ask(rest.length ? `${rest.join(", ")} ${or} ${last}` : last);
}

/** A question asked back by code: no model call, no citations, nothing to pay for. */
export function askedBack(answer: string, deep: boolean, resolvedQuery = ""): AnswerResult {
  return {
    status: "needs_clarification",
    basis: "stated",
    answer,
    reason: "",
    citations: [],
    related: [],
    assumed: "",
    didYouMean: "",
    deep: { requested: deep, applied: false },
    resolvedQuery,
    activeEntities: [],
    validation: { passed: true, errors: [], warnings: [], retryReasons: [], rejectedAnswers: [], attempts: 0 },
    usage: { inputTokens: 0, outputTokens: 0, model: "" },
    timings: { llmMs: [], validationMs: 0, totalMs: 0 },
  };
}
