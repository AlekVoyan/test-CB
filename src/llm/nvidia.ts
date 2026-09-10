// NVIDIA-hosted open models (build.nvidia.com) through their OpenAI-compatible chat API.
import type { LlmClient } from "../core/answerer.js";
import { config } from "../core/config.js";
import { LLM_ANSWER_JSON_SCHEMA, parseLlmAnswer } from "../core/contract.js";

const BASE_URL = "https://integrate.api.nvidia.com/v1";

interface ChatCompletion {
  model?: string;
  choices?: { message?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

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
      const started = performance.now();
      const response = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${options.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: config.llm.temperature,
          max_tokens: config.llm.maxTokens,
          messages: [{ role: "system", content: system }, ...messages],
          ...schemaParams,
          ...(config.llm.nvidiaDisableThinking ? { chat_template_kwargs: { enable_thinking: false } } : {}),
        }),
        signal: AbortSignal.timeout(config.llm.requestTimeoutMs),
      });
      const latencyMs = performance.now() - started;
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
