import { describe, expect, it } from "vitest";
import { wrongAnswerLanguage } from "./language";

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
