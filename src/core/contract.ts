import { z } from "zod";
import { config } from "./config.js";

export const STATUSES = ["answered", "not_found", "needs_clarification", "conflict"] as const;

/** What the model must return (enforced by structured outputs). */
export const LlmAnswerSchema = z.object({
  status: z.enum(STATUSES),
  answer: z.string(),
  citations: z.array(z.string()),
  resolvedQuery: z.string(),
  activeEntities: z.array(z.string()),
});
export type LlmAnswer = z.infer<typeof LlmAnswerSchema>;

/** The same contract as a plain JSON Schema, for providers that take a raw schema. */
export const LLM_ANSWER_JSON_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: [...STATUSES] },
    answer: { type: "string" },
    citations: { type: "array", items: { type: "string" } },
    resolvedQuery: { type: "string" },
    activeEntities: { type: "array", items: { type: "string" } },
  },
  required: ["status", "answer", "citations", "resolvedQuery", "activeEntities"],
  additionalProperties: false,
};

/** Parses model output into the contract. Tolerates code fences or text around the JSON object. */
export function parseLlmAnswer(rawText: string): LlmAnswer | null {
  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const result = LlmAnswerSchema.safeParse(JSON.parse(rawText.slice(start, end + 1)));
    if (!result.success) return null;
    // Some models copy the brackets around ids from the evidence ("[d1:p2:s3]").
    return { ...result.data, citations: result.data.citations.map((id) => id.trim().replace(/^\[(.*)\]$/, "$1")) };
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
});
export type AnswerRequest = z.infer<typeof AnswerRequestSchema>;
