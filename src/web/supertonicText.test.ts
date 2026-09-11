import { describe, expect, it } from "vitest";
import { chunkText, prepareText, textIds } from "./supertonicText";

describe("text for the on-device voice", () => {
  it("normalizes punctuation and tags the language", () => {
    expect(prepareText("Model A — 20 units", "en")).toBe("<en>Model A - 20 units.</en>");
    expect(prepareText("  Модель B :  15 одиниць!  ", "uk")).toBe("<uk>Модель B: 15 одиниць!</uk>");
  });

  it("splits at sentence ends, keeping pieces under the limit", () => {
    const text = "The limit is 20 units. Model B takes 12 units. Both stop at the limit.";
    expect(chunkText(text, 50)).toEqual(["The limit is 20 units. Model B takes 12 units.", "Both stop at the limit."]);
    expect(chunkText(text, 500)).toEqual([text]);
  });

  it("maps characters through the model's indexer, unknown ones to -1", () => {
    const indexer = [];
    indexer[65] = 7; // "A"
    expect(Array.from(textIds("AB", indexer))).toEqual([7n, -1n]);
  });
});
