// A question arrives through speech recognition, which mishears words: "сторона" (side) comes back as "страна"
// (country), "nozzle" as "nozzel". Answering the question that was heard, rather than the one that was asked, is the
// worst failure this product can have — it sounds right and is about something else. So a word the documents do not
// contain is checked against the words they do, and the question either names the assumption or asks which word was
// meant. This runs on the index in the browser: no model call, no key, nothing to pay for.
import { type Language } from "./config.js";
import { editDistance } from "./slips.js";
import type { AnswerResult, EvidenceUnit } from "./types.js";

/** A word of the question the documents do not have, and the words they have that sound like it. */
export interface Misheard {
  word: string;
  /** Best first: the documents' own spelling, at most three. */
  candidates: string[];
}

const WORDS = /\p{L}[\p{L}'’-]*/gu;

/**
 * What two words sound like, roughly. Recognition errors are about sound, not spelling: "сторона" and "страна" are
 * two letters apart but one fold apart. Voiced and voiceless pairs collapse (б/п, д/т, ж/ш, з/с), unstressed vowels
 * collapse (о/а, е/и), soft signs go, and English digraphs reduce (ph → f, ck → k) before the vowels after the first
 * letter are dropped.
 */
export function fold(word: string): string {
  let w = word.toLowerCase().replace(/['’-]/g, "");
  if (/[Ѐ-ӿ]/.test(w)) {
    w = w
      .replace(/[ъь]/g, "")
      .replace(/[ёэ]/g, "е")
      .replace(/[іїы]/g, "и")
      .replace(/є/g, "е")
      .replace(/ґ/g, "г")
      .replace(/щ/g, "ш")
      .replace(/ц/g, "с")
      .replace(/[бп]/g, "п")
      .replace(/[вф]/g, "ф")
      .replace(/[гкх]/g, "к")
      .replace(/[дт]/g, "т")
      .replace(/[жш]/g, "ш")
      .replace(/[зс]/g, "с")
      .replace(/[оа]/g, "а")
      .replace(/[еи]/g, "и")
      .replace(/я/g, "а")
      .replace(/[юу]/g, "у");
  } else {
    w = w
      .replace(/ph/g, "f")
      .replace(/ck/g, "k")
      .replace(/[cq]/g, "k")
      .replace(/x/g, "ks")
      .replace(/z/g, "s")
      .replace(/(?!^)[aeiouy]+/g, "");
  }
  return w.replace(/(.)\1+/g, "$1");
}

/** The documents' own words: how often each is used, and which of them sound alike. */
export interface Lexicon {
  count: Map<string, number>;
  byFold: Map<string, Set<string>>;
}

export function lexiconOf(units: Pick<EvidenceUnit, "text">[]): Lexicon {
  const count = new Map<string, number>();
  const byFold = new Map<string, Set<string>>();
  for (const unit of units) {
    for (const raw of unit.text.match(WORDS) ?? []) {
      const word = raw.toLowerCase();
      count.set(word, (count.get(word) ?? 0) + 1);
      const key = fold(word);
      const set = byFold.get(key) ?? new Set<string>();
      set.add(word);
      byFold.set(key, set);
    }
  }
  return { count, byFold };
}

/** Words that name one of several things a document describes: "Model B" and "Model C" must never be confused. */
const ENTITY_WORDS = new Set(["model", "models", "модель", "модели", "моделі", "type", "version", "версия", "версії"]);
const isIdentifier = (word: string) => word.length <= 2 || /\d/.test(word);

/**
 * Only a long word is worth correcting, and never an everyday one. A three-page manual holds a few hundred words, so
 * most of any language is "not in the documents": the first version of this check offered "every" for "ever" and
 * "days" for "does", turned a direct question into a clarification and, by rewriting the question it fed back into
 * the conversation, cost the follow-up after it too. The eval caught all three.
 */
const MIN_LENGTH = 6;
const EVERYDAY = new Set([
  "should", "shall", "would", "could", "please", "really", "always", "anyone", "anything", "someone", "something",
  "better", "another", "before", "between", "during", "without", "within", "because", "however", "itself", "myself",
  "around", "either", "neither", "though", "through", "across", "besides", "instead", "therefore",
  "который", "которая", "которые", "нужно", "можно", "сколько", "почему", "никогда", "всегда", "вообще", "просто",
  "наверное", "потому", "поэтому", "вместо", "кроме", "однако", "именно", "вообще", "какой", "какая", "какие",
  "який", "яка", "які", "скільки", "чому", "ніколи", "завжди", "взагалі", "мабуть", "проте", "натомість", "окрім",
]);

/**
 * The words of a question the documents do not have, each with the documents' own words that sound like it.
 * A word that only differs from a document word by its ending ("filters" against "filter") is not misheard, and the
 * name of a thing the documents enumerate is never swapped for its neighbour: asked about "Model C", a manual that
 * describes A and B has no answer, and saying "did you mean Model B?" would be the plausible-but-unsupported answer
 * the whole pipeline exists to prevent.
 */
export function misheardWords(question: string, lexicon: Lexicon, options: { max?: number } = {}): Misheard[] {
  const max = options.max ?? 3;
  const tokens = question.match(WORDS) ?? [];
  const out: Misheard[] = [];
  tokens.forEach((raw, i) => {
    const word = raw.toLowerCase();
    if (word.length < MIN_LENGTH || EVERYDAY.has(word) || isIdentifier(word) || lexicon.count.has(word)) return;
    if (ENTITY_WORDS.has(tokens[i - 1]?.toLowerCase() ?? "")) return;
    // Words that sound the same, and words one sound away: recognition turned "аркология" into "онкология", whose
    // folds differ by a letter. To qualify, such a word must also be spelled within two letters of the candidate —
    // sound alone is too loose, spelling alone brought in words that sound nothing alike.
    const key = fold(word);
    const near = new Set<string>(lexicon.byFold.get(key) ?? []);
    for (const [candidate] of lexicon.count) {
      if (near.has(candidate) || Math.abs(candidate.length - word.length) > 2) continue;
      if (editDistance(fold(candidate), key) <= 1 && editDistance(candidate, word) <= 2) near.add(candidate);
    }
    // An ending is not a slip. One word growing out of the other is a form of it, whatever it sounds like ("exceed"
    // against "exceeded", "filters" against "filter"); a difference confined to the last letters that also sounds
    // different is an ending too ("страницу" against "страница"). What is left — a difference inside the word, or one
    // at the end that sounds the same, like "nozzel" for "nozzle" — is what a recognizer does.
    const prefixOf = (a: string, b: string) => a.startsWith(b) || b.startsWith(a);
    const tailOnly = (a: string, b: string) => {
      let n = 0;
      while (n < a.length && n < b.length && a[n] === b[n]) n++;
      return n >= 3 && n >= Math.min(a.length, b.length) - 2;
    };
    const candidates = [...near]
      .filter((c) => c.length >= 4 && !isIdentifier(c) && !EVERYDAY.has(c) && !prefixOf(word, c) && (fold(c) === key || !tailOnly(word, c)))
      .sort((a, b) => {
        const sound = Number(fold(b) === key) - Number(fold(a) === key);
        if (sound) return sound;
        const edits = editDistance(word, a) - editDistance(word, b);
        return edits || (lexicon.count.get(b) ?? 0) - (lexicon.count.get(a) ?? 0);
      })
      .slice(0, max);
    if (candidates.length) out.push({ word, candidates });
  });
  return out;
}

const ASK: Record<Language, { lead: string; or: string }> = {
  en: { lead: "Did you mean", or: "or" },
  ru: { lead: "Вы имели в виду", or: "или" },
  uk: { lead: "Ви мали на увазі", or: "чи" },
};

/** The question asked back when more than one word of the documents fits what was heard. */
export function didYouMean(language: Language, candidates: string[]): string {
  const { lead, or } = ASK[language];
  const quoted = candidates.map((c) => (language === "en" ? `“${c}”` : `«${c}»`));
  const last = quoted.pop()!;
  return `${lead} ${quoted.length ? `${quoted.join(", ")} ${or} ${last}` : last}?`;
}

/** The answer when the question itself is not settled yet: asked back without a model call, so it costs nothing. */
export function heardClarification(language: Language, heard: Misheard, deep: boolean): AnswerResult {
  return {
    status: "needs_clarification",
    basis: "stated",
    answer: didYouMean(language, heard.candidates),
    reason: "",
    citations: [],
    related: [],
    assumed: "",
    didYouMean: "",
    deep: { requested: deep, applied: false },
    resolvedQuery: "",
    activeEntities: [],
    validation: { passed: true, errors: [], warnings: [], retryReasons: [], attempts: 0 },
    usage: { inputTokens: 0, outputTokens: 0, model: "" },
    timings: { llmMs: [], validationMs: 0, totalMs: 0 },
  };
}
