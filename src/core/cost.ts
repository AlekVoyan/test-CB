import { PRICES, TTS_PRICES, type Price } from "./config.js";
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

/** Cost of speaking `chars` characters with a hosted voice; the longest matching model prefix sets the price. */
export function ttsCostUsd(model: string, chars: number): number {
  const key = Object.keys(TTS_PRICES)
    .filter((prefix) => model.startsWith(prefix))
    .sort((a, b) => b.length - a.length)[0];
  const price = key ? TTS_PRICES[key] : undefined;
  return price === undefined ? Number.NaN : (chars / 1000) * price;
}
