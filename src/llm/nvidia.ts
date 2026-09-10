// NVIDIA-hosted open models (build.nvidia.com) through their OpenAI-compatible chat API.
import type { LlmClient } from "../core/answerer.js";
import { config } from "../core/config.js";
import { LLM_ANSWER_JSON_SCHEMA, parseLlmAnswer } from "../core/contract.js";

const BASE_URL = "https://integrate.api.nvidia.com/v1";
// The free endpoint returns 503 "temporarily overloaded" now and then; retry like the Anthropic SDK does.
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);
const MAX_TRANSPORT_ATTEMPTS = 3;

interface ChatCompletion {
  model?: string;
  choices?: { message?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createNvidiaLlm(options: {
  apiKey: string;
  model?: string;
  schemaMode?: "response_format" | "guided_json";
}): LlmClient {
  const model = options.model ?? config.llm.nvidiaModel;
  const schemaMode = options.schemaMode ?? config.llm.nvidiaSchemaMode;
  const schemaParams =
    schemaMode === "guided_json"
      ? { nvext: { guided_json: LLM_ANSWER_JSON_SCHEMA } }
      : { response_format: { type: "json_schema", json_schema: { name: "answer", schema: LLM_ANSWER_JSON_SCHEMA, strict: true } } };

  return {
    async complete({ system, messages }) {
      const body = JSON.stringify({
        model,
        temperature: config.llm.temperature,
        max_tokens: config.llm.maxTokens,
        messages: [{ role: "system", content: system }, ...messages],
        ...schemaParams,
        ...(config.llm.nvidiaDisableThinking ? { chat_template_kwargs: { enable_thinking: false } } : {}),
      });

      const started = performance.now();
      let response: Response | undefined;
      let lastError = "";
      for (let attempt = 1; attempt <= MAX_TRANSPORT_ATTEMPTS; attempt++) {
        try {
          const res = await fetch(`${BASE_URL}/chat/completions`, {
            method: "POST",
            headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
            body,
            signal: AbortSignal.timeout(config.llm.requestTimeoutMs),
          });
          if (res.ok || !RETRYABLE_STATUS.has(res.status)) {
            response = res;
            break;
          }
          lastError = `NVIDIA API ${res.status}: ${(await res.text()).slice(0, 200)}`;
        } catch (error) {
          lastError = `NVIDIA API request failed: ${error instanceof Error ? error.message : String(error)}`;
        }
        if (attempt < MAX_TRANSPORT_ATTEMPTS) await sleep(1000 * 2 ** (attempt - 1));
      }
      const latencyMs = performance.now() - started;

      if (!response) throw new Error(lastError);
      if (!response.ok) throw new Error(`NVIDIA API ${response.status}: ${(await response.text()).slice(0, 200)}`);
      const json = (await response.json()) as ChatCompletion;
      const choice = json.choices?.[0];
      const rawText = choice?.message?.content ?? "";
      return {
        parsed: parseLlmAnswer(rawText),
        rawText,
        inputTokens: json.usage?.prompt_tokens ?? 0,
        outputTokens: json.usage?.completion_tokens ?? 0,
        latencyMs,
        model: json.model ?? model,
        stopReason: choice?.finish_reason ?? null,
      };
    },
  };
}
