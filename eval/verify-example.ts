// Reproduces the worked check in docs/DELIVERY_NOTES.md §12:
// exception question → verbatim quote on page 3 → numbers in the quote → same citation for a paraphrase.
// Usage: npm run verify-example
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { answerQuestion } from "../src/core/answerer.js";
import { ingestPdf } from "../src/core/ingest.js";
import { selectEvidence } from "../src/core/retriever.js";
import { extractNumbers, verifyCitations } from "../src/core/validator.js";
import { createLlmFromEnv } from "../src/llm/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(path.join(root, ".env"));
} catch {
  // no .env — rely on the shell environment
}
const created = createLlmFromEnv(process.env);
if ("error" in created) {
  console.error(created.error);
  process.exit(1);
}
console.log(`provider: ${created.provider} · model: ${created.model}`);

const doc = await ingestPdf({
  bytes: new Uint8Array(readFileSync(path.join(root, "fixtures", "manual-v1.pdf"))),
  filename: "manual-v1.pdf",
  documentId: "manual-v1.pdf#1",
  docKey: "d1",
  existing: [],
  pdfjs,
});
const sourcePages = readFileSync(path.join(root, "fixtures", "source", "manual-v1.txt"), "utf8").split(/^=== PAGE ===$/m);

for (const question of ["Is Model B ever allowed to exceed its normal limit?", "Can Model B ever go above its usual maximum load?"]) {
  const selection = selectEvidence([doc], question);
  const result = await answerQuestion({ question, history: [], evidence: selection.units, llm: created.llm });
  console.log(`\nQ: ${question}\nA: [${result.status}] ${result.answer}`);
  for (const c of result.citations) {
    const extracted = doc.pages.find((p) => p.page === c.page)?.text ?? "";
    console.log(`  cited ${c.filename} p.${c.page} (${c.sentenceId}): "${c.quote}"`);
    console.log(`    exact substring of the text extracted from PDF page ${c.page}: ${extracted.includes(c.quote)}`);
    console.log(`    same line on page ${c.page} of fixtures/source/manual-v1.txt: ${sourcePages[c.page - 1]?.includes(c.quote) ?? false}`);
  }
  const quoted = new Set(result.citations.flatMap((c) => [...extractNumbers(c.quote)]));
  const numbers = [...extractNumbers(result.answer)].map((n) => `${n} ${quoted.has(n) ? "(in quote)" : "(NOT in quote)"}`);
  console.log(`  numbers in the answer: ${numbers.join(", ") || "none"}`);
  console.log(`  verifyCitations errors: ${JSON.stringify(verifyCitations(result.citations, [doc]))}`);
}
