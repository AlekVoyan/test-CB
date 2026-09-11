// Framework-agnostic handler for POST /api/answer (used by Vercel and by the Vite dev server).
import { answerQuestion, spokenAnswer } from "../core/answerer.js";
import { config } from "../core/config.js";
import { AnswerRequestSchema } from "../core/contract.js";
import { estimateTokens } from "../core/retriever.js";
import { createLlmFromEnv } from "../llm/index.js";
import { rateLimiter } from "./rateLimit.js";
import { signSpeech, voiceFromEnv } from "./tts.js";

// 30 questions a minute per address, best effort (see rateLimit.ts).
const rateLimited = rateLimiter(30);

export interface HandlerResult {
  status: number;
  json: unknown;
}

export async function handleAnswerRequest(req: { method: string; body: unknown; ip: string }): Promise<HandlerResult> {
  // GET tells the page which model answers and whether "Think harder" is available. No model call.
  if (req.method === "GET") {
    const created = createLlmFromEnv(process.env);
    if ("error" in created) return { status: 500, json: { error: created.error } };
    const voice = voiceFromEnv(process.env);
    return {
      status: 200,
      json: {
        provider: created.provider,
        model: created.model,
        deep: created.llm.supportsDeep,
        voice: voice ? { provider: "ElevenLabs", model: voice.model, name: voice.voiceName } : null,
      },
    };
  }
  if (req.method !== "POST") return { status: 405, json: { error: "Use POST." } };
  if (rateLimited(req.ip)) return { status: 429, json: { error: "Too many questions. Wait a minute and try again." } };

  const parsed = AnswerRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const details = parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`);
    return { status: 400, json: { error: "Invalid request.", details } };
  }
  // The server builds the prompt itself and caps its size, so the endpoint is not a general-purpose LLM proxy.
  if (estimateTokens(parsed.data.evidence) > config.evidenceTokenBudget * 1.25)
    return { status: 413, json: { error: "Too much document text for one question." } };

  const created = createLlmFromEnv(process.env);
  if ("error" in created) return { status: 500, json: { error: created.error } };

  try {
    const result = await answerQuestion({ ...parsed.data, llm: created.llm });
    // With a hosted voice, the page gets a ticket to have exactly this text spoken (see tts.ts).
    const voice = voiceFromEnv(process.env);
    const text = spokenAnswer(result);
    return { status: 200, json: voice ? { ...result, speech: { text, token: signSpeech(text, voice.key) } } : result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 502, json: { error: `The language model call failed: ${message}` } };
  }
}
