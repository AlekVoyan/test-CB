// Text extraction with pdf.js. The pdf.js module is injected so the same code runs in the browser and in Node.
import type { Rect } from "./types.js";

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
  /** Where the line sits on the page, in PDF space. */
  box: Rect;
  /** Joined to the line above without a space: the second half of a word hyphenated across the break. */
  glued?: boolean;
}

export interface LogicalLine {
  text: string;
  /** Paragraph index within the page, 1-based. */
  paragraph: number;
  /** The physical lines this line was joined from, with their positions; a glued part follows the one before it without a space. */
  parts: { text: string; box: Rect; glued?: boolean }[];
}

export interface ExtractedPage {
  page: number;
  /** Physical lines joined with "\n", before normalization, in reading order (block by block). */
  rawText: string;
  lines: LogicalLine[];
  /** Non-whitespace characters on the page (used to detect scans). */
  charCount: number;
}

export interface ExtractedPdf {
  pageCount: number;
  pages: ExtractedPage[];
}

/** Non-space characters that make a run of text running text, not a label or a value ("Expert", "2019 – 2021"). */
const TEXT_RUN_CHARS = 24;

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
  const x = pieces[0]!.x;
  const right = last.x + last.width;
  // The baseline is y; letters rise about 0.85 of the font size above it and descend about 0.25 below.
  const bottom = Math.min(...pieces.map((p) => p.y - (p.size || size) * 0.25));
  const top = Math.max(...pieces.map((p) => p.y + (p.size || size) * 0.85));
  return { text: text.trim(), x, right, y: pieces[0]!.y, gapped, box: { x, y: bottom, width: right - x, height: top - bottom } };
}

interface Run {
  right: number;
  x: number;
  chars: number;
}

/** Runs of text: pieces on one baseline no further apart than a font size. */
function runsOf(groups: Piece[][], size: number): Run[] {
  const runs: Run[] = [];
  for (const group of groups) {
    let run: Run | null = null;
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
  return runs;
}

/**
 * The x of an empty vertical band that splits a region into two text columns, or null.
 * The band holds no text from the top of the region to its bottom and is at least one font size wide, and each side
 * holds at least 15% of the characters and some running text. So a column of right-aligned dates, or the value column
 * of a label–value table ("Figma … Expert"), is never taken for a column of its own: those have no running text on
 * the narrow side. What carries the rule is the band being empty down the whole region — justified or ragged, running
 * text never leaves a hole of a whole font size on every line at the same x. A magazine scan set at 5pt with a 7pt
 * gutter needed the looser threshold: two font sizes is a wide gutter only on a full-size page.
 */
function findGutter(groups: Piece[][], size: number): number | null {
  const runs = runsOf(groups, size);
  if (runs.length < 8) return null;

  const total = runs.reduce((n, r) => n + r.chars, 0);
  const qualifies = (side: Run[]) =>
    side.reduce((n, r) => n + r.chars, 0) >= 0.15 * total && side.some((r) => r.chars >= TEXT_RUN_CHARS);
  const sorted = [...runs].sort((a, b) => a.x - b.x);
  let reach = sorted[0]!.right;
  let best: { x: number; width: number } | null = null;
  for (const run of sorted.slice(1)) {
    const width = run.x - reach;
    if (width >= size) {
      const x = (reach + run.x) / 2;
      const balanced = qualifies(runs.filter((r) => r.right <= x)) && qualifies(runs.filter((r) => r.x >= x));
      if (balanced && (!best || width > best.width)) best = { x, width };
    }
    reach = Math.max(reach, run.right);
  }
  return best?.x ?? null;
}

/** The pieces of each baseline left and right of a gutter. */
function splitAt(groups: Piece[][], gutter: number): Piece[][][] {
  const center = (p: Piece) => p.x + p.width / 2;
  return [
    groups.map((g) => g.filter((p) => center(p) < gutter)).filter((g) => g.length),
    groups.map((g) => g.filter((p) => center(p) >= gutter)).filter((g) => g.length),
  ];
}

/** A region's baselines split into sections where the vertical gap is wider than a paragraph break. */
function sections(groups: Piece[][]): Piece[][][] {
  const gaps = groups.slice(1).map((g, i) => groups[i]![0]!.y - g[0]!.y);
  const typical = median(gaps.filter((g) => g > 0)) || 12;
  const out: Piece[][][] = [];
  groups.forEach((group, i) => {
    if (i === 0 || gaps[i - 1]! > typical * 1.4) out.push([]);
    out[out.length - 1]!.push(group);
  });
  return out;
}

/**
 * Cuts a region into blocks of physical lines, in reading order. A gutter through the whole region splits it into
 * columns, read left, then right (a CV's sidebar and main column). Otherwise a section may hold columns of its own,
 * like "Languages | Focus areas" at the foot of the main column; sections without columns stay together as one block,
 * so a one-column page comes out as a single block, exactly as before.
 */
function cutRegion(groups: Piece[][], size: number, depth: number, out: PhysicalLine[][]): void {
  const lines = (gs: Piece[][]) => gs.map((g) => joinPieces(g, size));
  const gutter = depth < 3 ? findGutter(groups, size) : null;
  if (gutter !== null) {
    for (const side of splitAt(groups, gutter)) cutRegion(side, size, depth + 1, out);
    return;
  }
  const parts = depth < 3 ? sections(groups) : [groups];
  let plain: Piece[][] = [];
  for (const section of parts) {
    const inner = parts.length > 1 ? findGutter(section, size) : null;
    if (inner === null) {
      plain.push(...section);
      continue;
    }
    if (plain.length) out.push(lines(plain));
    plain = [];
    for (const side of splitAt(section, inner)) cutRegion(side, size, depth + 1, out);
  }
  if (plain.length) out.push(lines(plain));
}

/** The page's physical lines, one list per block (column or column section), each top to bottom. */
function pageBlocks(items: TextItemLike[]): PhysicalLine[][] {
  const groups = baselineGroups(items);
  const size = median(groups.flat().map((p) => p.size).filter((s) => s > 0)) || 10;
  const blocks: PhysicalLine[][] = [];
  cutRegion(groups, size, 0, blocks);
  return blocks;
}

/**
 * Re-joins lines that were wrapped at the right margin, and numbers paragraphs by vertical gaps.
 * A line counts as wrapped when it reaches the text block's right edge without closing punctuation and is running
 * text (no wide gap inside, as in a table row or a title with its date), and the next line does not start with a
 * capital letter, which would begin a new list item or sentence.
 * A full stop that ends an abbreviation does not close a sentence. Russian prose is full of them — "в 1938г.",
 * "37 л. с.", "53 кг. на 100 км." — and treating each as the end of a line cut statements away from their own
 * numbers, which then read as unsupported and cost a call to put right.
 */
const ABBREVIATION = /(?:^|[\s(])(?:\d+\s*)?(?:\p{L}|г|гг|стр|рис|см|табл|ул|руб|кг|км|мин|тыс|млн|др|пр|т\.д|т\.е|no|fig|pp|vs|approx|e\.g|i\.e)\.$/iu;
const endsSentence = (text: string) => /[.!?:;]["')\]]?$/.test(text) && !ABBREVIATION.test(text);

/** The words that stand inside a line somewhere in the document: whole words, never the halves of a hyphenated one. */
function wordsInsideLines(lines: PhysicalLine[]): Set<string> {
  const inside = new Set<string>();
  for (const line of lines) for (const word of (line.text.toLowerCase().match(/\p{L}+/gu) ?? []).slice(1, -1)) inside.add(word);
  return inside;
}

/**
 * A word hyphenated across a line break. Some PDFs keep no hyphen, so "газогене" | "раторная" read as two words that
 * neither search nor the model knows. They are joined when the document writes the whole word inside a line elsewhere
 * and one half never stands there on its own, so two real words ("не" | "большой") stay apart. A hyphen the PDF did
 * keep is dropped for a word the document writes whole, and kept, without the space, otherwise ("древесно-чурочном").
 * Returns the line above as it should read before the join, or null for no join.
 */
function hyphenJoin(above: string, below: string, inside: Set<string>): string | null {
  const head = above.match(/(\p{L}+)(-?)$/u);
  const tail = below.match(/^\p{Ll}+/u);
  if (!head || !tail) return null;
  const [, half, hyphen] = head;
  const whole = `${half}${tail[0]}`.toLowerCase();
  if (inside.has(whole) && (!inside.has(half!.toLowerCase()) || !inside.has(tail[0]))) return hyphen ? above.slice(0, -1) : above;
  return hyphen ? above : null;
}

function logicalLines(lines: PhysicalLine[], textRight: number, inside: Set<string>): LogicalLine[] {
  const gaps = lines.slice(1).map((l, i) => lines[i]!.y - l.y).filter((g) => g > 0);
  const typicalGap = median(gaps) || 12;
  const out: LogicalLine[] = [];
  let paragraph = 1;
  lines.forEach((line, i) => {
    const prev = lines[i - 1];
    const newParagraph = prev !== undefined && prev.y - line.y > typicalGap * 1.4;
    if (newParagraph) paragraph++;
    // A line that ends on an abbreviation keeps going even when the next one starts with a capital: what follows
    // "в сентябре 1938г." is usually a name, and cutting there separates the statement from its own date.
    const prevAbbreviates = prev !== undefined && ABBREVIATION.test(prev.text);
    const prevWrapped =
      prev !== undefined &&
      !newParagraph &&
      !prev.gapped &&
      (prevAbbreviates || !/^\p{Lu}/u.test(line.text)) &&
      prev.right >= textRight * 0.9 &&
      !endsSentence(prev.text);
    const last = out[out.length - 1];
    if (last && prevWrapped) {
      const above = hyphenJoin(prev!.text, line.text, inside);
      if (above === null) {
        last.text += ` ${line.text}`;
        last.parts.push({ text: line.text, box: line.box });
      } else {
        // The line above loses its hyphen here and in the page text alike, so a quote still matches the page.
        last.text = `${last.text.slice(0, last.text.length - prev!.text.length)}${above}${line.text}`;
        last.parts[last.parts.length - 1]!.text = above;
        prev!.text = above;
        line.glued = true;
        last.parts.push({ text: line.text, box: line.box, glued: true });
      }
    } else out.push({ text: line.text, paragraph, parts: [{ text: line.text, box: line.box }] });
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
      perPage.push(pageBlocks(content.items.filter(isTextItem)));
    }
    // Wrapping is judged against the text block's right edge: the widest line of the document on one-block pages,
    // the block's own edge on a page with columns.
    const textRight = Math.max(0, ...perPage.filter((blocks) => blocks.length === 1).flat(2).map((l) => l.right));
    const inside = wordsInsideLines(perPage.flat(2));
    return {
      pageCount: doc.numPages,
      pages: perPage.map((blocks, i) => {
        let paragraphs = 0;
        const lines = blocks.flatMap((block) => {
          const right = blocks.length === 1 ? textRight : Math.max(...block.map((l) => l.right));
          const logical = logicalLines(block, right, inside).map((l) => ({ ...l, paragraph: l.paragraph + paragraphs }));
          paragraphs = logical[logical.length - 1]?.paragraph ?? paragraphs;
          return logical;
        });
        const physical = blocks.flat();
        return {
          page: i + 1,
          rawText: physical.map((l, n) => (n === 0 ? "" : l.glued ? "" : "\n") + l.text).join(""),
          lines,
          charCount: physical.reduce((sum, l) => sum + l.text.replace(/\s/g, "").length, 0),
        };
      }),
    };
  } finally {
    await task.destroy();
  }
}
