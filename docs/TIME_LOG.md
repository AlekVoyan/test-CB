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
| 3b | Full eval on NVIDIA | 19:22 | | |
