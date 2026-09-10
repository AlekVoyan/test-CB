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
  timings: { extractMs: number; indexMs: number };
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
  answer: string;
  citations: Citation[];
  resolvedQuery: string;
  activeEntities: string[];
  validation: { passed: boolean; attempts: number; errors: string[]; warnings: string[] };
  usage: Usage & { model: string };
  timings: { llmMs: number[]; validationMs: number; totalMs: number };
}
