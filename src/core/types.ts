export type AnswerStatus = "answered" | "not_found" | "needs_clarification" | "conflict";

export interface PageText {
  /** 1-based physical page index. */
  page: number;
  /** Normalized page text (whitespace collapsed). Every quote must be a substring of this. */
  text: string;
}

/** One citable line (or sentence of a long line). */
export interface EvidenceUnit {
  /** "d1:p2:s3" — document key, page, unit index on the page. */
  id: string;
  documentId: string;
  filename: string;
  page: number;
  /** Paragraph index within the page, 1-based. */
  paragraph: number;
  /** Normalized text; always a substring of the page text. */
  text: string;
}

export interface IndexedDocument {
  documentId: string;
  /** Short key used inside unit ids ("d1"). */
  docKey: string;
  filename: string;
  pageCount: number;
  pages: PageText[];
  units: EvidenceUnit[];
  /** Where each unit sits on its page (by unit id), for framing it on the rendered page. Stays in the browser. */
  boxes: Record<string, Rect[]>;
  timings: { extractMs: number; indexMs: number };
}

/** A rectangle in PDF page space: points, origin at the bottom left, as pdf.js reports text positions. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Turn {
  question: string;
  resolvedQuery: string;
  status: AnswerStatus;
  answer: string;
  activeEntities: string[];
}

export interface Citation {
  documentId: string;
  filename: string;
  page: number;
  sentenceId: string;
  /** Verbatim evidence text — taken from the index, never from the model. */
  quote: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

export interface AnswerResult {
  status: AnswerStatus;
  /** stated: a cited line says it; inferred: it follows from the cited lines. */
  basis: "stated" | "inferred";
  answer: string;
  /** For an inferred answer, the rule it follows from (also spoken). */
  reason: string;
  citations: Citation[];
  /** For not_found: closely related lines the model mentions. Never the answer. */
  related: Citation[];
  /** The corrected term when the question had an obvious slip; empty otherwise. */
  assumed: string;
  /** For not_found: the documents' own word for what was asked about, offered as the next question. */
  didYouMean: string;
  deep: { requested: boolean; applied: boolean };
  resolvedQuery: string;
  activeEntities: string[];
  /** retryReasons: validator findings of every rejected attempt (kept even when a retry succeeds). */
  validation: { passed: boolean; attempts: number; errors: string[]; warnings: string[]; retryReasons: string[] };
  usage: Usage & { model: string };
  timings: { llmMs: number[]; validationMs: number; totalMs: number };
}
