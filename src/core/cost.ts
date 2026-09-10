import { PRICES, type Price } from "./config.js";
import type { Usage } from "./types.js";

export function priceFor(model: string): Price | undefined {
  const key = Object.keys(PRICES).find((prefix) => model.startsWith(prefix));
  return key ? PRICES[key] : undefined;
}

/** Variable LLM cost of one operation at the assumed per-token price. NaN when there is no price assumption for the model. */
export function llmCostUsd(usage: Usage & { model: string }): number {
  const price = priceFor(usage.model);
  if (!price) return Number.NaN;
  return (usage.inputTokens / 1e6) * price.inputUsdPerMTok + (usage.outputTokens / 1e6) * price.outputUsdPerMTok;
}
