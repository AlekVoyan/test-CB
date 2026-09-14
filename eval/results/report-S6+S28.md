# Eval report

- Date: 2026-09-14T22:47:06.573Z
- Commit: `9fea9f0 + uncommitted changes` · provider: `nvidia` · model: `nvidia/nemotron-3-super-120b-a12b` · retrieval: `full` · think harder: off · runs per session: 3
- Expected outcomes: `eval/expected.json` (committed before the first run)
- Latency here is the text pipeline in Node (retrieval + LLM + validation). Voice latency is measured in the browser.

## Summary

| Group | Tests | Runs | Factual accuracy | Citation accuracy | Reasoning checks | Pass rate | Critical failures |
|---|---|---|---|---|---|---|---|
| P0 | 2 | 6 | 100.0% | 100.0% | — | 100.0% | 0 |
| Think better | 1 | 3 | 100.0% | 100.0% | — | 100.0% | 0 |
| all | 3 | 9 | 100.0% | 100.0% | — | 100.0% | 0 |

**Acceptance (ТЗ §7.8):** P0 tests passing in ≥ 2/3 of runs: yes. Critical failures: 0.

## Factual accuracy

| ID | Type | Question | Expected | Actual (run 1) | Factual per run |
|---|---|---|---|---|---|
| R1 | ambiguity | What is the limit? | needs_clarification: Which model do you mean — Model A or Model B? | needs_clarification: Which model do you mean — Model A or Model B? | 1 / 1 / 1 |
| R1b | clarification answer | Model B. | answered: Model B's maximum load is 12 units under normal conditions. | answered: The limit for Model B is 12 units under normal conditions. | 1 / 1 / 1 |
| X5 | slip, model not named (guard) | How often should I clean the nozzel? | needs_clarification: Which model do you mean — Model A or Model B? | needs_clarification: Which model do you mean — Model A or Model B? | 1 / 1 / 1 |

## Citation accuracy

| ID | Expected sources | Actual citations (run 1) | Citation per run |
|---|---|---|---|
| R1 | none (0 citations) | none | 1 / 1 / 1 |
| R1b | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 / 1 |
| X5 | none (0 citations) | none | 1 / 1 / 1 |

## Reasoning: inferred, assumed and related answers

All tests, all runs. A wrong inferred answer counts as a critical failure.

None.

## Failures

None.

## Latency (Node, text pipeline)

| Measure | Median | p90 | Max |
|---|---|---|---|
| Retrieval | 2 ms | 14 ms | 14 ms |
| LLM, first attempt | 0 ms | 7210 ms | 7210 ms |
| Question total (retrieval + LLM incl. retries + validation) | 3 ms | 7216 ms | 7216 ms |

| Ingestion (Node, 5 runs) | Pages | Median | Max |
|---|---|---|---|
| manual-v1.pdf | 3 | 9 ms | 13 ms |
| manual-v2.pdf | 3 | 4 ms | 4 ms |
| holdout-nimbus.pdf | 2 | 2 ms | 3 ms |

## Cost (LLM only, $0.085/MTok in, $0.4/MTok out — OpenRouter paid list price for the same model, checked 2026-09-10 (called via NVIDIA's free endpoint))

| Measure | Value |
|---|---|
| Input tokens per question (mean) | 735 |
| Output tokens per question (mean) | 58 |
| Cost per question, mean / max | $0.00009 / $0.00026 |
| Questions that needed a retry | 0/9 (0.0%) |
| Cost of one pass over the P0 tests | $0.00026 |
| Cost per ingestion | $0 (parsing and indexing run locally, no API calls) |
