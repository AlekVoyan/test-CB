# Eval report

- Date: 2026-09-12T13:04:20.889Z
- Commit: `4540f82 + uncommitted changes` · provider: `nvidia` · model: `nvidia/nemotron-3-super-120b-a12b` · retrieval: `full` · think harder: off · runs per session: 3
- Expected outcomes: `eval/expected.json` (committed before the first run)
- Latency here is the text pipeline in Node (retrieval + LLM + validation). Voice latency is measured in the browser.

## Summary

| Group | Tests | Runs | Factual accuracy | Citation accuracy | Reasoning checks | Pass rate | Critical failures |
|---|---|---|---|---|---|---|---|
| P0 | 3 | 6 | 100.0% | 100.0% | — | 100.0% | 0 |
| P1 | 1 | 2 | 100.0% | 100.0% | — | 100.0% | 0 |
| holdout | 5 | 8 | 100.0% | 100.0% | — | 100.0% | 0 |
| all | 9 | 16 | 100.0% | 100.0% | — | 100.0% | 0 |

**Acceptance (ТЗ §7.8):** P0 tests passing in ≥ 2/3 of runs: yes. Critical failures: 0.

**Provider errors (not scored, excluded from the rates above):** 9 — run 1 S6 R1, run 1 S14 H2, run 1 S15 H4, run 2 S1 M1, run 2 S6 R1, run 2 S11 A4, run 3 S1 M3, run 3 S6 R1, run 3 S14 H1. Details under Failures.

**Not scored because an earlier step of the same session hit a provider error** (the conversation they depend on never happened): run 1 R1b (after R1), run 1 H3 (after H2), run 1 H5 (after H4), run 2 M3 (after M1), run 2 R1b (after R1), run 3 R1b (after R1), run 3 H2 (after H1), run 3 H3 (after H1).

## Factual accuracy

| ID | Type | Question | Expected | Actual (run 1) | Factual per run |
|---|---|---|---|---|---|
| M1 | direct fact | What is the maximum for Model A? | answered: The maximum load for Model A is 20 units. | answered: The maximum load for Model A is 20 units. | 1 / 1 |
| M3 | follow-up | And what about the other model? | answered: Model B's maximum load is 12 units under normal conditions. | answered: The maximum load for Model B is 12 units. | 1 |
| M5 | absent fact | What is the battery life of Model A? | not_found: The manual does not specify battery life. | not_found: The uploaded documents do not specify the battery life of Model A. | 1 / 1 / 1 |
| A4 | unknown entity | What is the maximum load for Model C? | not_found: The manual only covers Model A and Model B. | not_found: The uploaded documents do not specify a maximum load for Model C. | 1 / 1 |
| H1 | holdout direct | What room size is the Pro designed for? | answered: Nimbus Pro is designed for rooms up to 60 square meters. | answered: The Nimbus Pro is designed for rooms up to 60 square meters. | 1 / 1 |
| H2 | holdout direct | How often should I replace the filter on the Compact? | answered: Replace the HEPA filter of Nimbus Compact every 6 months. | answered: Replace the HEPA filter of the Nimbus Compact every 6 months. | 1 |
| H3 | holdout follow-up | And the other one? | answered: Nimbus Pro: replace the HEPA filter every 12 months. | answered: Replace the HEPA filter of the Nimbus Pro every 12 months. | 1 |
| H4 | holdout inference | Does the Compact have night mode? | answered: No. Night mode is available only on Nimbus Pro. | answered (inferred): No, the Nimbus Compact does not have night mode. | 1 / 1 |
| H5 | holdout absent | How much does the Pro cost? | not_found: The guide does not state a price. | not_found: The uploaded documents do not specify the cost of the Nimbus Pro. | 1 / 1 |

## Citation accuracy

| ID | Expected sources | Actual citations (run 1) | Citation per run |
|---|---|---|---|
| M1 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 / 1 |
| M3 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 |
| M5 | none (0 citations) | none | 1 / 1 / 1 |
| A4 | none (0 citations) | none | 1 / 1 |
| H1 | holdout-nimbus.pdf p.1 | holdout-nimbus.pdf p.1: "Nimbus Pro is designed for rooms up to 60 square meters." | 1 / 1 |
| H2 | holdout-nimbus.pdf p.2 | holdout-nimbus.pdf p.2: "Replace the HEPA filter of Nimbus Compact every 6 months." | 1 |
| H3 | holdout-nimbus.pdf p.2 | holdout-nimbus.pdf p.2: "Replace the HEPA filter of Nimbus Pro every 12 months." | 1 |
| H4 | holdout-nimbus.pdf p.2 | holdout-nimbus.pdf p.2: "Night mode is available only on Nimbus Pro." | 1 / 1 |
| H5 | none (0 citations) | none | 1 / 1 |

## Reasoning: inferred, assumed and related answers

All tests, all runs. A wrong inferred answer counts as a critical failure.

| Run | ID | Question | Answer | Why · assumed · related | Reasoning check |
|---|---|---|---|---|---|
| 2 | H4 | Does the Compact have night mode? | answered (inferred): No, the Nimbus Compact does not have night mode. | why: Night mode is available only on Nimbus Pro, so it is not available on the Compact. | — |
| 2 | H5 | How much does the Pro cost? | not_found: The uploaded documents do not specify the cost of the Nimbus Pro. | related p.1: "Nimbus Pro is designed for rooms up to 60 square meters."<br>related p.2: "Replace the HEPA filter of Nimbus Pro every 12 months." | — |
| 3 | H4 | Does the Compact have night mode? | answered (inferred): No, the Nimbus Compact does not have night mode. | why: Night mode is available only on Nimbus Pro, so it is not available on the Compact. | — |

## Failures

- run 1 S6 R1: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S14 H2: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S15 H4: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S1 M1: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S6 R1: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S11 A4: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S1 M3: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S6 R1: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S14 H1: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}

## Latency (Node, text pipeline)

| Measure | Median | p90 | Max |
|---|---|---|---|
| Retrieval | 2 ms | 3 ms | 4 ms |
| LLM, first attempt | 4929 ms | 13815 ms | 14555 ms |
| Question total (retrieval + LLM incl. retries + validation) | 4936 ms | 13818 ms | 14561 ms |

| Ingestion (Node, 5 runs) | Pages | Median | Max |
|---|---|---|---|
| manual-v1.pdf | 3 | 9 ms | 22 ms |
| manual-v2.pdf | 3 | 17 ms | 48 ms |
| holdout-nimbus.pdf | 2 | 4 ms | 8 ms |

## Cost (LLM only, $0.085/MTok in, $0.4/MTok out — OpenRouter paid list price for the same model, checked 2026-09-10 (called via NVIDIA's free endpoint))

| Measure | Value |
|---|---|
| Input tokens per question (mean) | 1944 |
| Output tokens per question (mean) | 133 |
| Cost per question, mean / max | $0.00022 / $0.00024 |
| Questions that needed a retry | 0/16 (0.0%) |
| Cost of one pass over the P0 tests | $0.00047 |
| Cost per ingestion | $0 (parsing and indexing run locally, no API calls) |
