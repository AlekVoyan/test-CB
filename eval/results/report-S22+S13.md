# Eval report

- Date: 2026-09-15T00:20:38.891Z
- Commit: `e2e3341 + uncommitted changes` · provider: `nvidia` · model: `nvidia/nemotron-3-super-120b-a12b` · retrieval: `full` · think harder: off · runs per session: 3
- Expected outcomes: `eval/expected.json` (committed before the first run)
- Latency here is the text pipeline in Node (retrieval + LLM + validation). Voice latency is measured in the browser.

## Summary

| Group | Tests | Runs | Factual accuracy | Citation accuracy | Reasoning checks | Pass rate | Critical failures |
|---|---|---|---|---|---|---|---|
| P1 | 1 | 3 | 100.0% | 100.0% | — | 100.0% | 0 |
| RU/UA | 1 | 3 | 100.0% | 100.0% | — | 100.0% | 0 |
| all | 2 | 6 | 100.0% | 100.0% | — | 100.0% | 0 |

**Acceptance (ТЗ §7.8):** P0 tests passing in ≥ 2/3 of runs: yes. Critical failures: 0.

## Factual accuracy

| ID | Type | Question | Expected | Actual (run 1) | Factual per run |
|---|---|---|---|---|---|
| A6 | exception reasoning | Can Model B run at 15 units when it's 25°C? | answered: No. The exception applies only below 20°C; otherwise Model B's maximum is 12 units. | answered (inferred): No, Model B cannot run at 15 units at 25°C; the exception allowing up to 15 units only applies when the ambient temperature is below 20°C. | 1 / 1 / 1 |
| L5 | exception (UA) | Чи може модель B перевищувати свій звичайний ліміт? | answered: Так: модель B може працювати до 15 одиниць не довше 5 хвилин, якщо температура нижче 20°C. | answered (inferred): Так, модель B може перевищувати свій звичайний ліміт 12 одиниць до 15 одиниць, але не більше 5 хвилин при температурі нижче 20°C. | 1 / 1 / 1 |

## Citation accuracy

| ID | Expected sources | Actual citations (run 1) | Citation per run |
|---|---|---|---|
| A6 | manual-v1.pdf p.3 | manual-v1.pdf p.3: "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C." | 1 / 1 / 1 |
| L5 | manual-v1.pdf p.3 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions."<br>manual-v1.pdf p.3: "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C." | 1 / 1 / 1 |

## Reasoning: inferred, assumed and related answers

All tests, all runs. A wrong inferred answer counts as a critical failure.

| Run | ID | Question | Answer | Why · assumed · related | Reasoning check |
|---|---|---|---|---|---|
| 1 | A6 | Can Model B run at 15 units when it's 25°C? | answered (inferred): No, Model B cannot run at 15 units at 25°C; the exception allowing up to 15 units only applies when the ambient temperature is below 20°C. | why: The exception for Model B to operate up to 15 units is conditional on ambient temperature being below 20°C, which is not met at 25°C. | — |
| 1 | L5 | Чи може модель B перевищувати свій звичайний ліміт? | answered (inferred): Так, модель B може перевищувати свій звичайний ліміт 12 одиниць до 15 одиниць, але не більше 5 хвилин при температурі нижче 20°C. | why: Виключення дозволяє тимчасове збільшення навантаження за певних умов. | — |
| 2 | A6 | Can Model B run at 15 units when it's 25°C? | answered (inferred): No, Model B cannot run at 15 units at 25°C; the exception allowing up to 15 units only applies when the ambient temperature is below 20°C. | why: The exception for Model B to operate up to 15 units is limited to ambient temperatures below 20°C, so at 25°C the normal maximum load applies. | — |
| 2 | L5 | Чи може модель B перевищувати свій звичайний ліміт? | answered (inferred): Так, модель B може перевищувати свій звичайний ліміт 12 одиниць до 15 одиниць, але не більше 5 хвилин при температурі нижче 20°C. | why: За виключенням для Model B, дозволено тимчасове перевищення ліміту при певних умовах. | — |
| 3 | A6 | Can Model B run at 15 units when it's 25°C? | answered (inferred): No, Model B cannot run at 15 units at 25°C; the exception allowing up to 15 units only applies when ambient temperature is below 20°C. | why: The exception for Model B to operate up to 15 units is conditional on ambient temperature being below 20°C, which is not met at 25°C. | — |
| 3 | L5 | Чи може модель B перевищувати свій звичайний ліміт? | answered (inferred): Так, модель B може перевищувати свій звичайний ліміт 12 одиниць до 15 одиниць, якщо температура навколишнього середовища нижче 20°C, але не довше 5 хвилин. | why: За виключенням, Model B може працювати до 15 одиниць протягом не більше 5 хвилин при температурі нижче 20°C. | — |

## Failures

None.

## Latency (Node, text pipeline)

| Measure | Median | p90 | Max |
|---|---|---|---|
| Retrieval | 3 ms | 5 ms | 5 ms |
| LLM, first attempt | 2660 ms | 9671 ms | 9671 ms |
| Question total (retrieval + LLM incl. retries + validation) | 3132 ms | 16453 ms | 16453 ms |

| Ingestion (Node, 5 runs) | Pages | Median | Max |
|---|---|---|---|
| manual-v1.pdf | 3 | 6 ms | 9 ms |
| manual-v2.pdf | 3 | 4 ms | 5 ms |
| holdout-nimbus.pdf | 2 | 2 ms | 2 ms |

## Cost (LLM only, $0.085/MTok in, $0.4/MTok out — OpenRouter paid list price for the same model, checked 2026-09-10 (called via NVIDIA's free endpoint))

| Measure | Value |
|---|---|
| Input tokens per question (mean) | 2620 |
| Output tokens per question (mean) | 277 |
| Cost per question, mean / max | $0.00033 / $0.00060 |
| Questions that needed a retry | 1/6 (16.7%) |
| Cost of one pass over the P0 tests | $0.00000 |
| Cost per ingestion | $0 (parsing and indexing run locally, no API calls) |
