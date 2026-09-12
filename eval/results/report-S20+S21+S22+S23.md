# Eval report

- Date: 2026-09-12T07:59:46.382Z
- Commit: `2c6c971 + uncommitted changes` · provider: `nvidia` · model: `nvidia/nemotron-3-super-120b-a12b` · retrieval: `full` · think harder: off · runs per session: 3
- Expected outcomes: `eval/expected.json` (committed before the first run)
- Latency here is the text pipeline in Node (retrieval + LLM + validation). Voice latency is measured in the browser.

## Summary

| Group | Tests | Runs | Factual accuracy | Citation accuracy | Reasoning checks | Pass rate | Critical failures |
|---|---|---|---|---|---|---|---|
| RU/UA | 4 | 12 | 100.0% | 100.0% | — | 100.0% | 0 |
| all | 4 | 12 | 100.0% | 100.0% | — | 100.0% | 0 |

**Acceptance (ТЗ §7.8):** P0 tests passing in ≥ 2/3 of runs: yes. Critical failures: 0.

## Factual accuracy

| ID | Type | Question | Expected | Actual (run 1) | Factual per run |
|---|---|---|---|---|---|
| L3 | absent fact (RU) | Сколько работает модель A от батареи? | not_found: В документе не указано время работы от батареи. | not_found: В загруженных документах не указано, сколько работает модель A от батареи. | 1 / 1 / 1 |
| L4 | direct fact (UA) | Яке максимальне навантаження моделі B? | answered: Максимальне навантаження моделі B — 12 одиниць за звичайних умов. | answered: Максимальне навантаження моделі B становить 12 одиниць за нормальних умов. | 1 / 1 / 1 |
| L5 | exception (UA) | Чи може модель B перевищувати свій звичайний ліміт? | answered: Так: модель B може працювати до 15 одиниць не довше 5 хвилин, якщо температура нижче 20°C. | answered (inferred): Так, модель B може перевищувати свій звичайний ліміт до 15 одиниць, але не більше 5 хвилин при температурі нижче 20°C. | 1 / 1 / 1 |
| L6 | absent fact (UA) | Скільки коштує модель A? | not_found: У документі ціна не вказана. | not_found: Завантажені документи не вказують ціну на модель A. | 1 / 1 / 1 |

## Citation accuracy

| ID | Expected sources | Actual citations (run 1) | Citation per run |
|---|---|---|---|
| L3 | none (0 citations) | none | 1 / 1 / 1 |
| L4 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 / 1 |
| L5 | manual-v1.pdf p.3 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions."<br>manual-v1.pdf p.3: "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C." | 1 / 1 / 1 |
| L6 | none (0 citations) | none | 1 / 1 / 1 |

## Reasoning: inferred, assumed and related answers

All tests, all runs. A wrong inferred answer counts as a critical failure.

| Run | ID | Question | Answer | Why · assumed · related | Reasoning check |
|---|---|---|---|---|---|
| 1 | L5 | Чи може модель B перевищувати свій звичайний ліміт? | answered (inferred): Так, модель B може перевищувати свій звичайний ліміт до 15 одиниць, але не більше 5 хвилин при температурі нижче 20°C. | why: За винятком, Model B може працювати до 15 одиниць при температурі нижче 20°C протягом не більше 5 хвилин. | — |
| 2 | L5 | Чи може модель B перевищувати свій звичайний ліміт? | answered (inferred): Так, модель B може перевищувати свій звичайний ліміт 12 одиниць до 15 одиниць, але не більше 5 хвилин при температурі нижче 20°C. | why: За виключенням, Model B може працювати до 15 одиниць при температурі нижче 20°C протягом не більше 5 хвилин. | — |
| 3 | L5 | Чи може модель B перевищувати свій звичайний ліміт? | answered (inferred): Так, модель B може перевищувати свій звичайний ліміт до 15 одиниць, але не більше 5 хвилин при температурі нижче 20°C. | why: Виключення дозволяє тимчасове збільшення навантаження за певних умов. | — |

## Failures

None.

## Latency (Node, text pipeline)

| Measure | Median | p90 | Max |
|---|---|---|---|
| Retrieval | 0 ms | 2 ms | 3 ms |
| LLM, first attempt | 2629 ms | 4885 ms | 6810 ms |
| Question total (retrieval + LLM incl. retries + validation) | 2634 ms | 4888 ms | 6823 ms |

| Ingestion (Node, 5 runs) | Pages | Median | Max |
|---|---|---|---|
| manual-v1.pdf | 3 | 8 ms | 24 ms |
| manual-v2.pdf | 3 | 4 ms | 6 ms |
| holdout-nimbus.pdf | 2 | 2 ms | 7 ms |

## Cost (LLM only, $0.085/MTok in, $0.4/MTok out — OpenRouter paid list price for the same model, checked 2026-09-10 (called via NVIDIA's free endpoint))

| Measure | Value |
|---|---|
| Input tokens per question (mean) | 2126 |
| Output tokens per question (mean) | 165 |
| Cost per question, mean / max | $0.00025 / $0.00028 |
| Questions that needed a retry | 0/12 (0.0%) |
| Cost of one pass over the P0 tests | $0.00000 |
| Cost per ingestion | $0 (parsing and indexing run locally, no API calls) |
