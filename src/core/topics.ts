// What the document does have, when it does not have the answer. A refusal is correct but useless on its own: the
// reader is left guessing what else to ask. The retriever already knows which lines came closest, so their opening
// words are offered back as questions to ask next — the document's own wording, never a paraphrase, and never an
// answer to the question that failed.
import { type Language } from "./config.js";

const MAX_CHARS = 52;
const SCRAP = /^(?:[\s…•·—–\-"'«»()]+|\d+[.)]\s+)+/u;
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
    // Counted on the whole line: a figure legend keeps numbering past the point where the phrase was cut.
    const numbered = (text.match(/\d+\s*\./gu) ?? []).length >= 2;
    const listing = (phrase.match(/,/gu) ?? []).length >= 2;
    const letters = (phrase.match(/\p{L}/gu) ?? []).length / phrase.length;
    const scanNoise = phrase.includes("_");
    if (words.length < 2 || phrase.length < 10 || !/^[\p{Lu}\d]/u.test(phrase) || numbered || listing || scanNoise || letters < 0.6) continue;
    const key = words.slice(0, 2).join(" ").toLowerCase();
    if (out.some((other) => other.toLowerCase().startsWith(key))) continue;
    out.push(phrase);
    if (out.length === max) break;
  }
  return out;
}

// Words that make a poor edge or middle for a term, in the three languages.
const STOP = new Set(
  (
    "и а но или в во на с со по для от до из к ко о об у за при под над про через что как это его ее её их этот эта эти этой " +
    "этого тот та те также был была были было быть не же ли то бы уже только более менее очень таким образом тем однако " +
    "кроме этом всего время году годы годах рис стр і або з із зі від що як це її цей ця ці також був була були було бути " +
    "вже лише дуже the a an of and or to in on for with by from at as is are was were be this that these those it its " +
    "also only more less very every either"
  ).split(" "),
);
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The document's own terms near a question it had no answer to: phrases of two or three words from the closest lines
 * that the document uses at least twice, so a term and not a scrap of a broken line, and that add a word the question
 * did not have. A question asked in those words reaches the lines that use them. On a magazine article, "Как работает
 * газогенераторная установка" got "процесса газификации" and "камеры сгорания", where the openings of the closest
 * lines gave "Их масса колебалась в пределах 400-600 кг"; ranking phrases by the search model's similarity gave
 * scraps that repeated the question. Terms are taken as written, not put back into the nominative.
 */
export function termsFrom(closest: string[], documentLines: string[], question: string, max = 2): string[] {
  const stem = (word: string) => word.toLowerCase().slice(0, 5);
  const asked = new Set((question.match(/\p{L}+/gu) ?? []).map(stem));
  const text = documentLines.join(" ").replace(/\s+/g, " ").toLowerCase();
  const uses = (phrase: string) => (text.match(new RegExp(`(?<!\\p{L})${escapeRe(phrase)}(?!\\p{L})`, "gu")) ?? []).length;
  const found = new Map<string, { inDocument: number; inClosest: number }>();
  // A line the document repeats word for word is a running header or footer ("Kestrel Dosing System — User Manual v1"
  // on every page): it uses its words often and is about nothing.
  const lineCount = new Map<string, number>();
  for (const line of documentLines) lineCount.set(line.trim().toLowerCase(), (lineCount.get(line.trim().toLowerCase()) ?? 0) + 1);
  for (const line of closest) {
    if ((lineCount.get(line.trim().toLowerCase()) ?? 0) >= 2) continue;
    // A clause ends at punctuation and at a number: "Расход древесных чурок составлял 32 кг" gives no "составлял кг".
    for (const clause of line.split(/[,.;:!?()«»"“”—–]|\s-\s|\d+/u)) {
      const words = clause.trim().split(/\s+/).filter((w) => /^\p{L}[\p{L}-]*$/u.test(w));
      for (let size = 2; size <= 3; size++) {
        for (let i = 0; i + size <= words.length; i++) {
          const run = words.slice(i, i + size);
          // short words, function words and a running header in capitals ("ТЕХНИКА И ТЕХНОЛОГИИ") make no term
          if (run.some((w) => w.length < 4 || STOP.has(w.toLowerCase()) || /^\p{Lu}{2,}/u.test(w))) continue;
          if (run.every((w) => asked.has(stem(w)))) continue;
          // every word capitalized is a name ("Kestrel Dosing System"): asking what the document says about it is no lead
          if (run.every((w) => /^\p{Lu}/u.test(w))) continue;
          const phrase = run.join(" ").toLowerCase();
          const seen = found.get(phrase);
          if (seen) seen.inClosest++;
          else found.set(phrase, { inDocument: uses(phrase), inClosest: 1 });
        }
      }
    }
  }
  const terms = [...found.entries()].filter(([, t]) => t.inDocument >= 2);
  return (
    terms
      // "расход древесных чурок", used as often as "древесных чурок", says more
      .filter(([phrase, t]) => !terms.some(([other, o]) => other !== phrase && other.includes(phrase) && o.inDocument >= t.inDocument))
      .sort((a, b) => b[1].inClosest - a[1].inClosest || b[1].inDocument - a[1].inDocument)
      .slice(0, max)
      .map(([phrase]) => phrase)
  );
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

/**
 * What a document can be asked about, before any question has been asked. Headings carry a document's own idea of
 * what it covers — short lines that end without a full stop — and when there are not enough of them, the openings of
 * paragraphs spread through the document stand in. No model call: this is the text that was just indexed.
 */
export function documentTopics(units: { text: string }[], max = 3): string[] {
  // A heading is short, holds more than one word and does not end like a sentence. When a document has none — a plain
  // letter, a page of prose — nothing is suggested: a sentence pulled out of the middle reads as noise, not a topic.
  const headings = units.filter((u) => {
    const t = u.text.trim();
    return t.length <= 60 && t.split(/\s+/).length >= 2 && !/[.;:,]$/u.test(t);
  });
  return topicsFrom(headings, max);
}
