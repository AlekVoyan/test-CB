import { normalizeText } from "./normalize.js";
import type { ExtractedPdf, LogicalLine } from "./pdf.js";
import type { EvidenceUnit, PageText, Rect } from "./types.js";

const LONG_LINE = 200;

/** Splits a long line into sentences, without breaking after "Step 3." style prefixes. */
function splitSentences(text: string): string[] {
  if (text.length <= LONG_LINE) return [text];
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/);
  const out: string[] = [];
  for (const part of parts) {
    const prev = out[out.length - 1];
    if (prev !== undefined && /\b(?:step|no|fig|p|pp|e\.g|i\.e|approx|vs)\.?\s*\d*\.$/i.test(prev)) out[out.length - 1] = `${prev} ${part}`;
    else out.push(part);
  }
  return out;
}

/**
 * The boxes of the physical lines a sentence of a logical line spans. The logical line is its parts joined with
 * spaces, so each part's offset in the normalized text is known; if the sentence can't be placed, all parts count.
 */
function sentenceBoxes(line: LogicalLine, text: string, sentence: string, from: number): { boxes: Rect[]; end: number } {
  const all = line.parts.map((p) => p.box);
  const start = text.indexOf(sentence, from);
  if (start < 0) return { boxes: all, end: from };
  const end = start + sentence.length;
  let offset = 0;
  const boxes: Rect[] = [];
  for (const part of line.parts) {
    const length = normalizeText(part.text).length;
    if (offset < end && offset + length > start) boxes.push(part.box);
    offset += length + 1;
  }
  return { boxes: boxes.length ? boxes : all, end };
}

export function indexDocument(
  extracted: ExtractedPdf,
  meta: { documentId: string; docKey: string; filename: string },
): { pages: PageText[]; units: EvidenceUnit[]; boxes: Record<string, Rect[]> } {
  const pages: PageText[] = [];
  const units: EvidenceUnit[] = [];
  const boxes: Record<string, Rect[]> = {};
  for (const page of extracted.pages) {
    pages.push({ page: page.page, text: normalizeText(page.rawText) });
    let n = 0;
    for (const line of page.lines) {
      const text = normalizeText(line.text);
      let cursor = 0;
      for (const sentence of splitSentences(text)) {
        if (!sentence) continue;
        n++;
        const id = `${meta.docKey}:p${page.page}:s${n}`;
        units.push({ id, documentId: meta.documentId, filename: meta.filename, page: page.page, paragraph: line.paragraph, text: sentence });
        const placed = sentenceBoxes(line, text, sentence, cursor);
        boxes[id] = placed.boxes;
        cursor = placed.end;
      }
    }
  }
  return { pages, units, boxes };
}
