import { readFileSync } from "node:fs";
import path from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { answerQuestion, UNVERIFIED_ANSWER, type LlmClient, type LlmCompletion } from "./answerer.js";
import { AnswerRequestSchema, parseLlmAnswer, type LlmAnswer } from "./contract.js";
import { buildUserPrompt } from "./prompt.js";
import { appendTurn, documentSetKey } from "./conversation.js";
import { ingestPdf } from "./ingest.js";
import { SCANNED_MESSAGE } from "./limits.js";
import { normalizeSpokenQuestion } from "./normalize.js";
import { selectEvidence, tokenize } from "./retriever.js";
import type { EvidenceUnit, IndexedDocument, Turn } from "./types.js";
import { validateLlmAnswer, verifyCitations } from "./validator.js";

const fixture = (name: string) => new Uint8Array(readFileSync(path.join(process.cwd(), "fixtures", name)));

let keyCounter = 0;
function load(name: string, existing: { pageCount: number }[] = []): Promise<IndexedDocument> {
  keyCounter++;
  return ingestPdf({
    bytes: fixture(name),
    filename: name,
    documentId: `${name}#${keyCounter}`,
    docKey: `d${keyCounter}`,
    existing,
    pdfjs,
  });
}

const pageText = (doc: IndexedDocument, page: number) => doc.pages.find((p) => p.page === page)!.text;

describe("ingestion", () => {
  it("extracts manual v1 page by page", async () => {
    const doc = await load("manual-v1.pdf");
    expect(doc.pageCount).toBe(3);
    expect(pageText(doc, 1)).toContain("Step 2. Press and hold the SETUP button for 3 seconds until the status light blinks green.");
    expect(pageText(doc, 2)).toContain("Model A: the maximum load is 20 units.");
    expect(pageText(doc, 3)).toContain("Clean the dosing nozzle of Model B every 30 days.");
  });

  it("keeps a line wrapped at the margin as one evidence unit", async () => {
    const doc = await load("manual-v1.pdf");
    const exception = doc.units.find((u) => u.text.startsWith("Exception:"));
    expect(exception?.text).toBe(
      "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C.",
    );
    expect(exception?.page).toBe(3);
    expect(doc.units.some((u) => u.text === "Step 4. Press START.")).toBe(true);
  });

  it("every unit is a substring of its page and ids are unique", async () => {
    for (const name of ["manual-v1.pdf", "manual-v2.pdf", "holdout-nimbus.pdf"]) {
      const doc = await load(name);
      for (const u of doc.units) expect(pageText(doc, u.page)).toContain(u.text);
      expect(new Set(doc.units.map((u) => u.id)).size).toBe(doc.units.length);
    }
  });

  it("manual v2 changes the Model A limit", async () => {
    const doc = await load("manual-v2.pdf");
    expect(pageText(doc, 2)).toContain("Model A: the maximum load is 24 units.");
    expect(pageText(doc, 2)).not.toContain("20 units");
  });

  it("I1: rejects a third file", async () => {
    const v1 = await load("manual-v1.pdf");
    const v2 = await load("manual-v2.pdf", [v1]);
    await expect(load("holdout-nimbus.pdf", [v1, v2])).rejects.toThrow(/Up to 2 PDFs/);
  });

  it("I2: rejects more than 10 pages in total", async () => {
    const v1 = await load("manual-v1.pdf");
    await expect(load("filler-8p.pdf", [v1])).rejects.toThrow(/At most 10 pages in total/);
  });

  it("I3: rejects a PDF without a text layer", async () => {
    await expect(load("image-only.pdf")).rejects.toThrow(SCANNED_MESSAGE);
  });

  it("rejects bytes that are not a PDF", async () => {
    await expect(
      ingestPdf({ bytes: new TextEncoder().encode("hello"), filename: "x.pdf", documentId: "x", docKey: "dx", existing: [], pdfjs }),
    ).rejects.toThrow(/Only PDF files/);
  });
});

describe("tokenizer", () => {
  it("keeps single-letter model names", () => {
    expect(tokenize("What is the maximum for Model A?")).toContain("model_a");
    expect(tokenize("How many units can A handle?")).toContain("model_a");
    expect(tokenize("What's the max load for model bee?")).toContain("model_b");
    expect(tokenize("A filter must be replaced.")).not.toContain("model_a");
  });

  it("restores spoken letters after 'model' without touching ordinary words", () => {
    expect(normalizeSpokenQuestion("What's the max load for model bee?")).toBe("What's the max load for model B?");
    expect(normalizeSpokenQuestion("And Model see?")).toBe("And Model C?");
    expect(normalizeSpokenQuestion("Should the model be reset?")).toBe("Should the model be reset?");
  });
});

describe("retriever", () => {
  it("full mode sends the whole corpus in document order", async () => {
    const doc = await load("manual-v1.pdf");
    const sel = selectEvidence([doc], "How many units can A handle?", { mode: "full" });
    expect(sel.mode).toBe("full");
    expect(sel.units).toEqual(doc.units);
  });

  it("topk mode finds the Model A limit for a paraphrase", async () => {
    const doc = await load("manual-v1.pdf");
    const sel = selectEvidence([doc], "How many units can A handle?", { mode: "topk", topK: 2 });
    expect(sel.units.some((u) => u.text === "Model A: the maximum load is 20 units.")).toBe(true);
  });
});

function unit(id: string, text: string, documentId = "doc1", page = 2): EvidenceUnit {
  return { id, documentId, filename: `${documentId}.pdf`, page, paragraph: 1, text };
}

const evidence = [
  unit("d1:p2:s2", "Model A: the maximum load is 20 units."),
  unit("d1:p2:s3", "Model B: the maximum load is 12 units under normal conditions."),
  unit("d2:p2:s2", "Model A: the maximum load is 24 units.", "doc2"),
];
const evidenceById = new Map(evidence.map((u) => [u.id, u]));
const check = (out: Partial<LlmAnswer>, question = "What is the maximum for Model A?") =>
  validateLlmAnswer(
    { status: "answered", answer: "", citations: [], resolvedQuery: "", activeEntities: [], ...out },
    { question, evidenceById, maxWords: 45, maxCitations: 3 },
  );

describe("validator", () => {
  it("accepts a supported answer", () => {
    expect(check({ answer: "The maximum load for Model A is 20 units.", citations: ["d1:p2:s2"] }).errors).toEqual([]);
  });
  it("rejects unknown ids and missing citations", () => {
    expect(check({ answer: "It is 20 units.", citations: ["d9:p9:s9"] }).errors.join()).toMatch(/Unknown evidence id/);
    expect(check({ answer: "It is 20 units.", citations: [] }).errors.join()).toMatch(/at least one citation/);
  });
  it("rejects a number that no cited line contains", () => {
    expect(check({ answer: "Model A handles 22 units.", citations: ["d1:p2:s2"] }).errors.join()).toMatch(/number 22/);
    // a mis-cited number: the retry hint names the line that holds it
    expect(check({ answer: "Model B handles 12 units.", citations: ["d1:p2:s2"] }).errors.join()).toMatch(/Lines that contain 12: \[d1:p2:s3\]/);
  });
  it("allows numbers from the question and ignores 'the other one'", () => {
    expect(check({ answer: "No, not at 25 units.", citations: ["d1:p2:s2"] }, "Can Model A run at 25 units?").errors).toEqual([]);
    expect(check({ answer: "The other one handles 12 units.", citations: ["d1:p2:s3"] }).errors).toEqual([]);
  });
  it("enforces the status rules", () => {
    expect(check({ status: "not_found", answer: "The manual does not specify it.", citations: ["d1:p2:s2"] }).errors.join()).toMatch(/empty citations/);
    expect(check({ status: "not_found", answer: "Twenty units." }).errors.join()).toMatch(/say explicitly/);
    expect(check({ status: "not_found", answer: "The uploaded manual does not specify battery life." }).errors).toEqual([]);
    expect(check({ status: "needs_clarification", answer: "Model A or Model B." }).errors.join()).toMatch(/must be a question/);
    expect(check({ status: "conflict", answer: "20 units.", citations: ["d1:p2:s2"] }).errors.join()).toMatch(/two different documents/);
    expect(check({ status: "conflict", answer: "v1 says 20 units, v2 says 24 units.", citations: ["d1:p2:s2", "d2:p2:s2"] }).errors).toEqual([]);
  });
});

describe("verifyCitations", () => {
  it("catches a tampered quote", async () => {
    const doc = await load("manual-v1.pdf");
    const real = doc.units.find((u) => u.text.includes("20 units"))!;
    const citation = { documentId: doc.documentId, filename: doc.filename, page: real.page, sentenceId: real.id, quote: real.text };
    expect(verifyCitations([citation], [doc])).toEqual([]);
    expect(verifyCitations([{ ...citation, quote: "Model A: the maximum load is 22 units." }], [doc])[0]).toMatch(/not an exact substring/);
    expect(verifyCitations([{ ...citation, page: 9 }], [doc])[0]).toMatch(/does not exist/);
  });
});

describe("conversation", () => {
  it("changes the document-set key on replacement and keeps the last turns", () => {
    expect(documentSetKey([{ documentId: "a" }])).not.toBe(documentSetKey([{ documentId: "b" }]));
    const turn: Turn = { question: "q", resolvedQuery: "q", status: "answered", answer: "a", activeEntities: [] };
    let history: Turn[] = [];
    for (let i = 0; i < 6; i++) history = appendTurn(history, { ...turn, question: `q${i}` });
    expect(history.map((t) => t.question)).toEqual(["q2", "q3", "q4", "q5"]);
  });
});

function fakeLlm(outputs: Partial<LlmAnswer>[]): LlmClient & { calls: number } {
  const llm = {
    calls: 0,
    async complete(): Promise<LlmCompletion> {
      const out = { status: "answered", answer: "", citations: [], resolvedQuery: "q", activeEntities: [], ...outputs[llm.calls] } as LlmAnswer;
      llm.calls++;
      return { parsed: out, rawText: JSON.stringify(out), inputTokens: 100, outputTokens: 20, latencyMs: 1, model: "fake", stopReason: "end_turn" };
    },
  };
  return llm;
}

describe("answerer", () => {
  it("retries once with the validator's findings", async () => {
    const llm = fakeLlm([
      { answer: "Model A handles 22 units.", citations: ["d1:p2:s2"] },
      { answer: "Model A handles 20 units.", citations: ["d1:p2:s2"] },
    ]);
    const result = await answerQuestion({ question: "What is the maximum for Model A?", history: [], evidence, llm });
    expect(llm.calls).toBe(2);
    expect(result.validation).toMatchObject({ passed: true, attempts: 2 });
    expect(result.citations[0]?.quote).toBe("Model A: the maximum load is 20 units.");
    expect(result.usage.inputTokens).toBe(200);
  });

  it("never returns an unverified answer", async () => {
    const llm = fakeLlm([
      { answer: "Model A handles 22 units.", citations: ["d1:p2:s2"] },
      { answer: "Model A handles 21 units.", citations: ["d1:p2:s2"] },
    ]);
    const result = await answerQuestion({ question: "What is the maximum for Model A?", history: [], evidence, llm });
    expect(result).toMatchObject({ status: "not_found", answer: UNVERIFIED_ANSWER, citations: [] });
    expect(result.validation.passed).toBe(false);
  });
});

describe("parseLlmAnswer", () => {
  const valid = { status: "answered", answer: "20 units.", citations: ["d1:p2:s2"], resolvedQuery: "q", activeEntities: ["Model A"] };
  it("accepts plain JSON and JSON wrapped in a code fence", () => {
    expect(parseLlmAnswer(JSON.stringify(valid))).toEqual(valid);
    expect(parseLlmAnswer("```json\n" + JSON.stringify(valid) + "\n```")).toEqual(valid);
    expect(parseLlmAnswer(JSON.stringify({ ...valid, citations: [" [d1:p2:s2] "] }))?.citations).toEqual(["d1:p2:s2"]);
  });
  it("rejects text and objects that break the contract", () => {
    expect(parseLlmAnswer("The answer is 20 units.")).toBeNull();
    expect(parseLlmAnswer(JSON.stringify({ ...valid, status: "maybe" }))).toBeNull();
  });
});

describe("languages", () => {
  it("accepts a not-found answer in Russian and Ukrainian, and still demands that it says so", () => {
    expect(check({ status: "not_found", answer: "В загруженных документах это не указано." }).errors).toEqual([]);
    expect(check({ status: "not_found", answer: "У завантажених документах цього не зазначено." }).errors).toEqual([]);
    expect(check({ status: "not_found", answer: "Двадцать единиц." }).errors.join()).toMatch(/say explicitly/);
  });
  it("tokenizes Cyrillic questions and keeps model letters", () => {
    const tokens = tokenize("Какая максимальная нагрузка у модели A?");
    expect(tokens).toContain("model_a");
    expect(tokens).toContain("нагрузка");
    expect(tokenize("Яке навантаження моделі Б?")).toContain("model_b");
  });
  it("names the answer language in the prompt and defaults requests to English", () => {
    expect(buildUserPrompt("Q?", [], evidence, "uk")).toContain("<answer_language>Ukrainian</answer_language>");
    const parsed = AnswerRequestSchema.parse({ question: "Q?", history: [], evidence });
    expect(parsed.language).toBe("en");
  });
});
