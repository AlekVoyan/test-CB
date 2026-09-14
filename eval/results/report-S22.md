# Eval report

- Date: 2026-09-14T23:53:01.316Z
- Commit: `1d8b370 + uncommitted changes` · provider: `nvidia` · model: `nvidia/nemotron-3-super-120b-a12b` · retrieval: `full` · think harder: off · runs per session: 3
- Expected outcomes: `eval/expected.json` (committed before the first run)
- Latency here is the text pipeline in Node (retrieval + LLM + validation). Voice latency is measured in the browser.

## Summary

| Group | Tests | Runs | Factual accuracy | Citation accuracy | Reasoning checks | Pass rate | Critical failures |
|---|---|---|---|---|---|---|---|
| RU/UA | 1 | 3 | 33.3% | 33.3% | — | 33.3% | 0 |
| all | 1 | 3 | 33.3% | 33.3% | — | 33.3% | 0 |

**Acceptance (ТЗ §7.8):** P0 tests passing in ≥ 2/3 of runs: yes. Critical failures: 0.

## Factual accuracy

| ID | Type | Question | Expected | Actual (run 1) | Factual per run |
|---|---|---|---|---|---|
| L5 | exception (UA) | Чи може модель B перевищувати свій звичайний ліміт? | answered: Так: модель B може працювати до 15 одиниць не довше 5 хвилин, якщо температура нижче 20°C. | not_found: Не вдалося перевірити відповідь за завантаженими документами. | 0 / 0 / 1 |

## Citation accuracy

| ID | Expected sources | Actual citations (run 1) | Citation per run |
|---|---|---|---|
| L5 | manual-v1.pdf p.3 | none | 0 / 0 / 1 |

## Reasoning: inferred, assumed and related answers

All tests, all runs. A wrong inferred answer counts as a critical failure.

| Run | ID | Question | Answer | Why · assumed · related | Reasoning check |
|---|---|---|---|---|---|
| 3 | L5 | Чи може модель B перевищувати свій звичайний ліміт? | answered (inferred): Так, модель B може перевищувати свій звичайний ліміт 12 одиниць до 15 одиниць, але не більше 5 хвилин при температурі нижче 20°C. | why: За виключенням, Model B може працювати до 15 одиниць при температурі нижче 20°C протягом не більше 5 хвилин. | — |

## Failures

- run 1 L5: not_found — "Не вдалося перевірити відповідь за завантаженими документами." (status not_found ≠ answered; missing: так/може, 15, 5, 20; validation attempts 2)
  - rejected attempt 1 (answered): Так, модель B може перевищувати свій звичайний ліміт 12 одиниць до 15 одиниць, якщо температура навколишнього середовища нижче 20°C, але не довше 5 хвилин. · reason: За виключенням, зазначеним у розділі 6, Model B може працювати з навантаженням до 15 одиниць при температурі нижче 20°C протягом не більше 5 хвилин. · cites d1:p2:s4, d1:p3:s3 — The number 6 in the answer does not appear in any cited line or in the question. Lines that contain 6: [d1:p3:s2] 6. Exceptions [d1:p3:s8] Replace the filter cartridge of either model every 6 months. Cite the line that actually supports your statement, or remove the number.
  - rejected attempt 2 (answered): Так, модель B може перевищувати свій звичайний ліміт 12 одиниць до 15 одиниць, якщо температура навколишнього середовища нижче 20°C, але не довше 5 хвилин. · reason: За виключенням, зазначеним у розділі 6, Model B може працювати з навантаженням до 15 одиниць при температурі нижче 20°C протягом не більше 5 хвилин. · cites d1:p2:s4, d1:p3:s3 — The number 6 in the answer does not appear in any cited line or in the question. Lines that contain 6: [d1:p3:s2] 6. Exceptions [d1:p3:s8] Replace the filter cartridge of either model every 6 months. Cite the line that actually supports your statement, or remove the number.
- run 2 L5: not_found — "Не вдалося перевірити відповідь за завантаженими документами." (status not_found ≠ answered; missing: так/може, 15, 5, 20; validation attempts 2)
  - rejected attempt 1 (answered): Так, модель B може перевищувати свій звичайний ліміт 12 одиниць до 15 одиниць, але не більше 5 хвилин при температурі навколишнього середовища нижче 20°C. · reason: За винятком, зазначеним у розділі 6, Model B може працювати з навантаженням до 15 одиниць при умовах нижче 20°C температури. · cites d1:p2:s4, d1:p3:s3 — The number 6 in the answer does not appear in any cited line or in the question. Lines that contain 6: [d1:p3:s2] 6. Exceptions [d1:p3:s8] Replace the filter cartridge of either model every 6 months. Cite the line that actually supports your statement, or remove the number.
  - rejected attempt 2 (answered): Так, модель B може перевищувати свій звичайний ліміт 12 одиниць до 15 одиниць, але не більше 5 хвилин при температурі навколишнього середовища нижче 20°C. · reason: За винятком, зазначеним у розділі 6, Model B може працювати з навантаженням до 15 одиниць при умовах нижче 20°C температури. · cites d1:p2:s4, d1:p3:s3 — The number 6 in the answer does not appear in any cited line or in the question. Lines that contain 6: [d1:p3:s2] 6. Exceptions [d1:p3:s8] Replace the filter cartridge of either model every 6 months. Cite the line that actually supports your statement, or remove the number.

## Latency (Node, text pipeline)

| Measure | Median | p90 | Max |
|---|---|---|---|
| Retrieval | 1 ms | 6 ms | 6 ms |
| LLM, first attempt | 3939 ms | 4582 ms | 4582 ms |
| Question total (retrieval + LLM incl. retries + validation) | 5292 ms | 10093 ms | 10093 ms |

| Ingestion (Node, 5 runs) | Pages | Median | Max |
|---|---|---|---|
| manual-v1.pdf | 3 | 7 ms | 20 ms |
| manual-v2.pdf | 3 | 5 ms | 8 ms |
| holdout-nimbus.pdf | 2 | 2 ms | 2 ms |

## Cost (LLM only, $0.085/MTok in, $0.4/MTok out — OpenRouter paid list price for the same model, checked 2026-09-10 (called via NVIDIA's free endpoint))

| Measure | Value |
|---|---|
| Input tokens per question (mean) | 3903 |
| Output tokens per question (mean) | 433 |
| Cost per question, mean / max | $0.00050 / $0.00062 |
| Questions that needed a retry | 2/3 (66.7%) |
| Cost of one pass over the P0 tests | $0.00000 |
| Cost per ingestion | $0 (parsing and indexing run locally, no API calls) |
