import { readFileSync } from "node:fs";
import path from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { answerQuestion, spokenAnswer, UNVERIFIED_ANSWER, type LlmClient, type LlmCompletion } from "./answerer.js";
import { AnswerRequestSchema, parseLlmAnswer, type LlmAnswer } from "./contract.js";
import { buildUserPrompt } from "./prompt.js";
import { appendTurn, documentSetKey } from "./conversation.js";
import { ingestPdf } from "./ingest.js";
import { SCANNED_MESSAGE } from "./limits.js";
import { normalizeSpokenQuestion } from "./normalize.js";
import { extractPdf, type PdfjsLike } from "./pdf.js";
import { selectEvidence, tokenize } from "./retriever.js";
import { editDistance, findCorrectedSlip } from "./slips.js";
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

describe("page layout", () => {
  const item = (str: string, x: number, y: number, width: number) => ({ str, transform: [6, 0, 0, 6, x, y], width });
  const onePage = (items: unknown[]): PdfjsLike => ({
    getDocument: () => ({
      promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items }) }) }),
      destroy: async () => {},
    }),
  });
  const lines = async (items: unknown[]) => (await extractPdf(new Uint8Array([1]), onePage(items))).pages[0]!.lines.map((l) => l.text);

  it("reads a sidebar and a main column separately, like a CV", async () => {
    const cv = [
      item("Oleh Dudek", 30, 700, 53), item("EXPERIENCE", 166, 700, 46),
      item("Budapest, Hungary", 30, 690, 50), item("UI/UX Designer", 166, 690, 49), item("2022 – 2025", 537, 690, 32),
      item("Figma", 30, 680, 15), item("Expert", 115, 680, 16), item("Growkal · Remote", 166, 680, 46),
      item("Photoshop", 30, 670, 27), item("Expert", 115, 670, 16),
      item("Designed modern, user-centric interfaces for digital products, ensuring alignment", 166, 670, 407),
      item("Icon generation", 30, 660, 45), item("with business goals and brand positioning.", 166, 660, 150),
      item("Bachelors of Design Engineer", 30, 650, 84), item("Mechanical Design Engineer", 166, 650, 89), item("2011 – 2015", 539, 650, 30),
      item("Aviation Factory “Motor Sich”", 166, 640, 76),
    ];
    expect(await lines(cv)).toEqual([
      "Oleh Dudek",
      "Budapest, Hungary",
      "Figma Expert",
      "Photoshop Expert",
      "Icon generation",
      "Bachelors of Design Engineer",
      "EXPERIENCE",
      "UI/UX Designer 2022 – 2025",
      "Growkal · Remote",
      "Designed modern, user-centric interfaces for digital products, ensuring alignment with business goals and brand positioning.",
      "Mechanical Design Engineer 2011 – 2015",
      "Aviation Factory “Motor Sich”",
    ]);
  });

  it("keeps a one-column page with right-aligned dates as one column, and never wraps a dated line", async () => {
    const resume = [
      item("Experience", 56, 700, 60),
      item("Senior Designer, Acme", 56, 690, 120), item("2019 – 2021", 520, 690, 40),
      item("Led the redesign of the checkout flow and the design system used by four product teams.", 56, 680, 400),
      item("Designer, Beta", 56, 670, 80), item("2016 – 2019", 520, 670, 40),
      item("Built the component library and ran usability tests with customers every sprint.", 56, 660, 380),
      item("Education", 56, 640, 55),
      item("Bachelor of Design, Zaporizhzhia Technical University", 56, 630, 260), item("2011", 544, 630, 16),
      item("Skills: Figma, prototyping, research, design systems, accessibility.", 56, 620, 330),
    ];
    expect(await lines(resume)).toEqual([
      "Experience",
      "Senior Designer, Acme 2019 – 2021",
      "Led the redesign of the checkout flow and the design system used by four product teams.",
      "Designer, Beta 2016 – 2019",
      "Built the component library and ran usability tests with customers every sprint.",
      "Education",
      "Bachelor of Design, Zaporizhzhia Technical University 2011",
      "Skills: Figma, prototyping, research, design systems, accessibility.",
    ]);
  });

  it("reads a two-column section at the foot of a page column by column (Languages | Focus areas)", async () => {
    const page = [
      item("About me", 56, 700, 44),
      item("Designer with four years of experience in web and product design, building websites and", 56, 690, 484),
      item("dashboards for digital services.", 56, 680, 144),
      item("Experience", 56, 670, 54),
      item("Senior Designer, Acme", 56, 660, 120), item("2019 – 2021", 500, 660, 40),
      item("Led the redesign of the checkout flow and the design system.", 56, 650, 344),
      item("ADDITIONAL INFO", 56, 620, 74),
      item("Languages", 56, 610, 44), item("Focus Areas", 300, 610, 50),
      item("English – Intermediate (working with clients in", 56, 600, 224), item("Web & product interfaces for SaaS and education", 300, 600, 240),
      item("written form)", 56, 590, 54), item("Conversion-oriented landing pages", 300, 590, 200),
      item("Ukrainian – Native", 56, 580, 84), item("Design systems and component libraries", 300, 580, 220),
      item("Russian – Fluent", 56, 570, 74), item("No-code implementation", 300, 570, 120),
    ];
    expect(await lines(page)).toEqual([
      "About me",
      "Designer with four years of experience in web and product design, building websites and dashboards for digital services.",
      "Experience",
      "Senior Designer, Acme 2019 – 2021",
      "Led the redesign of the checkout flow and the design system.",
      "ADDITIONAL INFO",
      "Languages",
      "English – Intermediate (working with clients in written form)",
      "Ukrainian – Native",
      "Russian – Fluent",
      "Focus Areas",
      "Web & product interfaces for SaaS and education",
      "Conversion-oriented landing pages",
      "Design systems and component libraries",
      "No-code implementation",
    ]);
  });

  it("never splits a label–value table into two columns", async () => {
    const skills = [
      item("Skills and tools", 56, 700, 84),
      item("Figma", 56, 690, 24), item("Expert", 300, 690, 30),
      item("Adobe XD, Sketch", 56, 680, 74), item("Advanced", 300, 680, 40),
      item("Photoshop", 56, 670, 44), item("Expert", 300, 670, 30),
      item("After Effects, LottieFiles", 56, 660, 114), item("Intermediate", 300, 660, 50),
      item("Blender 3D", 56, 650, 49), item("Intermediate", 300, 650, 50),
    ];
    expect(await lines(skills)).toEqual([
      "Skills and tools",
      "Figma Expert",
      "Adobe XD, Sketch Advanced",
      "Photoshop Expert",
      "After Effects, LottieFiles Intermediate",
      "Blender 3D Intermediate",
    ]);
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
const BLANK: LlmAnswer = {
  analysis: "",
  status: "answered",
  basis: "stated",
  answer: "",
  reason: "",
  citations: [],
  related: [],
  assumed: "",
  resolvedQuery: "q",
  activeEntities: [],
};
const check = (out: Partial<LlmAnswer>, question = "What is the maximum for Model A?") =>
  validateLlmAnswer({ ...BLANK, ...out }, { question, evidenceById, maxWords: 45, maxCitations: 3 });

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
    // about the question, not the documents: steer to a clarification
    const clarify = /the status is "needs_clarification", not "not_found"/;
    expect(check({ status: "not_found", answer: "The question does not specify which limit is meant." }).errors.join()).toMatch(clarify);
    expect(check({ status: "not_found", answer: "The uploaded documents do not specify what limit is being asked about." }).errors.join()).toMatch(clarify);
    expect(check({ status: "not_found", answer: "No." }).errors.join()).toMatch(/must say explicitly/);
    // any kind of document counts, in any of the three languages
    expect(check({ status: "not_found", answer: "The CV does not mention a salary." }).errors).toEqual([]);
    expect(check({ status: "not_found", answer: "В резюме не указано, сколько он зарабатывал." }).errors).toEqual([]);
    expect(check({ status: "not_found", answer: "The manual does not specify the battery life you are asking about." }).errors).toEqual([]);
    expect(check({ status: "needs_clarification", answer: "Model A or Model B." }).errors.join()).toMatch(/must ask which option/);
    expect(check({ status: "needs_clarification", answer: "Please specify which model you mean: Model A or Model B." }).errors).toEqual([]);
    expect(check({ status: "conflict", answer: "20 units.", citations: ["d1:p2:s2"] }).errors.join()).toMatch(/two different documents/);
    expect(check({ status: "conflict", answer: "v1 says 20 units, v2 says 24 units.", citations: ["d1:p2:s2", "d2:p2:s2"] }).errors).toEqual([]);
  });
});

describe("reasoning fields", () => {
  const q = "Can Model A run at 25 units?";
  it("accepts an inferred answer that names its rule, and checks the numbers in the rule", () => {
    const out = { basis: "inferred" as const, answer: "No, 25 units is over the limit.", reason: "Model A's maximum load is 20 units.", citations: ["d1:p2:s2"] };
    expect(check(out, q).errors).toEqual([]);
    expect(check({ ...out, reason: "" }, q).errors.join()).toMatch(/needs a one-sentence "reason"/);
    expect(check({ ...out, reason: "The limit is 22 units." }, q).errors.join()).toMatch(/number 22/);
  });
  it("ignores reasoning marks on answers that are not answers", () => {
    const clarify = { status: "needs_clarification" as const, answer: "Model A or Model B?" };
    expect(check({ ...clarify, basis: "inferred", reason: "r", assumed: "nozzle" }).errors).toEqual([]);
  });
  it("points a not-found answer that cites its own inference at the answered status", () => {
    const out = {
      status: "not_found" as const,
      basis: "inferred" as const,
      answer: "The manual does not specify it.",
      reason: "The maximum load is 20 units.",
      citations: ["d1:p2:s2"],
    };
    expect(check(out).errors.join()).toMatch(/gave this reason: "The maximum load is 20 units."\. If the cited lines decide the question, answer it/);
  });
  it("lets related lines back numbers only on a not-found answer", () => {
    const notFound = { status: "not_found" as const, answer: "The manual does not specify battery life. Model B's maximum load is 12 units." };
    expect(check({ ...notFound, related: ["d1:p2:s3"] }).errors).toEqual([]);
    expect(check(notFound).errors.join()).toMatch(/number 12/);
    expect(check({ ...notFound, related: ["d9:p9:s9"] }).errors.join()).toMatch(/Unknown related id/);
    expect(check({ answer: "Model B handles 12 units.", citations: ["d1:p2:s2"], related: ["d1:p2:s3"] }).errors.join()).toMatch(/number 12/);
  });
});

describe("slips", () => {
  const nozzle = [unit("d1:p3:s7", "Clean the dosing nozzle of Model B every 30 days.", "doc1", 3)];
  it("finds a word the model corrected to a document word", () => {
    expect(findCorrectedSlip("How often should I clean the nozzel on Model B?", "How often should I clean the nozzle on Model B?", nozzle)).toBe("nozzle");
  });
  it("ignores paraphrases, inflections and words the documents use", () => {
    expect(findCorrectedSlip("How often do I clean it?", "How often should I clean the dosing nozzle of Model B?", nozzle)).toBeNull();
    expect(findCorrectedSlip("Cleaning the nozzles?", "How often should I clean the nozzle?", nozzle)).toBeNull();
  });
  it("counts a swap of two letters as one edit", () => {
    expect(editDistance("nozzel", "nozzle")).toBe(1);
    expect(editDistance("kitten", "sitting")).toBe(3);
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

function fakeLlm(outputs: Partial<LlmAnswer>[], supportsDeep = false): LlmClient & { calls: number; deepSeen: boolean[] } {
  const llm = {
    calls: 0,
    deepSeen: [] as boolean[],
    supportsDeep,
    async complete(request: { deep?: boolean }): Promise<LlmCompletion> {
      const out: LlmAnswer = { ...BLANK, ...outputs[llm.calls] };
      llm.deepSeen.push(!!request.deep);
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

  it("files the model's related lines with a not-found answer, never as citations", async () => {
    const answer = "The manual does not specify battery life. Model B's maximum load is 12 units.";
    const llm = fakeLlm([{ status: "not_found", answer, related: ["d1:p2:s3"] }]);
    const result = await answerQuestion({ question: "How long does Model B run on battery?", history: [], evidence, llm });
    expect(result.citations).toEqual([]);
    expect(result.related.map((c) => c.quote)).toEqual(["Model B: the maximum load is 12 units under normal conditions."]);
  });

  it("drops a related line the answer never talks about", async () => {
    const llm = fakeLlm([{ status: "not_found", answer: "The manual does not specify battery life.", related: ["d1:p2:s3"] }]);
    const result = await answerQuestion({ question: "How long does Model B run on battery?", history: [], evidence, llm });
    expect(result.related).toEqual([]);
  });

  it("accepts a clarifying request and shows no quotes with it", async () => {
    const llm = fakeLlm([
      { status: "needs_clarification", answer: "Please specify which model: Model A (20 units) or Model B (12 units).", citations: ["d1:p2:s2", "d1:p2:s3"] },
    ]);
    const result = await answerQuestion({ question: "What is the limit?", history: [], evidence, llm });
    expect(result).toMatchObject({ status: "needs_clarification", citations: [] });
    expect(result.validation.attempts).toBe(1);
  });

  it("names a slip the model fixed without saying so", async () => {
    const withNozzle = [...evidence, unit("d1:p3:s7", "Clean the dosing nozzle of Model B every 30 days.", "doc1", 3)];
    const llm = fakeLlm([{ answer: "Every 30 days.", citations: ["d1:p3:s7"], resolvedQuery: "How often should I clean the nozzle on Model B?" }]);
    const result = await answerQuestion({ question: "How often should I clean the nozzel on Model B?", history: [], evidence: withNozzle, llm });
    expect(result).toMatchObject({ assumed: "nozzle", answer: "Assuming you meant “nozzle”: Every 30 days." });
  });

  it("speaks the reason after an inferred answer only", () => {
    expect(spokenAnswer({ basis: "inferred", answer: "No.", reason: "The range is 5°C to 35°C." })).toBe("No. The range is 5°C to 35°C.");
    expect(spokenAnswer({ basis: "stated", answer: "20 units.", reason: "ignored" })).toBe("20 units.");
  });

  it("keeps reasoning marks on answers only", async () => {
    const llm = fakeLlm([{ status: "needs_clarification", basis: "inferred", reason: "r", assumed: "nozzle", answer: "Model A or Model B?" }]);
    const result = await answerQuestion({ question: "How often should I clean the nozzel?", history: [], evidence, llm });
    expect(result).toMatchObject({ status: "needs_clarification", basis: "stated", reason: "", assumed: "" });
  });

  it("asks for Think harder only when the model can reason first", async () => {
    const out = { answer: "Model A handles 20 units.", citations: ["d1:p2:s2"] };
    const plain = fakeLlm([out]);
    expect((await answerQuestion({ question: "Q?", history: [], evidence, llm: plain, deep: true })).deep).toEqual({ requested: true, applied: false });
    expect(plain.deepSeen).toEqual([false]);
    const thinker = fakeLlm([out], true);
    expect((await answerQuestion({ question: "Q?", history: [], evidence, llm: thinker, deep: true })).deep).toEqual({ requested: true, applied: true });
    expect(thinker.deepSeen).toEqual([true]);
  });
});

describe("parseLlmAnswer", () => {
  const valid: LlmAnswer = { ...BLANK, answer: "20 units.", citations: ["d1:p2:s2"], activeEntities: ["Model A"] };
  it("accepts plain JSON and JSON wrapped in a code fence", () => {
    expect(parseLlmAnswer(JSON.stringify(valid))).toEqual(valid);
    expect(parseLlmAnswer("```json\n" + JSON.stringify(valid) + "\n```")).toEqual(valid);
    expect(parseLlmAnswer(JSON.stringify({ ...valid, citations: [" [d1:p2:s2] "] }))?.citations).toEqual(["d1:p2:s2"]);
    expect(parseLlmAnswer(JSON.stringify({ ...valid, related: ["[d1:p2:s3]"] }))?.related).toEqual(["d1:p2:s3"]);
    expect(parseLlmAnswer(JSON.stringify({ ...valid, citations: [":d1:p2:s2", "d1:p2:s3."] }))?.citations).toEqual(["d1:p2:s2", "d1:p2:s3"]);
  });
  it("rejects text and objects that break the contract", () => {
    expect(parseLlmAnswer("The answer is 20 units.")).toBeNull();
    expect(parseLlmAnswer(JSON.stringify({ ...valid, status: "maybe" }))).toBeNull();
    expect(parseLlmAnswer(JSON.stringify({ ...valid, basis: "guessed" }))).toBeNull();
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
    expect(parsed.deep).toBe(false);
  });
});
