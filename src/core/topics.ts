// What the document does have, when it does not have the answer. A refusal is correct but useless on its own: the
// reader is left guessing what else to ask. The retriever already knows which lines came closest, so their opening
// words are offered back as questions to ask next — the document's own wording, never a paraphrase, and never an
// answer to the question that failed.
import { type Language } from "./config.js";

const MAX_CHARS = 52;
const SCRAP = /^[\s…•·—–\-"'«»()]+/u;
const LEADING = /^(?:и |а |но |the |a )/iu;

/** The opening of a line, short enough to read on a chip: whole words, cut at a comma or a full stop. */
function opening(text: string): string {
  const cleaned = text.trim().replace(SCRAP, "").replace(LEADING, "");
  const stop = cleaned.search(/[,.;:]/u);
  let phrase = stop > 12 ? cleaned.slice(0, stop) : cleaned;
  if (phrase.length > MAX_CHARS) phrase = phrase.slice(0, phrase.lastIndexOf(" ", MAX_CHARS));
  return phrase.trim().replace(/[-–—]$/u, "").trim();
}

/**
 * Up to `max` things the document talks about, taken from the lines that came closest to the question. Lines that
 * open with the same words as another are dropped, and so is anything too short to mean something on its own.
 */
export function topicsFrom(lines: { quote: string }[] | { text: string }[], max = 3): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const text = "quote" in line ? line.quote : line.text;
    const phrase = opening(text);
    const words = phrase.split(/\s+/).filter(Boolean);
    // A phrase that starts mid-sentence reads as a scrap on a chip; so does a figure legend ("10. Решетка 11. Ось")
    // or a run of model codes ("АА, ЗИС-5, ЯГ-4"). The document has better places to point at than those.
    const numbered = (phrase.match(/\d+\s*\./gu) ?? []).length >= 2;
    const listing = (phrase.match(/,/gu) ?? []).length >= 2;
    const letters = (phrase.match(/\p{L}/gu) ?? []).length / phrase.length;
    if (words.length < 2 || phrase.length < 10 || !/^[\p{Lu}\d]/u.test(phrase) || numbered || listing || letters < 0.6) continue;
    const key = words.slice(0, 2).join(" ").toLowerCase();
    if (out.some((other) => other.toLowerCase().startsWith(key))) continue;
    out.push(phrase);
    if (out.length === max) break;
  }
  return out;
}

const ASK_ABOUT: Record<Language, (topic: string) => string> = {
  en: (topic) => `What does the document say about “${topic}”?`,
  ru: (topic) => `Что в документе сказано про «${topic}»?`,
  uk: (topic) => `Що в документі сказано про «${topic}»?`,
};

/** The question a suggestion asks when it is tapped, in the language the answers are being given in. */
export const askAbout = (language: Language, topic: string) => ASK_ABOUT[language](topic);

const CLOSEST: Record<Language, string> = {
  en: "Closest in this document",
  ru: "Ближе всего в этом документе",
  uk: "Найближче в цьому документі",
};

/** The label above the suggestions, in the same language. */
export const closestLabel = (language: Language) => CLOSEST[language];
