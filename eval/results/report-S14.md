# Eval report

- Date: 2026-09-11T00:11:04.521Z
- Commit: `fc99ba3 + uncommitted changes` · provider: `nvidia` · model: `nvidia/nemotron-3-super-120b-a12b` · retrieval: `full` · runs per session: 3
- Expected outcomes: `eval/expected.json` (committed before the first run)
- Latency here is the text pipeline in Node (retrieval + LLM + validation). Voice latency is measured in the browser.

## Summary

| Group | Tests | Runs | Factual accuracy | Citation accuracy | Pass rate | Critical failures |
|---|---|---|---|---|---|---|
| holdout | 3 | 9 | 66.7% | 66.7% | 66.7% | 0 |
| all | 3 | 9 | 66.7% | 66.7% | 66.7% | 0 |

**Acceptance (ТЗ §7.8):** P0 tests passing in ≥ 2/3 of runs: yes. Critical failures: 0.

## Factual accuracy

| ID | Type | Question | Expected | Actual (run 1) | Factual per run |
|---|---|---|---|---|---|
| H1 | holdout direct | What room size is the Pro designed for? | answered: Nimbus Pro is designed for rooms up to 60 square meters. | answered: Nimbus Pro is designed for rooms up to 60 square meters. | 1 / 1 / 1 |
| H2 | holdout direct | How often should I replace the filter on the Compact? | answered: Replace the HEPA filter of Nimbus Compact every 6 months. | answered: Replace the HEPA filter of Nimbus Compact every 6 months. | 1 / 1 / 1 |
| H3 | holdout follow-up | And the other one? | answered: Nimbus Pro: replace the HEPA filter every 12 months. | needs_clarification: Which model are you asking about: Nimbus Compact or Nimbus Pro? | 0 / 0 / 0 |

## Citation accuracy

| ID | Expected sources | Actual citations (run 1) | Citation per run |
|---|---|---|---|
| H1 | holdout-nimbus.pdf p.1 | holdout-nimbus.pdf p.1: "Nimbus Pro is designed for rooms up to 60 square meters." | 1 / 1 / 1 |
| H2 | holdout-nimbus.pdf p.2 | holdout-nimbus.pdf p.2: "Replace the HEPA filter of Nimbus Compact every 6 months." | 1 / 1 / 1 |
| H3 | holdout-nimbus.pdf p.2 | none | 0 / 0 / 0 |

## Failures

- run 1 H3: needs_clarification — "Which model are you asking about: Nimbus Compact or Nimbus Pro?" (status needs_clarification ≠ answered; missing: 12 months/twelve months; validation attempts 2)
- run 2 H3: needs_clarification — "Do you mean the Nimbus Compact or the Nimbus Pro?" (status needs_clarification ≠ answered; missing: 12 months/twelve months; validation attempts 2)
- run 3 H3: needs_clarification — "Which model are you asking about: Nimbus Compact or Nimbus Pro?" (status needs_clarification ≠ answered; missing: 12 months/twelve months; validation attempts 2)

## Latency (Node, text pipeline)

| Measure | Median | p90 | Max |
|---|---|---|---|
| Retrieval | 0 ms | 2 ms | 2 ms |
| LLM, first attempt | 1378 ms | 5500 ms | 5500 ms |
| Question total (retrieval + LLM incl. retries + validation) | 1831 ms | 6505 ms | 6505 ms |

| Ingestion (Node, 5 runs) | Pages | Median | Max |
|---|---|---|---|
| manual-v1.pdf | 3 | 9 ms | 15 ms |
| manual-v2.pdf | 3 | 5 ms | 8 ms |
| holdout-nimbus.pdf | 2 | 3 ms | 10 ms |

## Cost (LLM only, $0.085/MTok in, $0.4/MTok out — OpenRouter paid list price for the same model, checked 2026-09-10 (called via NVIDIA's free endpoint))

| Measure | Value |
|---|---|
| Input tokens per question (mean) | 1415 |
| Output tokens per question (mean) | 74 |
| Cost per question, mean / max | $0.00015 / $0.00022 |
| Questions that needed a retry | 3/9 (33.3%) |
| Cost of one pass over the P0 tests | $0.00000 |
| Cost per ingestion | $0 (parsing and indexing run locally, no API calls) |
