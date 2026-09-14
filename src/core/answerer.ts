import { config, DEFAULT_LANGUAGE, type Language } from "./config.js";
import type { LlmAnswer } from "./contract.js";
import { LANGUAGES } from "./config.js";
import { wrongAnswerLanguage } from "./language.js";
import { normalizeSpokenQuestion } from "./normalize.js";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompt.js";
import { assumptionPrefix, findCorrectedSlip } from "./slips.js";
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
  /** Whether the model can reason before it answers ("Think harder"). */
  supportsDeep: boolean;
  complete(request: { system: string; messages: LlmMessage[]; deep?: boolean }): Promise<LlmCompletion>;
}

const UNVERIFIED: Record<Language, string> = {
  en: "I couldn't verify an answer in the uploaded documents.",
  ru: "Не удалось проверить ответ по загруженным документам.",
  uk: "Не вдалося перевірити відповідь за завантаженими документами.",
};

/** What is said when no answer passed validation, in the language that was asked in. */
export const unverifiedAnswer = (language: Language = DEFAULT_LANGUAGE) => UNVERIFIED[language];
export const UNVERIFIED_ANSWER = UNVERIFIED.en;

/** What a rejected attempt said. The validator's reason alone does not show where a rejected number came from. */
function whatItSaid(attempt: number, completion: LlmCompletion): string {
  const out = completion.parsed;
  if (!out) return `attempt ${attempt} (unparsed): ${completion.rawText.slice(0, 400)}`;
  const reason = out.reason.trim() ? ` · reason: ${out.reason.trim()}` : "";
  const cited = out.citations.length ? ` · cites ${out.citations.join(", ")}` : "";
  return `attempt ${attempt} (${out.status}): ${out.answer.trim()}${reason}${cited}`;
}

const contentWords = (text: string) => new Set(text.toLowerCase().match(/\p{L}{4,}|\p{N}+/gu) ?? []);

/** A related line is shown only when the answer talks about it: they share a word or number the question does not. */
function answerMentions(answer: string, line: string, question: string): boolean {
  const asked = contentWords(question);
  const said = contentWords(answer);
  return [...contentWords(line)].some((w) => said.has(w) && !asked.has(w));
}

/** The documents' own word, or nothing: an offer the documents do not support is not made. */
function offeredWord(word: string, evidence: EvidenceUnit[]): string {
  const term = word.trim();
  if (!term || term.split(/\s+/).length > 4) return "";
  const needle = term.toLowerCase();
  return evidence.some((u) => u.text.toLowerCase().includes(needle)) ? term : "";
}

/** What the user hears (and reads): the answer, then for an inference the rule it rests on. */
export function spokenAnswer(r: Pick<AnswerResult, "basis" | "answer" | "reason">): string {
  return r.basis === "inferred" && r.reason ? `${r.answer} ${r.reason}` : r.answer;
}

export async function answerQuestion(input: {
  question: string;
  history: Turn[];
  evidence: EvidenceUnit[];
  llm: LlmClient;
  language?: Language;
  /** "Think harder": ignored by models that cannot reason first (reported as not applied). */
  deep?: boolean;
  maxAttempts?: number;
}): Promise<AnswerResult> {
  const started = performance.now();
  const maxAttempts = input.maxAttempts ?? config.maxAttempts;
  const deep = { requested: !!input.deep, applied: !!input.deep && input.llm.supportsDeep };
  const evidenceById = new Map(input.evidence.map((u) => [u.id, u]));
  const question = normalizeSpokenQuestion(input.question);
  const language = input.language ?? DEFAULT_LANGUAGE;
  const messages: LlmMessage[] = [{ role: "user", content: buildUserPrompt(question, input.history, input.evidence, language) }];

  const llmMs: number[] = [];
  let validationMs = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let model = "";
  let errors: string[] = [];
  let warnings: string[] = [];
  /** A validated answer in the wrong language, traded in for one more call: better than nothing if that call fails. */
  let kept: { out: LlmAnswer; warnings: string[] } | null = null;
  const retryReasons: string[] = [];
  const rejectedAnswers: string[] = [];

  /** Builds the answer the caller gets: the same door for an answer that passed and for a kept one. */
  const settle = (out: LlmAnswer, said: string[]): AnswerResult => {
    // Reasoning marks describe answers only; a clarifying question or a not-found answer keeps none.
    const isAnswer = out.status === "answered" || out.status === "conflict";
    const inferred = isAnswer && out.basis === "inferred";
    // A slip the model fixed without saying so is named in the answer, so the user hears what was assumed.
    const silentFix = isAnswer && !out.assumed.trim() ? findCorrectedSlip(question, out.resolvedQuery, input.evidence) : null;
    return {
      status: out.status,
      basis: inferred ? "inferred" : "stated",
      answer: silentFix ? `${assumptionPrefix(language, silentFix)} ${out.answer.trim()}` : out.answer.trim(),
      reason: inferred ? out.reason.trim() : "",
      // A clarifying question makes no claim, so it shows no quotes.
      citations: out.status === "needs_clarification" ? [] : buildCitations(out.citations, evidenceById),
      related:
        out.status === "not_found"
          ? buildCitations(out.related, evidenceById)
              .filter((c) => answerMentions(out.answer, c.quote, question))
              .slice(0, config.maxRelated)
          : [],
      assumed: isAnswer ? out.assumed.trim() || silentFix || "" : "",
      didYouMean: out.status === "not_found" ? offeredWord(out.didYouMean, input.evidence) : "",
      deep,
      resolvedQuery: out.resolvedQuery,
      activeEntities: out.activeEntities,
      validation: { passed: true, attempts: llmMs.length, errors: [], warnings: said, retryReasons, rejectedAnswers },
      usage: { inputTokens, outputTokens, model },
      timings: { llmMs, validationMs, totalMs: performance.now() - started },
    };
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const completion = await input.llm.complete({ system: SYSTEM_PROMPT, messages, deep: deep.applied });
    llmMs.push(completion.latencyMs);
    inputTokens += completion.inputTokens;
    outputTokens += completion.outputTokens;
    model = completion.model;

    const t0 = performance.now();
    if (completion.parsed) {
      ({ errors, warnings } = validateLlmAnswer(completion.parsed, {
        question,
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
      // A right answer in the wrong language is unusable, so it is worth one more call. It is never worth losing,
      // though: the answer is kept here, and returned if the call spent on the language leaves nothing better.
      const want = LANGUAGES[language].name;
      const slipped = wrongAnswerLanguage(`${out.answer} ${out.reason}`, language);
      if (slipped && attempt < maxAttempts) {
        kept = { out, warnings: [...warnings, `The answer is not in ${want}.`] };
        retryReasons.push(`attempt ${attempt} (${out.status}): the answer is not in ${want}`);
        rejectedAnswers.push(whatItSaid(attempt, completion));
        messages.push({ role: "assistant", content: completion.rawText || "(no output)" });
        messages.push({
          role: "user",
          content: `Your answer is not written in ${want}. Answer the same question again, in ${want} (${LANGUAGES[language].nativeName}), keeping the same status, citations and meaning. Quotes stay in the document's own language.`,
        });
        continue;
      }
      return settle(out, slipped ? [...warnings, `The answer is not in ${want}.`] : warnings);
    }

    // Retry once with the validator's findings.
    retryReasons.push(...errors.map((e) => `attempt ${attempt} (${completion.parsed?.status ?? "unparsed"}): ${e}`));
    rejectedAnswers.push(whatItSaid(attempt, completion));
    messages.push({ role: "assistant", content: completion.rawText || "(no output)" });
    messages.push({
      role: "user",
      content: `Your answer failed validation:\n- ${errors.join("\n- ")}\nFix these problems and answer the same question again in the required format.`,
    });
  }

  // Never return an answer that did not pass validation. An answer that passed but spoke the wrong language did.
  if (kept) return settle(kept.out, kept.warnings);
  return {
    status: "not_found",
    basis: "stated",
    answer: unverifiedAnswer(language),
    didYouMean: "",
    reason: "",
    citations: [],
    related: [],
    assumed: "",
    deep,
    resolvedQuery: input.question,
    activeEntities: [],
    validation: { passed: false, attempts: maxAttempts, errors, warnings, retryReasons, rejectedAnswers },
    usage: { inputTokens, outputTokens, model },
    timings: { llmMs, validationMs, totalMs: performance.now() - started },
  };
}
