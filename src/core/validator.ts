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

// A not_found answer has to say in words that the documents lack the answer. English, Russian and Ukrainian wording;
// any kind of document ("the CV does not mention", "в резюме не указано"). An answer that finds the question itself
// unclear is caught separately, before this check.
const NEGATION_RE = /\b(not|no|cannot|couldn't|can't|doesn't|don't|isn't|aren't|without|neither|nor)\b/i;
const ABOUT_DOCS_RE =
  /(document|manual|guide|uploaded|\bcv\b|resume|résumé|file|specif|mention|state|contain|cover|include|information|find|found|list|provide)/i;
const NEGATION_CYR_RE = /(?<!\p{L})(не|нет|немає|ні|без|нельзя)(?!\p{L})|отсутств|відсутн/iu;
const ABOUT_DOCS_CYR_RE =
  /документ|руководств|посібник|инструкц|інструкц|резюме|файл|указан|вказан|зазнач|упомина|згаду|содерж|міст|описан|информац|інформац|найд|найти|знайд|знайти/iu;

// A not-found answer that finds the question unclear ("The question does not specify which limit", "... what limit is
// being asked about") is a clarification in disguise.
const QUESTION_UNCLEAR_RE =
  /\bthe question\b[^.?!]*\b(does not|doesn't|did not|didn't|is not|isn't)\b|\b(what|which)\b[^.?!]*\b(is being asked|are you asking|you are asking|you mean|you're referring|you are referring|is meant)\b|что именно|какой именно|вы имеете в виду|що саме|який саме|ви маєте на увазі/iu;

// A clarification asks the user to choose: a question, or a request such as "Please specify which model ...".
const ASKS_RE = /\?|\b(which|specify|clarify)\b|уточн|котор|какой|какая|какое|какую|який|яка|яке|яку|якої|якого/iu;

function saysNotFound(answer: string): boolean {
  return (NEGATION_RE.test(answer) && ABOUT_DOCS_RE.test(answer)) || (NEGATION_CYR_RE.test(answer) && ABOUT_DOCS_CYR_RE.test(answer));
}

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
        errors.push(
          'Status "conflict" needs citations from at least two different documents that disagree. If the question assumes something the document contradicts, correct it with status "answered".',
        );
      break;
    case "not_found":
      if (ids.length && out.basis === "inferred") {
        // The model derived something from the lines it cited: point the retry at the answered status, in its own words.
        const why = out.reason.trim() ? ` and gave this reason: "${out.reason.trim()}"` : "";
        errors.push(
          `Status "not_found" must have an empty citations list. You cited lines${why}. If the cited lines decide the question, answer it: status "answered", basis "inferred", keep the reason and the citations. If they do not, use "not_found" with no citations.`,
        );
      } else if (ids.length) errors.push('Status "not_found" must have an empty citations list.');
      // The model follows the first instruction of a retry hint, so an unclear question gets only the clarification path.
      if (QUESTION_UNCLEAR_RE.test(answer))
        errors.push(
          'This answer says the question is unclear, so the status is "needs_clarification", not "not_found". Ask one short question that names the options the documents distinguish, for example the models.',
        );
      else if (!saysNotFound(answer))
        errors.push('A "not_found" answer must say explicitly that the uploaded documents do not contain the answer.');
      break;
    case "needs_clarification":
      // Citations are allowed here only to back numbers in the question; the answerer does not show them.
      if (!ASKS_RE.test(answer)) errors.push('A "needs_clarification" answer must ask which option the user means.');
      break;
  }

  // Reasoning fields. basis, reason and assumed describe an answer; on other statuses they are ignored (the answerer
  // drops them). Related lines count only on a not-found answer, where they may back the numbers they mention.
  const isAnswer = out.status === "answered" || out.status === "conflict";
  const inferred = isAnswer && out.basis === "inferred";
  const relatedUnits: EvidenceUnit[] = [];
  if (out.status === "not_found") {
    for (const id of new Set(out.related)) {
      const unit = ctx.evidenceById.get(id);
      if (unit) relatedUnits.push(unit);
      else errors.push(`Unknown related id "${id}". Use only ids that appear in the evidence.`);
    }
  }
  if (inferred && !out.reason.trim())
    errors.push('An inferred answer needs a one-sentence "reason" naming the rule it follows from.');

  // Every number in the answer or reason must be backed by a cited or related line, or come from the question.
  // Digits in a cited file name ("manual-v2.pdf") are allowed so conflict answers can name the documents.
  const allowed = new Set([
    ...extractNumbers(ctx.question),
    ...[...cited, ...relatedUnits].flatMap((u) => [...extractNumbers(u.text), ...extractNumbers(u.filename)]),
  ]);
  for (const n of extractNumbers(`${answer} ${inferred ? out.reason : ""}`)) {
    if (allowed.has(n)) continue;
    // Point the retry at the lines that do contain the number, so a mis-cited fact can be fixed.
    const holders = [...ctx.evidenceById.values()].filter((u) => extractNumbers(u.text).has(n)).slice(0, 3);
    const hint = holders.length
      ? ` Lines that contain ${n}: ${holders.map((u) => `[${u.id}] ${u.text}`).join(" ")} Cite the line that actually supports your statement, or remove the number.`
      : " No evidence line contains it, so remove it. Do not mention page numbers or line ids.";
    errors.push(`The number ${n} in the answer does not appear in any cited line or in the question.${hint}`);
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
