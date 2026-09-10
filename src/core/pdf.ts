// Text extraction with pdf.js. The pdf.js module is injected so the same code runs in the browser and in Node.

interface TextItemLike {
  str: string;
  transform: number[];
  width: number;
}

export interface PdfjsLike {
  getDocument(src: { data: Uint8Array; isEvalSupported?: boolean; verbosity?: number }): {
    promise: Promise<{
      numPages: number;
      getPage(pageNumber: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }> }>;
    }>;
    destroy(): Promise<void>;
  };
}

interface PhysicalLine {
  text: string;
  x: number;
  right: number;
  y: number;
}

export interface LogicalLine {
  text: string;
  /** Paragraph index within the page, 1-based. */
  paragraph: number;
}

export interface ExtractedPage {
  page: number;
  /** Physical lines joined with "\n", before normalization. */
  rawText: string;
  lines: LogicalLine[];
  /** Non-whitespace characters on the page (used to detect scans). */
  charCount: number;
}

export interface ExtractedPdf {
  pageCount: number;
  pages: ExtractedPage[];
}

function isTextItem(item: unknown): item is TextItemLike {
  return typeof item === "object" && item !== null && typeof (item as TextItemLike).str === "string" && Array.isArray((item as TextItemLike).transform);
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** Groups text items that share a baseline into lines, top to bottom. */
function physicalLines(items: TextItemLike[]): PhysicalLine[] {
  const pieces = items
    .filter((i) => i.str.trim().length > 0)
    .map((i) => ({ str: i.str, x: i.transform[4] ?? 0, y: i.transform[5] ?? 0, width: i.width }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const groups: (typeof pieces)[] = [];
  for (const piece of pieces) {
    const group = groups[groups.length - 1];
    if (group && Math.abs(group[0]!.y - piece.y) <= 2) group.push(piece);
    else groups.push([piece]);
  }

  return groups.map((group) => {
    group.sort((a, b) => a.x - b.x);
    let text = "";
    let prevEnd = -Infinity;
    for (const p of group) {
      const needsSpace = text && p.x - prevEnd > 1 && !text.endsWith(" ") && !p.str.startsWith(" ");
      text += (needsSpace ? " " : "") + p.str;
      prevEnd = p.x + p.width;
    }
    const last = group[group.length - 1]!;
    return { text: text.trim(), x: group[0]!.x, right: last.x + last.width, y: group[0]!.y };
  });
}

/**
 * Re-joins lines that were wrapped at the right margin, and numbers paragraphs by vertical gaps.
 * A line counts as wrapped when it reaches the text block's right edge without closing punctuation.
 */
function logicalLines(lines: PhysicalLine[], textRight: number): LogicalLine[] {
  const gaps = lines.slice(1).map((l, i) => lines[i]!.y - l.y).filter((g) => g > 0);
  const typicalGap = median(gaps) || 12;
  const out: LogicalLine[] = [];
  let paragraph = 1;
  lines.forEach((line, i) => {
    const prev = lines[i - 1];
    const newParagraph = prev !== undefined && prev.y - line.y > typicalGap * 1.4;
    if (newParagraph) paragraph++;
    const prevWrapped =
      prev !== undefined && !newParagraph && prev.right >= textRight * 0.9 && !/[.!?:;]["')\]]?$/.test(prev.text);
    const last = out[out.length - 1];
    if (last && prevWrapped) last.text += ` ${line.text}`;
    else out.push({ text: line.text, paragraph });
  });
  return out;
}

export async function extractPdf(data: Uint8Array, pdfjs: PdfjsLike): Promise<ExtractedPdf> {
  // pdf.js may transfer the buffer to its worker, so hand it a copy.
  const task = pdfjs.getDocument({ data: data.slice(), isEvalSupported: false, verbosity: 0 });
  try {
    const doc = await task.promise;
    const perPage: PhysicalLine[][] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      perPage.push(physicalLines(content.items.filter(isTextItem)));
    }
    const textRight = Math.max(0, ...perPage.flat().map((l) => l.right));
    return {
      pageCount: doc.numPages,
      pages: perPage.map((lines, i) => ({
        page: i + 1,
        rawText: lines.map((l) => l.text).join("\n"),
        lines: logicalLines(lines, textRight),
        charCount: lines.reduce((sum, l) => sum + l.text.replace(/\s/g, "").length, 0),
      })),
    };
  } finally {
    await task.destroy();
  }
}
