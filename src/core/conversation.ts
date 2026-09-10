import { config } from "./config.js";
import type { Turn } from "./types.js";

export function appendTurn(history: Turn[], turn: Turn, maxTurns: number = config.historyTurns): Turn[] {
  return [...history, turn].slice(-maxTurns);
}

/** Identity of the loaded document set. When it changes, the conversation is reset (decision D4). */
export function documentSetKey(docs: { documentId: string }[]): string {
  return docs
    .map((d) => d.documentId)
    .sort()
    .join("|");
}
