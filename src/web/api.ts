import type { Language } from "../core/config";
import type { AnswerResult, EvidenceUnit, Turn } from "../core/types";
import type { SpeechTicket } from "./tts";

export interface ServerInfo {
  provider: string;
  model: string;
  /** Whether "Think harder" is available with this model. */
  deep: boolean;
  /** The hosted voice, when the server has one. */
  voice?: { provider: string; model: string; name: string } | null;
}

/** The answer, plus a ticket to have it spoken by the hosted voice when the server has one. */
export type AnswerResponse = AnswerResult & { speech?: SpeechTicket };

export async function askServer(body: {
  question: string;
  history: Turn[];
  evidence: EvidenceUnit[];
  language: Language;
  deep: boolean;
}): Promise<AnswerResponse> {
  let response: Response;
  try {
    response = await fetch("/api/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }
  const json = (await response.json().catch(() => null)) as (AnswerResponse & { error?: string }) | null;
  if (!response.ok || !json) throw new Error(json?.error ?? `Server error ${response.status}.`);
  return json;
}

/** Which model answers and whether it can think harder; null when the server cannot say. */
export async function fetchServerInfo(): Promise<ServerInfo | null> {
  try {
    const response = await fetch("/api/answer");
    return response.ok ? ((await response.json()) as ServerInfo) : null;
  } catch {
    return null;
  }
}
