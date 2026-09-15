import { describe, expect, it } from "vitest";
import { wrongAnswerLanguage, wrongReasonLanguage } from "./language";

describe("the answer's language", () => {
  it("catches a Russian answer to a Ukrainian question", () => {
    expect(wrongAnswerLanguage("Максимальная нагрузка модели A составляет 20 единиц.", "uk")).toBe(true);
  });

  it("catches a Ukrainian answer to a Russian question", () => {
    expect(wrongAnswerLanguage("Максимальне навантаження моделі A становить 20 одиниць.", "ru")).toBe(true);
  });

  it("catches an English question answered in Russian, and the other way round", () => {
    expect(wrongAnswerLanguage("Максимальная нагрузка модели A составляет 20 единиц.", "en")).toBe(true);
    expect(wrongAnswerLanguage("The maximum load for Model A is 20 units.", "ru")).toBe(true);
  });

  it("leaves a right-language answer alone", () => {
    expect(wrongAnswerLanguage("Максимальне навантаження моделі A становить 20 одиниць.", "uk")).toBe(false);
    expect(wrongAnswerLanguage("Максимальная нагрузка модели A составляет 20 единиц.", "ru")).toBe(false);
    expect(wrongAnswerLanguage("The maximum load for Model A is 20 units.", "en")).toBe(false);
    // a model name in Latin letters inside a Ukrainian answer
    expect(wrongAnswerLanguage("Модель Nimbus Pro розрахована на приміщення до 60 квадратних метрів.", "uk")).toBe(false);
  });

  it("does not judge an answer too short to carry a marker", () => {
    expect(wrongAnswerLanguage("20 единиц.", "uk")).toBe(false);
    expect(wrongAnswerLanguage("Model A: 20 units.", "ru")).toBe(false);
  });
});

describe("the reason's language", () => {
  it("catches an English reason under a Russian answer, which the answer's check lets through", () => {
    // Seen with Nemotron: a Russian answer, then the reason in English, read aloud with Russian phonetics.
    const answer = "Расход топлива зависит от модели: для ГАЗ-42 он составляет около 53 кг древесных чурок на 100 км.";
    const reason = "Fuel consumption differs between the models listed in the table.";
    expect(wrongAnswerLanguage(`${answer} ${reason}`, "ru")).toBe(false);
    expect(wrongReasonLanguage(reason, "ru")).toBe(true);
    expect(wrongReasonLanguage(reason, "uk")).toBe(true);
    expect(wrongReasonLanguage("Діапазон роботи моделі B від 5 до 35 °C.", "en")).toBe(true);
  });

  it("leaves a reason in the right alphabet alone, with a model name in Latin letters inside it", () => {
    expect(wrongReasonLanguage("Рабочий диапазон Model B указан в разделе про эксплуатацию.", "ru")).toBe(false);
    expect(wrongReasonLanguage("The operating range of Model B is 5 to 35°C.", "en")).toBe(false);
    expect(wrongReasonLanguage("", "ru")).toBe(false);
    expect(wrongReasonLanguage("Model B.", "ru")).toBe(false);
  });
});
