import { z } from "zod";
import { config } from "./config.js";

export const STATUSES = ["answered", "not_found", "needs_clarification", "conflict"] as const;
/** stated: a cited line says it. inferred: it follows from cited lines (a rule, range, limit or condition). */
export const BASES = ["stated", "inferred"] as const;

/** What the model must return (enforced by structured outputs). */
export const LlmAnswerSchema = z.object({
  status: z.enum(STATUSES),
  basis: z.enum(BASES),
  answer: z.string(),
  /** For an inferred answer: one short sentence naming the rule it follows from. */
  reason: z.string(),
  citations: z.array(z.string()),
  /** For not_found: ids of closely related lines worth mentioning. Never the answer. */
  related: z.array(z.string()),
  /** The corrected term when the question had an obvious slip (typo, misheard word). */
  assumed: z.string(),
  resolvedQuery: z.string(),
  activeEntities: z.array(z.string()),
});
export type LlmAnswer = z.infer<typeof LlmAnswerSchema>;

/** The same contract as a plain JSON Schema, for providers that take a raw schema. */
export const LLM_ANSWER_JSON_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: [...STATUSES] },
    basis: { type: "string", enum: [...BASES] },
    answer: { type: "string" },
    reason: { type: "string" },
    citations: { type: "array", items: { type: "string" } },
    related: { type: "array", items: { type: "string" } },
    assumed: { type: "string" },
    resolvedQuery: { type: "string" },
    activeEntities: { type: "array", items: { type: "string" } },
  },
  required: ["status", "basis", "answer", "reason", "citations", "related", "assumed", "resolvedQuery", "activeEntities"],
  additionalProperties: false,
};

// Some models copy the brackets around ids from the evidence ("[d1:p2:s3]") or stray punctuation (":d1:p2:s3").
const cleanId = (id: string) =>
  id
    .trim()
    .replace(/^\[(.*)\]$/, "$1")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

/** Parses model output into the contract. Tolerates code fences or text around the JSON object. */
export function parseLlmAnswer(rawText: string): LlmAnswer | null {
  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const result = LlmAnswerSchema.safeParse(JSON.parse(rawText.slice(start, end + 1)));
    if (!result.success) return null;
    return { ...result.data, citations: result.data.citations.map(cleanId), related: result.data.related.map(cleanId) };
  } catch {
    return null;
  }
}

const EvidenceUnitSchema = z.object({
  id: z.string().max(40),
  documentId: z.string().max(80),
  filename: z.string().max(260),
  page: z.number().int().min(1),
  paragraph: z.number().int().min(1),
  text: z.string().max(4000),
});

const TurnSchema = z.object({
  question: z.string().max(500),
  resolvedQuery: z.string().max(500),
  status: z.enum(STATUSES),
  answer: z.string().max(1000),
  activeEntities: z.array(z.string().max(80)).max(10),
});

/** Body of POST /api/answer. */
export const AnswerRequestSchema = z.object({
  question: z.string().trim().min(1).max(500),
  history: z.array(TurnSchema).max(config.historyTurns),
  evidence: z.array(EvidenceUnitSchema).min(1).max(3000),
  /** Language of the answer (and of speech). Quotes stay in the document's language. */
  language: z.enum(["en", "ru", "uk"]).default("en"),
  /** "Think harder": let the model reason before answering (Claude only; slower). */
  deep: z.boolean().default(false),
});
export type AnswerRequest = z.infer<typeof AnswerRequestSchema>;
