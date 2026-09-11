# Eval report

- Date: 2026-09-11T01:36:20.056Z
- Commit: `ff6dbe6` · provider: `nvidia` · model: `nvidia/nemotron-3-super-120b-a12b` · retrieval: `full` · think harder: off · runs per session: 3
- Expected outcomes: `eval/expected.json` (committed before the first run)
- Latency here is the text pipeline in Node (retrieval + LLM + validation). Voice latency is measured in the browser.

## Summary

| Group | Tests | Runs | Factual accuracy | Citation accuracy | Reasoning checks | Pass rate | Critical failures |
|---|---|---|---|---|---|---|---|
| P0 | 10 | 30 | 76.7% | 90.0% | — | 73.3% | 0 |
| P1 | 9 | 27 | 90.7% | 92.6% | — | 88.9% | 0 |
| holdout | 5 | 15 | 60.0% | 60.0% | — | 60.0% | 0 |
| RU/UA | 6 | 18 | 100.0% | 100.0% | — | 100.0% | 0 |
| Think better | 5 | 15 | 80.0% | 93.3% | 55.6% | 53.3% | 0 |
| all | 35 | 105 | 82.4% | 88.6% | 55.6% | 77.1% | 0 |

**Acceptance (ТЗ §7.8):** P0 tests passing in ≥ 2/3 of runs: NO — M4, R1, R1b. Critical failures: 0.

## Factual accuracy

| ID | Type | Question | Expected | Actual (run 1) | Factual per run |
|---|---|---|---|---|---|
| M1 | direct fact | What is the maximum for Model A? | answered: The maximum load for Model A is 20 units. | answered: The maximum load for Model A is 20 units. | 1 / 1 / 1 |
| M3 | follow-up | And what about the other model? | answered: Model B's maximum load is 12 units under normal conditions. | answered: The maximum load for Model B is 12 units under normal conditions. | 1 / 1 / 1 |
| M2 | comparison | How do I set up Model A versus Model B? | answered: Model A: connect power, hold SETUP for 3 seconds, select channel 1. Model B: connect power, open the front cover, set MODE to B, press START. | answered (inferred): For Model A, connect the power adapter, press and hold the SETUP button for 3 seconds until the status light blinks green, then select channel 1 on the CHANNEL dial. For Model B, connect the power adapter, open the front cover, set the MODE switch to position B, then press START. | 1 / 1 / 1 |
| M4 | exception | Is Model B ever allowed to exceed its normal limit? | answered: Yes. Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C. | answered (inferred): Yes, Model B may exceed its normal limit of 12 units up to 15 units for no more than 5 minutes when ambient temperature is below 20°C. | 1 / 0.5 / 0.5 |
| M5 | absent fact | What is the battery life of Model A? | not_found: The manual does not specify battery life. | not_found: The uploaded documents do not specify the battery life of Model A. | 1 / 1 / 1 |
| M6-baseline | replacement baseline | What is the maximum for Model A? | answered: The maximum load for Model A is 20 units. | answered: The maximum load for Model A is 20 units. | 1 / 1 / 1 |
| M6 | replacement | What is the maximum for Model A? | answered: The maximum load for Model A is 24 units. | answered: The maximum load for Model A is 24 units. | 1 / 1 / 1 |
| R1 | ambiguity | What is the limit? | needs_clarification: Which model do you mean — Model A or Model B? | not_found: The question does not specify what limit is being asked about. | 0 / 0 / 0 |
| R1b | clarification answer | Model B. | answered: Model B's maximum load is 12 units under normal conditions. | needs_clarification: Which limit are you asking about for Model B? | 0 / 0 / 0 |
| R2 | correction | I meant Model B. | answered: Model B's maximum load is 12 units. | answered: The maximum load for Model B is 12 units under normal conditions. | 1 / 1 / 1 |
| A1 | conflicting documents | What is the maximum for Model A? | conflict: manual-v1.pdf says 20 units; manual-v2.pdf says 24 units. | conflict (inferred): The maximum load for Model A is 20 units in manual-v1.pdf and 24 units in manual-v2.pdf. | 1 / 1 / 1 |
| A2 | paraphrase | How many units can A handle? | answered: Model A can handle a maximum load of 20 units. | answered: Model A can handle a maximum load of 20 units. | 1 / 1 / 1 |
| A3 | distractor | How often should I clean the nozzle on Model B? | answered: Clean the dosing nozzle of Model B every 30 days. | answered: Clean the dosing nozzle of Model B every 30 days. | 1 / 1 / 1 |
| A4 | unknown entity | What is the maximum load for Model C? | not_found: The manual only covers Model A and Model B. | not_found: The uploaded documents do not specify a maximum load for Model C. | 1 / 1 / 1 |
| A5 | rename (anti-hardcode) | What is the maximum for Model A? | answered: The maximum load for Model A is 24 units. | answered: The maximum load for Model A is 24 units. | 1 / 1 / 1 |
| A6 | exception reasoning | Can Model B run at 15 units when it's 25°C? | answered: No. The exception applies only below 20°C; otherwise Model B's maximum is 12 units. | not_found: The uploaded documents do not specify whether Model B can run at 15 units at 25°C. | 0 / 0.5 / 0 |
| H1 | holdout direct | What room size is the Pro designed for? | answered: Nimbus Pro is designed for rooms up to 60 square meters. | answered: Nimbus Pro is designed for rooms up to 60 square meters. | 1 / 1 / 1 |
| H2 | holdout direct | How often should I replace the filter on the Compact? | answered: Replace the HEPA filter of Nimbus Compact every 6 months. | answered: Replace the HEPA filter of Nimbus Compact every 6 months. | 1 / 1 / 1 |
| H3 | holdout follow-up | And the other one? | answered: Nimbus Pro: replace the HEPA filter every 12 months. | needs_clarification: Which model are you asking about? | 0 / 0 / 0 |
| H4 | holdout inference | Does the Compact have night mode? | answered: No. Night mode is available only on Nimbus Pro. | not_found: The uploaded documents do not specify whether the Compact has night mode. | 0 / 0 / 0 |
| H5 | holdout absent | How much does the Pro cost? | not_found: The guide does not state a price. | not_found: The uploaded documents do not specify the cost of the Nimbus Pro. | 1 / 1 / 1 |
| A7 | STT error | What's the max load for model bee? | answered: Model B's maximum load is 12 units. | answered: Model B: the maximum load is 12 units under normal conditions. | 1 / 1 / 1 |
| A8 | history reset | And what about the other model? | needs_clarification: Which model do you mean? | needs_clarification: Which model are you referring to as 'the other model'? | 1 / 1 / 1 |
| A9 | document overview | What is this document about? | answered: It is the user manual for the Kestrel Dosing System, covering Model A and Model B. | answered: This document is the user manual for the Kestrel Dosing System, covering Model A and Model B. | 1 / 1 / 1 |
| L1 | direct fact (RU) | Какая максимальная нагрузка у модели A? | answered: Максимальная нагрузка модели A — 20 единиц. | answered: Максимальная нагрузка модели A составляет 20 единиц. | 1 / 1 / 1 |
| L2 | follow-up (RU) | А у другой модели? | answered: У модели B максимальная нагрузка 12 единиц в обычных условиях. | answered: Максимальная нагрузка модели B составляет 12 единиц при нормальных условиях. | 1 / 1 / 1 |
| L3 | absent fact (RU) | Сколько работает модель A от батареи? | not_found: В документе не указано время работы от батареи. | not_found: В загруженных документах не указано, сколько работает модель A от батареи. | 1 / 1 / 1 |
| L4 | direct fact (UA) | Яке максимальне навантаження моделі B? | answered: Максимальне навантаження моделі B — 12 одиниць за звичайних умов. | answered: Максимальне навантаження моделі B становить 12 одиниць за нормальних умов. | 1 / 1 / 1 |
| L5 | exception (UA) | Чи може модель B перевищувати свій звичайний ліміт? | answered: Так: модель B може працювати до 15 одиниць не довше 5 хвилин, якщо температура нижче 20°C. | answered (inferred): Так, модель B може працювати до 15 одиниць протягом не більше 5 хвилин, якщо температура навколишнього середовища нижче 20°C. | 1 / 1 / 1 |
| L6 | absent fact (UA) | Скільки коштує модель A? | not_found: У документі ціна не вказана. | not_found: Документ не вказує ціну на модель A. | 1 / 1 / 1 |
| X1 | inference from a range | Can Model B run at 40°C? | answered: No. The operating temperature for both models is 5°C to 35°C, so 40°C is outside it. | not_found: The manual does not specify whether Model B can run at 40°C. | 0 / 0.5 / 0.5 |
| X2 | indirect fact | What's the maximum temperature for Model A? | answered: 35°C, the top of the operating temperature range (5°C to 35°C). | answered: The maximum temperature for Model A is 35°C. | 1 / 1 / 1 |
| X3 | absent fact, related line | How long does Model B run on battery? | not_found: The manual does not mention battery operation. Related: both models use the same 12 V power adapter. | not_found: The uploaded documents do not specify how long Model B runs on battery. | 1 / 1 / 1 |
| X4 | slip, one target | How often should I clean the nozzel on Model B? | answered: Assuming you meant the nozzle: clean the dosing nozzle of Model B every 30 days. | answered: Assuming you meant “nozzle”: Clean the dosing nozzle of Model B every 30 days. | 1 / 1 / 1 |
| X5 | slip, model not named (guard) | How often should I clean the nozzel? | needs_clarification: Which model do you mean — Model A or Model B? | needs_clarification: Please specify which model you are asking about: Model A or Model B. | 1 / 0 / 1 |

## Citation accuracy

| ID | Expected sources | Actual citations (run 1) | Citation per run |
|---|---|---|---|
| M1 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 / 1 / 1 |
| M3 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 / 1 |
| M2 | manual-v1.pdf p.1 | manual-v1.pdf p.1: "2. Setup: Model A"<br>manual-v1.pdf p.1: "3. Setup: Model B" | 1 / 1 / 1 |
| M4 | manual-v1.pdf p.3 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions."<br>manual-v1.pdf p.3: "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C." | 1 / 1 / 1 |
| M5 | none (0 citations) | none | 1 / 1 / 1 |
| M6-baseline | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 / 1 / 1 |
| M6 | manual-v2.pdf p.2 | manual-v2.pdf p.2: "Model A: the maximum load is 24 units." | 1 / 1 / 1 |
| R1 | none (0 citations) | none | 1 / 1 / 1 |
| R1b | manual-v1.pdf p.2 | none | 0 / 0 / 0 |
| R2 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 / 1 |
| A1 | manual-v1.pdf p.2, manual-v2.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units."<br>manual-v2.pdf p.2: "Model A: the maximum load is 24 units." | 1 / 1 / 1 |
| A2 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 / 1 / 1 |
| A3 | manual-v1.pdf p.3 | manual-v1.pdf p.3: "Clean the dosing nozzle of Model B every 30 days." | 1 / 1 / 1 |
| A4 | none (0 citations) | none | 1 / 1 / 1 |
| A5 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 24 units." | 1 / 1 / 1 |
| A6 | manual-v1.pdf p.3 | none | 0 / 1 / 0 |
| H1 | holdout-nimbus.pdf p.1 | holdout-nimbus.pdf p.1: "Nimbus Pro is designed for rooms up to 60 square meters." | 1 / 1 / 1 |
| H2 | holdout-nimbus.pdf p.2 | holdout-nimbus.pdf p.2: "Replace the HEPA filter of Nimbus Compact every 6 months." | 1 / 1 / 1 |
| H3 | holdout-nimbus.pdf p.2 | none | 0 / 0 / 0 |
| H4 | holdout-nimbus.pdf p.2 | none | 0 / 0 / 0 |
| H5 | none (0 citations) | none | 1 / 1 / 1 |
| A7 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 / 1 |
| A8 | none (0 citations) | none | 1 / 1 / 1 |
| A9 | manual-v1.pdf p.1 | manual-v1.pdf p.1: "Kestrel Dosing System — User Manual v1"<br>manual-v1.pdf p.1: "1. Introduction"<br>manual-v1.pdf p.1: "This manual covers two models of the Kestrel Dosing System: Model A and Model B." | 1 / 1 / 1 |
| L1 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 / 1 / 1 |
| L2 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 / 1 |
| L3 | none (0 citations) | none | 1 / 1 / 1 |
| L4 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 / 1 |
| L5 | manual-v1.pdf p.3 | manual-v1.pdf p.3: "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C." | 1 / 1 / 1 |
| L6 | none (0 citations) | none | 1 / 1 / 1 |
| X1 | manual-v1.pdf p.2 | none | 0 / 1 / 1 |
| X2 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Operating temperature for both models: 5°C to 35°C." | 1 / 1 / 1 |
| X3 | none (0 citations) | none | 1 / 1 / 1 |
| X4 | manual-v1.pdf p.3 | manual-v1.pdf p.3: "Clean the dosing nozzle of Model B every 30 days." | 1 / 1 / 1 |
| X5 | none (0 citations) | none | 1 / 1 / 1 |

## Reasoning: inferred, assumed and related answers

All tests, all runs. A wrong inferred answer counts as a critical failure.

| Run | ID | Question | Answer | Why · assumed · related | Reasoning check |
|---|---|---|---|---|---|
| 1 | M2 | How do I set up Model A versus Model B? | answered (inferred): For Model A, connect the power adapter, press and hold the SETUP button for 3 seconds until the status light blinks green, then select channel 1 on the CHANNEL dial. For Model B, connect the power adapter, open the front cover, set the MODE switch to position B, then press START. | why: The setup steps for each model are described in separate sections of the manual. | — |
| 1 | M4 | Is Model B ever allowed to exceed its normal limit? | answered (inferred): Yes, Model B may exceed its normal limit of 12 units up to 15 units for no more than 5 minutes when ambient temperature is below 20°C. | why: The exception for Model B allows temporary operation above the normal maximum under specific temperature conditions. | — |
| 1 | M5 | What is the battery life of Model A? | not_found: The uploaded documents do not specify the battery life of Model A. | related p.2: "Model A: the maximum load is 20 units."<br>related p.2: "Model B: the maximum load is 12 units under normal conditions." | — |
| 1 | R1 | What is the limit? | not_found: The question does not specify what limit is being asked about. | related p.2: "Model A: the maximum load is 20 units."<br>related p.2: "Model B: the maximum load is 12 units under normal conditions." | — |
| 1 | A1 | What is the maximum for Model A? | conflict (inferred): The maximum load for Model A is 20 units in manual-v1.pdf and 24 units in manual-v2.pdf. | why: The two manuals give different values for Model A's maximum load. | — |
| 1 | A4 | What is the maximum load for Model C? | not_found: The uploaded documents do not specify a maximum load for Model C. | related p.2: "Model A: the maximum load is 20 units."<br>related p.2: "Model B: the maximum load is 12 units under normal conditions." | — |
| 1 | A6 | Can Model B run at 15 units when it's 25°C? | not_found: The uploaded documents do not specify whether Model B can run at 15 units at 25°C. | related p.3: "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C." | — |
| 1 | H4 | Does the Compact have night mode? | not_found: The uploaded documents do not specify whether the Compact has night mode. | related p.2: "Night mode is available only on Nimbus Pro." | — |
| 1 | L3 | Сколько работает модель A от батареи? | not_found: В загруженных документах не указано, сколько работает модель A от батареи. | related p.2: "Operating temperature for both models: 5°C to 35°C." | — |
| 1 | L5 | Чи може модель B перевищувати свій звичайний ліміт? | answered (inferred): Так, модель B може працювати до 15 одиниць протягом не більше 5 хвилин, якщо температура навколишнього середовища нижче 20°C. | why: Виключення дозволяє перевищення звичайного ліміту за певних умов. | — |
| 1 | X1 | Can Model B run at 40°C? | not_found: The manual does not specify whether Model B can run at 40°C. | related p.2: "Operating temperature for both models: 5°C to 35°C." | 0 |
| 1 | X3 | How long does Model B run on battery? | not_found: The uploaded documents do not specify how long Model B runs on battery. | — | 0 |
| 1 | X4 | How often should I clean the nozzel on Model B? | answered: Assuming you meant “nozzle”: Clean the dosing nozzle of Model B every 30 days. | assumed: nozzle | 1 |
| 2 | M3 | And what about the other model? | answered (inferred): The maximum load for Model B is 12 units under normal conditions. | why: The manual states Model B's maximum load is 12 units under normal conditions. | — |
| 2 | M2 | How do I set up Model A versus Model B? | answered (inferred): For Model A, connect the power adapter, press and hold the SETUP button for 3 seconds until the status light blinks green, then select channel 1 on the CHANNEL dial. For Model B, connect the power adapter, open the front cover, set the MODE switch to position B, then press START. | why: The setup steps for each model are described in separate sections of the manual. | — |
| 2 | M4 | Is Model B ever allowed to exceed its normal limit? | answered (inferred): Yes, Model B may exceed its normal limit under specific conditions. | why: The manual states an exception allowing Model B to operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C. | — |
| 2 | M5 | What is the battery life of Model A? | not_found: The uploaded documents do not specify the battery life of Model A. | related p.2: "Operating temperature for both models: 5°C to 35°C." | — |
| 2 | A1 | What is the maximum for Model A? | conflict (inferred): The maximum load for Model A is 20 units in manual-v1.pdf and 24 units in manual-v2.pdf. | why: The two documents give different values for the same specification. | — |
| 2 | A4 | What is the maximum load for Model C? | not_found: The uploaded documents do not specify a maximum load for Model C. | related p.2: "Model A: the maximum load is 20 units."<br>related p.2: "Model B: the maximum load is 12 units under normal conditions." | — |
| 2 | A6 | Can Model B run at 15 units when it's 25°C? | answered (inferred): No, Model B cannot run at 15 units when it's 25°C. | why: The exception for Model B to operate up to 15 units only applies when ambient temperature is below 20°C, and 25°C is not below 20°C. | — |
| 2 | H4 | Does the Compact have night mode? | not_found: The uploaded documents do not specify whether the Compact has night mode. | related p.2: "Night mode is available only on Nimbus Pro." | — |
| 2 | L3 | Сколько работает модель A от батареи? | not_found: В документе не указано, сколько работает модель A от батареи. | related p.1: "Both models use the same 12 V power adapter, but they have different setup procedures and different load limits." | — |
| 2 | L5 | Чи може модель B перевищувати свій звичайний ліміт? | answered (inferred): Так, модель B може перевищувати свій звичайний ліміт до 15 одиниць на не більше 5 хвилин, якщо температура навколишнього середовища нижче 20°C. | why: Виключення дозволяє моделі B працювати до 15 одиниць протягом не більше 5 хвилин при температурі нижче 20°C. | — |
| 2 | L6 | Скільки коштує модель A? | not_found: Документ не вказує ціну на модель A. | related p.1: "This manual covers two models of the Kestrel Dosing System: Model A and Model B." | — |
| 2 | X1 | Can Model B run at 40°C? | answered (inferred): Model B cannot run at 40°C. | why: The operating temperature range for both models is 5°C to 35°C, so 40°C is outside the specified range. | 1 |
| 2 | X3 | How long does Model B run on battery? | not_found: The uploaded documents do not specify how long Model B runs on battery. | related p.2: "Operating temperature for both models: 5°C to 35°C." | 0 |
| 2 | X4 | How often should I clean the nozzel on Model B? | answered: Assuming you meant “nozzle”: Clean the dosing nozzle of Model B every 30 days. | assumed: nozzle | 1 |
| 2 | X5 | How often should I clean the nozzel? | not_found: The manual does not specify a cleaning frequency for the nozzle. | related p.3: "Clean the dosing nozzle of Model A every 15 days."<br>related p.3: "Clean the dosing nozzle of Model B every 30 days." | — |
| 3 | M2 | How do I set up Model A versus Model B? | answered (inferred): For Model A, connect the power adapter, press and hold the SETUP button for 3 seconds until the status light blinks green, then select channel 1 on the CHANNEL dial. For Model B, connect the power adapter, open the front cover, set the MODE switch to position B, then press START. | why: The setup steps for each model are described in separate sections of the manual. | — |
| 3 | M4 | Is Model B ever allowed to exceed its normal limit? | answered (inferred): Yes, Model B may exceed its normal limit under specific conditions. | why: The manual states an exception allowing Model B to operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C. | — |
| 3 | M5 | What is the battery life of Model A? | not_found: The uploaded documents do not specify the battery life of Model A. | related p.2: "Operating temperature for both models: 5°C to 35°C." | — |
| 3 | R1 | What is the limit? | not_found: The uploaded documents do not specify what limit is being asked about. | related p.2: "Model A: the maximum load is 20 units."<br>related p.2: "Model B: the maximum load is 12 units under normal conditions." | — |
| 3 | A1 | What is the maximum for Model A? | conflict (inferred): The maximum load for Model A is 20 units in manual-v1.pdf and 24 units in manual-v2.pdf. | why: The two documents give different values for the same specification. | — |
| 3 | A4 | What is the maximum load for Model C? | not_found: The uploaded documents do not specify a maximum load for Model C. | related p.2: "Model A: the maximum load is 20 units."<br>related p.2: "Model B: the maximum load is 12 units under normal conditions." | — |
| 3 | A6 | Can Model B run at 15 units when it's 25°C? | not_found: The manual does not specify whether Model B can run at 15 units at 25°C. | related p.3: "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C." | — |
| 3 | H4 | Does the Compact have night mode? | not_found: The uploaded documents do not specify whether the Compact has night mode. | related p.2: "Night mode is available only on Nimbus Pro." | — |
| 3 | L2 | А у другой модели? | answered (inferred): Максимальная нагрузка модели B составляет 12 единиц. | why: Модель B имеет максимальную нагрузку 12 единиц при нормальных условиях. | — |
| 3 | L3 | Сколько работает модель A от батареи? | not_found: В загруженных документах не указано, сколько работает модель A от батареи. | related p.1: "Both models use the same 12 V power adapter, but they have different setup procedures and different load limits."<br>related p.2: "Operating temperature for both models: 5°C to 35°C." | — |
| 3 | L5 | Чи може модель B перевищувати свій звичайний ліміт? | answered (inferred): Так, модель B може працювати до 15 одиниць протягом не більше 5 хвилин, якщо температура навколишнього середовища нижче 20°C. | why: Виключення дозволяє перевищення звичайного ліміту за певних умов. | — |
| 3 | L6 | Скільки коштує модель A? | not_found: Документи не вказують ціну на модель A. | related p.1: "This manual covers two models of the Kestrel Dosing System: Model A and Model B." | — |
| 3 | X1 | Can Model B run at 40°C? | answered (inferred): Model B cannot run at 40°C. | why: The operating temperature range for both models is 5°C to 35°C, so 40°C exceeds the maximum allowed temperature. | 1 |
| 3 | X3 | How long does Model B run on battery? | not_found: The uploaded documents do not specify how long Model B runs on battery. | — | 0 |
| 3 | X4 | How often should I clean the nozzel on Model B? | answered: Assuming you meant “nozzle”: Clean the dosing nozzle of Model B every 30 days. | assumed: nozzle | 1 |

## Failures

- run 1 R1: not_found — "The question does not specify what limit is being asked about." (status not_found ≠ needs_clarification; missing: Model A, Model B; validation attempts 1)
- run 1 R1b: needs_clarification — "Which limit are you asking about for Model B?" (status needs_clarification ≠ answered; missing: 12; validation attempts 1)
- run 1 A6: not_found — "The uploaded documents do not specify whether Model B can run at 15 units at 25°C." (status not_found ≠ answered; missing: 20; validation attempts 2)
- run 1 H3: needs_clarification — "Which model are you asking about?" (status needs_clarification ≠ answered; missing: 12 months/twelve months; validation attempts 1)
- run 1 H4: not_found — "The uploaded documents do not specify whether the Compact has night mode." (status not_found ≠ answered; validation attempts 2)
- run 1 X1: not_found — "The manual does not specify whether Model B can run at 40°C." (status not_found ≠ answered; missing: 35; basis stated ≠ inferred; validation attempts 2)
- run 1 X3: not_found — "The uploaded documents do not specify how long Model B runs on battery." (no related line from the expected pages; validation attempts 1)
- run 2 M4: answered — "Yes, Model B may exceed its normal limit under specific conditions." (missing: 15, 5 minutes/five minutes, 20; validation attempts 1)
- run 2 R1: not_found — "The question does not specify what limit is being asked about." (status not_found ≠ needs_clarification; missing: Model A, Model B; validation attempts 1)
- run 2 R1b: needs_clarification — "Which limit are you asking about for Model B?" (status needs_clarification ≠ answered; missing: 12; validation attempts 1)
- run 2 A6: answered — "No, Model B cannot run at 15 units when it's 25°C." (missing: 20; validation attempts 2)
- run 2 H3: needs_clarification — "Which model are you asking about?" (status needs_clarification ≠ answered; missing: 12 months/twelve months; validation attempts 1)
- run 2 H4: not_found — "The uploaded documents do not specify whether the Compact has night mode." (status not_found ≠ answered; validation attempts 1)
- run 2 X1: answered — "Model B cannot run at 40°C." (missing: 35; validation attempts 2)
- run 2 X3: not_found — "The uploaded documents do not specify how long Model B runs on battery." (no related line from the expected pages; validation attempts 1)
- run 2 X5: not_found — "The manual does not specify a cleaning frequency for the nozzle." (status not_found ≠ needs_clarification; missing: Model A, Model B; validation attempts 2)
- run 3 M4: answered — "Yes, Model B may exceed its normal limit under specific conditions." (missing: 15, 5 minutes/five minutes, 20; validation attempts 1)
- run 3 R1: not_found — "The uploaded documents do not specify what limit is being asked about." (status not_found ≠ needs_clarification; missing: Model A, Model B; validation attempts 1)
- run 3 R1b: needs_clarification — "Which limit are you asking about for Model B?" (status needs_clarification ≠ answered; missing: 12; validation attempts 1)
- run 3 A6: not_found — "The manual does not specify whether Model B can run at 15 units at 25°C." (status not_found ≠ answered; missing: 20; validation attempts 2)
- run 3 H3: needs_clarification — "Do you mean the room size for the Nimbus Compact or the filter replacement for the Nimbus Pro?" (status needs_clarification ≠ answered; missing: 12 months/twelve months; validation attempts 2)
- run 3 H4: not_found — "The uploaded documents do not specify whether the Compact has night mode." (status not_found ≠ answered; validation attempts 2)
- run 3 X1: answered — "Model B cannot run at 40°C." (missing: 35; validation attempts 2)
- run 3 X3: not_found — "The uploaded documents do not specify how long Model B runs on battery." (no related line from the expected pages; validation attempts 1)

Replacement check (M6 vs baseline): answer changed in 3/3 runs.

## Latency (Node, text pipeline)

| Measure | Median | p90 | Max |
|---|---|---|---|
| Retrieval | 1 ms | 1 ms | 3 ms |
| LLM, first attempt | 1938 ms | 4761 ms | 19978 ms |
| Question total (retrieval + LLM incl. retries + validation) | 2343 ms | 5709 ms | 19983 ms |

| Ingestion (Node, 5 runs) | Pages | Median | Max |
|---|---|---|---|
| manual-v1.pdf | 3 | 9 ms | 9 ms |
| manual-v2.pdf | 3 | 5 ms | 5 ms |
| holdout-nimbus.pdf | 2 | 2 ms | 3 ms |

## Cost (LLM only, $0.085/MTok in, $0.4/MTok out — OpenRouter paid list price for the same model, checked 2026-09-10 (called via NVIDIA's free endpoint))

| Measure | Value |
|---|---|
| Input tokens per question (mean) | 2181 |
| Output tokens per question (mean) | 113 |
| Cost per question, mean / max | $0.00023 / $0.00046 |
| Questions that needed a retry | 17/105 (16.2%) |
| Cost of one pass over the P0 tests | $0.00209 |
| Cost per ingestion | $0 (parsing and indexing run locally, no API calls) |
