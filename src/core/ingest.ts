import { config } from "./config.js";
import { indexDocument } from "./indexer.js";
import { checkAfterParse, checkBeforeParse, IngestError, SCANNED_MESSAGE } from "./limits.js";
import { extractPdf, type PdfjsLike } from "./pdf.js";
import type { IndexedDocument } from "./types.js";

export type IngestStage = "extracting" | "indexing";

/** Validate → extract → index. Throws IngestError with a user-facing message when a limit is hit. */
export async function ingestPdf(input: {
  bytes: Uint8Array;
  filename: string;
  documentId: string;
  docKey: string;
  existing: { pageCount: number }[];
  pdfjs: PdfjsLike;
  onStage?: (stage: IngestStage) => void;
}): Promise<IndexedDocument> {
  const early = checkBeforeParse(input.existing, input.bytes);
  if (early) throw new IngestError(early);

  input.onStage?.("extracting");
  const t0 = performance.now();
  let extracted;
  try {
    extracted = await extractPdf(input.bytes, input.pdfjs);
  } catch (error) {
    throw new IngestError(`Could not read this PDF (${error instanceof Error ? error.message : String(error)}).`);
  }
  const extractMs = performance.now() - t0;

  const lowTextPages = extracted.pages.filter((p) => p.charCount < config.scannedMinCharsPerPage).length;
  if (extracted.pageCount === 0 || lowTextPages >= extracted.pageCount / 2) throw new IngestError(SCANNED_MESSAGE);

  const late = checkAfterParse(input.existing, extracted.pageCount);
  if (late) throw new IngestError(late);

  input.onStage?.("indexing");
  const t1 = performance.now();
  const { pages, units } = indexDocument(extracted, input);
  const indexMs = performance.now() - t1;

  return {
    documentId: input.documentId,
    docKey: input.docKey,
    filename: input.filename,
    pageCount: extracted.pageCount,
    pages,
    units,
    timings: { extractMs, indexMs },
  };
}
