# Eval report

- Date: 2026-09-12T08:01:10.518Z
- Commit: `eeb047b + uncommitted changes` · provider: `nvidia` · model: `nvidia/nemotron-3-super-120b-a12b` · retrieval: `full` · think harder: off · runs per session: 3
- Expected outcomes: `eval/expected.json` (committed before the first run)
- Latency here is the text pipeline in Node (retrieval + LLM + validation). Voice latency is measured in the browser.

## Summary

| Group | Tests | Runs | Factual accuracy | Citation accuracy | Reasoning checks | Pass rate | Critical failures |
|---|---|---|---|---|---|---|---|
| RU/UA | 2 | 6 | 100.0% | 100.0% | — | 100.0% | 0 |
| all | 2 | 6 | 100.0% | 100.0% | — | 100.0% | 0 |

**Acceptance (ТЗ §7.8):** P0 tests passing in ≥ 2/3 of runs: yes. Critical failures: 0.

## Factual accuracy

| ID | Type | Question | Expected | Actual (run 1) | Factual per run |
|---|---|---|---|---|---|
| L7-baseline | direct fact (RU) (RU) | Какая максимальная нагрузка у модели A? | answered: Максимальная нагрузка модели A — 20 единиц. | answered: Максимальная нагрузка модели A составляет 20 единиц. | 1 / 1 / 1 |
| L7 | language switch after a Russian turn (UA) | А яке максимальне навантаження моделі B? | answered: Максимальне навантаження моделі B — 12 одиниць за звичайних умов. | answered: Максимальне навантаження моделі B становить 12 одиниць. | 1 / 1 / 1 |

## Citation accuracy

| ID | Expected sources | Actual citations (run 1) | Citation per run |
|---|---|---|---|
| L7-baseline | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 / 1 / 1 |
| L7 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 / 1 |

## Reasoning: inferred, assumed and related answers

All tests, all runs. A wrong inferred answer counts as a critical failure.

None.

## Failures

None.

Replacement check (M6 vs baseline): answer changed in 3/3 runs.

## Latency (Node, text pipeline)

| Measure | Median | p90 | Max |
|---|---|---|---|
| Retrieval | 1 ms | 4 ms | 4 ms |
| LLM, first attempt | 3407 ms | 10346 ms | 10346 ms |
| Question total (retrieval + LLM incl. retries + validation) | 3415 ms | 10360 ms | 10360 ms |

| Ingestion (Node, 5 runs) | Pages | Median | Max |
|---|---|---|---|
| manual-v1.pdf | 3 | 9 ms | 32 ms |
| manual-v2.pdf | 3 | 6 ms | 9 ms |
| holdout-nimbus.pdf | 2 | 3 ms | 3 ms |

## Cost (LLM only, $0.085/MTok in, $0.4/MTok out — OpenRouter paid list price for the same model, checked 2026-09-10 (called via NVIDIA's free endpoint))

| Measure | Value |
|---|---|
| Input tokens per question (mean) | 2141 |
| Output tokens per question (mean) | 134 |
| Cost per question, mean / max | $0.00024 / $0.00024 |
| Questions that needed a retry | 0/6 (0.0%) |
| Cost of one pass over the P0 tests | $0.00000 |
| Cost per ingestion | $0 (parsing and indexing run locally, no API calls) |
