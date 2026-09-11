// Quotes are filed by the paragraph they come from: one sheet per paragraph, its cited lines in focus.
import type { Citation, IndexedDocument } from "./types.js";

export interface PassageLine {
  id: string;
  text: string;
  cited: boolean;
}

export interface Passage {
  key: string;
  documentId: string;
  filename: string;
  page: number;
  paragraph: number;
  /** The paragraph's first line: a job title in a CV, a section heading in a manual. */
  title: string;
  /** The paragraph's lines; a long paragraph keeps only the lines next to cited ones, with null where it skips. */
  lines: (PassageLine | null)[];
  /** The lines just before and after the paragraph on the same page, shown fading out. */
  before: string | null;
  after: string | null;
  /** Cited unit ids, in document order. */
  cited: string[];
  /** Lines in the whole paragraph. */
  total: number;
}

/** Paragraphs longer than this show only the cited lines and one line on either side of each. */
const FULL_PARAGRAPH = 8;

/** Files cited lines under the paragraphs they come from, in document order (documents as loaded, then page, paragraph). */
export function groupPassages(citations: Citation[], docs: IndexedDocument[]): Passage[] {
  const citedIds = new Set(citations.map((c) => c.sentenceId));
  const byKey = new Map<string, Passage>();
  const order = (p: Passage) => [docs.findIndex((d) => d.documentId === p.documentId), p.page, p.paragraph];

  for (const c of citations) {
    const doc = docs.find((d) => d.documentId === c.documentId);
    const unit = doc?.units.find((u) => u.id === c.sentenceId);
    const paragraph = unit?.paragraph ?? 0;
    const key = `${c.documentId}#${c.page}#${paragraph}`;
    if (byKey.has(key)) continue;

    if (!doc || !unit) {
      // The document is gone (replaced): the quote alone, as its own sheet.
      const line = { id: c.sentenceId, text: c.quote, cited: true };
      byKey.set(key, { key, documentId: c.documentId, filename: c.filename, page: c.page, paragraph, title: c.quote, lines: [line], before: null, after: null, cited: [c.sentenceId], total: 1 });
      continue;
    }

    const pageUnits = doc.units.filter((u) => u.page === unit.page);
    const inParagraph = pageUnits.filter((u) => u.paragraph === paragraph);
    const first = pageUnits.indexOf(inParagraph[0]!);
    const lines = inParagraph.map((u) => ({ id: u.id, text: u.text, cited: citedIds.has(u.id) }));
    const near = (i: number) => lines.slice(Math.max(0, i - 1), i + 2).some((l) => l.cited);
    const shown =
      lines.length <= FULL_PARAGRAPH
        ? lines
        : lines.map((l, i) => (near(i) ? l : null)).filter((l, i, all) => l !== null || all[i - 1] !== null);

    byKey.set(key, {
      key,
      documentId: doc.documentId,
      filename: doc.filename,
      page: unit.page,
      paragraph,
      title: inParagraph[0]!.text,
      lines: shown,
      before: pageUnits[first - 1]?.text ?? null,
      after: pageUnits[first + inParagraph.length]?.text ?? null,
      cited: lines.filter((l) => l.cited).map((l) => l.id),
      total: lines.length,
    });
  }

  return [...byKey.values()].sort((a, b) => {
    const [x, y] = [order(a), order(b)];
    return x[0]! - y[0]! || x[1]! - y[1]! || x[2]! - y[2]!;
  });
}
