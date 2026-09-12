import { describe, expect, it } from "vitest";
import { didYouMean, fold, lexiconOf, misheardWords } from "./heard";

const lexicon = (...texts: string[]) => lexiconOf(texts.map((text) => ({ text })));

const manual = lexicon(
  "Model A: the maximum load is 20 units.",
  "Model B: the maximum load is 12 units under normal conditions.",
  "Clean the dosing nozzle of Model B every 30 days.",
  "Replace the filter cartridge of either model every 6 months.",
);
const cv = lexicon(
  "Его самая сильная сторона — внимание к деталям.",
  "Он работает в Будапеште и говорит на трёх языках.",
  "Страница проекта содержит описание работы.",
);

describe("what the recognizer heard", () => {
  it("folds words that sound alike", () => {
    expect(fold("сторона")).toBe(fold("старана"));
    expect(fold("nozzle")).toBe(fold("nozzel"));
    expect(fold("филтр")).toBe(fold("фильтр"));
    expect(fold("страна")).not.toBe(fold("сторона"));
  });

  it("offers the document's word for a misheard one", () => {
    expect(misheardWords("How often should I clean the nozzel?", manual)).toEqual([{ word: "nozzel", candidates: ["nozzle"] }]);
    expect(misheardWords("Какая у него самая сильная старана?", cv)).toEqual([{ word: "старана", candidates: ["сторона"] }]);
  });

  it("offers every fitting word when more than one sounds the same", () => {
    // "палочка" is in neither text and sounds like both words that are.
    const heard = misheardWords("Что сказано про палочка?", lexicon("Балочка держит нагрузку.", "Палачка лежит рядом."));
    expect(heard).toHaveLength(1);
    expect(heard[0]!.candidates.length).toBeGreaterThan(1);
  });

  it("catches a word one sound away, when its spelling is close too", () => {
    // From my own session: recognition heard "онкология" for "аркология", a word of the rules it was asked about.
    const rules = lexicon("Аркология запускается в космос.", "Водородные насосы ставятся на аркологию.");
    expect(misheardWords("Что такое это онкология?", rules)).toEqual([{ word: "онкология", candidates: ["аркология"] }]);
    // sound close, spelling far: not a mishearing
    expect(misheardWords("Что такое металлургия?", rules)).toEqual([]);
    // one fold apart but starting on a different sound: two different words, seen in my own session
    expect(misheardWords("Ну откуда газ появляется?", lexicon("Генераторный газ является топливом для двигателя."))).toEqual([]);
  });

  it("leaves everyday words alone, however short a document's vocabulary is", () => {
    // The eval caught these: "ever" was offered "every" or "never", "does" was offered "days", and the question the
    // model then saw was nonsense.
    expect(misheardWords("Is Model B ever allowed to exceed its normal limit?", manual)).toEqual([]);
    expect(misheardWords("How long does Model B run on battery?", manual)).toEqual([]);
    expect(misheardWords("How often should I replace the filter?", manual)).toEqual([]);
    expect(misheardWords("Сколько это работает, и почему именно так?", cv)).toEqual([]);
  });

  it("never swaps the name of one thing for another (A4 stays not found)", () => {
    expect(misheardWords("What is the maximum load for Model C?", manual)).toEqual([]);
    expect(misheardWords("Какая нагрузка у модели C?", manual)).toEqual([]);
  });

  it("leaves alone a word the documents have, and an ending they do not", () => {
    expect(misheardWords("What is the maximum load?", manual)).toEqual([]);
    expect(misheardWords("How often should I change the filters?", manual)).toEqual([]);
    expect(misheardWords("Clean the nozzles?", manual)).toEqual([]);
  });

  it("asks which word was meant, in the answer's language", () => {
    expect(didYouMean("en", ["nozzle"])).toBe("Did you mean “nozzle”?");
    expect(didYouMean("ru", ["сторона", "страна"])).toBe("Вы имели в виду «сторона» или «страна»?");
    expect(didYouMean("uk", ["сторона", "країна", "сторінка"])).toBe("Ви мали на увазі «сторона», «країна» чи «сторінка»?");
  });
});
