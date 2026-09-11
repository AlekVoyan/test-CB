# Eval report

- Date: 2026-09-11T00:01:12.086Z
- Commit: `fc99ba3` · provider: `nvidia` · model: `nvidia/nemotron-3-super-120b-a12b` · retrieval: `full` · runs per session: 3
- Expected outcomes: `eval/expected.json` (committed before the first run)
- Latency here is the text pipeline in Node (retrieval + LLM + validation). Voice latency is measured in the browser.

## Summary

| Group | Tests | Runs | Factual accuracy | Citation accuracy | Pass rate | Critical failures |
|---|---|---|---|---|---|---|
| RU/UA | 6 | 18 | 100.0% | 100.0% | 100.0% | 0 |
| all | 6 | 18 | 100.0% | 100.0% | 100.0% | 0 |

**Acceptance (ТЗ §7.8):** P0 tests passing in ≥ 2/3 of runs: yes. Critical failures: 0.

## Factual accuracy

| ID | Type | Question | Expected | Actual (run 1) | Factual per run |
|---|---|---|---|---|---|
| L1 | direct fact (RU) | Какая максимальная нагрузка у модели A? | answered: Максимальная нагрузка модели A — 20 единиц. | answered: Максимальная нагрузка модели A составляет 20 единиц. | 1 / 1 / 1 |
| L2 | follow-up (RU) | А у другой модели? | answered: У модели B максимальная нагрузка 12 единиц в обычных условиях. | answered: Максимальная нагрузка модели B составляет 12 единиц. | 1 / 1 / 1 |
| L3 | absent fact (RU) | Сколько работает модель A от батареи? | not_found: В документе не указано время работы от батареи. | not_found: В загруженных документах не указано, сколько работает модель A от батареи. | 1 / 1 / 1 |
| L4 | direct fact (UA) | Яке максимальне навантаження моделі B? | answered: Максимальне навантаження моделі B — 12 одиниць за звичайних умов. | answered: Максимальне навантаження моделі B становить 12 одиниць за нормальних умов. | 1 / 1 / 1 |
| L5 | exception (UA) | Чи може модель B перевищувати свій звичайний ліміт? | answered: Так: модель B може працювати до 15 одиниць не довше 5 хвилин, якщо температура нижче 20°C. | answered: Так, модель B може працювати до 15 одиниць протягом не більше 5 хвилин, якщо температура навколишнього середовища нижче 20°C. | 1 / 1 / 1 |
| L6 | absent fact (UA) | Скільки коштує модель A? | not_found: У документі ціна не вказана. | not_found: Завантажені документи не вказують ціну на модель A. | 1 / 1 / 1 |

## Citation accuracy

| ID | Expected sources | Actual citations (run 1) | Citation per run |
|---|---|---|---|
| L1 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 / 1 / 1 |
| L2 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 / 1 |
| L3 | none (0 citations) | none | 1 / 1 / 1 |
| L4 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 / 1 |
| L5 | manual-v1.pdf p.3 | manual-v1.pdf p.3: "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C." | 1 / 1 / 1 |
| L6 | none (0 citations) | none | 1 / 1 / 1 |

## Failures

None.

## Latency (Node, text pipeline)

| Measure | Median | p90 | Max |
|---|---|---|---|
| Retrieval | 1 ms | 3 ms | 3 ms |
| LLM, first attempt | 1691 ms | 5389 ms | 5459 ms |
| Question total (retrieval + LLM incl. retries + validation) | 1822 ms | 5392 ms | 5466 ms |

| Ingestion (Node, 5 runs) | Pages | Median | Max |
|---|---|---|---|
| manual-v1.pdf | 3 | 4 ms | 7 ms |
| manual-v2.pdf | 3 | 11 ms | 20 ms |
| holdout-nimbus.pdf | 2 | 2 ms | 2 ms |

## Cost (LLM only, $0.085/MTok in, $0.4/MTok out — OpenRouter paid list price for the same model, checked 2026-09-10 (called via NVIDIA's free endpoint))

| Measure | Value |
|---|---|
| Input tokens per question (mean) | 1602 |
| Output tokens per question (mean) | 77 |
| Cost per question, mean / max | $0.00017 / $0.00034 |
| Questions that needed a retry | 1/18 (5.6%) |
| Cost of one pass over the P0 tests | $0.00000 |
| Cost per ingestion | $0 (parsing and indexing run locally, no API calls) |
