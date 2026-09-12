# Delivery notes — Ask your documents by voice

## 1. Summary

A browser prototype: upload up to two text-based PDFs (≤ 10 pages total), ask a question by voice, hear a one- or two-sentence answer, and see the exact quoted line with its page number. The answer is generated from the uploaded text only — in the deployed demo and in every eval run by NVIDIA Nemotron 3 Super, with Claude Haiku 4.5 as the target model of decision D1 and one environment variable away (§4, §14); the quote is copied from the extracted PDF text, never written by the model. Replacing a document changes the answer; questions the documents can't answer get an explicit "not in the document". Some answers follow from a stated rule rather than a line that says them; these are marked *inferred* and give their reason. An obvious slip is answered with the assumption named. An optional "Think harder" switch lets Claude reason before answering.

## 2. Key decisions and trade-offs

| Decision | Why | Cost of the choice |
|---|---|---|
| Whole corpus in the prompt (`full`), BM25 `topk` kept as a fallback | ≤ 10 pages is a few thousand tokens. Sending everything removes retrieval misses on paraphrases ("How many units can A handle?") and on follow-ups with no keywords ("the other one?"). | More input tokens per question (measured in §11). Falls back to top-k automatically above an 8k-token budget. |
| Evidence in document order, not score order | Keeps step lists and section context readable for the model. (Deviation from the spec, which said "sorted by BM25".) | None measured. |
| The model returns line ids; the code copies the quote | Quotes are exact by construction — no paraphrased "citations". | The model can only cite whole lines. |
| Validator + one retry, never speak an unverified answer | Enforces status rules and "every number in the answer appears in a cited line or the question". | A second failure degrades to "I couldn't verify an answer"; retries cost tokens (§11). |
| Documents and index in the browser, stateless server | Works on serverless hosting; no cross-user document leaks; ingestion costs $0. | Documents disappear on reload. |
| Conversation resets when the document set changes | Stops "20 units" from Manual v1 leaking into answers after switching to v2. | Follow-ups don't carry across a replacement (tested: A8). |
| Browser speech recognition (Web Speech API) | $0 and no extra latency hop for a prototype. | Chrome/Edge only; recognition audio goes to the browser vendor's service. A hosted recognizer is priced in `docs/pricing.md`. |
| Auto-submit the final transcript | Faster; the transcript stays visible and a spoken correction ("I meant Model B") works. | A misrecognised question is sent before the user can fix it. |
| No embeddings, no OCR | Not needed for ≤ 10 text pages; the brief excludes scans. | Scanned PDFs are rejected with a message. |
| Claude Haiku 4.5 | Fastest and cheapest current Claude model; the task is extraction from a short text. | Weaker on subtle reasoning than larger models. |
| Answers in English, Russian or Ukrainian | A small extension beyond the brief's "one language": the reviewer's and the tester's languages. The whole chain follows one switch (recognition locale, answer language, voice); quotes stay verbatim in the document's language. English stays the evaluated language. | Six more tests (L1–L6); the validator learned Russian/Ukrainian "not found" wording; recognition quality depends on the browser. |
| Neural voice: ElevenLabs Flash v2.5 through `/api/tts`, the browser's voice as the fallback | The OS voices sound robotic and differ by machine; a reviewer on Windows may have no Russian or Ukrainian voice at all. I compared hosted and open voices on the three languages (few cover Ukrainian well), then ran a blind listening test: ElevenLabs Flash v2.5 and v3, two voices each, against the macOS voices. Flash won on latency (~0.2 s to the first byte against ~0.75 s) at half v3's price. The key stays on the server, and the endpoint speaks only answer text that `/api/answer` signed, so the public demo is not a free text-to-speech proxy. The audio streams as PCM into Web Audio and starts on the first chunk. | It adds the voice's time to the first audio (§10) and is the largest variable cost per question (§11). On the free plan the API offers only ElevenLabs' own voices; a voice verified for Russian and Ukrainian needs a paid plan. Chatterbox Multilingual was rejected: no Ukrainian, and it needs a GPU service. |
| A free voice on the device: Supertonic 3, as a third choice | Few open models speak Ukrainian, and of those only Supertonic 3 also runs in a browser (99M parameters, 31 languages, weights under OpenRAIL-M). It runs in a Web Worker with ONNX Runtime Web: WebGPU when the browser has it, WebAssembly as the last resort. The model comes from Hugging Face the first time the voice is chosen and stays in Cache Storage, and the audio is made on the user's machine at no cost. I picked it after listening to its samples. | A 399 MB first download (about 35 s on my connection). It needs WebGPU to be usable. An answer is synthesized in pieces: a short first one (up to 64 characters, cut at a sentence end, a comma, or between words) and the rest while it plays. Each kind of piece has one fixed input shape, warmed up at load, so no answer waits for WebGPU to build its kernels. On this Mac the first sound is ready 0.74–0.79 s after the answer arrives, whatever its length; WebAssembly would take 5.5–11 s. The GitHub repository was archived on 2026-09-09; the pinned weights stay usable. |
| Redesign: bento layout with folder-tab tiles (user-pinned brief) | The answer and its proof read as one object: the status sits on the answer's tab, each quote is a folder whose tab names its page. Documented in `DESIGN.md`. | More CSS than a plain layout; checked at desktop and 375px. |
| Earlier answers and quotes as folder stacks | The comparison question cited 7–10 lines and produced a wall of cards; quotes are now filed one folder per page, stacked with "Show all". Earlier answers (last 8) are filed behind the current one with their question on the tab, view only, so follow-ups stay predictable. Tabs keep their places: bringing a folder forward changes only its depth. Colour belongs to the plane, not to the folder — the front plane carries the full lime and each plane behind is a quarter of the way deeper — so the folder brought forward brightens and the one it replaces darkens, and that lighter tone spreads from under its tab. | The mouse wheel is captured only over the tab strip and released at the ends; ‹ › buttons and the keyboard cover the rest. Tabs in fixed places are narrower than one front tab, so a long question is cut on its tab; the card repeats it in full. |
| Second provider: NVIDIA-hosted Nemotron 3 Super (`LLM_PROVIDER=nvidia`) | The Anthropic balance was empty during development; the pipeline sits behind an `LlmClient` interface, so a second adapter was cheap. Reasoning is turned off: with it on, the model's JSON degenerated into whitespace. | The free endpoint is slower and returns 503 at times (handled with retries). Its results are reported separately and priced at a paid provider's list price. |
| "Think better": inferred answers, related lines, named slips (always on) | Users ask things a manual decides without saying them ("Can Model B run at 40°C?"), misspell or mishear words, and ask about things that aren't there. The model marks such an answer *inferred*, with a one-sentence reason that is shown and read aloud. A not-found answer may add a related line. An assumed slip is named ("Assuming you meant “nozzle”"). Related lines never turn "not in the document" into an answer. | An inference is a new way to be wrong, so a wrong inferred answer counts as a critical failure in the eval. The answer contract grew four fields. On Nemotron some inferences need a retry (+2–4 s). |
| Think harder: Claude extended thinking, off by default | Lets the target model reason before hard questions. It costs latency and output tokens, so the user opts in. Haiku 4.5 supports only manual thinking (`budget_tokens`, 2,048 here, on top of `max_tokens`). | **Not measured**: the Anthropic balance was empty. With the NVIDIA model the switch is disabled and says why. |
| The model reads before it decides | Its answer now begins with the restated question and a private `analysis` (which lines bear on the question and what they say), and only then the status. When status came first, a model without reasoning committed to "not in the document" and then wrote a reason that contradicted it. | About 40–60 more output tokens per answer. |
| Columns read in reading order | A CV with a sidebar came out with lines of both columns glued together, which spoiled both the answers and the quotes. An empty vertical band with running text on both sides marks a gutter, and each column is read top to bottom. A section can have columns of its own, like the CV's "Languages" and "Focus Areas". A label–value table is never split, and a line that starts with a capital letter is never taken as the continuation of a wrapped line. | Heuristics tuned on one real CV and synthetic pages. One-column documents extract byte-identically. |
| Quotes filed by source paragraph, the real page on demand | A one-page document put every quote into one folder: a broad question about my CV cited 26 lines in a single block. Each cited paragraph is now a sheet titled by its first line, with the cited lines in focus and the lines around them fading out. "Open in page" renders the actual PDF page with pdf.js, with the paragraph lit and the cited lines framed. Line positions come from the text layer at ingestion and stay in the browser. | No citation limit, by choice: the model may still cite many lines. A long paragraph shows only the lines next to cited ones. Zoom goes to 300%: a pinch or Ctrl/⌘-scroll scales the image at once, and the page is rendered sharp when the gesture rests. |
| A silent slip fix is named by code | Nemotron corrected "nozzel" in its restated question but never told the user. `slips.ts` names the correction when the corrected word is in the documents, the original is not, and the two differ by a letter or two. | Catches only slips the model itself corrected, and only spelling-level ones. |

## 3. Reused components and own work

Libraries: `pdfjs-dist` (PDF text extraction), `@anthropic-ai/sdk` (API client, structured outputs), `zod` (schemas), React, Vite, Vitest, `tsx`, `pdf-lib` (only to generate fixture PDFs).
Own code: everything under `src/` (ingestion, wrapped-line joining, indexer, tokenizer and BM25, prompt, validator, answerer, API handler, UI, voice), `eval/` (test sessions and scorer), `scripts/make-fixtures.ts`, fixture texts. No RAG framework, no existing product.

## 4. AI tools and models

- **Development:** Claude Code (desktop app) running Claude Opus 5 (`claude-opus-5`) — wrote the spec review, code, tests and docs under my direction. Lavish Editor (`lavish-axi`) was used to review the implementation plan visually. The first version of the assignment spec (`ТЗ v2`, my own working document, not part of the submission) was drafted with ChatGPT and Gemini and then reviewed and rewritten with Claude Code; everything else in this project — code, tests, fixtures, docs — went through Claude Code alone.
- **Runtime, as deployed and as evaluated:** NVIDIA Nemotron 3 Super 120B A12B (`nvidia/nemotron-3-super-120b-a12b`) on NVIDIA's hosted API, temperature 0, JSON schema, reasoning off. Every number in §9–§11 comes from that model. The target model of decision D1 is Claude Haiku 4.5 via the Anthropic API (`claude-haiku-4-5`), temperature 0, JSON schema output: the adapter is written and unit-tested, and `LLM_PROVIDER=anthropic` switches to it, but the account had no balance during the assignment window, so no answer in this submission was produced by it. Models tried and rejected in a probe with the real prompt: Mistral Large 2 and Llama 3.1 Nemotron 70B (not available to the account), Nemotron 3.5 Lightning (ignored the schema, 92 s), gpt-oss-20b (timed out).
- **Think harder:** Claude Haiku 4.5 with extended thinking (`thinking: {type: "enabled", budget_tokens: 2048}`, default temperature, because thinking does not take a changed one). The parameters come from Anthropic's extended-thinking documentation (checked 2026-09-11): Haiku 4.5 has no adaptive thinking, the budget must be ≥ 1,024 and below `max_tokens`, and thinking tokens are billed as output. Never run: no balance.
- **Speech:** Web Speech API recognition in Chrome (Google speech service). Speech output: ElevenLabs Flash v2.5 (`eleven_flash_v2_5`), voice Matilda, with `language_code` set to the answer's language; the browser's `speechSynthesis` as the fallback (macOS voice "Aaron" in the earlier Chrome test). The on-device voice: Supertonic 3 (`supertone-oss-archive/supertonic-3`, pinned revision), voice F1, 8 denoising steps, ONNX Runtime Web 1.29 on WebGPU.

## 5. How to run

See `README.md` (install, `.env`, `npm run dev`, `npm test`, `npm run eval`, deploy).

## 6. Browser and device tested

- macOS 15 (Darwin 24.6), Node 22.19.
- Text flow (upload, ask, answer card, quotes, replace, limits, measurements) checked in the Chromium-based browser embedded in the Claude desktop app, desktop and 375 px widths.
- Voice flow: Google Chrome 152 on macOS. English with the local voice "Aaron" on my own 7-page PDF; Russian (voice "Милена") and Ukrainian ("Леся") on the sample manual and on my own 1-page CV. Neither of my own documents is in the repo.
- Neural voice: headless Chromium (Playwright) on the local dev server, six questions in English, Russian and Ukrainian, plus one with the voice service forced to fail (the browser's voice took over and the panel named the reason).
- On-device voice: the same headless Chromium on Apple Silicon (WebGPU on Metal): the first download, loading from the cache, answers in three languages, and the built-in voice answering while the model downloads.

## 7. Test files and questions

Fixtures: `fixtures/manual-v1.pdf`, `manual-v2.pdf` (Model A limit 20 → 24), `holdout-nimbus.pdf` (never used for prompt tuning), `filler-8p.pdf` and `image-only.pdf` (limit tests). Text sources in `fixtures/source/`.
Questions and expected outcomes: `eval/expected.json`, committed in `f699eb9` before the first eval run; the think-better tests X1–X5 in `8c0dd95`, before their first run.

## 8. Expected vs actual results

Reported run: commit `2ad522c`, NVIDIA Nemotron 3 Super, 37 tests, 3 runs per session, no provider errors — the last of three full passes over the whole suite on the shipped code, all three within half an hour of each other. The other two are in `eval/results/report-pass-b.md` and in git history, and §9 carries the spread between them, which is wider than I expected. Verbatim answers and quotes for every run are in `eval/results/report.md`, raw records in `eval/results/actual-results.json`.

| ID | Type | Question | Expected (status · fact · source) | Passed |
|---|---|---|---|---|
| M1 | direct fact | What is the maximum for Model A? | answered · 20 units · v1 p.2 | 3/3 |
| M3 | follow-up (after M1) | And what about the other model? | answered · Model B 12 units · v1 p.2 | 3/3 |
| M2 | comparison | How do I set up Model A versus Model B? | answered · both setup sequences · v1 p.1 | 3/3 |
| M4 | exception | Is Model B ever allowed to exceed its normal limit? | answered · 15 units, ≤ 5 min, below 20°C · v1 p.3 | 3/3 |
| M5 | absent fact | What is the battery life of Model A? | not_found · 0 citations | 3/3 |
| M6 | replacement (v1 → v2) | What is the maximum for Model A? | answered · 24 units, not 20 · v2 p.2 | 3/3 (answer changed from the v1 baseline in 6/6 runs across the passes) |
| R1 | ambiguity | What is the limit? | needs_clarification · names Model A and Model B | 3/3 |
| R1b | spoken clarification | Model B. | answered · 12 units · v1 p.2 | **1/3** — the weakest test in the set, see §13 |
| R2 | correction | I meant Model B. | answered · 12 units, not "20 units" · v1 p.2 | 3/3 |
| A1 | conflicting documents | What is the maximum for Model A? (v1 + v2 loaded) | conflict · 20 and 24, both documents cited | 3/3 |
| A2 | paraphrase | How many units can A handle? | answered · 20 units · v1 p.2 | 3/3 |
| A3 | distractor | How often should I clean the nozzle on Model B? | answered · 30 days, not 15 · v1 p.3 | 3/3 |
| A4 | unknown entity | What is the maximum load for Model C? | not_found | 3/3 |
| A5 | rename (v2 uploaded as manual-v1.pdf) | What is the maximum for Model A? | answered · 24 units | 3/3 |
| A6 | exception reasoning | Can Model B run at 15 units when it's 25°C? | answered · No (exception only below 20°C) · v1 p.3 | 3/3 here, 2/3 in the pass before it |
| A7 | speech-recognition error | What's the max load for model bee? | answered · 12 units · v1 p.2 | 3/3 |
| A8 | history reset (D4) | And what about the other model? (after v1 → v2) | needs_clarification | 3/3 |
| A9 | document overview | What is this document about? | answered · Kestrel Dosing System · v1 p.1 | 3/3 |
| X1 | inference from a range | Can Model B run at 40°C? | answered, marked inferred · No, range 5–35°C · v1 p.2 | 3/3 |
| X2 | indirect fact | What's the maximum temperature for Model A? | answered · 35°C · v1 p.2 | 3/3 |
| X3 | absent fact, related line | How long does Model B run on battery? | not_found · a related line from p.1 or p.3 (power adapter) | 0/3 (not_found 3/3, never a related line) |
| X4 | slip, one target | How often should I clean the nozzel on Model B? | answered · 30 days · assumption named · v1 p.3 | 3/3 |
| X5 | slip, model not named (guard) | How often should I clean the nozzel? | needs_clarification · names Model A and Model B | 3/3 |
| L1–L6 | Russian and Ukrainian | facts, follow-up, exception, absent facts | answer in the selected language, quotes in English | 18/18 |
| L7 | language switch mid-session | А яке максимальне навантаження моделі B? (after a Russian turn) | answered in Ukrainian · 12 units · v1 p.2 | 3/3 (with its Russian baseline, 6/6) |
| H1–H5 | holdout document | room size, filter intervals, follow-up, night mode, price | see `eval/expected.json` | 15/15 |
| I1–I3 | input limits | 3 files, 11 pages, PDF without text | rejected with a message | pass (`npm test`) |

How the numbers moved (full runs, 3 runs each):

| Run | Code | P0 | P1 | Holdout | RU/UA | Think better | Critical |
|---|---|---|---|---|---|---|---|
| First full run | `20bdd17` | 100% | 75.0% (A6, A7 fail) | 100% | — | — | 0 |
| After A6/A7 fixes | `016ee32` | 96.7% (R1b mis-cite, caught) | 83.3% | 100% | — | — | 0 |
| After retry hint + permission rule | `e41c065` | 100% | 87.5% (A6 fails) | 100% | — | — | 0 |
| Russian and Ukrainian added | `fc99ba3` | 100% | 88.9% (A6) | 80% (H3) | 100% | — | 0 |
| Think-better mode, first full run | `ff6dbe6` | 73.3% (M4, R1, R1b) | 88.9% | 60% (H3, H4) | 100% | 53.3% | 0 |
| Clarifications and inferences steered, spoken text scored | `132f03f` | 86.7% (R1, R1b) | 92.6% | 71.4% (H3, H4 2/3) | 100% | 60.0% | 1 (eval artifact, §13) |
| Think-better mode complete | `6f9f76b` | 96.7% (R1 2/3) | 88.9% (A6) | 80% (H3) | 100% | 60.0% (X3, X5) | 0 |
| **Final**: the model reads before it decides | `627aaf7` | **96.7%** (R1b 2/3) | **92.6%** (A6 1/3) | **100%** | 94.4% (L5 2/3) | **80.0%** (X3) | **0** |

**Think-better tests, final run:**
- **X1** ("Can Model B run at 40°C?"): 3/3 answered "No", marked inferred, with the 5–35°C range as the Why line. It was 2/3 before the analysis-first change.
- **X2**: 3/3.
- **X3** ("How long does Model B run on battery?"): not found 3/3, as expected, but Nemotron never offered a related line, so the reasoning check failed.
- **X4**: 3/3 with "Assuming you meant “nozzle”". The model corrected the word silently, and `slips.ts` named the correction.
- **X5**: 3/3. It was 1/3 before, when the model declined instead of asking which model.

Across all 105 answers the model marked 18 as inferred, and none was wrong. The guards held: A4, M5 and R1 3/3.

**Russian and Ukrainian (L1–L6, commit `fc99ba3`, 3 runs):** 18/18 passed — answers in the selected language, quotes in English, not-found recognised in both languages. Full run on the same commit: P0 100%, P1 88.9% (A6), holdout 80% (**H3 regressed to 0/3**, see §13), RU/UA 100%, 0 critical failures.

`expected.json` was not changed after the first run except for added tests, each in its own commit (L1–L6 and X1–X5 before their first run, and this one): **A9, "What is this document about?"** (session S18). Asking my own 7-page PDF "about what is document" by voice returned `not_found`: the prompt handled specific facts but not questions about the document as a whole. The prompt now answers those from the title, headings and introduction, and A9 checks it on the fixture manual.

## 9. Factual accuracy and citation accuracy

Scored separately for every test and run (rules in `eval/expected.json` and ТЗ §8). Reported run, commit `2ad522c`:

| Group | Tests | Scored runs | Factual accuracy | Citation accuracy | Reasoning checks |
|---|---|---|---|---|---|
| P0 | 10 | 30 | 93.3% | 93.3% | — |
| P1 | 9 | 27 | 100.0% | 100.0% | — |
| Holdout | 5 | 15 | 100.0% | 100.0% | — |
| RU/UA | 8 | 24 | 100.0% | 100.0% | — |
| Think better | 5 | 15 | 100.0% | 100.0% | 66.7% |
| All | 37 | 111 | 98.2% | 98.2% | 66.7% |

**Critical failures** (a plausible answer without support, an answer where the documents have none, or a wrong inferred answer): **0**, in this pass and in every other.

**The spread between passes is the honest headline.** Three full passes over the whole suite, all within half an hour, at the same code (the first of them before the fix in `2ad522c`, which only touches the wrong-language path):

| Pass | P0 | P1 | Holdout | RU/UA | All (factual) | Pass rate | ТЗ §7.8 | Critical |
|---|---|---|---|---|---|---|---|---|
| 08:09 | 96.7% | 96.3% | 100% | 95.8% | 97.3% | 94.6% | met | 0 |
| 08:20 | 90.0% | 92.6% | 100% | 95.8% | 94.1% | 91.0% | not met (R1b) | 0 |
| 08:46 — reported | 93.3% | 100% | 100% | 100% | 98.2% | 95.5% | not met (R1b) | 0 |

Nothing changed between them but the model's own sampling: temperature is 0, the endpoint returned no errors, and the prompts were byte-identical. **The acceptance criterion of ТЗ §7.8 is met in one pass of the three and missed in two, both times on R1b** (§13). I report all three rather than the best one; a single pass of this suite on this endpoint is not a reliable measurement, and the first thing to do with an Anthropic balance is to repeat it on Claude Haiku 4.5, where I expect a narrower spread.

**Changes to scoring with the think-better mode** (code, not `expected.json`):
- A wrong inferred answer is a critical failure.
- basis / assumed / related are reasoning checks, reported separately. A failed check fails the test but does not change factual or citation accuracy.
- Facts are matched on what the user hears: the answer plus, for an inferred answer, its Why line. Before, only the answer text was matched. The Why line is shown and read aloud, and M4, A6 and X1 put their numbers there.

In this run the two scores are equal in every group: each failure is a decline or a withheld answer, and those fail both. In `6f9f76b` they differed where X5 declined instead of asking: factual 0, but citation 1, because a non-answer should cite nothing. The case the two scores are meant to separate — right fact, wrong citation — did occur (R1b and A7 in the `016ee32` run, R1b and L5 in this one), but the validator rejected those answers before they could be shown or scored as correct.

## 10. Latency

| Measure | Where | Result |
|---|---|---|
| Ingestion, `manual-v1.pdf` (3 pages), file selected → ready | embedded Chromium, local dev | 274 ms and 447 ms (two loads; pdf.js extraction is almost all of it, indexing 1 ms) |
| Ingestion, same file | Node, 5 runs | median 6 ms, max 12 ms (warm process) |
| Question → first audio (submit → `speechSynthesis` utterance start, a proxy, not speaker onset) | embedded Chromium, typed question, NVIDIA | 3309 ms (retrieval 1 ms, server round trip 3301 ms, LLM 3272 ms); one sample |
| Question total, text pipeline (retrieval + LLM incl. retries + validation) | Node, 111 questions, reported run `2ad522c` | median 2264 ms, p90 5620 ms, max 18090 ms; first model call median 2257 ms. The two passes before it, same code, same half hour: medians 2393 ms and 2674 ms, maxima 54.4 s and 13.6 s. Earlier daytime run `627aaf7`: median 3738 ms, p90 9835 ms |
| Answer format A/B, same time window | Node, NVIDIA, 12 raw calls per format, interleaved | Status first: median 3.35 s, 133 output tokens. Analysis first: median 3.2 s, 167 output tokens. Three 503s excluded. The format costs ~34 tokens and no measurable time |
| Question → first audio, inferred answer that needed a retry (X1) | embedded Chromium, typed question, NVIDIA | 5.84 s (two model calls, 2.15 s + 3.61 s); one sample |
| Question → first audio, not-found answer (battery life) | same | 1.23 s (one model call, 1.12 s); one sample |
| Ingestion, my own 7-page PDF | Chrome 152 | 157 ms (extract 153 ms, index 1 ms) |
| Voice question → first audio, same PDF | Chrome 152, NVIDIA | speech end → first audio 1172 ms; submit → first audio 1172 ms (LLM 1053 ms); one sample |
| End of speech → final transcript (STT) | Chrome 152, 8 voice questions (RU 7, UA 1), NVIDIA | median 69 ms (1–171 ms). The first English test read 0 ms — a measurement bug: Chrome fired `speechend` after the final result. The end of speech is now `speechend` or the last interim result, whichever comes first. |
| Speech end → first audio | same 8 questions | median 2.07 s (1.10–4.00 s) |
| Submit → first audio | same 8 questions | median 1.96 s (1.06–3.92 s); almost all of it is the model call on the free endpoint |
| Ingestion, my own 1-page CV | Chrome 152 | 305 ms (extract 256 ms) |
| Voice: request → first audio byte in the page (ElevenLabs Flash v2.5, local dev server) | headless Chromium, 6 answers (EN, RU, UA), NVIDIA | median 285 ms (177–431 ms), of which ElevenLabs' own time to respond is 277 ms |
| Voice: answer received → first sound due at the audio output | same | median 349 ms (241–499 ms). The browser's own voice starts at once, but sounds robotic |
| Voice listening test, straight to ElevenLabs from my Mac | 9 phrases per model | Flash v2.5: first byte median 208 ms (172–562 ms), whole phrase 0.3–0.7 s. v3: first byte 749 ms (697–806 ms), whole phrase 2.5–3.8 s |
| On-device voice: first download of the model (399 MB) | headless Chromium, my connection | about 35 s. Later loads come from the browser's cache: 4–6 s, including warming up both piece shapes |
| On-device voice: answer received → first piece synthesized | same, WebGPU on Metal | 0.74–0.79 s in the app, for answers of 55–317 characters, with no gaps between pieces. Before these fixes, 1.5–5.4 s (my Chrome test on my CV: 2.7–5.4 s). WebAssembly: 5.5–11 s for a whole answer |
| **Question → first audio, deployed demo** (submit → first sound due at the output; typed questions, so no STT) | Vercel + NVIDIA + ElevenLabs, Chromium, M1 / M4 / M5 × 5 runs each | **median 2.29 s, max 4.98 s** over 15 questions. Per question: M1 median 2.42 s (max 3.14 s), M4 median 2.65 s (max 4.98 s), M5 median 2.11 s (max 4.25 s). Of that, the model call is 1.13–4.31 s; retrieval and validation stay ~1 ms; no retries in these 15 |
| Voice on the deployed demo (ElevenLabs Flash v2.5, request → first audio byte in the page) | same 15 questions | median 425 ms (343–480 ms), of which ElevenLabs' own time to respond is 169 ms median (149–266 ms) |
| Ingestion on the deployed demo, `manual-v1.pdf` (3 pages) | same session | 153 ms (extract 150 ms, index 1 ms) |
| Cold start of the deployed function | Vercel, `GET /api/answer` after 45 minutes of idleness, then twice more | **1.12 s**, then 476 ms and 370 ms — a boot costs about 0.7 s over a warm request, and the first question after a quiet spell should be read as the rows above plus that. Eight minutes of idleness did not cost the instance: 271 / 339 / 249 ms |

Almost all of the question latency is the model call; retrieval and validation are ~1 ms, and the neural voice adds about a third of a second. Retry hints add a second call on 6% of questions in the final run: 19% before the analysis-first change, 7% before the think-better mode. Most of a question's time is the free endpoint itself. Its calls ranged from 1.2 to 7 s within the same minute, and one took 29 s. These are measurements on NVIDIA's free endpoint, whose latency varies; Claude Haiku 4.5 numbers are **TBD**.

## 11. Cost

Assumptions and sources: `docs/pricing.md` (list prices checked 2026-09-10; free access is priced at list price).

| Item | Value | Basis |
|---|---|---|
| Ingestion | $0 | parsing and indexing run in the browser, no API call |
| Tokens per question | 2131 in / 157 out (mean, retries included) | measured, reported eval `2ad522c`, 111 questions. Before the think-better mode: 1452 / 87 (the prompt is longer now, and each answer carries a private analysis) |
| Retries | 2 of 111 questions (1.8%) | measured; their tokens are included above. The two passes before it: 4.5% and 5/111. A retry is a second call, so it is the cost line that moves most between passes |
| LLM per question, Nemotron 3 Super | mean $0.00025, max $0.00060 | measured tokens × OpenRouter paid price ($0.085 / $0.40 per MTok) |
| LLM per question, Claude Haiku 4.5 | ≈ $0.0030 | **estimate**: same token counts × $1 / $5 per MTok; Haiku's tokenizer differs — **TBD measured** |
| Think harder, Claude Haiku 4.5 | up to ≈ +$0.010 per question | **estimate**: a thinking budget of up to 2,048 output tokens × $5/MTok. The budget is a target; easy questions use less. **TBD measured** |
| One pass over the P0 tests | $0.00271 (Nemotron) | measured |
| Speech recognition, prototype | $0 direct | Web Speech API (browser vendor's service, no SLA) |
| Speech synthesis (ElevenLabs Flash v2.5) | ≈ $0.0046 per question | measured mean spoken text 92 characters (the answer plus the Why line of inferred answers) × $0.05 per 1,000. In the browser test: 41–140 characters, $0.002–0.007. $0 when the browser's voice speaks |
| Speech synthesis, on device (Supertonic 3) | $0 per question | runs in the browser; a one-time 399 MB download per browser |
| Speech recognition, production (Deepgram Nova-3) | ≈ $0.00032 per question | **assumption**: 7-word mean question ≈ 2.5 s of speech × $0.0077/min |
| **Total variable cost per question** | with the neural voice: ≈ $0.0049 (Nemotron) / ≈ $0.0076 (Haiku est.); with a hosted recognizer as well: ≈ $0.0052 / ≈ $0.0079; Think harder adds up to ≈ $0.010 on Haiku | sum of the rows above |
| Paid intermediaries | $0 | the server calls the provider directly |
| Hosting (fixed, separate) | $0 / month on Vercel Hobby, within its caps | `docs/pricing.md` |

The voice is now the largest variable cost: about 18 times the reasoning on Nemotron and 1.5 times on Haiku.

## 12. One concrete check of AI output

**Automated, on every answer.** The validator rejects an answer whose cited ids don't exist, whose status breaks the rules, or that contains a number no cited line (and not the question) contains; the browser and the eval re-check that each quote is an exact substring of its page.

**Worked example (2026-09-10, runtime model NVIDIA Nemotron 3 Super).**

1. Asked "Is Model B ever allowed to exceed its normal limit?". Answer: "Model B may exceed its normal limit up to 15 units for no more than 5 minutes when ambient temperature is below 20°C.", citing `manual-v1.pdf` p.3, line `d1:p3:s3`.
2. The quote "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C." is an exact substring of the text pdf.js extracted from page 3, and the same line is on page 3 of `fixtures/source/manual-v1.txt`.
3. Every number in the answer — 15, 5, 20 — appears in the quote.
4. Rephrased as "Can Model B ever go above its usual maximum load?": same answer, same line, same page.
5. Opened the cited page with "Open in page" (2026-09-12). The viewer renders the PDF itself with pdf.js — not our extracted text — and frames the cited line. Read the framed line off the rendered page and compared it with the quote word for word and number for number: "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C." The same page also carries the distractors the answer had to avoid ("Clean the dosing nozzle of Model A every 15 days", "There is no exception for Model A"), and neither reached the answer. Anyone can repeat this in the demo in two clicks.

Reproduce with `npm run verify-example` (uses whichever provider `LLM_PROVIDER` selects).

**The check that mattered most.** In the first rerun after the A6/A7 fixes, the model answered "12 units" for Model B twice but cited a different line both times. The validator rejected it because 12 was not in the cited line, so the app said "I couldn't verify an answer" instead of showing a correct-sounding answer with a wrong citation — exactly the failure the brief warns about. The retry message now lists the lines that do contain the number; a targeted rerun then passed R1b and A7 3/3.

## 13. What failed / known limitations

Known before the eval:
- Voice input works only where the Web Speech API exists (Chrome/Edge).
- "First audio" is when the first sound is due at the audio output (the Web Audio clock plus the output latency), not the speaker itself; with the browser's voice it is the utterance start.
- The neural voice needs a round trip through the server, and the free ElevenLabs plan allows only ElevenLabs' own voices through the API.
- The on-device voice needs WebGPU to be usable, downloads 399 MB once per browser, and takes 4–6 s to load from the cache after a reload. Its source repository is archived.
- Rate limiting is best effort per server instance; the real protection is the spend limit on the API key.
- Wrapped-line joining and the "not found must say so" check are heuristics tuned on clean PDFs.
- The client bundle is ~674 KB, 208 KB gzipped (mostly pdf.js, plus the fonts and icons added in the redesign); not code-split.

Found by the eval (NVIDIA Nemotron 3 Super):
- **R1b is the weakest test in the set — it passed 4 of 9 runs across the three passes (1/3 in the reported one), and it is a P0 test.** "What is the limit?" is ambiguous in two ways at once: which model, and which of the manual's several limits. The contract says a clarifying question is about which model or product, and when the model asks that, the reply "Model B." is answered with 12 units. When it instead asks "which limit — load, reservoir capacity or temperature?", the reply names a model and settles nothing, so it asks again and the test fails. The failure is safe — it declines, cites nothing and invents nothing — but it is the criterion of ТЗ §7.8 that is missed. I tried twice to fix it in the prompt and reverted both, which is why the shipped prompt is the one that produced the numbers above:
  - *A rule that the reply to your own clarifying question must be answered.* R1b did not improve and R1 fell to 1/3: the clarifying question itself became vaguer.
  - *A rule that a clarifying question names the models as its options, derived from the contract's own definition of the status.* R1b rose to 2/3 and R1 fell to 1/3 — one P0 test traded for another. Both experiments are kept in `eval/results/report-clarification-experiment.md`.
  I did not touch `expected.json`: the expected answer was recorded before any run, and the model asking a different, also reasonable question does not make the recorded answer wrong. On Claude Haiku 4.5 this is the first test I would re-measure.
- **The "I couldn't verify an answer in the uploaded documents." fallback is English in all three languages.** It is the sentence shown and spoken when two attempts fail validation, and a Russian or Ukrainian listener gets it in English. One constant per language would fix it; I left the code as it was evaluated rather than change it after the reported run.
- **A6 failed 3/3 until the analysis-first change, 1/3 after it** — "Can Model B run at 15 units when it's 25°C?" gets "The uploaded documents do not specify…" instead of "No, the exception applies only below 20°C". A safe failure (declines, invents nothing, 0 citations), not fixed by two general prompt changes. Not tuned further to avoid fitting the prompt to one test. In the run `627aaf7` the retry hint that quotes the model's own reason back to it did not change its mind either. It has since settled down without any change aimed at it: 3/3, 2/3 and 3/3 in the three latest passes — another sign that a single pass measures the endpoint's mood as much as the pipeline. **TBD:** result on Claude Haiku 4.5.
- **X5 1/3 in `6f9f76b`, 3/3 after the analysis-first change** — "How often should I clean the nozzel?" twice got "the documents do not specify how often to clean the nozzle" instead of "which model?". The manual gives an interval for each model, so this is a wrong decline: safe, nothing invented, but wrong.
- **X3** — Nemotron never offered a related line for the battery question (0/3). In the final run, related lines appeared only for H5 and X5.
- **Mis-cited numbers** — the model sometimes cites a neighbouring line for a correct number. The validator catches it; since the retry hint (commit `e41c065`) the retry fixes it.
- **One garbled answer** — "answerModelA: the maximum load is 20 units." (fact and quote correct, so it scored as a pass). The validator checks facts and quotes, not fluency.
- **Free endpoint** — returns 503 "temporarily overloaded" at times (handled by retries; one unscored provider error in the first run) and its latency varies.
- **A7 before the fix** — "model bee" was answered with a clarification question; fixed in code by restoring spoken letters after "model".
- **Seen in the Russian voice test (my CV):** recognition turned "самая сильная сторона" (strongest side) into "самая сильная страна" (strongest country); the app answered "not in the document" instead of inventing a country, and the re-asked question was answered. "Какой самый лучший скилл" (what is the best skill) got "not specified": the CV does not rank skills, so the app declined to conclude — the behaviour the brief asks for.
- **H3 regression (holdout)** — "And the other one?" after a question about the Compact's filter passed 3/3 before the language work and 0/3 after it: the model asked "Compact or Pro?" instead. The new `<answer_language>` block sat between the conversation and the question; moving it above the conversation brought H3 back to 1/3 (M3 and L2, the other follow-ups, stayed 3/3). Not tuned further, because the holdout must not be used for prompt tuning. Still 0/3 in `6f9f76b`, and 3/3 after the analysis-first change (`627aaf7`). That change was made for the CV questions, not for H3: the model now restates the follow-up before it decides. Retry reasons are now recorded (`validation.retryReasons`), which showed the first attempt returning an empty clarification.

Found while building the think-better mode (NVIDIA Nemotron 3 Super):
- **My own prompt caused a regression.** The first version suggested adding "the rule that governs the topic" as a related line. The model then answered "not in the document" and filed the deciding rule as related: H4 (holdout, "Does the Compact have night mode?") dropped to 0/3. Rewritten to "a line that decides the question is never a related line, it makes the question answered".
- **My validator caused a regression too.** It rejected `basis: "inferred"` on clarifying questions, and Nemotron sets it there, so R1 (P0) fell into "I couldn't verify". These marks are now ignored on non-answers.
- **Ambiguity rendered as "not found" (R1).** With the longer prompt, Nemotron often answers "What is the limit?" with "The uploaded documents do not specify what limit is being asked about." A combined retry hint did not help: the model followed only its first instruction. A hint with only the clarification path works, but R1 now usually needs a second call.
- **Inferences often need a second call.** Nemotron first answers "not in the document" to "Can Model B run at 40°C?", citing the range and giving the right reason. The retry quotes that reason back and asks it to answer; in the browser that answer took 5.8 s to first audio instead of ~1.2 s.
- **Related lines are weak on Nemotron.** It often offers none (X3), or lines its answer never mentions (load limits for a battery question). Those are now dropped, and the retriever's closest passages appear instead, labelled "Closest".
- **The model fixes slips silently.** "nozzel" became "nozzle" in its restated question with no word to the user. The code names the correction (`slips.ts`); only slips the model itself corrected are caught.
- **Eval artifact.** A provider 429 on H2 made the harness score H3 against a conversation without H2, and count it critical. Later steps of a session after a provider error are now not scored, and the report lists them.

Found in my own test after the think-better mode (Russian voice questions about my 1-page CV, NVIDIA):
- **Answers got worse and slower.** "Кем он работал" (what did he work as) and "какой у него опыт работы" (his work experience) were answered "not in the document". Three of six questions needed a second call, 7–12 s to first audio.
- **Cause 1: status was generated first.** Replaying the conversation showed the model citing the right lines, and even writing in its reason field that the CV lists the jobs, while the status said "not found". The prompt from before the think-better mode failed the same way, so the cause was the order of the answer's fields, not the new prompt text. The retry hint did not change the model's mind. Fixed by making the model write the restated question and a private analysis first.
- **Cause 2: my morning validator change.** It accepted a not-found answer only if it named a "document", "manual" or "file", so "В резюме не указано…" (the CV does not say) went to a retry. Reverted to the broader check; the unclear-question case it was meant for has its own check.
- **Cause 3: the CV's two columns were glued together.** Examples: "Budapest, Hungary UI/UX Designer 2021 – 2022" and "Mechanical Design Engineer 2011 – 2015 Icon & illustration generation Systematic". Fixed in `pdf.ts`. The two small columns under "Additional info" ("Languages", "Focus Areas") were fixed next, at my request.
- **A question with a false premise** ("so he did not work as an engineer at Motor Sich?") was answered correctly but marked "conflict", which is for two documents, and was rejected. The prompt now says to answer and correct the premise.
- One call took 29 s on the free NVIDIA endpoint. That is the provider, not the pipeline.
- **After the fixes**, the same six questions (NVIDIA, `c692dbd`) were all answered correctly, with one retry: the false-premise question came back as "conflict" once more and was corrected on the retry. One weak spot remains: "Кем он работал" right after the Motor Sich answer named only Motor Sich.

Found while building the on-device voice:
- **Whole sentences before the first sound.** In my Chrome test on my CV the voice started 2.7–5.4 s after each answer. The answers were single long sentences, synthesized whole, and every new length made WebGPU build its kernels anew. The first piece is now cut short, and each kind of piece has a fixed shape warmed up at load.
- **My tile shadows slowed the voice down.** Tiles used a drop-shadow filter, so the shadow followed the tab. A filter is recomputed every frame while anything inside the tile moves: the answer filing in, the speaking bars. In the app that took the GPU from the voice, and its first piece took 1.5–2.1 s instead of 0.7 s. With the animations off it took 1.0 s, and without the filters 0.7 s. Tile shadows are now box-shadows: the surface's shadow, then the tab with its own, then the surface, which covers the tab's shadow at its foot. The silhouette keeps one seamless shadow, and nothing is recomputed while the answer moves. Two intermediate fixes failed. Clipping the tab's shadow at its foot left a hard edge. Moving the filter to a layer under the content was still recomputed, because the content moved over it. The first piece takes 0.74–0.79 s.
- **My own test on a 10-page short story, asked by voice in Russian (2026-09-12).** A document at the top of the size limit, and prose rather than a manual — the hardest input the scope allows. Seven questions: a clean one reached first audio in 3.0–3.5 s (model 1.3–1.8 s, on-device voice ~1.0 s, 2.9–3.1 s for the first answer after the voice loads), but three of the seven needed a second model call and the worst took 15.2 s. The three causes, in the order they cost time:
  - *An answer cut off by the output limit.* On "who is Eleonora" the model wrote 1,166 output tokens of private analysis and ran past `max_tokens`; the attempt was unparseable and 9.7 s were spent on nothing. **Not fixed** — a shorter analysis on narrative text, or a higher limit, both want an eval pass behind them.
  - *An id written in the answer's alphabet.* Twice in a row the model cited `д4:p7:s47` — our own id with Russian letters — the line was rejected as unknown, and a correct answer ended as "I couldn't verify an answer". **Fixed**: an id now resolves whichever alphabet it is written in (`findEvidence` in `core/validator.ts`, tested). The fix is additive — it can only let a previously rejected id resolve — and it postdates the reported eval run, which used no such ids.
  - *Evidence size.* Ten pages of prose are 440 lines and 7,855 tokens, against the manual's 82 and 1,213, so every question carries ~11.7k input tokens and costs $0.0021 instead of $0.0003 — and the automatic switch to top-k sits at 8,000 tokens, just above it. **Not fixed**: lowering that threshold would speed long documents up and cost recall on follow-ups through a narrative, which is a trade I would want measured first.
- **L5 swings like R1b.** The Ukrainian exception question passed 3/3 in the reported run and 1/3 in a targeted re-run half an hour later, both times on the same code. Same cause as everything else in this section: one pass of this suite measures the endpoint's mood as much as the pipeline.
- **Answer language drift (fixed).** A Ukrainian question asked right after a Russian one got a Russian answer (Nemotron). The answer is now checked against the language that was asked for: letters and everyday words that exist in one of the two Cyrillic languages and not in the other, and Cyrillic against Latin for English. A slip costs one more call with "answer again in Ukrainian"; if the second call slips too, the answer is kept and the slip is reported, because a right answer in the wrong language is better than no answer. The check only fires when an answer carries markers of the other language and none of its own, so a borderline answer is left alone (`src/core/language.ts`, tested in `src/core/language.test.ts` and in the answerer's retry tests). A new eval test, **L7**, asks in Russian and then switches to Ukrainian in the same session: 3/3 on its first run, committed before it (`eeb047b`). The drift was intermittent, so the eval test guards the case rather than proving the retry fires.

## 14. Unfinished parts

- **Final eval on Claude Haiku 4.5** — the target model (D1). The key works, but the account had no balance during the session; the pipeline is ready (`LLM_PROVIDER=anthropic`), a run takes ~10 minutes.
- **Think harder on Claude** — wired end to end: switch, request flag, `GET /api/answer` availability, the adapter's thinking parameters and `npm run eval -- --deep`. Unit-tested with a fake model, never run against the API. Anthropic's documentation does not say whether extended thinking and structured outputs (`output_config.format`) combine on Haiku 4.5. If they don't, the first Think harder question returns a server error in the answer tile. That is the first thing to check after the top-up.
- **Voice measurements in Chrome** and **cold start on Vercel** — see §10.
- **Cold start of the deployed function** — the function was already warm during the measurement session; a first-request-after-idle figure is still missing (§10).
- Not built on purpose (P2): a full/top-k comparison in the eval, prompt caching.

## 15. Time spent

14.4 hours logged in `docs/TIME_LOG.md`, against the brief's "up to eight focused working hours". The split: **4.5 hours on the brief itself** — ingestion, retrieval, the answer contract, validator and citations, the eval harness and its runs, the voice flow, the UI and the measurements — and **9.8 hours beyond it**, by my own choice, on work the brief did not ask for:

| Beyond the brief | Time | Why I spent it |
|---|---|---|
| The folder-tab interface, its animation and two rounds of visual bugs | ~5.0 h | The proof is the product here, and I wanted the answer and its quotes to read as one object. The largest single item, and the easiest to cut |
| Voice: ElevenLabs, the on-device model, the switch between three voices | ~1.3 h | The product is voice-first and the OS voices differ per machine; a reviewer on Windows may have no Russian or Ukrainian voice at all |
| "Think better": inferred answers, related lines, named slips | ~1.2 h | Real manuals answer questions they never state; declining those felt like the wrong product |
| Russian and Ukrainian, and the column-aware extraction my own CV needed | ~1.5 h | The brief allows one language; I wanted the reviewer's languages |
| Quotes filed per paragraph and the page viewer | ~0.8 h | A broad question about a one-page CV cited 26 lines in one block |

The core scenario was finished and evaluated inside the eight hours; everything after that is depth I chose to add, not overrun on the assignment.

## 16. What I would improve next

1. **Faster first audio:** stream the model's output and start speaking the first sentence once it validates, instead of waiting for the whole answer.
2. **Production speech:** a streaming recognizer for all browsers (for example ElevenLabs Scribe v2 or Soniox, both with Russian and Ukrainian) with temporary keys issued by the server, the browser's recognizer as the fallback; and a voice verified for Russian and Ukrainian (a paid ElevenLabs plan).
3. **Reasoning over stated rules (A6, X1):** run Haiku with and without Think harder first. If it still declines, add a small rule-evaluation step for "is it allowed" and range questions rather than more prompt text. The retry hint that quotes the model's own reason back to it already turns some of Nemotron's declines into answers, at the cost of a second call.
4. **Answer quality checks beyond facts:** a cheap fluency check (one garbled answer passed), and an LLM-judge pass in the eval for partial answers.
5. **The page viewer:** let the reader page through the document from the cited page.
6. **Bigger documents:** switch to top-k automatically (already implemented) and add embeddings once a corpus no longer fits the prompt; OCR for scans.
7. **Keep documents across reloads** (IndexedDB) and a real per-user rate limit (a KV store) for a public demo.

## 17. Links

- Repository: https://github.com/AlekVoyan/test-CB (private)
- Browser demo: https://askyourdocuments.vercel.app/
- Video walkthrough: **TBD**
