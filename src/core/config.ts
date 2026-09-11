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
  /** Related lines shown (and spoken about) with a not-found answer. */
  maxRelated: 2,
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
    /** "Think harder": Claude's thinking budget in tokens (min 1024). It is added on top of maxTokens. */
    deepThinkingBudget: 2048,
    temperature: 0,
    requestTimeoutMs: 60_000,
  },

  // Voice
  speechLang: "en-US",
  /**
   * Hosted voice, on when the server has ELEVENLABS_API_KEY; the browser's own voice is the fallback.
   * Env overrides: ELEVENLABS_MODEL, ELEVENLABS_VOICE_ID (ELEVENLABS_VOICE_NAME labels it).
   */
  tts: {
    /** Chosen in a blind listening test against v3 and the macOS voices: half v3's price, ~0.2 s to the first byte. */
    model: "eleven_flash_v2_5",
    voice: { id: "XrExE9yKIg1WjnnlVkGX", name: "Matilda" },
    /** 16-bit mono PCM at this rate plays through Web Audio in every browser as it arrives. */
    sampleRate: 24000,
    /** Longest text the endpoint will speak; answers are one or two sentences. */
    maxChars: 600,
    /** Without audio by then, the browser voice speaks instead. */
    firstByteTimeoutMs: 2500,
  },
  /**
   * On-device voice: Supertonic 3 by Supertone (weights under OpenRAIL-M), run in the browser with ONNX Runtime Web.
   * The files come from Hugging Face the first time it is chosen and stay in the browser's Cache Storage.
   */
  deviceVoice: {
    repo: "supertone-oss-archive/supertonic-3",
    /** The archive revision its SDK examples pin. */
    revision: "aafc6e32416a594460b32413efc49d7fe4ce6d46",
    voice: "F1",
    /** Denoising steps (the example's default) and speaking rate. */
    steps: 8,
    speed: 1.05,
    /**
     * An answer is synthesized in pieces: a short first one, so the first sound comes quickly, and the others while the
     * one before plays. Each kind has one fixed input shape (text ids, latent frames), padded and masked out, and both
     * are warmed up at load: WebGPU builds its kernels per input shape, and a new shape cost 1–2 s in my tests.
     */
    firstChars: 64,
    restChars: 100,
    firstShape: { text: 96, frames: 96 },
    restShape: { text: 128, frames: 160 },
    /** A piece that does not fit its shape is padded to multiples of these instead. */
    textBucket: 32,
    frameBucket: 16,
    /** Pause before a piece: after a sentence end, and after a cut inside a sentence. */
    sentencePauseSec: 0.3,
    clausePauseSec: 0.08,
    /** Size of the model files, for the progress bar. */
    downloadBytes: 398_600_000,
  },
} as const;

export type Language = "en" | "ru" | "uk";

/**
 * Languages for questions, answers and speech. English is the evaluated language; Russian and Ukrainian are
 * additional. Quotes always stay in the document's own language.
 */
export const LANGUAGES: Record<Language, { label: string; name: string; nativeName: string; locale: string }> = {
  en: { label: "EN", name: "English", nativeName: "English", locale: "en-US" },
  ru: { label: "RU", name: "Russian", nativeName: "Русский", locale: "ru-RU" },
  uk: { label: "UA", name: "Ukrainian", nativeName: "Українська", locale: "uk-UA" },
};
export const DEFAULT_LANGUAGE: Language = "en";

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

/** ElevenLabs API price in USD per 1,000 characters, by model id prefix (elevenlabs.io/pricing/api, checked 2026-09-11). */
export const TTS_PRICES: Record<string, number> = {
  eleven_flash: 0.05,
  eleven_turbo: 0.05,
  eleven_v3_conversational: 0.05,
  eleven_v3: 0.1,
  eleven_multilingual: 0.1,
};
