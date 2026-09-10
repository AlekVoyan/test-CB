# Eval report

- Date: 2026-09-10T17:33:37.173Z
- Commit: `ec88291 + uncommitted changes` · provider: `nvidia` · model: `nvidia/nemotron-3-super-120b-a12b` · retrieval: `full` · runs per session: 3
- Expected outcomes: `eval/expected.json` (committed before the first run)
- Latency here is the text pipeline in Node (retrieval + LLM + validation). Voice latency is measured in the browser.

## Summary

| Group | Tests | Runs | Factual accuracy | Citation accuracy | Pass rate | Critical failures |
|---|---|---|---|---|---|---|
| P0 | 3 | 9 | 100.0% | 100.0% | 100.0% | 0 |
| P1 | 3 | 9 | 66.7% | 66.7% | 66.7% | 0 |
| holdout | 2 | 6 | 100.0% | 100.0% | 100.0% | 0 |
| all | 8 | 24 | 87.5% | 87.5% | 87.5% | 0 |

**Acceptance (ТЗ §7.8):** P0 tests passing in ≥ 2/3 of runs: yes. Critical failures: 0.

## Factual accuracy

| ID | Type | Question | Expected | Actual (run 1) | Factual per run |
|---|---|---|---|---|---|
| M5 | absent fact | What is the battery life of Model A? | not_found: The manual does not specify battery life. | not_found: The uploaded documents do not specify the battery life of Model A. | 1 / 1 / 1 |
| R1 | ambiguity | What is the limit? | needs_clarification: Which model do you mean — Model A or Model B? | needs_clarification: Which model are you asking about, Model A or Model B? | 1 / 1 / 1 |
| R1b | clarification answer | Model B. | answered: Model B's maximum load is 12 units under normal conditions. | answered: The maximum load for Model B is 12 units under normal conditions. | 1 / 1 / 1 |
| A4 | unknown entity | What is the maximum load for Model C? | not_found: The manual only covers Model A and Model B. | not_found: The uploaded documents do not specify the maximum load for Model C. | 1 / 1 / 1 |
| A6 | exception reasoning | Can Model B run at 15 units when it's 25°C? | answered: No. The exception applies only below 20°C; otherwise Model B's maximum is 12 units. | not_found: The uploaded documents do not specify whether Model B can run at 15 units at 25°C. | 0 / 0 / 0 |
| H4 | holdout inference | Does the Compact have night mode? | answered: No. Night mode is available only on Nimbus Pro. | answered: No, night mode is available only on Nimbus Pro. | 1 / 1 / 1 |
| H5 | holdout absent | How much does the Pro cost? | not_found: The guide does not state a price. | not_found: The uploaded documents do not specify the cost of the Nimbus Pro. | 1 / 1 / 1 |
| A7 | STT error | What's the max load for model bee? | answered: Model B's maximum load is 12 units. | answered: The maximum load for Model B is 12 units under normal conditions. | 1 / 1 / 1 |

## Citation accuracy

| ID | Expected sources | Actual citations (run 1) | Citation per run |
|---|---|---|---|
| M5 | none (0 citations) | none | 1 / 1 / 1 |
| R1 | none (0 citations) | none | 1 / 1 / 1 |
| R1b | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 / 1 |
| A4 | none (0 citations) | none | 1 / 1 / 1 |
| A6 | manual-v1.pdf p.3 | none | 0 / 0 / 0 |
| H4 | holdout-nimbus.pdf p.2 | holdout-nimbus.pdf p.2: "Night mode is available only on Nimbus Pro." | 1 / 1 / 1 |
| H5 | none (0 citations) | none | 1 / 1 / 1 |
| A7 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 / 1 |

## Failures

- run 1 A6: not_found — "The uploaded documents do not specify whether Model B can run at 15 units at 25°C." (status not_found ≠ answered; missing: 20; validation attempts 1)
- run 2 A6: not_found — "The uploaded documents do not specify whether Model B can run at 15 units at 25°C." (status not_found ≠ answered; missing: 20; validation attempts 1)
- run 3 A6: not_found — "The uploaded documents do not specify whether Model B can run at 15 units at 25°C." (status not_found ≠ answered; missing: 20; validation attempts 1)

## Latency (Node, text pipeline)

| Measure | Median | p90 | Max |
|---|---|---|---|
| Retrieval | 0 ms | 1 ms | 1 ms |
| LLM, first attempt | 1955 ms | 4079 ms | 8348 ms |
| Question total (retrieval + LLM incl. retries + validation) | 1957 ms | 4082 ms | 8351 ms |

| Ingestion (Node, 5 runs) | Pages | Median | Max |
|---|---|---|---|
| manual-v1.pdf | 3 | 4 ms | 5 ms |
| manual-v2.pdf | 3 | 4 ms | 5 ms |
| holdout-nimbus.pdf | 2 | 5 ms | 9 ms |

## Cost (LLM only, $0.085/MTok in, $0.4/MTok out — OpenRouter paid list price for the same model, checked 2026-09-10 (called via NVIDIA's free endpoint))

| Measure | Value |
|---|---|
| Input tokens per question (mean) | 1291 |
| Output tokens per question (mean) | 59 |
| Cost per question, mean / max | $0.00013 / $0.00015 |
| Questions that needed a retry | 0/24 (0.0%) |
| Cost of one pass over the P0 tests | $0.00043 |
| Cost per ingestion | $0 (parsing and indexing run locally, no API calls) |
