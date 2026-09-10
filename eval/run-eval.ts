// Runs eval/expected.json against the real pipeline (real PDFs, real LLM) and writes
// eval/results/actual-results.json + eval/results/report.md.
// Usage: npm run eval [-- --session S5] [-- --runs 1]
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { answerQuestion } from "../src/core/answerer.js";
import { config, type RetrievalMode } from "../src/core/config.js";
import { appendTurn } from "../src/core/conversation.js";
import { llmCostUsd, priceFor } from "../src/core/cost.js";
import { ingestPdf } from "../src/core/ingest.js";
import { normalizeText } from "../src/core/normalize.js";
import { selectEvidence } from "../src/core/retriever.js";
import type { AnswerResult, AnswerStatus, IndexedDocument, Turn } from "../src/core/types.js";
import { verifyCitations } from "../src/core/validator.js";
import { createLlmFromEnv } from "../src/llm/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(path.join(root, ".env"));
} catch {
  // no .env — rely on the shell environment
}

// ---------- expected.json shape ----------
interface Source {
  file: string;
  page: number;
}
interface Expected {
  status: AnswerStatus;
  answer: string;
  mustInclude: string[][];
  mustNotInclude: string[];
  sources: Source[];
  allowedExtraSources: Source[];
}
type UploadSpec = string | { file: string; as: string };
type Step =
  | { upload: UploadSpec[] }
  | { remove: string[] }
  | { ask: string; testId?: string; type?: string; priority?: string; expected?: Expected };
interface Session {
  id: string;
  steps: Step[];
}

// ---------- args ----------
const args = process.argv.slice(2);
const argValue = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const onlySession = argValue("--session");
const runs = Number(argValue("--runs") ?? process.env.EVAL_RUNS ?? 3);
const mode = (process.env.RETRIEVAL_MODE as RetrievalMode | undefined) ?? config.retrievalMode;
// Record the code version at the start: the report is written minutes later and HEAD may have moved.
let commit = "unknown";
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim();
  if (execSync("git status --porcelain -- src eval/run-eval.ts", { cwd: root }).toString().trim()) commit += " + uncommitted changes";
} catch {
  // not a git checkout
}

const created = createLlmFromEnv(process.env);
if ("error" in created) {
  console.error(`${created.error} Copy .env.example to .env and add the key.`);
  process.exit(1);
}
const { llm, provider, model } = created;

const expectedFile = JSON.parse(readFileSync(path.join(root, "eval", "expected.json"), "utf8")) as { sessions: Session[] };
const sessionFilter = onlySession ? new Set(onlySession.split(",")) : null;
const sessions = expectedFile.sessions.filter((s) => !sessionFilter || sessionFilter.has(s.id));
// A partial run writes its own files so it never overwrites the full report.
const suffix = onlySession ? `-${onlySession.replace(/,/g, "+")}` : "";
const fixture = (file: string) => new Uint8Array(readFileSync(path.join(root, "fixtures", file)));

// ---------- scoring ----------
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const forMatch = (s: string) =>
  normalizeText(s)
    .replace(/\s*°\s*c\b/gi, "°C")
    .replace(/\s+degrees?\s+(celsius|c)\b/gi, "°C");
function hasTerm(text: string, term: string): boolean {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(forMatch(term))}(?![\\p{L}\\p{N}])`, "iu").test(forMatch(text));
}

const CITING = new Set<AnswerStatus>(["answered", "conflict"]);
const sourceKey = (s: Source) => `${s.file}#${s.page}`;

function score(result: AnswerResult, expected: Expected, quoteErrors: string[]) {
  const statusOk = result.status === expected.status;
  const forbidden = expected.mustNotInclude.filter((t) => hasTerm(result.answer, t));
  const missing = expected.mustInclude.filter((group) => !group.some((alt) => hasTerm(result.answer, alt)));
  const factual = !statusOk || forbidden.length ? 0 : missing.length ? 0.5 : 1;

  let citation: number;
  const cited = new Set(result.citations.map((c) => sourceKey({ file: c.filename, page: c.page })));
  if (CITING.has(expected.status)) {
    const allowed = new Set([...expected.sources, ...expected.allowedExtraSources].map(sourceKey));
    const allExpectedCited = expected.sources.every((s) => cited.has(sourceKey(s)));
    const extras = [...cited].filter((k) => !allowed.has(k));
    citation = allExpectedCited && result.citations.length > 0 && quoteErrors.length === 0 ? (extras.length ? 0.5 : 1) : 0;
  } else {
    citation = result.citations.length === 0 ? 1 : 0;
  }

  const critical =
    (CITING.has(expected.status) && factual >= 0.5 && citation === 0) ||
    (expected.status === "not_found" && result.status === "answered");
  const notes = [
    !statusOk && `status ${result.status} ≠ ${expected.status}`,
    missing.length && `missing: ${missing.map((g) => g.join("/")).join(", ")}`,
    forbidden.length && `forbidden: ${forbidden.join(", ")}`,
    ...quoteErrors,
  ].filter(Boolean) as string[];
  return { factual, citation, pass: factual === 1 && citation === 1, critical, notes };
}

// ---------- run ----------
interface Record_ {
  run: number;
  session: string;
  testId: string;
  type: string;
  priority: string;
  question: string;
  expected: Expected;
  actual: {
    status: AnswerStatus;
    answer: string;
    citations: { file: string; page: number; sentenceId: string; quote: string }[];
    resolvedQuery: string;
    validation: AnswerResult["validation"];
  };
  scores: ReturnType<typeof score>;
  evidence: { mode: RetrievalMode; units: number; estimatedTokens: number };
  latencyMs: { retrieval: number; llmAttempts: number[]; validation: number; total: number };
  usage: AnswerResult["usage"];
  costUsd: number;
  changedFromBaseline?: boolean;
}

const records: Record_[] = [];
const ingestions: { file: string; pages: number; extractMs: number; indexMs: number }[] = [];
const apiErrors: { run: number; session: string; testId: string; question: string; error: string }[] = [];

for (let run = 1; run <= runs; run++) {
  for (const session of sessions) {
    let docs: IndexedDocument[] = [];
    let history: Turn[] = [];
    let keyCounter = 0;
    const answersByTest = new Map<string, string>();

    for (const step of session.steps) {
      if ("upload" in step) {
        for (const spec of step.upload) {
          const file = typeof spec === "string" ? spec : spec.file;
          const filename = typeof spec === "string" ? spec : spec.as;
          keyCounter++;
          const doc = await ingestPdf({
            bytes: fixture(file),
            filename,
            documentId: `${filename}#${keyCounter}`,
            docKey: `d${keyCounter}`,
            existing: docs,
            pdfjs,
          });
          docs = [...docs, doc];
          ingestions.push({ file, pages: doc.pageCount, ...doc.timings });
        }
        history = []; // document set changed → reset (D4)
      } else if ("remove" in step) {
        docs = docs.filter((d) => !step.remove.includes(d.filename));
        history = [];
      } else {
        const t0 = performance.now();
        const selection = selectEvidence(docs, step.ask, { mode, history });
        const retrievalMs = performance.now() - t0;
        let result: AnswerResult;
        try {
          result = await answerQuestion({ question: step.ask, history, evidence: selection.units, llm });
        } catch (error) {
          // Provider outage (after the adapter's own retries): record it, don't score it, keep going.
          const message = error instanceof Error ? error.message : String(error);
          console.log(`run ${run} ${session.id} ${(step.testId ?? "(setup)").padEnd(12)} API-ERROR ${message}`);
          apiErrors.push({ run, session: session.id, testId: step.testId ?? "(setup ask)", question: step.ask, error: message });
          continue;
        }
        const quoteErrors = verifyCitations(result.citations, docs);
        history = appendTurn(history, {
          question: step.ask,
          resolvedQuery: result.resolvedQuery,
          status: result.status,
          answer: result.answer,
          activeEntities: result.activeEntities,
        });

        if (step.testId && step.expected) {
          answersByTest.set(step.testId, result.answer);
          const scores = score(result, step.expected, quoteErrors);
          const baseline = answersByTest.get(`${step.testId}-baseline`);
          records.push({
            run,
            session: session.id,
            testId: step.testId,
            type: step.type ?? "",
            priority: step.priority ?? "",
            question: step.ask,
            expected: step.expected,
            actual: {
              status: result.status,
              answer: result.answer,
              citations: result.citations.map((c) => ({ file: c.filename, page: c.page, sentenceId: c.sentenceId, quote: c.quote })),
              resolvedQuery: result.resolvedQuery,
              validation: result.validation,
            },
            scores,
            evidence: { mode: selection.mode, units: selection.units.length, estimatedTokens: selection.estimatedTokens },
            latencyMs: {
              retrieval: retrievalMs,
              llmAttempts: result.timings.llmMs,
              validation: result.timings.validationMs,
              total: retrievalMs + result.timings.totalMs,
            },
            usage: result.usage,
            costUsd: llmCostUsd(result.usage),
            ...(baseline !== undefined ? { changedFromBaseline: baseline !== result.answer } : {}),
          });
          const mark = scores.pass ? "PASS" : scores.critical ? "CRITICAL" : "FAIL";
          console.log(`run ${run} ${session.id} ${step.testId.padEnd(12)} ${mark.padEnd(8)} f=${scores.factual} c=${scores.citation}  ${result.status}: ${result.answer}`);
        }
      }
    }
  }
}

// Ingestion timing on a clean set, 5 runs per fixture.
const ingestBench: { file: string; pages: number; ms: number[] }[] = [];
for (const file of ["manual-v1.pdf", "manual-v2.pdf", "holdout-nimbus.pdf"]) {
  const ms: number[] = [];
  let pages = 0;
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const doc = await ingestPdf({ bytes: fixture(file), filename: file, documentId: file, docKey: "d1", existing: [], pdfjs });
    ms.push(performance.now() - t0);
    pages = doc.pageCount;
  }
  ingestBench.push({ file, pages, ms });
}

// ---------- report ----------
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
};
const ms = (x: number) => `${Math.round(x)} ms`;
const usd = (x: number) => `$${x.toFixed(5)}`;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

const testIds = [...new Set(records.map((r) => r.testId))];
const byTest = (id: string) => records.filter((r) => r.testId === id);
const groups = [
  { name: "P0", match: (r: Record_) => r.priority === "P0" },
  { name: "P1", match: (r: Record_) => r.priority === "P1" },
  { name: "holdout", match: (r: Record_) => r.priority === "holdout" },
  { name: "all", match: () => true },
];

const lines: string[] = [];
lines.push(`# Eval report`, ``);
lines.push(`- Date: ${new Date().toISOString()}`);
lines.push(`- Commit: \`${commit}\` · provider: \`${provider}\` · model: \`${model}\` · retrieval: \`${mode}\` · runs per session: ${runs}`);
lines.push(`- Expected outcomes: \`eval/expected.json\` (committed before the first run)`);
lines.push(`- Latency here is the text pipeline in Node (retrieval + LLM + validation). Voice latency is measured in the browser.`, ``);

lines.push(`## Summary`, ``);
lines.push(`| Group | Tests | Runs | Factual accuracy | Citation accuracy | Pass rate | Critical failures |`);
lines.push(`|---|---|---|---|---|---|---|`);
for (const g of groups) {
  const rs = records.filter(g.match);
  if (!rs.length) continue;
  lines.push(
    `| ${g.name} | ${new Set(rs.map((r) => r.testId)).size} | ${rs.length} | ${pct(mean(rs.map((r) => r.scores.factual)))} | ${pct(mean(rs.map((r) => r.scores.citation)))} | ${pct(mean(rs.map((r) => (r.scores.pass ? 1 : 0))))} | ${rs.filter((r) => r.scores.critical).length} |`,
  );
}
const p0Fails = testIds.filter((id) => {
  const rs = byTest(id);
  return rs[0]?.priority === "P0" && rs.filter((r) => r.scores.pass).length < Math.ceil((2 / 3) * rs.length);
});
const criticalCount = records.filter((r) => r.scores.critical).length;
lines.push(``, `**Acceptance (ТЗ §7.8):** P0 tests passing in ≥ 2/3 of runs: ${p0Fails.length ? `NO — ${p0Fails.join(", ")}` : "yes"}. Critical failures: ${criticalCount}.`, ``);
if (apiErrors.length) {
  lines.push(
    `**Provider errors (not scored, excluded from the rates above):** ${apiErrors.length} — ${apiErrors.map((e) => `run ${e.run} ${e.session} ${e.testId}`).join(", ")}. Details under Failures.`,
    ``,
  );
}

lines.push(`## Factual accuracy`, ``);
lines.push(`| ID | Type | Question | Expected | Actual (run 1) | Factual per run |`);
lines.push(`|---|---|---|---|---|---|`);
for (const id of testIds) {
  const rs = byTest(id);
  const r = rs[0]!;
  lines.push(
    `| ${id} | ${r.type} | ${cell(r.question)} | ${r.expected.status}: ${cell(r.expected.answer)} | ${r.actual.status}: ${cell(r.actual.answer)} | ${rs.map((x) => x.scores.factual).join(" / ")} |`,
  );
}

lines.push(``, `## Citation accuracy`, ``);
lines.push(`| ID | Expected sources | Actual citations (run 1) | Citation per run |`);
lines.push(`|---|---|---|---|`);
for (const id of testIds) {
  const rs = byTest(id);
  const r = rs[0]!;
  const expected = r.expected.sources.length ? r.expected.sources.map((s) => `${s.file} p.${s.page}`).join(", ") : "none (0 citations)";
  const actual = r.actual.citations.length
    ? r.actual.citations.map((c) => `${c.file} p.${c.page}: "${cell(c.quote)}"`).join("<br>")
    : "none";
  lines.push(`| ${id} | ${expected} | ${actual} | ${rs.map((x) => x.scores.citation).join(" / ")} |`);
}

const failures = records.filter((r) => !r.scores.pass);
lines.push(``, `## Failures`, ``);
if (!failures.length && !apiErrors.length) lines.push(`None.`);
for (const e of apiErrors) lines.push(`- run ${e.run} ${e.session} ${e.testId}: provider error, not scored — ${cell(e.error)}`);
for (const r of failures) {
  lines.push(
    `- run ${r.run} ${r.testId}${r.scores.critical ? " **CRITICAL**" : ""}: ${r.actual.status} — "${cell(r.actual.answer)}" (${r.scores.notes.join("; ") || "see scores"}; validation attempts ${r.actual.validation.attempts})`,
  );
}
const baselineChecks = records.filter((r) => r.changedFromBaseline !== undefined);
if (baselineChecks.length) {
  lines.push(``, `Replacement check (M6 vs baseline): answer changed in ${baselineChecks.filter((r) => r.changedFromBaseline).length}/${baselineChecks.length} runs.`);
}

const totals = records.map((r) => r.latencyMs.total);
const firstLlm = records.map((r) => r.latencyMs.llmAttempts[0] ?? 0);
lines.push(``, `## Latency (Node, text pipeline)`, ``);
lines.push(`| Measure | Median | p90 | Max |`, `|---|---|---|---|`);
lines.push(`| Retrieval | ${ms(quantile(records.map((r) => r.latencyMs.retrieval), 0.5))} | ${ms(quantile(records.map((r) => r.latencyMs.retrieval), 0.9))} | ${ms(Math.max(...records.map((r) => r.latencyMs.retrieval)))} |`);
lines.push(`| LLM, first attempt | ${ms(quantile(firstLlm, 0.5))} | ${ms(quantile(firstLlm, 0.9))} | ${ms(Math.max(...firstLlm))} |`);
lines.push(`| Question total (retrieval + LLM incl. retries + validation) | ${ms(quantile(totals, 0.5))} | ${ms(quantile(totals, 0.9))} | ${ms(Math.max(...totals))} |`);
lines.push(``, `| Ingestion (Node, 5 runs) | Pages | Median | Max |`, `|---|---|---|---|`);
for (const b of ingestBench) lines.push(`| ${b.file} | ${b.pages} | ${ms(quantile(b.ms, 0.5))} | ${ms(Math.max(...b.ms))} |`);

const costs = records.map((r) => r.costUsd);
const retried = records.filter((r) => r.actual.validation.attempts > 1).length;
const p0PerRun = mean(
  Array.from({ length: runs }, (_, i) => sum(records.filter((r) => r.run === i + 1 && r.priority === "P0").map((r) => r.costUsd))),
);
const price = priceFor(model);
const costBasis = price
  ? `$${price.inputUsdPerMTok}/MTok in, $${price.outputUsdPerMTok}/MTok out — ${price.note}`
  : `no price assumption for ${model} yet`;
lines.push(``, `## Cost (LLM only, ${costBasis})`, ``);
lines.push(`| Measure | Value |`, `|---|---|`);
lines.push(`| Input tokens per question (mean) | ${Math.round(mean(records.map((r) => r.usage.inputTokens)))} |`);
lines.push(`| Output tokens per question (mean) | ${Math.round(mean(records.map((r) => r.usage.outputTokens)))} |`);
lines.push(`| Cost per question, mean / max | ${usd(mean(costs))} / ${usd(Math.max(...costs))} |`);
lines.push(`| Questions that needed a retry | ${retried}/${records.length} (${pct(retried / records.length)}) |`);
lines.push(`| Cost of one pass over the P0 tests | ${usd(p0PerRun)} |`);
lines.push(`| Cost per ingestion | $0 (parsing and indexing run locally, no API calls) |`);

mkdirSync(path.join(root, "eval", "results"), { recursive: true });
writeFileSync(
  path.join(root, "eval", "results", `actual-results${suffix}.json`),
  JSON.stringify({ generatedAt: new Date().toISOString(), commit, model, mode, runs, records, apiErrors, ingestions, ingestBench }, null, 2),
);
writeFileSync(path.join(root, "eval", "results", `report${suffix}.md`), `${lines.join("\n")}\n`);
console.log(`\nWrote eval/results/report${suffix}.md —pass rate ${pct(mean(records.map((r) => (r.scores.pass ? 1 : 0))))}, critical ${criticalCount}.`);
