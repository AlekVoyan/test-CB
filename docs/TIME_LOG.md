# Time log

Budget: 8 focused hours. Clock started 2026-09-10 16:50 CEST.

| # | Stage | Start | End | Notes |
|---|---|---|---|---|
| 1 | Scaffold, fixtures, expected.json | 16:50 | 16:58 | Fixtures generated from `fixtures/source` with pdf-lib |
| 2 | Loader, normalizer, indexer, core pipeline, unit tests | 16:58 | 17:04 | 20/20 unit tests; pdf.js 6 moved `destroy()` to the loading task |
| 3 | Eval harness | 17:04 | 17:06 | Written and type-checked; first run waits for the API key |
| 5 | UI + voice (started early while the key is pending) | 17:06 | 17:12 | Upload, limits and error states verified in the browser; answers need the key |
| 8a | README, pricing, delivery-notes draft | 17:12 | 17:16 | Prices checked on vendor pages |
| — | Discussion: API access | 17:16 | 17:35 | Anthropic key valid but balance is 0. Decision: develop on a free NVIDIA-hosted model now, final run on Haiku after top-up |
| 4b | Second LLM adapter (NVIDIA) | 17:35 | 19:20 | Wall-clock is inflated by waiting on the free endpoints during the model probe (two models hung until request timeouts). Chosen: Nemotron 3 Super with reasoning off — with reasoning on, its JSON degenerated into whitespace. First eval (S1): 2/2 pass |
| 3b | Full eval on NVIDIA | 19:22 | 19:27 | First attempt aborted on a 503 from the free endpoint after 6/6 passes; added adapter retries and unscored provider errors, restarted 19:23. Result: P0 100%, P1 75% (A6, A7 fail 3/3), holdout 100%, 0 critical |
| 6 | Fix failures, rerun | 19:27 | 19:31 | A7: spoken-letter normalization; A6: prompt. Rerun: P0 96.7%, P1 83.3%, 0 critical; A6 still fails; two mis-cited "12 units" caught by the validator. Next: retry hint with the lines that hold the number; rule for "is it allowed" questions |
| 6b | Retry hint, permission rule, final NVIDIA eval | 19:31 | 19:42 | Targeted rerun: R1b, A7 3/3. Final full run (e41c065): P0 100%, P1 87.5% (A6 0/3), holdout 100%, 0 critical |
| 8b | Worked AI-output check, delivery notes | 19:36 | 19:45 | `npm run verify-example` |
| 7 | Voice test with the user's own PDF; fixes | 19:45 | 19:55 | Overview question got not_found → prompt rule + test A9 (3/3); STT timing read 0 ms → measured from the last interim result |
| — | Discussion: multilingual TTS plan (Chatterbox) | 20:00 | 20:20 | Chosen: EN/RU/UA through the browser, TTS behind an interface; Chatterbox documented, not integrated |
| 9 | Languages (plan B) and redesign | 01:40 (Sep 11) | 02:30 | Core + tests L1–L6 (18/18); bento/folder redesign with impeccable, animate, emil-design-eng; H3 holdout regression found and partly fixed |
| 10 | Voice test RU/UA in Chrome (Oleh) | 02:19 | 02:23 | 8 voice questions; STT median 69 ms, speech end → first audio median 2.07 s |
| 11 | Answer history and grouped quotes as folder stacks | 02:35 | 02:50 | Shades of the answer lime by age, question on the tab, wheel only over the tab strip, view-only earlier answers; quotes one folder per page with Show all. Checked at 1280 and 375 px |
| — | Discussion: a "think better" mode | 02:50 | 03:05 | Inferred answers with a Why line, related lines for not-found answers, named slips, Think harder (Claude only); a wrong inference counts as critical |
| 12 | Think-better mode | 03:05 | 04:00 | Tests X1–X5 committed before their first run. Four full NVIDIA runs: my own prompt and validator changes caused two regressions (H4, R1); the eval caught both and they were fixed. One "critical" was an eval artifact (provider 429), and the harness now skips the rest of a broken session. Final `6f9f76b`: P0 96.7%, P1 88.9%, holdout 80%, RU/UA 100%, think-better 60%, 0 critical. Think harder is wired but not run (no Anthropic balance). UI checked in the browser through the DOM (the pane was hidden, so no screenshots) |
| 14 | Tile entrance animation (user request, several rounds) | 10:30 | 11:05 | Rise from below with stagger; distance, duration, curve and stagger tuned on request (64px/200px desktop, 600 ms, quadratic ease-in-out, 100 ms) |
| 15 | Fix after my CV test: wrong not-found answers, slow answers | 11:08 | 11:40 | Replayed my six Russian voice questions on my CV. The model chose the status before reading, and the old prompt failed the same way. The answer now starts with the restated question and a private analysis. The not-found check accepts any document again. Two-column pages are read column by column. CV replay: 6/6 answered. Full eval `627aaf7`: P0 96.7%, P1 92.6%, holdout 100%, RU/UA 94.4%, think-better 80%, 0 critical, retries 6%. An interleaved A/B shows the new format costs ~34 tokens and no measurable time |
| 16 | CV: the "Languages" and "Focus Areas" columns | 11:40 | 11:50 | Recursive column cuts: a section may hold columns of its own. Running text is required on both sides, so label–value tables stay whole, and a capitalised line never continues a wrapped one. Fixtures byte-identical, 44/44 unit tests |
| 17 | Quotes as paragraph sheets; the cited page with frames | 11:55 | 12:35 | Planned with a mockup; decisions by the user: group by paragraph, the real PDF page, no citation limit. Line positions are kept from the text layer. Each cited paragraph is a sheet, with the lines around it fading out. "Open in page" renders the PDF page with the paragraph lit and cited lines framed: a left panel on desktop, a bottom sheet on phones. 48/48 unit tests, fixtures byte-identical, checked in the browser |
