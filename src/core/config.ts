// Every tunable of the pipeline lives here, so a small change is a one-line edit.
export const config = {
  // Input limits (brief: up to two text-based PDFs, at most ten pages total)
  maxFiles: 2,
  maxTotalPages: 10,
  maxFileBytes: 10 * 1024 * 1024,
  /** A page with fewer non-whitespace characters counts as "no text layer". */
  scannedMinCharsPerPage: 30,

  // Retrieval
  /** "full": whole corpus goes to the model (default, corpus is tiny); "topk": BM25 top-k paragraphs. */
  retrievalMode: "full" as "full" | "topk",
  topK: 6,
  /** Above this estimated size, "full" falls back to "topk". */
  evidenceTokenBudget: 8000,

  // Answering
  historyTurns: 4,
  maxCitations: 3,
  answerMaxWords: 45,
  maxAttempts: 2,

  // LLM (server side)
  llm: {
    model: "claude-haiku-4-5",
    maxTokens: 1024,
    temperature: 0,
  },

  // Pricing assumptions for cost estimates — see docs/pricing.md
  pricing: {
    model: "claude-haiku-4-5",
    inputUsdPerMTok: 1.0,
    outputUsdPerMTok: 5.0,
  },

  // Voice
  speechLang: "en-US",
} as const;

export type RetrievalMode = "full" | "topk";
