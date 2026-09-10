import type { LlmAnswer } from "./contract.js";
import { normalizeText } from "./normalize.js";
import type { Citation, EvidenceUnit, IndexedDocument } from "./types.js";

const WORD_NUMBERS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9",
  ten: "10", eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16",
  seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20",
};
// Word numbers count only before a unit, so "the other one" is not read as 1.
const WORD_NUMBER_RE = new RegExp(
  `\\b(${Object.keys(WORD_NUMBERS).join("|")})\\s+(units?|minutes?|seconds?|hours?|days?|weeks?|months?|years?|liters?|litres?|degrees?|times|steps?|channels?)\\b`,
  "gi",
);

export function extractNumbers(text: string): Set<string> {
  const normalized = normalizeText(text);
  const out = new Set<string>();
  for (const m of normalized.matchAll(/\d+(?:\.\d+)?/g)) out.add(m[0]);
  for (const m of normalized.matchAll(WORD_NUMBER_RE)) {
    const n = WORD_NUMBERS[m[1]!.toLowerCase()];
    if (n) out.add(n);
  }
  return out;
}

// A not_found answer has to say so in words, not just stay silent.
const NEGATION_RE = /\b(not|no|cannot|couldn't|can't|doesn't|don't|isn't|aren't|without|neither|nor)\b/i;
const ABOUT_DOCS_RE = /(document|manual|guide|uploaded|specif|mention|state|contain|cover|include|information|find|found|list|provide)/i;

export interface ValidationContext {
  question: string;
  evidenceById: Map<string, EvidenceUnit>;
  maxWords: number;
  maxCitations: number;
}

export interface ValidationOutcome {
  errors: string[];
  warnings: string[];
}

export function validateLlmAnswer(out: LlmAnswer, ctx: ValidationContext): ValidationOutcome {
  const errors: string[] = [];
  const warnings: string[] = [];
  const answer = out.answer.trim();
  const ids = [...new Set(out.citations)];

  if (!answer) errors.push("The answer is empty.");

  const cited: EvidenceUnit[] = [];
  for (const id of ids) {
    const unit = ctx.evidenceById.get(id);
    if (unit) cited.push(unit);
    else errors.push(`Unknown evidence id "${id}". Cite only ids that appear in the evidence.`);
  }

  switch (out.status) {
    case "answered":
      if (ids.length === 0) errors.push('Status "answered" needs at least one citation.');
      break;
    case "conflict":
      if (new Set(cited.map((u) => u.documentId)).size < 2)
        errors.push('Status "conflict" needs citations from at least two different documents.');
      break;
    case "not_found":
      if (ids.length) errors.push('Status "not_found" must have an empty citations list.');
      if (!(NEGATION_RE.test(answer) && ABOUT_DOCS_RE.test(answer)))
        errors.push('A "not_found" answer must say explicitly that the uploaded documents do not contain the answer.');
      break;
    case "needs_clarification":
      if (ids.length) errors.push('Status "needs_clarification" must have an empty citations list.');
      if (!answer.includes("?")) errors.push('A "needs_clarification" answer must be a question.');
      break;
  }

  // Every number in the answer must be backed by a cited line or come from the user's question.
  // Digits in a cited file name ("manual-v2.pdf") are allowed so conflict answers can name the documents.
  const allowed = new Set([
    ...extractNumbers(ctx.question),
    ...cited.flatMap((u) => [...extractNumbers(u.text), ...extractNumbers(u.filename)]),
  ]);
  for (const n of extractNumbers(answer)) {
    if (!allowed.has(n))
      errors.push(`The number ${n} in the answer does not appear in any cited line or in the question. Do not mention page numbers or line ids.`);
  }

  const words = answer.split(/\s+/).filter(Boolean).length;
  if (words > ctx.maxWords) warnings.push(`Answer has ${words} words (limit ${ctx.maxWords}).`);
  if (ids.length > ctx.maxCitations) warnings.push(`Answer cites ${ids.length} lines (limit ${ctx.maxCitations}).`);

  return { errors, warnings };
}

/** Citations are built from the index, so quotes are verbatim by construction. */
export function buildCitations(ids: string[], evidenceById: Map<string, EvidenceUnit>): Citation[] {
  return [...new Set(ids)].flatMap((id) => {
    const u = evidenceById.get(id);
    return u ? [{ documentId: u.documentId, filename: u.filename, page: u.page, sentenceId: u.id, quote: u.text }] : [];
  });
}

/** Independent check against the full page text held by the client (or the eval). */
export function verifyCitations(citations: Citation[], docs: IndexedDocument[]): string[] {
  const errors: string[] = [];
  for (const c of citations) {
    const doc = docs.find((d) => d.documentId === c.documentId);
    const page = doc?.pages.find((p) => p.page === c.page);
    if (!doc) errors.push(`${c.sentenceId}: document ${c.documentId} is not loaded.`);
    else if (!page) errors.push(`${c.sentenceId}: page ${c.page} does not exist in ${doc.filename}.`);
    else if (!page.text.includes(normalizeText(c.quote)))
      errors.push(`${c.sentenceId}: quote is not an exact substring of page ${c.page}.`);
  }
  return errors;
}
