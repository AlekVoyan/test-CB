import type { LlmClient } from "../core/answerer.js";
import { config, type LlmProvider } from "../core/config.js";
import { createAnthropicLlm } from "./anthropic.js";
import { createNvidiaLlm } from "./nvidia.js";

export type CreatedLlm = { llm: LlmClient; provider: LlmProvider; model: string } | { error: string };

/** Picks the model provider from the environment (LLM_PROVIDER, keys, model overrides). */
export function createLlmFromEnv(env: Record<string, string | undefined>): CreatedLlm {
  const provider = env.LLM_PROVIDER || config.llm.provider;
  if (provider === "nvidia") {
    if (!env.NVIDIA_API_KEY) return { error: "NVIDIA_API_KEY is not set on the server." };
    const model = env.NVIDIA_MODEL || config.llm.nvidiaModel;
    return { provider, model, llm: createNvidiaLlm({ apiKey: env.NVIDIA_API_KEY, model }) };
  }
  if (provider !== "anthropic") return { error: `Unknown LLM_PROVIDER "${provider}". Use "anthropic" or "nvidia".` };
  if (!env.ANTHROPIC_API_KEY) return { error: "ANTHROPIC_API_KEY is not set on the server." };
  const model = env.LLM_MODEL || config.llm.anthropicModel;
  return { provider, model, llm: createAnthropicLlm({ apiKey: env.ANTHROPIC_API_KEY, model }) };
}
