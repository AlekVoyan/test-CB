import type { Language } from "../core/config";
import type { AnswerResult, EvidenceUnit, Turn } from "../core/types";

export async function askServer(body: {
  question: string;
  history: Turn[];
  evidence: EvidenceUnit[];
  language: Language;
}): Promise<AnswerResult> {
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
  const json = (await response.json().catch(() => null)) as (AnswerResult & { error?: string }) | null;
  if (!response.ok || !json) throw new Error(json?.error ?? `Server error ${response.status}.`);
  return json;
}
