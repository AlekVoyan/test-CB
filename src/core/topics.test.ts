import { describe, expect, it } from "vitest";
import { askAbout, topicsFrom } from "./topics";

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
