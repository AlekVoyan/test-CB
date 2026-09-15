import { describe, expect, it } from "vitest";
import { askAbout, termsFrom, topicsFrom } from "./topics";

describe("the document's own terms, after a question it had no answer to", () => {
  it("offers a phrase the document uses more than once near the question, in its own words", () => {
    const lines = [
      "Газогенератор обращенного процесса газификации для древесных чурок.",
      "Установка прямого процесса газификации.",
      "Расход древесных чурок составлял 32 кг на 100 км.",
    ];
    expect(termsFrom(lines, lines, "Как работает газогенераторная установка")).toEqual(["процесса газификации", "древесных чурок"]);
  });

  it("skips a phrase used once, function words, and what the question already says", () => {
    const manual = [
      "Replace the filter cartridge of either model every 6 months.",
      "The filter cartridge sits behind the front cover.",
      "Clean the dosing nozzle of Model B every 30 days.",
    ];
    expect(termsFrom(manual, manual, "How long does the battery last?")).toEqual(["filter cartridge"]);
    expect(termsFrom(manual, manual, "When do I change the filter cartridge?")).toEqual([]);
  });

  it("takes no term from a running header the document repeats on every page", () => {
    // Seen in the browser: "kestrel dosing system" was offered after "What is the battery life of Model A?".
    const header = "Kestrel Dosing System — User Manual v1";
    const pages = [header, "Model A: the maximum load is 20 units.", header, "Model B: the maximum load is 12 units.", header];
    expect(termsFrom([header, "Model A: the maximum load is 20 units."], pages, "What is the battery life of Model A?")).toEqual(["maximum load"]);
  });

  it("takes no name for a term, however often the document uses it", () => {
    const intro = "This manual covers two models of the Kestrel Dosing System: Model A and Model B.";
    const pages = [intro, "Kestrel Dosing System — User Manual v1", "Model A: the maximum load is 20 units.", "Model B: the maximum load is 12 units."];
    expect(termsFrom([intro, "Model A: the maximum load is 20 units."], pages, "What is the battery life of Model A?")).toEqual(["maximum load"]);
  });
});

describe("what else the document can answer", () => {
  it("offers the opening of each closest line, in the document's own words", () => {
    const lines = [
      { text: "Розжиг газогенератора занимал 10-14 мин., расход древесных чурок равнялся 53 кг. на 100 км." },
      { text: "Таким образом, его грузоподъемность снизилась с 1500 до 1200 кг." },
      { text: "Model B: the maximum load is 12 units under normal conditions." },
    ];
    expect(topicsFrom(lines)).toEqual([
      "Розжиг газогенератора занимал 10-14 мин",
      "Таким образом",
      "Model B: the maximum load is 12 units under normal",
    ]);
  });

  it("drops a repeat, something too short, and a scrap that starts mid-sentence", () => {
    const lines = [
      { text: "Расход топлива составлял 53 кг." },
      { text: "Расход топлива был выше зимой." },
      { text: "Да." },
      { text: "…лучше подвергнуть долгому испытанию однажды открытую истину" },
      { text: "10. Колосниковая решетка 11. Ось решетки 12. Зольник" },
      { text: "АА, ЗИС-5, ЯГ-4. Из-за потери мощности установка не подошла" },
    ];
    expect(topicsFrom(lines)).toEqual(["Расход топлива составлял 53 кг"]);
  });

  it("takes citations as well as lines, and asks in the answer's language", () => {
    expect(topicsFrom([{ quote: "Nimbus Pro is designed for rooms up to 60 square meters." }], 1)).toEqual([
      "Nimbus Pro is designed for rooms up to 60 square",
    ]);
    expect(askAbout("ru", "расход топлива")).toBe("Что в документе сказано про «расход топлива»?");
    expect(askAbout("en", "filter")).toBe("What does the document say about “filter”?");
  });
});
