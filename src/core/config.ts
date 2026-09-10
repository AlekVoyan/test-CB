// Every tunable of the pipeline lives here, so a small change is a one-line edit.

export type RetrievalMode = "full" | "topk";
export type LlmProvider = "anthropic" | "nvidia";

export const config = {
  // Input limits (brief: up to two text-based PDFs, at most ten pages total)
  maxFiles: 2,
  maxTotalPages: 10,
  maxFileBytes: 10 * 1024 * 1024,
  /** A page with fewer non-whitespace characters counts as "no text layer". */
  scannedMinCharsPerPage: 30,

  // Retrieval
  /** "full": whole corpus goes to the model (default, corpus is tiny); "topk": BM25 top-k paragraphs. */
  retrievalMode: "full" as RetrievalMode,
  topK: 6,
  /** Above this estimated size, "full" falls back to "topk". */
  evidenceTokenBudget: 8000,

  // Answering
  historyTurns: 4,
  maxCitations: 3,
  answerMaxWords: 45,
  maxAttempts: 2,

  // LLM (server side). Env overrides: LLM_PROVIDER, LLM_MODEL (Anthropic), NVIDIA_MODEL.
  llm: {
    /** "anthropic" is the target (decision D1); "nvidia" = free hosted open model used while the Anthropic balance is empty. */
    provider: "anthropic" as LlmProvider,
    anthropicModel: "claude-haiku-4-5",
    nvidiaModel: "nvidia/nemotron-3-super-120b-a12b",
    /** How the JSON schema is passed to NVIDIA-hosted models. */
    nvidiaSchemaMode: "response_format" as "response_format" | "guided_json",
    /** Nemotron reasons before answering unless told not to; with reasoning on, its JSON output degenerated in tests. */
    nvidiaDisableThinking: true,
    maxTokens: 1024,
    temperature: 0,
    requestTimeoutMs: 60_000,
  },

  // Voice
  speechLang: "en-US",
} as const;

export interface Price {
  inputUsdPerMTok: number;
  outputUsdPerMTok: number;
  note: string;
}

/**
 * Price assumptions per model id prefix (see docs/pricing.md). Free access is not zero cost:
 * a model called for free is priced at a paid provider's list price for the same model.
 */
export const PRICES: Record<string, Price> = {
  "claude-haiku-4-5": { inputUsdPerMTok: 1, outputUsdPerMTok: 5, note: "Anthropic list price, checked 2026-09-10" },
  // Called for free on NVIDIA's hosted API; priced at OpenRouter's paid list price for the same model.
  "nvidia/nemotron-3-super-120b-a12b": {
    inputUsdPerMTok: 0.085,
    outputUsdPerMTok: 0.4,
    note: "OpenRouter paid list price for the same model, checked 2026-09-10 (called via NVIDIA's free endpoint)",
  },
};
