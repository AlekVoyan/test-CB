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
| 6 | Fix failures, rerun | 19:27 | | A7: spoken-letter normalization; A6: prompt. Rerun: P0 96.7%, P1 83.3%, 0 critical; A6 still fails; two mis-cited "12 units" caught by the validator. Next: retry hint with the lines that hold the number; rule for "is it allowed" questions |
| 6b | Retry hint, permission rule, final NVIDIA eval | 19:31 | 19:42 | Targeted rerun: R1b, A7 3/3. Final full run (e41c065): P0 100%, P1 87.5% (A6 0/3), holdout 100%, 0 critical |
| 8b | Worked AI-output check, delivery notes | 19:36 | | `npm run verify-example` |
