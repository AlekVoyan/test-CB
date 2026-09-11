import { describe, expect, it } from "vitest";
import { prepareText, speechPieces, textIds } from "./supertonicText";

describe("text for the on-device voice", () => {
  it("normalizes punctuation and tags the language", () => {
    expect(prepareText("Model A — 20 units", "en")).toBe("<en>Model A - 20 units.</en>");
    expect(prepareText("  Модель B :  15 одиниць!  ", "uk")).toBe("<uk>Модель B: 15 одиниць!</uk>");
  });

  it("keeps the first piece short, cutting at a sentence end, a comma, or between words", () => {
    const answer =
      "У него более 4 лет опыта в веб- и продуктовом дизайне, создании конверсионно-ориентированных веб-сайтов, дашбордов и цифровых сервисов, а также работе с клиентами.";
    expect(speechPieces(answer, 64, 100)).toEqual([
      "У него более 4 лет опыта в веб- и продуктовом дизайне,",
      "создании конверсионно-ориентированных веб-сайтов, дашбордов и цифровых сервисов,",
      "а также работе с клиентами.",
    ]);
    expect(speechPieces("The limit is 20 units. Model B takes 12 units, both stop at the limit.", 40, 100)).toEqual([
      "The limit is 20 units.",
      "Model B takes 12 units, both stop at the limit.",
    ]);
    // cut between words: a comma keeps the sentence going
    expect(speechPieces("one two three four five six seven eight nine ten", 20, 100)).toEqual(["one two three four,", "five six seven eight nine ten"]);
    expect(speechPieces("Model A: 20 units.", 64, 100)).toEqual(["Model A: 20 units."]);
  });

  it("maps characters through the model's indexer, unknown ones to -1", () => {
    const indexer = [];
    indexer[65] = 7; // "A"
    expect(Array.from(textIds("AB", indexer))).toEqual([7n, -1n]);
  });
});
