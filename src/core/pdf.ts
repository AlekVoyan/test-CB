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

interface Piece {
  str: string;
  x: number;
  y: number;
  width: number;
  /** Font size (vertical scale of the text matrix). */
  size: number;
}

interface PhysicalLine {
  text: string;
  x: number;
  right: number;
  y: number;
  /** A gap wider than the font size inside the line: a table row, or a title with a right-aligned date. */
  gapped: boolean;
}

export interface LogicalLine {
  text: string;
  /** Paragraph index within the page, 1-based. */
  paragraph: number;
}

export interface ExtractedPage {
  page: number;
  /** Physical lines joined with "\n", before normalization, in reading order (column by column). */
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

/** Text items grouped by shared baseline, top to bottom; each group left to right. */
function baselineGroups(items: TextItemLike[]): Piece[][] {
  const pieces = items
    .filter((i) => i.str.trim().length > 0)
    .map((i) => ({ str: i.str, x: i.transform[4] ?? 0, y: i.transform[5] ?? 0, width: i.width, size: Math.abs(i.transform[3] ?? 0) }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const groups: Piece[][] = [];
  for (const piece of pieces) {
    const group = groups[groups.length - 1];
    if (group && Math.abs(group[0]!.y - piece.y) <= 2) group.push(piece);
    else groups.push([piece]);
  }
  for (const group of groups) group.sort((a, b) => a.x - b.x);
  return groups;
}

/** One line of text from pieces on a baseline, with a space wherever two pieces don't touch. */
function joinPieces(pieces: Piece[], size: number): PhysicalLine {
  let text = "";
  let prevEnd = -Infinity;
  let gapped = false;
  for (const p of pieces) {
    const gap = p.x - prevEnd;
    if (text && gap > size) gapped = true;
    const needsSpace = text && gap > 1 && !text.endsWith(" ") && !p.str.startsWith(" ");
    text += (needsSpace ? " " : "") + p.str;
    prevEnd = p.x + p.width;
  }
  const last = pieces[pieces.length - 1]!;
  return { text: text.trim(), x: pieces[0]!.x, right: last.x + last.width, y: pieces[0]!.y, gapped };
}

/**
 * The x of an empty vertical band that splits the page into two text columns, or null for one column.
 * The band holds no text from top to bottom, is at least two font sizes wide, and has at least 15% of the page's
 * characters on each side, so a column of right-aligned dates is not taken for a second column of text.
 */
function findGutter(groups: Piece[][], size: number): number | null {
  // Runs: pieces on one baseline no further apart than a font size.
  const runs: { x: number; right: number; chars: number }[] = [];
  for (const group of groups) {
    let run: (typeof runs)[number] | null = null;
    for (const p of group) {
      const chars = p.str.replace(/\s/g, "").length;
      if (run && p.x - run.right <= size) {
        run.right = Math.max(run.right, p.x + p.width);
        run.chars += chars;
      } else {
        run = { x: p.x, right: p.x + p.width, chars };
        runs.push(run);
      }
    }
  }
  if (runs.length < 8) return null;

  const total = runs.reduce((n, r) => n + r.chars, 0);
  const sorted = [...runs].sort((a, b) => a.x - b.x);
  let reach = sorted[0]!.right;
  let best: { x: number; width: number } | null = null;
  for (const run of sorted.slice(1)) {
    const width = run.x - reach;
    if (width >= 2 * size) {
      const x = (reach + run.x) / 2;
      const leftChars = runs.filter((r) => r.right <= x).reduce((n, r) => n + r.chars, 0);
      const balanced = leftChars >= 0.15 * total && total - leftChars >= 0.15 * total;
      if (balanced && (!best || width > best.width)) best = { x, width };
    }
    reach = Math.max(reach, run.right);
  }
  return best?.x ?? null;
}

/**
 * The page's physical lines, one list per text column, each top to bottom. On a two-column page (a CV with a
 * sidebar) each baseline is split at the gutter, so a sidebar line and a main-column line never merge.
 */
function pageColumns(items: TextItemLike[]): PhysicalLine[][] {
  const groups = baselineGroups(items);
  const size = median(groups.flat().map((p) => p.size).filter((s) => s > 0)) || 10;
  const gutter = findGutter(groups, size);
  if (gutter === null) return [groups.map((g) => joinPieces(g, size))];

  const columns: PhysicalLine[][] = [[], []];
  for (const group of groups) {
    const left = group.filter((p) => p.x + p.width / 2 < gutter);
    const right = group.filter((p) => p.x + p.width / 2 >= gutter);
    if (left.length) columns[0]!.push(joinPieces(left, size));
    if (right.length) columns[1]!.push(joinPieces(right, size));
  }
  return columns;
}

/**
 * Re-joins lines that were wrapped at the right margin, and numbers paragraphs by vertical gaps.
 * A line counts as wrapped when it reaches the text block's right edge without closing punctuation, and is running
 * text: a line with a wide gap inside (a table row, a right-aligned date) is never wrapped.
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
      prev !== undefined && !newParagraph && !prev.gapped && prev.right >= textRight * 0.9 && !/[.!?:;]["')\]]?$/.test(prev.text);
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
    const perPage: PhysicalLine[][][] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      perPage.push(pageColumns(content.items.filter(isTextItem)));
    }
    // Wrapping is judged against the text block's right edge: the widest line of the document on one-column pages,
    // the column's own edge on a two-column page.
    const textRight = Math.max(0, ...perPage.filter((columns) => columns.length === 1).flat(2).map((l) => l.right));
    return {
      pageCount: doc.numPages,
      pages: perPage.map((columns, i) => {
        let paragraphs = 0;
        const lines = columns.flatMap((column) => {
          const right = columns.length === 1 ? textRight : Math.max(...column.map((l) => l.right));
          const logical = logicalLines(column, right).map((l) => ({ ...l, paragraph: l.paragraph + paragraphs }));
          paragraphs = logical[logical.length - 1]?.paragraph ?? paragraphs;
          return logical;
        });
        const physical = columns.flat();
        return {
          page: i + 1,
          rawText: physical.map((l) => l.text).join("\n"),
          lines,
          charCount: physical.reduce((sum, l) => sum + l.text.replace(/\s/g, "").length, 0),
        };
      }),
    };
  } finally {
    await task.destroy();
  }
}
