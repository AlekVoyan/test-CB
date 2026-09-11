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
| `npm run eval` | Runs every session in `eval/expected.json` against the real PDFs and the LLM; writes `eval/results/` (needs the key). Options: `-- --session S5`, `-- --runs 1`, `-- --deep` (Think harder, Claude only) |
| `npm run verify-example` | Re-runs the worked AI-output check from the delivery notes (quote, page, numbers, paraphrase) |
| `npm run fixtures` | Regenerates the fixture PDFs from `fixtures/source/*.txt` |

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `LLM_PROVIDER` | `anthropic` | `anthropic` (Claude) or `nvidia` (NVIDIA-hosted Nemotron, used while the Anthropic balance was empty) |
| `ANTHROPIC_API_KEY` | — | Required by the server and by `npm run eval` with `LLM_PROVIDER=anthropic` |
| `LLM_MODEL` | `claude-haiku-4-5` | Claude model used for answers |
| `NVIDIA_API_KEY` | — | Required with `LLM_PROVIDER=nvidia` |
| `NVIDIA_MODEL` | `nvidia/nemotron-3-super-120b-a12b` | NVIDIA model used for answers |
| `EVAL_DEEP` | — | `1` runs the eval with Think harder (same as `--deep`) |
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
- **Reasoning is labelled as reasoning.** Some answers follow from a stated rule or range rather than from a line that says them. For example, "Can Model B run at 40°C?" → "No", from the 5–35°C operating range. Such answers are marked *Inferred from the document* and carry a one-sentence **Why**, shown under the answer and read aloud after it. A not-found answer may add a related line ("Related, not the answer"); the line is kept only if the answer actually talks about it. An obvious slip ("nozzel") is answered with the assumption named ("Assuming you meant “nozzle”"). A question that fits more than one thing gets a clarifying question instead, and a question about something the documents don't contain stays not found.
- **Think harder** (a switch in the voice tile) lets Claude reason before answering: extended thinking with a 2,048-token budget. It is disabled, with the reason shown, when the server runs a model that can't do it (the NVIDIA model). `GET /api/answer` reports which model is running.
- **Follow-ups** use the last four turns. Changing the set of loaded documents resets the conversation so values from a replaced document cannot leak into answers.

## Code map

| File | Responsibility |
|---|---|
| `src/core/config.ts` | Every limit and tunable: file and page limits, retrieval mode, history length, answer length, model, prices, speech language |
| `src/core/pdf.ts` | pdf.js text extraction, line grouping, columns (and columns inside a section) read in reading order, re-joining lines wrapped at the margin |
| `src/core/ingest.ts`, `limits.ts` | Upload checks (2 files, 10 pages, PDF only, text layer present) → extract → index, with timings |
| `src/core/indexer.ts` | Pages → citable units with ids |
| `src/core/retriever.ts` | Tokenizer (keeps "Model A"), BM25, `full` / `topk` evidence selection, closest passages |
| `src/core/prompt.ts` | System prompt and prompt layout — change answer behaviour here |
| `src/core/answerer.ts` | LLM call, validation, one retry, fallback; reasoning marks (inferred + why, related lines, assumed slip) and the spoken text |
| `src/core/validator.ts` | Answer rules, citation building, quote re-check |
| `src/core/passages.ts` | Files cited lines under the paragraph they come from (one sheet per paragraph, with the lines around it) |
| `src/core/slips.ts` | Names a slip the model fixed without saying so ("nozzel" → "nozzle"), found by comparing the question with the model's own restatement |
| `src/core/contract.ts` | JSON schema of the model's answer and of the API request |
| `src/llm/anthropic.ts` | Anthropic SDK adapter (structured outputs; Think harder = extended thinking) |
| `src/llm/nvidia.ts`, `src/llm/index.ts` | NVIDIA-hosted model adapter (OpenAI-compatible API) and provider selection from `LLM_PROVIDER` |
| `src/server/handler.ts`, `api/answer.ts` | `POST /api/answer`, and `GET` for the running model and Think harder availability (Vercel function; the dev server reuses the handler) |
| `src/web/App.tsx`, `styles.css` | UI (bento layout, language switch, answer and quote folders, measurements) — design system in `DESIGN.md` |
| `src/web/PageViewer.tsx` | "Open in page": renders the cited PDF page with pdf.js, the paragraph in focus and cited lines framed; zoom to 300% by buttons, keys, pinch or Ctrl/⌘-scroll |
| `src/web/voice.ts` | Speech recognition (Web Speech API) |
| `src/web/tts.ts` | Speech output behind a `TtsProvider` interface: browser voices now, a hosted voice can be added in front |
| `eval/expected.json`, `eval/run-eval.ts` | Test sessions with expected outcomes, and the scorer |
| `fixtures/source/*.txt`, `scripts/make-fixtures.ts` | Fixture text and the PDF generator |

**Adding a test:** add a session with `upload` / `remove` / `ask` steps to `eval/expected.json`, then `npm run eval -- --session <id>`.

## Measurements

- **Ingestion:** file selected → document ready, shown on each document card and in the Measurements panel.
- **Question to first audio:** submit → `speechSynthesis` utterance start. This is a proxy for the first audible sound, not the physical speaker onset. The panel also shows speech end → transcript and speech end → first audio.
- "Copy measurements JSON" in the panel exports the numbers.

## Voice and languages

Pick the answer language with the EN · RU · UA switch. Recognition, the answer and speech follow it; quotes stay in the document's language, because they are copied from it. English is the evaluated language; Russian and Ukrainian have their own tests (L1–L6).

| Language | Recognition locale | Speech (browser voice, macOS example) | Tested |
|---|---|---|---|
| English | en-US | local en-US voices (e.g. "Aaron") | eval + Chrome voice test |
| Russian | ru-RU | Milena | eval (L1–L3) + Chrome voice test |
| Ukrainian | uk-UA | Lesya | eval (L4–L6) + Chrome voice test |

If the browser has no voice for the language, the answer stays on screen and the Measurements panel says so. Chatterbox Multilingual was considered as a higher-quality voice and not integrated: its language list has no Ukrainian, it needs a Python/GPU service that Vercel can't host, and it would add generation time before the first audio. `tts.ts` is the place to add such a provider.

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

Up to two text-based PDFs, at most ten pages in total. Answers in English, Russian or Ukrainian; English is the evaluated language. No OCR, no accounts, no server-side storage — documents live in the browser tab and disappear on reload.
