import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { LlmClient } from "../core/answerer.js";
import { config } from "../core/config.js";
import { LlmAnswerSchema, type LlmAnswer } from "../core/contract.js";

function parseAnswer(rawText: string): LlmAnswer | null {
  try {
    const result = LlmAnswerSchema.safeParse(JSON.parse(rawText));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Claude via the Anthropic SDK, with the answer schema enforced by structured outputs. */
export function createAnthropicLlm(options: { apiKey?: string; model?: string } = {}): LlmClient {
  const client = new Anthropic({ apiKey: options.apiKey });
  const model = options.model ?? config.llm.model;
  const format = zodOutputFormat(LlmAnswerSchema);

  return {
    async complete({ system, messages }) {
      const started = performance.now();
      const response = await client.messages.create({
        model,
        max_tokens: config.llm.maxTokens,
        temperature: config.llm.temperature,
        system,
        messages,
        output_config: { format },
      });
      const latencyMs = performance.now() - started;
      const rawText = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
      return {
        parsed: parseAnswer(rawText),
        rawText,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        latencyMs,
        model: response.model,
        stopReason: response.stop_reason,
      };
    },
  };
}
