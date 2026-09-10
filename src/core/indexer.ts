import { normalizeText } from "./normalize.js";
import type { ExtractedPdf } from "./pdf.js";
import type { EvidenceUnit, PageText } from "./types.js";

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

export function indexDocument(
  extracted: ExtractedPdf,
  meta: { documentId: string; docKey: string; filename: string },
): { pages: PageText[]; units: EvidenceUnit[] } {
  const pages: PageText[] = [];
  const units: EvidenceUnit[] = [];
  for (const page of extracted.pages) {
    pages.push({ page: page.page, text: normalizeText(page.rawText) });
    let n = 0;
    for (const line of page.lines) {
      for (const sentence of splitSentences(normalizeText(line.text))) {
        if (!sentence) continue;
        n++;
        units.push({
          id: `${meta.docKey}:p${page.page}:s${n}`,
          documentId: meta.documentId,
          filename: meta.filename,
          page: page.page,
          paragraph: line.paragraph,
          text: sentence,
        });
      }
    }
  }
  return { pages, units };
}
