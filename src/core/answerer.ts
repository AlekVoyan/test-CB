import { config } from "./config.js";
import type { LlmAnswer } from "./contract.js";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt.js";
import type { AnswerResult, EvidenceUnit, Turn } from "./types.js";
import { buildCitations, validateLlmAnswer } from "./validator.js";

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmCompletion {
  /** null when the response could not be parsed into the schema (refusal, truncation, ...). */
  parsed: LlmAnswer | null;
  rawText: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  model: string;
  stopReason: string | null;
}

export interface LlmClient {
  complete(request: { system: string; messages: LlmMessage[] }): Promise<LlmCompletion>;
}

export const UNVERIFIED_ANSWER = "I couldn't verify an answer in the uploaded documents.";

export async function answerQuestion(input: {
  question: string;
  history: Turn[];
  evidence: EvidenceUnit[];
  llm: LlmClient;
  maxAttempts?: number;
}): Promise<AnswerResult> {
  const started = performance.now();
  const maxAttempts = input.maxAttempts ?? config.maxAttempts;
  const evidenceById = new Map(input.evidence.map((u) => [u.id, u]));
  const messages: LlmMessage[] = [{ role: "user", content: buildUserPrompt(input.question, input.history, input.evidence) }];

  const llmMs: number[] = [];
  let validationMs = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let model: string = config.llm.model;
  let errors: string[] = [];
  let warnings: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const completion = await input.llm.complete({ system: SYSTEM_PROMPT, messages });
    llmMs.push(completion.latencyMs);
    inputTokens += completion.inputTokens;
    outputTokens += completion.outputTokens;
    model = completion.model;

    const t0 = performance.now();
    if (completion.parsed) {
      ({ errors, warnings } = validateLlmAnswer(completion.parsed, {
        question: input.question,
        evidenceById,
        maxWords: config.answerMaxWords,
        maxCitations: config.maxCitations,
      }));
    } else {
      errors = [`The response did not match the required JSON format (stop reason: ${completion.stopReason ?? "unknown"}).`];
    }
    validationMs += performance.now() - t0;

    if (completion.parsed && errors.length === 0) {
      const out = completion.parsed;
      return {
        status: out.status,
        answer: out.answer.trim(),
        citations: buildCitations(out.citations, evidenceById),
        resolvedQuery: out.resolvedQuery,
        activeEntities: out.activeEntities,
        validation: { passed: true, attempts: attempt, errors: [], warnings },
        usage: { inputTokens, outputTokens, model },
        timings: { llmMs, validationMs, totalMs: performance.now() - started },
      };
    }

    // Retry once with the validator's findings.
    messages.push({ role: "assistant", content: completion.rawText || "(no output)" });
    messages.push({
      role: "user",
      content: `Your answer failed validation:\n- ${errors.join("\n- ")}\nFix these problems and answer the same question again in the required format.`,
    });
  }

  // Never return an answer that did not pass validation.
  return {
    status: "not_found",
    answer: UNVERIFIED_ANSWER,
    citations: [],
    resolvedQuery: input.question,
    activeEntities: [],
    validation: { passed: false, attempts: maxAttempts, errors, warnings },
    usage: { inputTokens, outputTokens, model },
    timings: { llmMs, validationMs, totalMs: performance.now() - started },
  };
}
