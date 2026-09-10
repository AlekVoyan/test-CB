# Ask your documents by voice

Upload an equipment manual (PDF), ask a question out loud, and get a short spoken answer with the exact quotation and page it came from. Answers come only from the uploaded documents, replacing a document changes the answer, and when the documents don't contain the answer the app says so.

## Quick start

Prerequisites: Node 20+ and Chrome or Edge (for voice input).

```bash
npm install
cp .env.example .env   # set ANTHROPIC_API_KEY
npm run dev            # http://localhost:5173
```

Upload `fixtures/manual-v1.pdf`, press the microphone and ask "What is the maximum for Model A?".

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | App plus `POST /api/answer` on the Vite dev server |
| `npm run build` | Type-check and production build to `dist/` |
| `npm test` | Unit tests — ingestion, limits, retriever, validator, answerer (no API key needed) |
| `npm run eval` | Runs every session in `eval/expected.json` against the real PDFs and the LLM; writes `eval/results/` (needs the key). Options: `-- --session S5`, `-- --runs 1` |
| `npm run verify-example` | Re-runs the worked AI-output check from the delivery notes (quote, page, numbers, paraphrase) |
| `npm run fixtures` | Regenerates the fixture PDFs from `fixtures/source/*.txt` |

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Required by the server and by `npm run eval` |
| `LLM_MODEL` | `claude-haiku-4-5` | Model used for answers |
| `RETRIEVAL_MODE` | `full` | `full` sends the whole corpus (≤ 10 pages) to the model; `topk` sends the BM25 top-k paragraphs (eval only; the app uses `config.ts`) |
| `EVAL_RUNS` | `3` | Repetitions of every eval session |

## How it works

```
Browser                                                   Server (stateless)
PDF ─► ingest (pdf.js) ─► index: one unit per line ─► in-memory index
mic ─► Web Speech STT ─► question ─► retriever ─► POST /api/answer ─► prompt → Claude (JSON schema)
                                                                       → validator (retry once) → citations
UI ◄─ quote re-check against page text ◄──────────────────────────── response
 └─► speechSynthesis reads the answer
```

- **Documents stay in the browser.** The server only holds the API key, builds the prompt and validates the answer, so it runs on any serverless host and viewers never see each other's files.
- **The model never writes quotes.** Every line of the PDF gets an id like `d1:p2:s3`; the model returns ids, and the quote shown on screen is copied from the index. The browser checks again that each quote is an exact substring of its page.
- **Unverified answers are never spoken.** The validator checks ids, status rules (for example, `not_found` must cite nothing and say so) and that every number in the answer appears in a cited line or in the question. A failed answer gets one retry with the findings; a second failure becomes "I couldn't verify an answer in the uploaded documents."
- **Statuses:** `answered`, `not_found`, `needs_clarification` (asks which model when it matters), `conflict` (two documents disagree; both are cited).
- **Follow-ups** use the last four turns. Changing the set of loaded documents resets the conversation so values from a replaced document cannot leak into answers.

## Code map

| File | Responsibility |
|---|---|
| `src/core/config.ts` | Every limit and tunable: file and page limits, retrieval mode, history length, answer length, model, prices, speech language |
| `src/core/pdf.ts` | pdf.js text extraction, line grouping, re-joining lines wrapped at the margin |
| `src/core/ingest.ts`, `limits.ts` | Upload checks (2 files, 10 pages, PDF only, text layer present) → extract → index, with timings |
| `src/core/indexer.ts` | Pages → citable units with ids |
| `src/core/retriever.ts` | Tokenizer (keeps "Model A"), BM25, `full` / `topk` evidence selection, closest passages |
| `src/core/prompt.ts` | System prompt and prompt layout — change answer behaviour here |
| `src/core/answerer.ts` | LLM call, validation, one retry, fallback |
| `src/core/validator.ts` | Answer rules, citation building, quote re-check |
| `src/core/contract.ts` | JSON schema of the model's answer and of the API request |
| `src/llm/anthropic.ts` | Anthropic SDK adapter (structured outputs) |
| `src/server/handler.ts`, `api/answer.ts` | `POST /api/answer` (Vercel function; the dev server reuses the handler) |
| `src/web/App.tsx`, `voice.ts` | UI, speech recognition and synthesis, measurements panel |
| `eval/expected.json`, `eval/run-eval.ts` | Test sessions with expected outcomes, and the scorer |
| `fixtures/source/*.txt`, `scripts/make-fixtures.ts` | Fixture text and the PDF generator |

**Adding a test:** add a session with `upload` / `remove` / `ask` steps to `eval/expected.json`, then `npm run eval -- --session <id>`.

## Measurements

- **Ingestion:** file selected → document ready, shown on each document card and in the Measurements panel.
- **Question to first audio:** submit → `speechSynthesis` utterance start. This is a proxy for the first audible sound, not the physical speaker onset. The panel also shows speech end → transcript and speech end → first audio.
- "Copy measurements JSON" in the panel exports the numbers.

## Deploy (Vercel)

```bash
npx vercel link
npx vercel env add ANTHROPIC_API_KEY
npx vercel --prod
```

Vercel detects Vite and serves `api/answer.ts` as a function. Set a spend limit on the API key in the Anthropic Console before sharing the link: the endpoint has only a best-effort per-IP rate limit.

## Browser support

Voice input needs the Web Speech API (Chrome or Edge on desktop; HTTPS or localhost). In Chrome, recognition audio is processed by Google's speech service. Other browsers get a visible notice and the text box. Speech output uses the operating system's voices.

## Scope and limits

Up to two text-based PDFs, at most ten pages in total, English only. No OCR, no accounts, no server-side storage — documents live in the browser tab and disappear on reload.
