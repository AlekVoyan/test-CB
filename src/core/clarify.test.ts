import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { askedBack, clarifiedQuestion, namesModel, whichModel, whichModelQuestion } from "./clarify";
import type { EvidenceUnit, Turn } from "./types";

/** A fixture's source text as index lines, one per non-empty line, in reading order. */
function source(name: string): EvidenceUnit[] {
  const pages = readFileSync(path.join(process.cwd(), "fixtures", "source", name), "utf8").split("=== PAGE ===");
  return pages.flatMap((page, p) =>
    page
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text, i) => ({ id: `d1:p${p + 1}:s${i + 1}`, documentId: "d1", filename: name, page: p + 1, paragraph: 1, text })),
  );
}

const lines = (...texts: string[]): EvidenceUnit[] =>
  texts.map((text, i) => ({ id: `d1:p1:s${i + 1}`, documentId: "d1", filename: "doc.pdf", page: 1, paragraph: 1, text }));

const manual = source("manual-v1.txt");
const turn = (question: string, status: Turn["status"], answer: string, activeEntities: string[] = []): Turn => ({
  question,
  resolvedQuery: question,
  status,
  answer,
  activeEntities,
});

describe("which model a question is about", () => {
  it("asks back when the closest lines differ by model", () => {
    expect(whichModel("What is the limit?", [], manual)).toEqual(["Model A", "Model B"]);
    expect(whichModel("What is the maximum?", [], manual)).toEqual(["Model A", "Model B"]);
    expect(whichModel("How often should I clean the nozzle?", [], manual)).toEqual(["Model A", "Model B"]);
  });

  it("leaves a question with one answer for every model to the model", () => {
    expect(whichModel("What is the minimum load?", [], manual)).toEqual([]);
    expect(whichModel("What is the operating temperature?", [], manual)).toEqual([]);
    expect(whichModel("Is it waterproof?", [], manual)).toEqual([]);
    expect(whichModel("What is this document about?", [], manual)).toEqual([]);
    expect(whichModel("How many models does it cover?", [], manual)).toEqual([]);
  });

  it("never asks when the question or the conversation names a model", () => {
    expect(whichModel("What is the limit for Model B?", [], manual)).toEqual([]);
    expect(whichModel("What's the max load for model bee?", [], manual)).toEqual([]);
    expect(whichModel("Какой лимит у модели Б?", [], manual)).toEqual([]);
    expect(whichModel("How many units can A handle?", [], manual)).toEqual([]);
    expect(whichModel("What is the limit?", [turn("Tell me about the reservoir", "answered", "…", ["Model A"])], manual)).toEqual([]);
    expect(whichModel("What is the limit?", [turn("What is the maximum for Model A?", "answered", "20 units.")], manual)).toEqual([]);
  });

  it("does not ask twice in a row", () => {
    const asked = turn("What is the limit?", "needs_clarification", "Which model do you mean — Model A or Model B?");
    expect(whichModel("What is the maximum?", [asked], manual)).toEqual([]);
  });

  it("reads the same words for every model as one fact", () => {
    const doc = lines("Filters", "Model A: replace the filter every 6 months.", "Model B: replace the filter every 6 months.");
    expect(whichModel("How often do I replace the filter?", [], doc)).toEqual([]);
  });

  it("finds nothing to ask in a document without models", () => {
    const doc = lines("Filters", "The large unit: replace the filter every 12 months.", "The small unit: replace the filter every 6 months.");
    expect(whichModel("How often do I replace the filter?", [], doc)).toEqual([]);
    expect(namesModel("the model is reset")).toBe(false);
  });

  it("asks in the language of the conversation", () => {
    expect(whichModelQuestion("en", ["Model A", "Model B"])).toBe("Which model do you mean — Model A or Model B?");
    expect(whichModelQuestion("ru", ["Model A", "Model B"])).toBe("Какую модель вы имеете в виду — Model A или Model B?");
    expect(whichModelQuestion("uk", ["Model A", "Model B", "Model C"])).toBe("Яку модель ви маєте на увазі — Model A, Model B чи Model C?");
  });

  it("asks back without a model call", () => {
    const result = askedBack(whichModelQuestion("en", ["Model A", "Model B"]), false, "What is the limit?");
    expect(result).toMatchObject({ status: "needs_clarification", citations: [], resolvedQuery: "What is the limit?" });
    expect(result.validation.attempts).toBe(0);
    expect(result.timings.llmMs).toEqual([]);
  });
});

describe("a reply to a clarifying question", () => {
  const asked = turn("What is the limit?", "needs_clarification", "Which model do you mean — Model A or Model B?");

  it("is joined to the question it answers", () => {
    expect(clarifiedQuestion("Model B.", [asked])).toBe("What is the limit — Model B?");
    expect(clarifiedQuestion("model bee", [asked])).toBe("What is the limit — model bee?");
    expect(clarifiedQuestion("Модель B.", [asked])).toBe("What is the limit — Модель B?");
  });

  it("may choose any option the clarification offered", () => {
    const which = turn("What is the limit?", "needs_clarification", "Which limit do you mean — the load or the reservoir capacity?");
    expect(clarifiedQuestion("The load.", [which])).toBe("What is the limit — The load?");
  });

  it("is left alone when it is not a choice", () => {
    expect(clarifiedQuestion("Thanks", [asked])).toBeNull();
    expect(clarifiedQuestion("What about the reservoir capacity?", [asked])).toBeNull();
    expect(clarifiedQuestion("Actually I wanted to know how to set up Model B", [asked])).toBeNull();
    // A correction after an answer is the model's to read, with the conversation.
    expect(clarifiedQuestion("I meant Model B.", [turn("What is the maximum for Model A?", "answered", "20 units.")])).toBeNull();
    expect(clarifiedQuestion("Model B.", [])).toBeNull();
  });
});
