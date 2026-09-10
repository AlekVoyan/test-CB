import { config } from "./config.js";
import type { Usage } from "./types.js";

/** Variable LLM cost of one operation at the published per-token price (see docs/pricing.md). */
export function llmCostUsd(usage: Usage, pricing: { inputUsdPerMTok: number; outputUsdPerMTok: number } = config.pricing): number {
  return (usage.inputTokens / 1e6) * pricing.inputUsdPerMTok + (usage.outputTokens / 1e6) * pricing.outputUsdPerMTok;
}
