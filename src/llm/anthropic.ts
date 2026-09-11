import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { LlmClient } from "../core/answerer.js";
import { config } from "../core/config.js";
import { LlmAnswerSchema, parseLlmAnswer } from "../core/contract.js";

/** Claude via the Anthropic SDK, with the answer schema enforced by structured outputs. */
export function createAnthropicLlm(options: { apiKey: string; model?: string }): LlmClient {
  const client = new Anthropic({ apiKey: options.apiKey, timeout: config.llm.requestTimeoutMs });
  const model = options.model ?? config.llm.anthropicModel;
  const format = zodOutputFormat(LlmAnswerSchema);

  // "Think harder": Haiku 4.5 has manual extended thinking only (a fixed budget_tokens). Thinking tokens count
  // toward max_tokens, so the budget is added on top; thinking runs at the default temperature.
  const deepParams = {
    max_tokens: config.llm.maxTokens + config.llm.deepThinkingBudget,
    thinking: { type: "enabled" as const, budget_tokens: config.llm.deepThinkingBudget },
  };
  const plainParams = { max_tokens: config.llm.maxTokens, temperature: config.llm.temperature };

  return {
    supportsDeep: true,
    async complete({ system, messages, deep }) {
      const started = performance.now();
      const response = await client.messages.create({
        model,
        ...(deep ? deepParams : plainParams),
        system,
        messages,
        output_config: { format },
      });
      const latencyMs = performance.now() - started;
      const rawText = response.content.map((block) => (block.type === "text" ? block.text : "")).join("");
      return {
        parsed: parseLlmAnswer(rawText),
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
