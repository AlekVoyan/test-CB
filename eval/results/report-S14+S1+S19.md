# Eval report

- Date: 2026-09-11T00:13:25.576Z
- Commit: `fc99ba3 + uncommitted changes` · provider: `nvidia` · model: `nvidia/nemotron-3-super-120b-a12b` · retrieval: `full` · runs per session: 3
- Expected outcomes: `eval/expected.json` (committed before the first run)
- Latency here is the text pipeline in Node (retrieval + LLM + validation). Voice latency is measured in the browser.

## Summary

| Group | Tests | Runs | Factual accuracy | Citation accuracy | Pass rate | Critical failures |
|---|---|---|---|---|---|---|
| P0 | 2 | 6 | 100.0% | 100.0% | 100.0% | 0 |
| holdout | 3 | 9 | 77.8% | 77.8% | 77.8% | 0 |
| RU/UA | 2 | 6 | 100.0% | 100.0% | 100.0% | 0 |
| all | 7 | 21 | 90.5% | 90.5% | 90.5% | 0 |

**Acceptance (ТЗ §7.8):** P0 tests passing in ≥ 2/3 of runs: yes. Critical failures: 0.

## Factual accuracy

| ID | Type | Question | Expected | Actual (run 1) | Factual per run |
|---|---|---|---|---|---|
| M1 | direct fact | What is the maximum for Model A? | answered: The maximum load for Model A is 20 units. | answered: The maximum load for Model A is 20 units. | 1 / 1 / 1 |
| M3 | follow-up | And what about the other model? | answered: Model B's maximum load is 12 units under normal conditions. | answered: The maximum load for Model B is 12 units under normal conditions. | 1 / 1 / 1 |
| H1 | holdout direct | What room size is the Pro designed for? | answered: Nimbus Pro is designed for rooms up to 60 square meters. | answered: Nimbus Pro is designed for rooms up to 60 square meters. | 1 / 1 / 1 |
| H2 | holdout direct | How often should I replace the filter on the Compact? | answered: Replace the HEPA filter of Nimbus Compact every 6 months. | answered: Replace the HEPA filter of Nimbus Compact every 6 months. | 1 / 1 / 1 |
| H3 | holdout follow-up | And the other one? | answered: Nimbus Pro: replace the HEPA filter every 12 months. | needs_clarification: Do you mean the Nimbus Compact or the Nimbus Pro? | 0 / 0 / 1 |
| L1 | direct fact (RU) | Какая максимальная нагрузка у модели A? | answered: Максимальная нагрузка модели A — 20 единиц. | answered: Максимальная нагрузка модели A составляет 20 единиц. | 1 / 1 / 1 |
| L2 | follow-up (RU) | А у другой модели? | answered: У модели B максимальная нагрузка 12 единиц в обычных условиях. | answered: Максимальная нагрузка модели B составляет 12 единиц при нормальных условиях. | 1 / 1 / 1 |

## Citation accuracy

| ID | Expected sources | Actual citations (run 1) | Citation per run |
|---|---|---|---|
| M1 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 / 1 / 1 |
| M3 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 / 1 |
| H1 | holdout-nimbus.pdf p.1 | holdout-nimbus.pdf p.1: "Nimbus Pro is designed for rooms up to 60 square meters." | 1 / 1 / 1 |
| H2 | holdout-nimbus.pdf p.2 | holdout-nimbus.pdf p.2: "Replace the HEPA filter of Nimbus Compact every 6 months." | 1 / 1 / 1 |
| H3 | holdout-nimbus.pdf p.2 | none | 0 / 0 / 1 |
| L1 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 / 1 / 1 |
| L2 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 / 1 |

## Failures

- run 1 H3: needs_clarification — "Do you mean the Nimbus Compact or the Nimbus Pro?" (status needs_clarification ≠ answered; missing: 12 months/twelve months; validation attempts 2)
- run 2 H3: needs_clarification — "Which model are you asking about: Nimbus Compact or Nimbus Pro?" (status needs_clarification ≠ answered; missing: 12 months/twelve months; validation attempts 2)

## Latency (Node, text pipeline)

| Measure | Median | p90 | Max |
|---|---|---|---|
| Retrieval | 0 ms | 3 ms | 5 ms |
| LLM, first attempt | 1445 ms | 4124 ms | 11048 ms |
| Question total (retrieval + LLM incl. retries + validation) | 1578 ms | 4130 ms | 11053 ms |

| Ingestion (Node, 5 runs) | Pages | Median | Max |
|---|---|---|---|
| manual-v1.pdf | 3 | 6 ms | 7 ms |
| manual-v2.pdf | 3 | 5 ms | 6 ms |
| holdout-nimbus.pdf | 2 | 2 ms | 3 ms |

## Cost (LLM only, $0.085/MTok in, $0.4/MTok out — OpenRouter paid list price for the same model, checked 2026-09-10 (called via NVIDIA's free endpoint))

| Measure | Value |
|---|---|
| Input tokens per question (mean) | 1415 |
| Output tokens per question (mean) | 69 |
| Cost per question, mean / max | $0.00015 / $0.00022 |
| Questions that needed a retry | 2/21 (9.5%) |
| Cost of one pass over the P0 tests | $0.00031 |
| Cost per ingestion | $0 (parsing and indexing run locally, no API calls) |
