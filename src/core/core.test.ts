import { readFileSync } from "node:fs";
import path from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";
import { answerQuestion, spokenAnswer, UNVERIFIED_ANSWER, unverifiedAnswer, type LlmClient, type LlmCompletion } from "./answerer.js";
import { AnswerRequestSchema, parseLlmAnswer, type LlmAnswer } from "./contract.js";
import { buildUserPrompt } from "./prompt.js";
import { appendTurn, documentSetKey } from "./conversation.js";
import { ingestPdf } from "./ingest.js";
import { SCANNED_MESSAGE } from "./limits.js";
import { normalizeSpokenQuestion } from "./normalize.js";
import { extractPdf, type PdfjsLike } from "./pdf.js";
import { selectEvidence, tokenize } from "./retriever.js";
import { editDistance, findCorrectedSlip } from "./slips.js";
import { groupPassages } from "./passages.js";
import type { Citation, EvidenceUnit, IndexedDocument, Turn } from "./types.js";
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

  it("reads a scanned magazine page column by column, though its gutter is narrower than two font sizes", async () => {
    // The geometry of a real scan (Leonora, Weird Tales 1927): 5pt type, a 7pt gutter, the running header crossing it,
    // and the two columns' baselines a point apart, so every row of the page holds a piece of both.
    const small = (str: string, x: number, y: number) => ({ str, transform: [5, 0, 0, 5, x, y], width: 91 });
    const left = ["There was still no breath of spring", "in the air on that night. The snow", "lay in the hollows, unmelted, and", "the road was empty from end to end.", "I did not go to Margaret's house."];
    const right = ["I had entered the car. I sat", "beside him, and the moon shone", "out brightly on the narrow road.", "I met with no success at all.", "He said nothing as we drove."];
    const scan = [
      { str: "LEONORA 95", transform: [5, 0, 0, 5, 101, 321], width: 108 },
      ...left.map((str, i) => small(str, 21, 308 - i * 7)),
      ...right.map((str, i) => small(str, 119, 307 - i * 7)),
    ];
    expect(await lines(scan)).toEqual([
      "LEONORA 95",
      "There was still no breath of spring in the air on that night. The snow lay in the hollows, unmelted, and the road was empty from end to end.",
      "I did not go to Margaret's house.",
      "I had entered the car. I sat beside him, and the moon shone out brightly on the narrow road.",
      "I met with no success at all.",
      "He said nothing as we drove.",
    ]);
  });

  it("keeps a sentence together across an abbreviation, even when a name follows it", async () => {
    // A Russian magazine column: "в сентябре 1938г." is not the end of anything, and what follows is a surname.
    const wide = (str: string, y: number) => ({ str, transform: [5, 0, 0, 5, 21, y], width: 91 });
    const page = [
      wide("Интересно, что в сентябре 1938г.", 300),
      wide("А. И. Пельтцер прошёл без остановок", 293),
      wide("5000 км на автомобиле ГАЗ-М1-Г.", 286),
      wide("Скорость составила 60,96 км/час.", 279),
    ];
    const [first] = await lines(page);
    expect(first).toBe("Интересно, что в сентябре 1938г. А. И. Пельтцер прошёл без остановок 5000 км на автомобиле ГАЗ-М1-Г.");
  });

  it("joins a word hyphenated across lines, and keeps the page text in step so quotes still match it", async () => {
    // A Russian magazine column whose PDF lost the hyphens: "газогене" | "раторная" came out as two words.
    const wide = (str: string, y: number) => ({ str, transform: [5, 0, 0, 5, 21, y], width: 91 });
    const extracted = await extractPdf(
      new Uint8Array([1]),
      onePage([
        wide("Эта газогенераторная установка стояла на", 300),
        wide("грузовике, и эта газогене", 293),
        wide("раторная установка работала на древесно-", 286),
        wide("чурочном топливе.", 279),
      ]),
    );
    const page = extracted.pages[0]!;
    // the hyphen the PDF kept stays when the document never writes the word without it
    expect(page.lines.map((l) => l.text)).toEqual([
      "Эта газогенераторная установка стояла на грузовике, и эта газогенераторная установка работала на древесно-чурочном топливе.",
    ]);
    expect(page.rawText.replace(/\n/g, " ")).toContain(page.lines[0]!.text);
  });

  it("keeps a model code broken after its hyphen in one piece", async () => {
    // Seen on the magazine article: "ЯГ-4" landed on a line of its own, the model cited the other one, and the
    // number check rejected a right answer twice.
    const wide = (str: string, y: number) => ({ str, transform: [5, 0, 0, 5, 21, y], width: 91 });
    expect(await lines([wide("испытывались на грузовиках: ГАЗ-", 300), wide("АА, ЗИС-5, ЯГ-4. Из-за потери мощности", 293)])).toEqual([
      "испытывались на грузовиках: ГАЗ-АА, ЗИС-5, ЯГ-4. Из-за потери мощности",
    ]);
  });

  it("leaves two real words apart at a line break, even when together they make a word", async () => {
    const wide = (str: string, y: number) => ({ str, transform: [5, 0, 0, 5, 21, y], width: 91 });
    expect(await lines([wide("Расход был небольшой, а шум не", 300), wide("большой, не очень большой и ровный.", 293)])).toEqual([
      "Расход был небольшой, а шум не большой, не очень большой и ровный.",
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

function unit(id: string, text: string, documentId = "doc1", page = 2, paragraph = 1): EvidenceUnit {
  return { id, documentId, filename: `${documentId}.pdf`, page, paragraph, text };
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
  didYouMean: "",
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
  it("reads a reference to one of the documents' numbered sections as a place, not a fact", () => {
    const sections = new Map<string, EvidenceUnit>([
      ...evidenceById,
      ["d1:p3:s2", unit("d1:p3:s2", "6. Exceptions", "doc1", 3)],
      ["d1:p3:s3", unit("d1:p3:s3", "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C.", "doc1", 3)],
    ]);
    const run = (out: Partial<LlmAnswer>) =>
      validateLlmAnswer({ ...BLANK, ...out }, { question: "Чи може модель B перевищувати свій звичайний ліміт?", evidenceById: sections, maxWords: 45, maxCitations: 3 });
    const answer = "Так, модель B може працювати до 15 одиниць не довше 5 хвилин, якщо температура нижче 20°C.";
    // The reported run's L5: a right answer whose reason named the section it came from.
    expect(run({ answer, basis: "inferred", reason: "За винятком, зазначеним у розділі 6, до 15 одиниць нижче 20°C.", citations: ["d1:p3:s3"] }).errors).toEqual([]);
    expect(run({ answer: "Да, согласно разделу 6: до 15 единиц не дольше 5 минут ниже 20°C.", citations: ["d1:p3:s3"] }).errors).toEqual([]);
    expect(run({ answer: "Yes, see section 6: up to 15 units for 5 minutes below 20°C.", citations: ["d1:p3:s3"] }).errors).toEqual([]);
    // A section the documents do not have is still an unsupported number.
    expect(run({ answer: "Yes, see section 9: up to 15 units for 5 minutes below 20°C.", citations: ["d1:p3:s3"] }).errors.join()).toMatch(/number 9/);
    // So is a fact that happens to share the section's number.
    expect(run({ answer: "Yes, see section 6: up to 15 units for 6 minutes below 20°C.", citations: ["d1:p3:s3"] }).errors.join()).toMatch(/number 6/);
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
  it("does not take ё for a slip of е", () => {
    const fuel = [unit("d1:p6:s5", "Процесс газификации твердого топлива неновый.", "doc1", 6)];
    expect(findCorrectedSlip("Какой вид топлива твёрдого подходит?", "Какой вид твердого топлива подходит?", fuel)).toBeNull();
  });
  it("counts a swap of two letters as one edit", () => {
    expect(editDistance("nozzel", "nozzle")).toBe(1);
    expect(editDistance("kitten", "sitting")).toBe(3);
  });
});

describe("model codes cited by the code", () => {
  // From the magazine article: the model named seven models, cited three lines, and "42" and "13" cost a second call.
  const lines = [
    unit("d1:p2:s26", "Газогенераторные установки испытывались на грузовиках: ГАЗ-АА, ЗИС-5, ЯГ-4.", "doc1", 2),
    unit("d1:p3:s29", "ГАЗ-42. С 1939 по 1946 г. заводом ГАЗ было изготовлено 33840 машин этой модели.", "doc1", 3),
    unit("d1:p3:s32", "ЗИС-13 производился с середины 1936г. до середины 1938г.", "doc1", 3),
    unit("d1:p4:s1", "Двигатель прогревался до 42 градусов.", "doc1", 4),
  ];
  const ctx = (question: string) => ({ question, evidenceById: new Map(lines.map((u) => [u.id, u])), maxWords: 45, maxCitations: 3 });
  const said = (answer: string, citations: string[]) => ({ ...BLANK, answer, citations });

  it("cites the line where a model code the answer names stands, instead of rejecting the answer", () => {
    const outcome = validateLlmAnswer(said("Подходили ГАЗ-АА, ЗИС-5, ЯГ-4, ГАЗ-42 и ЗИС-13.", ["d1:p2:s26"]), ctx("Какие машины подходили?"));
    expect(outcome.errors).toEqual([]);
    expect(outcome.citedByCode).toEqual(["d1:p3:s29", "d1:p3:s32"]);
  });

  it("still rejects a bare number, and a code no line names", () => {
    expect(validateLlmAnswer(said("ЗИС-5 прогревался до 42 градусов.", ["d1:p2:s26"]), ctx("До скольки градусов?")).errors.join(" ")).toContain("The number 42");
    expect(validateLlmAnswer(said("Подходили ЗИС-5 и ГАЗ-43.", ["d1:p2:s26"]), ctx("Какие машины?")).errors.join(" ")).toContain("The number 43");
  });

  it("answers the list with one call and shows the lines the code cited", async () => {
    const llm = fakeLlm([{ answer: "Подходили ГАЗ-АА, ЗИС-5, ЯГ-4, ГАЗ-42 и ЗИС-13.", citations: ["d1:p2:s26"] }]);
    const result = await answerQuestion({ question: "Какие машины подходили?", history: [], evidence: lines, llm, language: "ru" });
    expect(llm.calls).toBe(1);
    expect(result.citations.map((c) => c.sentenceId)).toEqual(["d1:p2:s26", "d1:p3:s29", "d1:p3:s32"]);
  });
});

describe("page positions", () => {
  it("gives every unit a box on its page, and a wrapped line one box per physical line", async () => {
    const doc = await load("manual-v1.pdf");
    for (const u of doc.units) {
      const boxes = doc.boxes[u.id]!;
      expect(boxes.length).toBeGreaterThan(0);
      for (const b of boxes) {
        expect(b.width).toBeGreaterThan(0);
        expect(b.height).toBeGreaterThan(0);
        expect(b.x).toBeGreaterThanOrEqual(0);
      }
    }
    const exception = doc.units.find((u) => u.text.startsWith("Exception:"))!;
    expect(doc.boxes[exception.id]).toHaveLength(2);
  });
});

describe("passages", () => {
  const cite = (doc: IndexedDocument, text: string): Citation => {
    const u = doc.units.find((x) => x.text === text)!;
    return { documentId: doc.documentId, filename: doc.filename, page: u.page, sentenceId: u.id, quote: u.text };
  };

  it("files the cited lines of one paragraph on one sheet, titled by its first line", async () => {
    const doc = await load("manual-v1.pdf");
    const sheets = groupPassages(
      [cite(doc, "Model B: the maximum load is 12 units under normal conditions."), cite(doc, "Model A: the maximum load is 20 units.")],
      [doc],
    );
    expect(sheets).toHaveLength(1);
    const sheet = sheets[0]!;
    const paragraph = doc.units.filter((u) => u.page === sheet.page && u.paragraph === sheet.paragraph);
    expect(sheet.title).toBe(paragraph[0]!.text);
    expect(sheet.lines.filter((l) => l?.cited).map((l) => l!.text)).toEqual([
      "Model A: the maximum load is 20 units.",
      "Model B: the maximum load is 12 units under normal conditions.",
    ]);
  });

  it("puts lines from different paragraphs on separate sheets, in document order", async () => {
    const doc = await load("manual-v1.pdf");
    const sheets = groupPassages([cite(doc, "Clean the dosing nozzle of Model B every 30 days."), cite(doc, "Model A: the maximum load is 20 units.")], [doc]);
    expect(sheets.map((s) => s.page)).toEqual([2, 3]);
  });

  it("keeps only the lines next to cited ones in a long paragraph", () => {
    const units = Array.from({ length: 12 }, (_, i) => unit(`d1:p1:s${i + 1}`, `Line ${i + 1}.`, "doc1", 1));
    const doc: IndexedDocument = { documentId: "doc1", docKey: "d1", filename: "doc1.pdf", pageCount: 1, pages: [], units, boxes: {}, timings: { extractMs: 0, indexMs: 0 } };
    const [sheet] = groupPassages([{ documentId: "doc1", filename: "doc1.pdf", page: 1, sentenceId: "d1:p1:s6", quote: "Line 6." }], [doc]);
    expect(sheet!.lines.map((l) => l?.text ?? null)).toEqual([null, "Line 5.", "Line 6.", "Line 7.", null]);
    expect(sheet!.total).toBe(12);
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

describe("a second pass at the evidence", () => {
  const paragraph = (id: string, text: string, n: number) => unit(id, text, "doc1", 1, n);
  const corpus = [
    paragraph("d1:p1:s1", "Пиролиз идёт при высокой температуре в закрытой камере.", 1),
    paragraph("d1:p1:s2", "В установке происходит пиролиз древесины без доступа воздуха.", 2),
    paragraph("d1:p1:s3", "Кузов автомобиля был деревянным и красился в тёмный цвет.", 3),
    paragraph("d1:p1:s4", "Колёса меняли каждые двадцать тысяч километров пробега.", 4),
  ];
  const docs = [{ documentId: "doc1", docKey: "d1", filename: "a.pdf", pageCount: 1, pages: [], units: corpus, boxes: {}, timings: { extractMs: 0, indexMs: 0 } }] as never;

  it("reaches the line the question shares no words with, through the line it does", () => {
    const asked = "Что делает установка";
    const alone = selectEvidence(docs, asked, { mode: "topk", topK: 1, feedback: false });
    const fed = selectEvidence(docs, asked, { mode: "topk", topK: 1 });
    // "пиролиз" is in neither the question nor the line it matches by name, and it is what the answer is about.
    expect(alone.units.map((u) => u.id)).not.toContain("d1:p1:s1");
    expect(fed.units.map((u) => u.id)).toContain("d1:p1:s1");
  });
});

describe("the word the documents do use", () => {
  it("keeps an offer the documents support, on a not-found answer", async () => {
    const nozzle = [...evidence, unit("d1:p3:s7", "Clean the dosing nozzle of Model B every 30 days.", "doc1", 3)];
    const llm = fakeLlm([{ status: "not_found", answer: "The documents do not mention a nozzel.", didYouMean: "nozzle" }]);
    const result = await answerQuestion({ question: "What is the nozzel made of?", history: [], evidence: nozzle, llm });
    expect(result.didYouMean).toBe("nozzle");
  });

  it("drops one they do not, and one on an answer that found something", async () => {
    const invented = fakeLlm([{ status: "not_found", answer: "The documents do not mention it.", didYouMean: "carburettor" }]);
    expect((await answerQuestion({ question: "What about the carburettor?", history: [], evidence, llm: invented })).didYouMean).toBe("");

    const answered = fakeLlm([{ answer: "Model A handles 20 units.", citations: ["d1:p2:s2"], didYouMean: "nozzle" }]);
    expect((await answerQuestion({ question: "What is the maximum for Model A?", history: [], evidence, llm: answered })).didYouMean).toBe("");
  });
});

describe("evidence ids", () => {
  it("reads an id the model wrote without its document, and a run of lines written as a range", async () => {
    // Only one document has a line p2:s3, so the missing part is restored.
    const llm = fakeLlm([{ answer: "Model B handles 12 units.", citations: ["p2:s3"] }]);
    const one = await answerQuestion({ question: "What is the maximum for Model B?", history: [], evidence, llm });
    expect(one.citations[0]?.sentenceId).toBe("d1:p2:s3");

    const ranged = fakeLlm([{ answer: "Both limits are stated.", citations: ["d1:p2:s2]-[d1:p2:s3"] }]);
    const run = await answerQuestion({ question: "What are the limits?", history: [], evidence, llm: ranged });
    expect(run.citations.map((c) => c.sentenceId)).toEqual(["d1:p2:s2", "d1:p2:s3"]);
  });

  it("does not guess which document a line belongs to when two of them could have it", async () => {
    // p2:s2 exists in both documents: restoring the missing part would be a guess, so the id stays unknown.
    const llm = fakeLlm([
      { answer: "Model A handles 20 units.", citations: ["p2:s2"] },
      { answer: "Model A handles 20 units.", citations: ["d1:p2:s2"] },
    ]);
    const result = await answerQuestion({ question: "What is the maximum for Model A?", history: [], evidence, llm });
    expect(result.validation.retryReasons[0]).toContain("Unknown evidence id");
    expect(result.citations[0]?.sentenceId).toBe("d1:p2:s2");
  });


  it("finds a line whose id the model wrote in the answer's alphabet", async () => {
    // Seen in my own test on a Russian story: "д4:p7:s47" for "d4:p7:s47", rejected twice, the answer lost.
    const llm = fakeLlm([{ answer: "Model A handles 20 units.", citations: ["д1:р2:с2"] }]);
    const result = await answerQuestion({ question: "What is the maximum for Model A?", history: [], evidence, llm });
    expect(llm.calls).toBe(1);
    expect(result.citations[0]?.sentenceId).toBe("d1:p2:s2");
    expect(result.citations[0]?.quote).toBe("Model A: the maximum load is 20 units.");
  });

  it("still rejects an id that points at nothing", async () => {
    const llm = fakeLlm([
      { answer: "Model A handles 20 units.", citations: ["d9:p9:s9"] },
      { answer: "Model A handles 20 units.", citations: ["d1:p2:s2"] },
    ]);
    const result = await answerQuestion({ question: "What is the maximum for Model A?", history: [], evidence, llm });
    expect(llm.calls).toBe(2);
    expect(result.validation.retryReasons[0]).toContain("Unknown evidence id");
  });
});

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
    // What the rejected attempt said is kept beside why it was rejected.
    expect(result.validation.rejectedAnswers).toEqual(["attempt 1 (answered): Model A handles 22 units. · cites d1:p2:s2"]);
  });

  it("asks again when the answer slips into another language", async () => {
    const llm = fakeLlm([
      { answer: "Максимальная нагрузка модели A составляет 20 единиц.", citations: ["d1:p2:s2"] },
      { answer: "Максимальне навантаження моделі A становить 20 одиниць.", citations: ["d1:p2:s2"] },
    ]);
    const result = await answerQuestion({ question: "Яке максимальне навантаження моделі A?", history: [], evidence, llm, language: "uk" });
    expect(llm.calls).toBe(2);
    expect(result.answer).toBe("Максимальне навантаження моделі A становить 20 одиниць.");
    expect(result.validation).toMatchObject({ passed: true, attempts: 2 });
    expect(result.validation.retryReasons[0]).toContain("not in Ukrainian");
  });

  it("keeps an answer that stays in the wrong language, and says so", async () => {
    const russian = "Максимальная нагрузка модели A составляет 20 единиц.";
    const llm = fakeLlm([{ answer: russian, citations: ["d1:p2:s2"] }, { answer: russian, citations: ["d1:p2:s2"] }]);
    const result = await answerQuestion({ question: "Яке максимальне навантаження моделі A?", history: [], evidence, llm, language: "uk" });
    expect(llm.calls).toBe(2);
    expect(result.answer).toBe(russian);
    expect(result.answer).not.toBe(UNVERIFIED_ANSWER);
    expect(result.validation.warnings.join(" ")).toContain("not in Ukrainian");
  });

  it("keeps the wrong-language answer when the call spent on the language brings nothing better", async () => {
    const russian = "Максимальная нагрузка модели A составляет 20 единиц.";
    const llm = fakeLlm([
      { answer: russian, citations: ["d1:p2:s2"] },
      { answer: "Максимальне навантаження моделі A становить 20 одиниць.", citations: ["d1:p9:s9"] },
    ]);
    const result = await answerQuestion({ question: "Яке максимальне навантаження моделі A?", history: [], evidence, llm, language: "uk" });
    expect(llm.calls).toBe(2);
    expect(result.answer).toBe(russian);
    expect(result.answer).not.toBe(UNVERIFIED_ANSWER);
    expect(result.validation).toMatchObject({ passed: true, attempts: 2 });
    expect(result.validation.warnings.join(" ")).toContain("not in Ukrainian");
  });

  it("asks again when an inferred answer's reason is in another language", async () => {
    const answer = "Да, модель A выдерживает такую нагрузку.";
    const llm = fakeLlm([
      { answer, basis: "inferred", reason: "It stays under the stated maximum load.", citations: ["d1:p2:s2"] },
      { answer, basis: "inferred", reason: "Это меньше указанной максимальной нагрузки.", citations: ["d1:p2:s2"] },
    ]);
    const result = await answerQuestion({ question: "Выдержит ли модель A нагрузку 15 единиц?", history: [], evidence, llm, language: "ru" });
    expect(llm.calls).toBe(2);
    expect(result.reason).toBe("Это меньше указанной максимальной нагрузки.");
    expect(result.validation.retryReasons[0]).toContain("the reason is not in Russian");
  });

  it("leaves out a reason that stays in another language, and keeps the answer", async () => {
    const answer = "Да, модель A выдерживает такую нагрузку.";
    const english = { answer, basis: "inferred" as const, reason: "It stays under the stated maximum load.", citations: ["d1:p2:s2"] };
    const llm = fakeLlm([english, english]);
    const result = await answerQuestion({ question: "Выдержит ли модель A нагрузку 15 единиц?", history: [], evidence, llm, language: "ru" });
    expect(llm.calls).toBe(2);
    expect(result).toMatchObject({ answer, basis: "inferred", reason: "" });
    expect(spokenAnswer(result)).toBe(answer);
    expect(result.validation.warnings.join(" ")).toContain("left out");
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

  it("says it could not verify an answer in the language that was asked in", async () => {
    const llm = fakeLlm([
      { answer: "Модель A выдерживает 22 единицы.", citations: ["d1:p2:s2"] },
      { answer: "Модель A выдерживает 21 единицу.", citations: ["d1:p2:s2"] },
    ]);
    const result = await answerQuestion({ question: "Какая максимальная нагрузка у модели A?", history: [], evidence, llm, language: "ru" });
    expect(result).toMatchObject({ status: "not_found", answer: unverifiedAnswer("ru"), citations: [] });
    expect(result.answer).not.toBe(UNVERIFIED_ANSWER);
    // Each wording still reads as "the documents do not have it", so the scorer and the validator treat it alike.
    for (const language of ["en", "ru", "uk"] as const)
      expect(check({ status: "not_found", answer: unverifiedAnswer(language) }).errors).toEqual([]);
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
