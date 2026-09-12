import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Where pdf.js finds what it does not bundle: the WebAssembly decoders for JBIG2 and JPEG 2000 images (a scanned page
 * is one of those, and without them it renders blank), the character maps for CJK text, the standard font data, and
 * the colour profiles. Vite serves and ships them under /pdfjs (see `vite.config.ts`). Only the page viewer needs
 * them; pulling text out of a PDF does not.
 */
export const PDF_ASSETS = {
  wasmUrl: "/pdfjs/wasm/",
  cMapUrl: "/pdfjs/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/pdfjs/standard_fonts/",
  iccUrl: "/pdfjs/iccs/",
} as const;

export { pdfjs };
