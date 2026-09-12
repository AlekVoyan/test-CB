# Eval report

- Date: 2026-09-12T13:24:38.612Z
- Commit: `d835747` · provider: `nvidia` · model: `nvidia/nemotron-3-super-120b-a12b` · retrieval: `full` · think harder: off · runs per session: 3
- Expected outcomes: `eval/expected.json` (committed before the first run)
- Latency here is the text pipeline in Node (retrieval + LLM + validation). Voice latency is measured in the browser.

## Summary

| Group | Tests | Runs | Factual accuracy | Citation accuracy | Reasoning checks | Pass rate | Critical failures |
|---|---|---|---|---|---|---|---|
| P0 | 9 | 16 | 100.0% | 100.0% | — | 100.0% | 0 |
| P1 | 7 | 12 | 91.7% | 100.0% | — | 91.7% | 0 |
| holdout | 5 | 8 | 100.0% | 100.0% | — | 100.0% | 0 |
| RU/UA | 5 | 8 | 100.0% | 100.0% | — | 100.0% | 0 |
| Think better | 5 | 8 | 100.0% | 100.0% | 80.0% | 87.5% | 0 |
| all | 31 | 52 | 98.1% | 100.0% | 80.0% | 96.2% | 0 |

**Acceptance (ТЗ §7.8):** P0 tests passing in ≥ 2/3 of runs: yes. Critical failures: 0.

**Provider errors (not scored, excluded from the rates above):** 49 — run 1 S6 R1, run 1 S9 A2, run 1 S10 A3, run 1 S11 A4, run 1 S13 A6, run 1 S14 H2, run 1 S17 (setup ask), run 1 S18 A9, run 1 S19 L2, run 1 S20 L3, run 1 S24 X1, run 1 S26 X3, run 1 S29 L7-baseline, run 2 S1 M1, run 2 S3 M4, run 2 S4 M5, run 2 S5 M6, run 2 S6 R1, run 2 S9 A2, run 2 S10 A3, run 2 S12 A5, run 2 S15 H4, run 2 S16 A7, run 2 S19 L1, run 2 S21 L4, run 2 S22 L5, run 2 S23 L6, run 2 S25 X2, run 2 S29 L7-baseline, run 3 S2 M2, run 3 S3 M4, run 3 S5 M6, run 3 S6 R1b, run 3 S7 R2, run 3 S9 A2, run 3 S10 A3, run 3 S13 A6, run 3 S14 H2, run 3 S15 H5, run 3 S17 A8, run 3 S18 A9, run 3 S19 L2, run 3 S21 L4, run 3 S22 L5, run 3 S25 X2, run 3 S26 X3, run 3 S27 X4, run 3 S28 X5, run 3 S29 L7-baseline. Details under Failures.

**Not scored because an earlier step of the same session hit a provider error** (the conversation they depend on never happened): run 1 R1b (after R1), run 1 H3 (after H2), run 1 A8 (after a setup question), run 1 L7 (after L7-baseline), run 2 M3 (after M1), run 2 R1b (after R1), run 2 H5 (after H4), run 2 L2 (after L1), run 2 L7 (after L7-baseline), run 3 H3 (after H2), run 3 L7 (after L7-baseline).

## Factual accuracy

| ID | Type | Question | Expected | Actual (run 1) | Factual per run |
|---|---|---|---|---|---|
| M1 | direct fact | What is the maximum for Model A? | answered: The maximum load for Model A is 20 units. | answered: The maximum load for Model A is 20 units. | 1 / 1 |
| M3 | follow-up | And what about the other model? | answered: Model B's maximum load is 12 units under normal conditions. | answered: The maximum load for Model B is 12 units. | 1 / 1 |
| M2 | comparison | How do I set up Model A versus Model B? | answered: Model A: connect power, hold SETUP for 3 seconds, select channel 1. Model B: connect power, open the front cover, set MODE to B, press START. | answered: For Model A: connect the power adapter, press and hold the SETUP button for 3 seconds until the status light blinks green, then select channel 1 on the CHANNEL dial (do not select channel 2). For Model B: connect the power adapter, open the front cover, set the MODE switch to position B, then press START. | 1 / 1 |
| M4 | exception | Is Model B ever allowed to exceed its normal limit? | answered: Yes. Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C. | answered (inferred): Yes, Model B may exceed its normal limit of 12 units under specific conditions. | 1 |
| M5 | absent fact | What is the battery life of Model A? | not_found: The manual does not specify battery life. | not_found: The uploaded documents do not specify the battery life of Model A. | 1 / 1 |
| M6-baseline | replacement baseline | What is the maximum for Model A? | answered: The maximum load for Model A is 20 units. | answered: The maximum load for Model A is 20 units. | 1 / 1 / 1 |
| M6 | replacement | What is the maximum for Model A? | answered: The maximum load for Model A is 24 units. | answered: The maximum load for Model A is 24 units. | 1 |
| R2 | correction | I meant Model B. | answered: Model B's maximum load is 12 units. | answered: The maximum load for Model B is 12 units under normal conditions. | 1 / 1 |
| A1 | conflicting documents | What is the maximum for Model A? | conflict: manual-v1.pdf says 20 units; manual-v2.pdf says 24 units. | conflict (inferred): The maximum load for Model A is 20 units according to manual-v1.pdf and 24 units according to manual-v2.pdf. | 1 / 1 / 1 |
| A5 | rename (anti-hardcode) | What is the maximum for Model A? | answered: The maximum load for Model A is 24 units. | answered: The maximum load for Model A is 24 units. | 1 / 1 |
| H1 | holdout direct | What room size is the Pro designed for? | answered: Nimbus Pro is designed for rooms up to 60 square meters. | answered: The Nimbus Pro is designed for rooms up to 60 square meters. | 1 / 1 / 1 |
| H4 | holdout inference | Does the Compact have night mode? | answered: No. Night mode is available only on Nimbus Pro. | answered (inferred): No, the Nimbus Compact does not have night mode. | 1 / 1 |
| H5 | holdout absent | How much does the Pro cost? | not_found: The guide does not state a price. | not_found: The uploaded documents do not specify the cost of the Nimbus Pro. | 1 |
| A7 | STT error | What's the max load for model bee? | answered: Model B's maximum load is 12 units. | answered: The maximum load for Model B is 12 units under normal conditions. | 1 / 1 |
| L1 | direct fact (RU) | Какая максимальная нагрузка у модели A? | answered: Максимальная нагрузка модели A — 20 единиц. | answered: Максимальная нагрузка у модели A составляет 20 единиц. | 1 / 1 |
| L4 | direct fact (UA) | Яке максимальне навантаження моделі B? | answered: Максимальне навантаження моделі B — 12 одиниць за звичайних умов. | answered: Максимальне навантаження моделі B становить 12 одиниць. | 1 |
| L5 | exception (UA) | Чи може модель B перевищувати свій звичайний ліміт? | answered: Так: модель B може працювати до 15 одиниць не довше 5 хвилин, якщо температура нижче 20°C. | answered (inferred): Так, модель B може перевищувати свій звичайний ліміт 12 одиниць до 15 одиниць, але не більше 5 хвилин, якщо температура навколишнього середовища нижче 20°C. | 1 |
| L6 | absent fact (UA) | Скільки коштує модель A? | not_found: У документі ціна не вказана. | not_found: Завантажені документи не вказують ціну на модель A. | 1 / 1 |
| X2 | indirect fact | What's the maximum temperature for Model A? | answered: 35°C, the top of the operating temperature range (5°C to 35°C). | answered: The maximum temperature for Model A is 35°C. | 1 |
| X4 | slip, one target | How often should I clean the nozzel on Model B? | answered: Assuming you meant the nozzle: clean the dosing nozzle of Model B every 30 days. | answered: Assuming you meant “nozzle”: Clean the dosing nozzle of Model B every 30 days. | 1 / 1 |
| X5 | slip, model not named (guard) | How often should I clean the nozzel? | needs_clarification: Which model do you mean — Model A or Model B? | needs_clarification: Assuming you meant “nozzle”: Please specify whether you are using Model A or Model B of the Kestrel Dosing System. | 1 / 1 |
| A4 | unknown entity | What is the maximum load for Model C? | not_found: The manual only covers Model A and Model B. | not_found: The uploaded documents do not specify a maximum load for Model C. | 1 / 1 |
| A6 | exception reasoning | Can Model B run at 15 units when it's 25°C? | answered: No. The exception applies only below 20°C; otherwise Model B's maximum is 12 units. | answered (inferred): No, Model B cannot run at 15 units at 25°C; the exception allowing up to 15 units only applies when ambient temperature is below 20°C. | 1 |
| H2 | holdout direct | How often should I replace the filter on the Compact? | answered: Replace the HEPA filter of Nimbus Compact every 6 months. | answered: Replace the HEPA filter of the Nimbus Compact every 6 months. | 1 |
| H3 | holdout follow-up | And the other one? | answered: Nimbus Pro: replace the HEPA filter every 12 months. | answered: Replace the HEPA filter of the Nimbus Pro every 12 months. | 1 |
| A8 | history reset | And what about the other model? | needs_clarification: Which model do you mean? | not_found: I couldn't verify an answer in the uploaded documents. | 0 |
| A9 | document overview | What is this document about? | answered: It is the user manual for the Kestrel Dosing System, covering Model A and Model B. | answered: This document is the user manual for the Kestrel Dosing System, covering Model A and Model B. | 1 |
| L3 | absent fact (RU) | Сколько работает модель A от батареи? | not_found: В документе не указано время работы от батареи. | not_found: В загруженных документах не указано, сколько работает модель A от батареи. | 1 / 1 |
| X1 | inference from a range | Can Model B run at 40°C? | answered: No. The operating temperature for both models is 5°C to 35°C, so 40°C is outside it. | answered (inferred): No, Model B cannot run at 40°C because the operating temperature range for both models is 5°C to 35°C. | 1 / 1 |
| X3 | absent fact, related line | How long does Model B run on battery? | not_found: The manual does not mention battery operation. Related: both models use the same 12 V power adapter. | not_found: The uploaded documents do not specify how long Model B runs on battery. | 1 |
| R1 | ambiguity | What is the limit? | needs_clarification: Which model do you mean — Model A or Model B? | needs_clarification: Please specify which limit you are asking about (e.g., load limit, temperature limit, reservoir capacity) and for which model (Model A or Model B). | 1 |

## Citation accuracy

| ID | Expected sources | Actual citations (run 1) | Citation per run |
|---|---|---|---|
| M1 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 / 1 |
| M3 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 |
| M2 | manual-v1.pdf p.1 | manual-v1.pdf p.1: "2. Setup: Model A"<br>manual-v1.pdf p.1: "Step 1. Connect the power adapter."<br>manual-v1.pdf p.1: "Step 2. Press and hold the SETUP button for 3 seconds until the status light blinks green."<br>manual-v1.pdf p.1: "Step 3. Select channel 1 on the CHANNEL dial."<br>manual-v1.pdf p.1: "Do not select channel 2 during setup. Channel 2 is reserved for service mode."<br>manual-v1.pdf p.1: "3. Setup: Model B"<br>manual-v1.pdf p.1: "Step 1. Connect the power adapter."<br>manual-v1.pdf p.1: "Step 2. Open the front cover."<br>manual-v1.pdf p.1: "Step 3. Set the MODE switch to position B."<br>manual-v1.pdf p.1: "Step 4. Press START."<br>manual-v1.pdf p.1: "Model B has no SETUP button. Holding START for more than 10 seconds resets Model B to factory settings." | 1 / 1 |
| M4 | manual-v1.pdf p.3 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions."<br>manual-v1.pdf p.3: "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C." | 1 |
| M5 | none (0 citations) | none | 1 / 1 |
| M6-baseline | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 / 1 / 1 |
| M6 | manual-v2.pdf p.2 | manual-v2.pdf p.2: "Model A: the maximum load is 24 units." | 1 |
| R2 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 |
| A1 | manual-v1.pdf p.2, manual-v2.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units."<br>manual-v2.pdf p.2: "Model A: the maximum load is 24 units." | 1 / 1 / 1 |
| A5 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 24 units." | 1 / 1 |
| H1 | holdout-nimbus.pdf p.1 | holdout-nimbus.pdf p.1: "Nimbus Pro is designed for rooms up to 60 square meters." | 1 / 1 / 1 |
| H4 | holdout-nimbus.pdf p.2 | holdout-nimbus.pdf p.2: "Night mode is available only on Nimbus Pro." | 1 / 1 |
| H5 | none (0 citations) | none | 1 |
| A7 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 |
| L1 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 / 1 |
| L4 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 |
| L5 | manual-v1.pdf p.3 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions."<br>manual-v1.pdf p.3: "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C." | 1 |
| L6 | none (0 citations) | none | 1 / 1 |
| X2 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Operating temperature for both models: 5°C to 35°C." | 1 |
| X4 | manual-v1.pdf p.3 | manual-v1.pdf p.3: "Clean the dosing nozzle of Model B every 30 days." | 1 / 1 |
| X5 | none (0 citations) | none | 1 / 1 |
| A4 | none (0 citations) | none | 1 / 1 |
| A6 | manual-v1.pdf p.3 | manual-v1.pdf p.3: "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C." | 1 |
| H2 | holdout-nimbus.pdf p.2 | holdout-nimbus.pdf p.2: "Replace the HEPA filter of Nimbus Compact every 6 months." | 1 |
| H3 | holdout-nimbus.pdf p.2 | holdout-nimbus.pdf p.2: "Replace the HEPA filter of Nimbus Pro every 12 months." | 1 |
| A8 | none (0 citations) | none | 1 |
| A9 | manual-v1.pdf p.1 | manual-v1.pdf p.1: "Kestrel Dosing System — User Manual v1"<br>manual-v1.pdf p.1: "1. Introduction"<br>manual-v1.pdf p.1: "This manual covers two models of the Kestrel Dosing System: Model A and Model B." | 1 |
| L3 | none (0 citations) | none | 1 / 1 |
| X1 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Operating temperature for both models: 5°C to 35°C." | 1 / 1 |
| X3 | none (0 citations) | none | 1 |
| R1 | none (0 citations) | none | 1 |

## Reasoning: inferred, assumed and related answers

All tests, all runs. A wrong inferred answer counts as a critical failure.

| Run | ID | Question | Answer | Why · assumed · related | Reasoning check |
|---|---|---|---|---|---|
| 1 | M4 | Is Model B ever allowed to exceed its normal limit? | answered (inferred): Yes, Model B may exceed its normal limit of 12 units under specific conditions. | why: The exception rule permits Model B to operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C. | — |
| 1 | A1 | What is the maximum for Model A? | conflict (inferred): The maximum load for Model A is 20 units according to manual-v1.pdf and 24 units according to manual-v2.pdf. | why: The two documents give different values for the same specification. | — |
| 1 | H4 | Does the Compact have night mode? | answered (inferred): No, the Nimbus Compact does not have night mode. | why: Night mode is available only on Nimbus Pro, so it is not available on the Compact. | — |
| 1 | H5 | How much does the Pro cost? | not_found: The uploaded documents do not specify the cost of the Nimbus Pro. | related p.1: "Nimbus Pro is designed for rooms up to 60 square meters."<br>related p.2: "Replace the HEPA filter of Nimbus Pro every 12 months." | — |
| 1 | L5 | Чи може модель B перевищувати свій звичайний ліміт? | answered (inferred): Так, модель B може перевищувати свій звичайний ліміт 12 одиниць до 15 одиниць, але не більше 5 хвилин, якщо температура навколишнього середовища нижче 20°C. | why: Виключення дозволяє тимчасове збільшення навантаження за певних умов. | — |
| 1 | X4 | How often should I clean the nozzel on Model B? | answered: Assuming you meant “nozzle”: Clean the dosing nozzle of Model B every 30 days. | assumed: nozzle | 1 |
| 1 | X5 | How often should I clean the nozzel? | needs_clarification: Assuming you meant “nozzle”: Please specify whether you are using Model A or Model B of the Kestrel Dosing System. | assumed: nozzle | — |
| 2 | A1 | What is the maximum for Model A? | conflict (inferred): The documents conflict: manual v1 says Model A's maximum load is 20 units, while manual v2 says it is 24 units. | why: Comparing the stated maximum load values for Model A across the two manuals. | — |
| 2 | A6 | Can Model B run at 15 units when it's 25°C? | answered (inferred): No, Model B cannot run at 15 units at 25°C; the exception allowing up to 15 units only applies when ambient temperature is below 20°C. | why: The exception for Model B to operate up to 15 units is conditional on ambient temperature being below 20°C, which is not met at 25°C. | — |
| 2 | X1 | Can Model B run at 40°C? | answered (inferred): No, Model B cannot run at 40°C because the operating temperature range for both models is 5°C to 35°C. | why: The operating temperature range is a stated limit, and 40°C exceeds the maximum of 35°C. | 1 |
| 2 | X3 | How long does Model B run on battery? | not_found: The uploaded documents do not specify how long Model B runs on battery. | — | 0 |
| 2 | X4 | How often should I clean the nozzel on Model B? | answered: Assuming you meant “nozzle”: Clean the dosing nozzle of Model B every 30 days. | assumed: nozzle | 1 |
| 2 | X5 | How often should I clean the nozzel? | needs_clarification: Assuming you meant “nozzle”: Please specify whether you have Model A or Model B, as cleaning frequency differs between the two models. | assumed: nozzle | — |
| 3 | A1 | What is the maximum for Model A? | conflict (inferred): The manuals disagree: manual v1 says Model A's maximum load is 20 units, but manual v2 says it is 24 units. | why: Two documents give different values for the same specification. | — |
| 3 | H4 | Does the Compact have night mode? | answered (inferred): No, the Nimbus Compact does not have night mode. | why: Night mode is available only on Nimbus Pro, so it is not available on the Compact. | — |
| 3 | X1 | Can Model B run at 40°C? | answered (inferred): No, Model B cannot run at 40°C because the operating temperature for both models is limited to 5°C to 35°C. | why: The operating temperature range of 5°C to 35°C excludes 40°C, so exceeding this limit is not allowed. | 1 |

## Failures

- run 1 S6 R1: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S9 A2: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S10 A3: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S11 A4: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S13 A6: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S14 H2: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S17 (setup ask): provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S18 A9: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S19 L2: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S20 L3: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S24 X1: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S26 X3: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S29 L7-baseline: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S1 M1: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S3 M4: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S4 M5: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S5 M6: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S6 R1: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S9 A2: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S10 A3: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S12 A5: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S15 H4: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S16 A7: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S19 L1: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S21 L4: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S22 L5: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S23 L6: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S25 X2: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S29 L7-baseline: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S2 M2: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S3 M4: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S5 M6: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S6 R1b: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S7 R2: provider error, not scored — NVIDIA API 503: {"error":{"message":"Service temporarily overloaded","type":"Service Unavailable","code":503}}
- run 3 S9 A2: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S10 A3: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S13 A6: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S14 H2: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S15 H5: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S17 A8: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S18 A9: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S19 L2: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S21 L4: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S22 L5: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S25 X2: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S26 X3: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S27 X4: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S28 X5: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S29 L7-baseline: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 A8: not_found — "I couldn't verify an answer in the uploaded documents." (status not_found ≠ needs_clarification; validation attempts 2)
- run 2 X3: not_found — "The uploaded documents do not specify how long Model B runs on battery." (no related line from the expected pages; validation attempts 1)

Replacement check (M6 vs baseline): answer changed in 1/1 runs.

## Latency (Node, text pipeline)

| Measure | Median | p90 | Max |
|---|---|---|---|
| Retrieval | 1 ms | 4 ms | 114 ms |
| LLM, first attempt | 4379 ms | 13214 ms | 19813 ms |
| Question total (retrieval + LLM incl. retries + validation) | 4384 ms | 13343 ms | 19985 ms |

| Ingestion (Node, 5 runs) | Pages | Median | Max |
|---|---|---|---|
| manual-v1.pdf | 3 | 20 ms | 42 ms |
| manual-v2.pdf | 3 | 9 ms | 31 ms |
| holdout-nimbus.pdf | 2 | 8 ms | 11 ms |

## Cost (LLM only, $0.085/MTok in, $0.4/MTok out — OpenRouter paid list price for the same model, checked 2026-09-10 (called via NVIDIA's free endpoint))

| Measure | Value |
|---|---|
| Input tokens per question (mean) | 2254 |
| Output tokens per question (mean) | 162 |
| Cost per question, mean / max | $0.00026 / $0.00054 |
| Questions that needed a retry | 2/52 (3.8%) |
| Cost of one pass over the P0 tests | $0.00144 |
| Cost per ingestion | $0 (parsing and indexing run locally, no API calls) |
