// Renders the test fixtures as text-based PDFs (plus two limit-test PDFs).
// Usage: npm run fixtures
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "fixtures", "source");
const outDir = path.join(root, "fixtures");

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 56;
const BODY_SIZE = 11;
const LEADING = 15;
const FIXED_DATE = new Date("2026-09-10T00:00:00Z");

function wrap(line: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = line.split(" ");
  const out: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      out.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) out.push(current);
  return out;
}

async function newDoc(title: string): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setCreator("ask-your-documents fixtures");
  doc.setProducer("pdf-lib");
  doc.setCreationDate(FIXED_DATE);
  doc.setModificationDate(FIXED_DATE);
  return doc;
}

async function textPdf(name: string): Promise<number> {
  const raw = readFileSync(path.join(sourceDir, `${name}.txt`), "utf8");
  const pages = raw.split(/^=== PAGE ===$/m).map((p) => p.replace(/^\n+|\n+$/g, ""));
  const title = pages[0]?.split("\n")[0] ?? name;
  const doc = await newDoc(title);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  for (const pageText of pages) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;
    pageText.split("\n").forEach((line, i) => {
      if (!line.trim()) {
        y -= LEADING * 0.8;
        return;
      }
      const isTitle = i === 0;
      const isHeading = isTitle || /^\d+\. [A-Z]/.test(line);
      const font = isHeading ? bold : regular;
      const size = isTitle ? 14 : BODY_SIZE;
      for (const piece of wrap(line, font, size, PAGE_W - 2 * MARGIN)) {
        page.drawText(piece, { x: MARGIN, y, size, font, color: rgb(0.1, 0.1, 0.1) });
        y -= isTitle ? 22 : LEADING;
      }
    });
  }
  writeFileSync(path.join(outDir, `${name}.pdf`), await doc.save());
  return pages.length;
}

// I2: 8 pages of neutral text, only used to exceed the 10-page limit together with a manual.
async function fillerPdf(): Promise<number> {
  const doc = await newDoc("Kestrel Accessories Catalog");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let p = 1; p <= 8; p++) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;
    page.drawText(`Kestrel Accessories Catalog — section ${p}`, { x: MARGIN, y, size: 14, font });
    y -= 28;
    for (let i = 1; i <= 12; i++) {
      page.drawText(`Item K-${p}${String(i).padStart(2, "0")}: accessory description for catalog entry ${i}.`, {
        x: MARGIN,
        y,
        size: BODY_SIZE,
        font,
      });
      y -= LEADING;
    }
    page.drawText(`Page ${p} of 8`, { x: MARGIN, y: MARGIN, size: BODY_SIZE, font });
  }
  writeFileSync(path.join(outDir, "filler-8p.pdf"), await doc.save());
  return 8;
}

// I3: a page with drawn shapes only — no text layer, like a scan.
async function imageOnlyPdf(): Promise<number> {
  const doc = await newDoc("Image-only page");
  const page = doc.addPage([PAGE_W, PAGE_H]);
  for (let i = 0; i < 12; i++) {
    page.drawRectangle({
      x: MARGIN,
      y: PAGE_H - MARGIN - 40 - i * 55,
      width: PAGE_W - 2 * MARGIN - (i % 3) * 60,
      height: 30,
      color: rgb(0.75, 0.75, 0.75),
    });
  }
  writeFileSync(path.join(outDir, "image-only.pdf"), await doc.save());
  return 1;
}

mkdirSync(outDir, { recursive: true });
const made: Record<string, number> = {};
for (const name of ["manual-v1", "manual-v2", "holdout-nimbus"]) made[`${name}.pdf`] = await textPdf(name);
made["filler-8p.pdf"] = await fillerPdf();
made["image-only.pdf"] = await imageOnlyPdf();
for (const [file, pages] of Object.entries(made)) console.log(`${file}: ${pages} page(s)`);
