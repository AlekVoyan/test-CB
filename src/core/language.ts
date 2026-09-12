// The answer must be spoken in the language the user asked in. Nemotron sometimes answers a Ukrainian question in
// Russian when the turn before it was Russian, and a wrong-language answer is unusable even when every fact in it is
// right. This is a deliberately blunt check: it only fires when an answer carries markers of the other language and
// none of its own, which is what a wholesale slip looks like. A borderline answer is left alone.
import { type Language } from "./config.js";

/** Letters and everyday words that exist in one of the two Cyrillic languages and not in the other. */
const MARKERS: Record<"ru" | "uk", { letters: RegExp; words: RegExp }> = {
  ru: {
    letters: /[ыъэё]/iu,
    words: /(^|\P{L})(что|это|нет|является|составляет|работает|может|если|только|после|указано|единиц|нагрузка)(\P{L}|$)/iu,
  },
  uk: {
    letters: /[іїєґ]/iu,
    words: /(^|\P{L})(що|це|немає|є|становить|працює|може|якщо|тільки|після|вказано|одиниць|навантаження)(\P{L}|$)/iu,
  },
};

const cyrillic = /\p{Script=Cyrillic}/u;
const marks = (text: string, of: "ru" | "uk") => (MARKERS[of].letters.test(text) ? 1 : 0) + (MARKERS[of].words.test(text) ? 1 : 0);

/**
 * True when the answer is plainly written in another language than the one asked for. Short answers are not judged:
 * a few words carry no reliable marker, and a needless retry costs a second model call.
 */
export function wrongAnswerLanguage(answer: string, language: Language): boolean {
  const words = answer.match(/\p{L}+/gu) ?? [];
  if (words.length < 5) return false;
  if (language === "en") return words.filter((w) => cyrillic.test(w)).length / words.length >= 0.5;
  const other = language === "ru" ? "uk" : "ru";
  const cyrillicWords = words.filter((w) => cyrillic.test(w)).length;
  if (cyrillicWords < 5) return cyrillicWords === 0 && words.length >= 5; // an answer in Latin letters is not it either
  return marks(answer, language) === 0 && marks(answer, other) > 0;
}
