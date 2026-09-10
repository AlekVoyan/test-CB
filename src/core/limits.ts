import { config } from "./config.js";

export class IngestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IngestError";
  }
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

export function isPdf(bytes: Uint8Array): boolean {
  return PDF_MAGIC.every((b, i) => bytes[i] === b);
}

/** Checks that can run before the PDF is parsed. Returns a user-facing message or null. */
export function checkBeforeParse(existing: { pageCount: number }[], bytes: Uint8Array): string | null {
  if (existing.length >= config.maxFiles)
    return `Up to ${config.maxFiles} PDFs can be loaded at a time. Remove one first.`;
  if (bytes.byteLength > config.maxFileBytes)
    return `This file is larger than ${Math.round(config.maxFileBytes / 1024 / 1024)} MB.`;
  if (!isPdf(bytes)) return "Only PDF files are supported.";
  return null;
}

/** Checks that need the parsed page count. */
export function checkAfterParse(existing: { pageCount: number }[], pageCount: number): string | null {
  const total = existing.reduce((sum, d) => sum + d.pageCount, 0) + pageCount;
  if (total > config.maxTotalPages)
    return `At most ${config.maxTotalPages} pages in total. This file has ${pageCount}, and ${total - pageCount} are already loaded.`;
  return null;
}

export const SCANNED_MESSAGE = "This PDF looks scanned. Only text-based PDFs are supported.";
