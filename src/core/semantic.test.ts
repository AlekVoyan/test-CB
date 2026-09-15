import { describe, expect, it } from "vitest";
import { retrievalQuery, selectEvidence } from "./retriever";
import { fuseRankings, paragraphSimilarity, passagesOf } from "./semantic";
import type { EvidenceUnit } from "./types";

let n = 0;
const line = (paragraph: number, text: string): EvidenceUnit => ({ id: `d1:p1:s${++n}`, documentId: "doc1", filename: "article.pdf", page: 1, paragraph, text });
const documentOf = (units: EvidenceUnit[]) => [{ documentId: "doc1", docKey: "d1", filename: "article.pdf", pageCount: 1, pages: [], units, boxes: {}, timings: { extractMs: 0, indexMs: 0 } }] as never;
const unit = (...values: number[]) => {
  const v = Float32Array.from(values);
  const norm = Math.hypot(...values);
  return v.map((x) => x / norm);
};

describe("passages for search by meaning", () => {
  it("covers a long paragraph with windows of lines overlapping by half, and keeps a short one whole", () => {
    const long = [0, 1, 2, 3].map((i) => line(1, `${i}`.repeat(250)));
    const short = line(2, "Короткий абзац.");
    const passages = passagesOf([...long, short], 600);
    expect(passages.map((p) => p.key)).toEqual(["doc1#1#1", "doc1#1#1", "doc1#1#1", "doc1#1#2"]);
    expect(passages.map((p) => p.text.length)).toEqual([501, 501, 501, 15]);
    expect(passages[1]!.text.startsWith("1")).toBe(true);
  });

  it("keeps a line longer than a window as a passage of its own", () => {
    expect(passagesOf([line(1, "x".repeat(900)), line(1, "y")], 600).map((p) => p.text.length)).toEqual([900, 1]);
  });
});

describe("ranking by meaning", () => {
  it("scores a paragraph by its best passage", () => {
    const similarity = paragraphSimilarity(unit(1, 0), { keys: ["a", "a", "b"], vectors: [unit(0, 1), unit(1, 0.1), unit(1, 1)] });
    expect(similarity.get("a")).toBeGreaterThan(similarity.get("b")!);
  });

  it("puts a paragraph near the top of both rankings above one at the top of only one", () => {
    const fused = fuseRankings([
      new Map([["first by words", 9], ["second in both", 8], ["last", 1]]),
      new Map([["first by meaning", 0.9], ["second in both", 0.8], ["last", 0.1]]),
    ]);
    const order = [...fused.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);
    expect(order[0]).toBe("second in both");
  });
});

describe("hybrid evidence selection", () => {
  const header = line(1, "Топливо будущего, часть вторая.");
  const issue = line(2, "Журнал выходит раз в месяц.");
  const thanks = line(3, "Редакция благодарит читателей за письма.");
  const trucks = line(4, "Газогенераторные установки испытывались на грузовиках ГАЗ-АА и ЗИС-5.");
  const docs = documentOf([header, issue, thanks, trucks]);
  const index = { keys: ["doc1#1#1", "doc1#1#2", "doc1#1#3", "doc1#1#4"], vectors: [unit(1, 0, 0, 0), unit(0, 1, 0, 0), unit(0, 0, 1, 0), unit(0, 0, 0, 1)] };
  // What the model makes of "Which trucks had a gas generator?": close to the trucks paragraph, in another language.
  const query = unit(0.1, 0.2, 0.1, 0.9);

  it("reaches the paragraph a question in another language shares no words with", () => {
    const asked = "Which trucks had a gas generator?";
    // by words alone, the lines that matched nothing lend their words, and one of them is sent instead
    const byWords = selectEvidence(docs, asked, { budgetTokens: 1, topK: 1 });
    expect(byWords.units).not.toContain(trucks);
    const hybrid = selectEvidence(docs, asked, { budgetTokens: 1, topK: 1, semantic: { query, index } });
    expect(hybrid.mode).toBe("hybrid");
    expect(hybrid.units).toEqual([trucks]);
  });

  it("takes paragraphs in rank order only while they fit the token cap, and always the best one", () => {
    const capped = selectEvidence(docs, "Which trucks had a gas generator?", { budgetTokens: 1, evidenceTokens: 1, semantic: { query, index } });
    expect(capped.units).toEqual([trucks]);
    const roomy = selectEvidence(docs, "Which trucks had a gas generator?", { budgetTokens: 1, evidenceTokens: 1000, semantic: { query, index } });
    expect(roomy.units).toHaveLength(4);
  });

  it("holds a follow-up to the cap too: paragraphs naming the conversation's subject rank, they are not added past it", () => {
    // Seen in the browser: the subjects of the answer before ("ГАЗ-АА") matched nearly every paragraph and were all sent.
    const turn = { question: "What is it about?", resolvedQuery: "What is the article about?", status: "answered" as const, answer: "Fuel.", activeEntities: ["журнал", "топливо", "редакция"] };
    const byWords = selectEvidence(docs, "And the trucks?", { budgetTokens: 1, topK: 1, history: [turn] });
    expect(byWords.units.length).toBeGreaterThan(1);
    const hybrid = selectEvidence(docs, "And the trucks?", { budgetTokens: 1, evidenceTokens: 1, history: [turn], semantic: { query, index } });
    expect(hybrid.units).toHaveLength(1);
  });

  it("sends the whole document when it fits the budget, meaning or not", () => {
    expect(selectEvidence(docs, "Which trucks?", { semantic: { query, index } }).mode).toBe("full");
  });

  it("searches for a follow-up together with the question it follows", () => {
    const turn = { question: "Какой расход у ГАЗ-42?", resolvedQuery: "Какой расход топлива у ГАЗ-42?", status: "answered" as const, answer: "53 кг.", activeEntities: ["ГАЗ-42"] };
    expect(retrievalQuery("А у ЗИС-13?", [turn])).toBe("А у ЗИС-13? Какой расход топлива у ГАЗ-42? ГАЗ-42");
  });
});
