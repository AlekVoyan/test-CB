# Ask your documents by voice

Upload an equipment manual (PDF), ask a question out loud, and get a short spoken answer with the exact quotation and page it came from. Answers come only from the uploaded documents, replacing a document changes the answer, and when the documents don't contain the answer the app says so.

**Live demo:** https://askyourdocuments.vercel.app/ — it answers with NVIDIA Nemotron 3 Super (`LLM_PROVIDER=nvidia`) and speaks with ElevenLabs Flash v2.5. Claude Haiku 4.5 is the target model and one environment variable away; see the delivery notes §4 and §14.

## Quick start

Prerequisites: Node 20+ and Chrome or Edge (for voice input).

```bash
npm install
cp .env.example .env   # set ANTHROPIC_API_KEY, and ELEVENLABS_API_KEY for the neural voice
npm run dev            # http://localhost:5173
```

Upload `fixtures/manual-v1.pdf`, press the microphone and ask "What is the maximum for Model A?".

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | App plus `/api/answer` and `/api/tts` on the Vite dev server |
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
| `ELEVENLABS_API_KEY` | — | Turns on the neural voice (ElevenLabs). Without it the browser's own voice speaks. The key needs only Text to Speech access |
| `ELEVENLABS_MODEL` | `eleven_flash_v2_5` | ElevenLabs model |
| `ELEVENLABS_VOICE_ID` | Matilda, `XrExE9yKIg1WjnnlVkGX` | One voice for all three languages; `ELEVENLABS_VOICE_NAME` labels a custom one |
| `EVAL_DEEP` | — | `1` runs the eval with Think harder (same as `--deep`) |
| `RETRIEVAL_MODE` | `full` | `full` sends the whole corpus (≤ 10 pages) to the model; `topk` sends the BM25 top-k paragraphs (eval only; the app uses `config.ts`) |
| `EVAL_RUNS` | `3` | Repetitions of every eval session |

## How it works

```
Browser                                                   Server (stateless)
PDF ─► ingest (pdf.js) ─► index: one unit per line ─► in-memory index
mic ─► Web Speech STT ─► question ─► retriever ─► POST /api/answer ─► prompt → Claude (JSON schema)
                                                                       → validator (retry once) → citations
UI ◄─ quote re-check against page text ◄──────────────────────────── response + speech ticket
 └─► voice, picked in the voice tile:
       ElevenLabs  POST /api/tts (ticketed text) ──────────────────► ElevenLabs Flash v2.5, PCM stream
       On device   Supertonic 3 in a Web Worker (WebGPU), model from Hugging Face, kept in the browser's cache
       Built-in    speechSynthesis, also the fallback for the other two
```

- **Documents stay in the browser.** The server only holds the API key, builds the prompt and validates the answer, so it runs on any serverless host and viewers never see each other's files.
- **The model never writes quotes.** Every line of the PDF gets an id like `d1:p2:s3`; the model returns ids, and the quote shown on screen is copied from the index. The browser checks again that each quote is an exact substring of its page.
- **Unverified answers are never spoken.** The validator checks ids, status rules (for example, `not_found` must cite nothing and say so) and that every number in the answer appears in a cited line or in the question. A failed answer gets one retry with the findings; a second failure becomes "I couldn't verify an answer in the uploaded documents."
- **Statuses:** `answered`, `not_found`, `needs_clarification` (asks which model when it matters), `conflict` (two documents disagree; both are cited).
- **Reasoning is labelled as reasoning.** Some answers follow from a stated rule or range rather than from a line that says them. For example, "Can Model B run at 40°C?" → "No", from the 5–35°C operating range. Such answers are marked *Inferred from the document* and carry a one-sentence **Why**, shown under the answer and read aloud after it. A not-found answer may add a related line ("Related, not the answer"); the line is kept only if the answer actually talks about it. An obvious slip ("nozzel") is answered with the assumption named ("Assuming you meant “nozzle”"). A question that fits more than one thing gets a clarifying question instead, and a question about something the documents don't contain stays not found.
- **Think harder** (a switch in the voice tile) lets Claude reason before answering: extended thinking with a 2,048-token budget. It is disabled, with the reason shown, when the server runs a model that can't do it (the NVIDIA model). `GET /api/answer` reports which model is running.
- **Three voices, one switch.** *Built-in* is the system voice: instant and free, but it sounds different on every computer. *ElevenLabs* runs in the cloud: about 0.3 s to first sound and about $0.005 an answer. *On device* is Supertonic 3 run in the browser with ONNX Runtime Web: free, and the audio is made on the user's machine. The model is a 399 MB download the first time it is chosen and comes from the browser's cache after that. The choice is remembered. A voice that cannot speak yet (not set up, still downloading, failed) hands over to the built-in voice, and the Measurements panel says why.
- **The voice speaks only answers this server produced.** `/api/answer` returns the text to speak with an HMAC ticket, and `/api/tts` speaks only ticketed text, so a public deployment is not a free text-to-speech proxy. The audio streams back as 16-bit PCM and Web Audio starts on its first chunk. If the voice service fails or sends nothing within 2.5 s, the browser's own voice speaks, and the panel says why.
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
| `src/core/topics.ts` | What the document does talk about: the opening words of the lines that came closest, offered as questions to ask next when nothing answered |
| `src/core/heard.ts` | What the recognizer misheard: the documents' own lexicon, a phonetic fold, and the question asked back when more than one of their words fits. Runs before the model, in the browser |
| `src/core/contract.ts` | JSON schema of the model's answer and of the API request |
| `src/llm/anthropic.ts` | Anthropic SDK adapter (structured outputs; Think harder = extended thinking) |
| `src/llm/nvidia.ts`, `src/llm/index.ts` | NVIDIA-hosted model adapter (OpenAI-compatible API) and provider selection from `LLM_PROVIDER` |
| `src/server/handler.ts`, `api/answer.ts` | `POST /api/answer` (with a speech ticket when a voice is configured), and `GET` for the running model, Think harder availability and the voice (Vercel function; the dev server reuses the handler). Best-effort per-address limits in `rateLimit.ts` |
| `src/server/tts.ts`, `api/tts.ts` | `POST /api/tts`: checks the ticket, calls ElevenLabs with the answer's language pinned, streams 16-bit PCM back |
| `src/web/App.tsx`, `styles.css` | UI (bento layout, language switch, answer and quote folders, measurements) — design system in `DESIGN.md` |
| `src/web/PageViewer.tsx` | "Open in page": renders the cited PDF page with pdf.js, the paragraph in focus and cited lines framed; zoom to 300% by buttons, keys, pinch or Ctrl/⌘-scroll |
| `src/web/voice.ts` | Speech recognition (Web Speech API) |
| `src/web/tts.ts`, `pcm.ts` | Speech output in the chosen voice: the hosted voice streamed into Web Audio (`pcm.ts` decodes the chunks), the on-device voice, and the browser's own voice as the fallback. Which service stands behind `/api/tts` is a server setting |
| `src/web/deviceVoice.ts`, `supertonic.worker.ts`, `supertonicText.ts` | On-device voice. The worker downloads Supertonic 3 from Hugging Face (a pinned revision) into Cache Storage, runs it with ONNX Runtime Web on WebGPU (WebAssembly as the last resort) and returns audio sentence by sentence. The first piece of an answer is short, and each kind of piece has a fixed input shape warmed up at load, so on WebGPU the first sound is ready in under a second and never waits for kernels to be built. `supertonicText.ts` is the text preparation, ported from Supertonic's MIT-licensed example |
| `eval/expected.json`, `eval/run-eval.ts` | Test sessions with expected outcomes, and the scorer |
| `fixtures/source/*.txt`, `scripts/make-fixtures.ts` | Fixture text and the PDF generator |

**Adding a test:** add a session with `upload` / `remove` / `ask` steps to `eval/expected.json`, then `npm run eval -- --session <id>`.

## Measurements

- **Ingestion:** file selected → document ready, shown on each document card and in the Measurements panel.
- **Question to first audio:** submit → the moment the first sound of the answer is due at the audio output. For the hosted voice that is the first chunk's start on the Web Audio clock plus the output latency; for the browser's voice, the utterance start. Not the speaker itself. The panel also shows when the voice was ready (ElevenLabs: its first audio byte; on device: the first sentence synthesized) and its cost, speech end → transcript and speech end → first audio.
- "Copy measurements JSON" in the panel exports the numbers.

## Voice and languages

Pick the answer language with the EN · RU · UA switch. Recognition, the answer and speech follow it; quotes stay in the document's language, because they are copied from it. English is the evaluated language; Russian and Ukrainian have their own tests (L1–L6).

| Language | Recognition locale | Voice | Fallback voice (macOS example) | Tested |
|---|---|---|---|---|
| English | en-US | ElevenLabs Matilda, or Supertonic 3 F1 on the device | local en-US voices (e.g. "Aaron") | eval + Chrome voice test |
| Russian | ru-RU | ElevenLabs Matilda, or Supertonic 3 F1 on the device | Milena | eval (L1–L3) + Chrome voice test |
| Ukrainian | uk-UA | ElevenLabs Matilda, or Supertonic 3 F1 on the device | Lesya | eval (L4–L6) + Chrome voice test |

The voice was picked in a blind listening test on the same sentences in three languages: ElevenLabs Flash v2.5 and v3, two voices each, against the macOS voices. Flash was chosen: it starts in ~0.2 s instead of ~0.75 s and costs half as much. On the free ElevenLabs plan the API offers only ElevenLabs' own voices; voices from the library, including ones verified for Russian and Ukrainian, need a paid plan. The free option is Supertonic 3 (Supertone): one open model with Russian and Ukrainian that runs in a browser. Its weights are under the OpenRAIL-M license, whose use restrictions apply; the app downloads them from Hugging Face and does not redistribute them. Its GitHub repository was archived on 2026-09-09, and the pinned weights stay usable. Chatterbox Multilingual was considered and not used: no Ukrainian, and it needs a GPU service. If neither voice can speak, the answer stays on screen and the Measurements panel says so.

## Deploy (Vercel)

```bash
npx vercel link
npx vercel env add ANTHROPIC_API_KEY
npx vercel env add ELEVENLABS_API_KEY   # optional: the neural voice
npx vercel --prod
```

Vercel detects Vite and serves `api/answer.ts` and `api/tts.ts` as functions. Set a spend limit on the Anthropic key and a credit limit on the ElevenLabs key before sharing the link: the endpoints have only best-effort per-address rate limits.

## Browser support

Voice input needs the Web Speech API (Chrome or Edge on desktop; HTTPS or localhost). In Chrome, recognition audio is processed by Google's speech service. Other browsers get a visible notice and the text box. Speech output streams from ElevenLabs through the server and plays with Web Audio in any current browser; the operating system's voices are the fallback. The on-device voice needs WebGPU to be quick (Chrome and Edge on desktop, Safari 26). Without it, it runs on WebAssembly and takes several seconds an answer.

## Scope and limits

Up to two text-based PDFs, at most ten pages in total. Answers in English, Russian or Ukrainian; English is the evaluated language. No OCR, no accounts, no server-side storage — documents live in the browser tab and disappear on reload.
