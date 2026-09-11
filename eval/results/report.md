# Eval report

- Date: 2026-09-11T09:27:09.463Z
- Commit: `627aaf7` · provider: `nvidia` · model: `nvidia/nemotron-3-super-120b-a12b` · retrieval: `full` · think harder: off · runs per session: 3
- Expected outcomes: `eval/expected.json` (committed before the first run)
- Latency here is the text pipeline in Node (retrieval + LLM + validation). Voice latency is measured in the browser.

## Summary

| Group | Tests | Runs | Factual accuracy | Citation accuracy | Reasoning checks | Pass rate | Critical failures |
|---|---|---|---|---|---|---|---|
| P0 | 10 | 30 | 96.7% | 96.7% | — | 96.7% | 0 |
| P1 | 9 | 27 | 92.6% | 92.6% | — | 92.6% | 0 |
| holdout | 5 | 15 | 100.0% | 100.0% | — | 100.0% | 0 |
| RU/UA | 6 | 18 | 94.4% | 94.4% | — | 94.4% | 0 |
| Think better | 5 | 15 | 100.0% | 100.0% | 66.7% | 80.0% | 0 |
| all | 35 | 105 | 96.2% | 96.2% | 66.7% | 93.3% | 0 |

**Acceptance (ТЗ §7.8):** P0 tests passing in ≥ 2/3 of runs: yes. Critical failures: 0.

## Factual accuracy

| ID | Type | Question | Expected | Actual (run 1) | Factual per run |
|---|---|---|---|---|---|
| M1 | direct fact | What is the maximum for Model A? | answered: The maximum load for Model A is 20 units. | answered: The maximum load for Model A is 20 units. | 1 / 1 / 1 |
| M3 | follow-up | And what about the other model? | answered: Model B's maximum load is 12 units under normal conditions. | answered: The maximum load for Model B is 12 units under normal conditions. | 1 / 1 / 1 |
| M2 | comparison | How do I set up Model A versus Model B? | answered: Model A: connect power, hold SETUP for 3 seconds, select channel 1. Model B: connect power, open the front cover, set MODE to B, press START. | answered: For Model A, connect the power adapter, press and hold the SETUP button for 3 seconds until the status light blinks green, then select channel 1 on the CHANNEL dial (do not select channel 2). For Model B, connect the power adapter, open the front cover, set the MODE switch to position B, then press START. | 1 / 1 / 1 |
| M4 | exception | Is Model B ever allowed to exceed its normal limit? | answered: Yes. Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C. | answered (inferred): Yes, Model B may exceed its normal limit of 12 units under specific conditions. | 1 / 1 / 1 |
| M5 | absent fact | What is the battery life of Model A? | not_found: The manual does not specify battery life. | not_found: The uploaded documents do not specify the battery life of Model A. | 1 / 1 / 1 |
| M6-baseline | replacement baseline | What is the maximum for Model A? | answered: The maximum load for Model A is 20 units. | answered: The maximum load for Model A is 20 units. | 1 / 1 / 1 |
| M6 | replacement | What is the maximum for Model A? | answered: The maximum load for Model A is 24 units. | answered: The maximum load for Model A is 24 units. | 1 / 1 / 1 |
| R1 | ambiguity | What is the limit? | needs_clarification: Which model do you mean — Model A or Model B? | needs_clarification: Please specify which limit and which model (Model A or Model B) you are asking about. | 1 / 1 / 1 |
| R1b | clarification answer | Model B. | answered: Model B's maximum load is 12 units under normal conditions. | not_found: I couldn't verify an answer in the uploaded documents. | 0 / 1 / 1 |
| R2 | correction | I meant Model B. | answered: Model B's maximum load is 12 units. | answered: The maximum load for Model B is 12 units under normal conditions. | 1 / 1 / 1 |
| A1 | conflicting documents | What is the maximum for Model A? | conflict: manual-v1.pdf says 20 units; manual-v2.pdf says 24 units. | conflict (inferred): The documents conflict: manual-v1.pdf says Model A's maximum load is 20 units, but manual-v2.pdf says it is 24 units. | 1 / 1 / 1 |
| A2 | paraphrase | How many units can A handle? | answered: Model A can handle a maximum load of 20 units. | answered: Model A can handle a maximum of 20 units. | 1 / 1 / 1 |
| A3 | distractor | How often should I clean the nozzle on Model B? | answered: Clean the dosing nozzle of Model B every 30 days. | answered: Clean the dosing nozzle of Model B every 30 days. | 1 / 1 / 1 |
| A4 | unknown entity | What is the maximum load for Model C? | not_found: The manual only covers Model A and Model B. | not_found: The uploaded documents do not specify the maximum load for Model C. | 1 / 1 / 1 |
| A5 | rename (anti-hardcode) | What is the maximum for Model A? | answered: The maximum load for Model A is 24 units. | answered: The maximum load for Model A is 24 units. | 1 / 1 / 1 |
| A6 | exception reasoning | Can Model B run at 15 units when it's 25°C? | answered: No. The exception applies only below 20°C; otherwise Model B's maximum is 12 units. | answered (inferred): No, Model B cannot run at 15 units at 25°C; the exception allowing up to 15 units only applies when the ambient temperature is below 20°C. | 1 / 0 / 0 |
| H1 | holdout direct | What room size is the Pro designed for? | answered: Nimbus Pro is designed for rooms up to 60 square meters. | answered: The Nimbus Pro is designed for rooms up to 60 square meters. | 1 / 1 / 1 |
| H2 | holdout direct | How often should I replace the filter on the Compact? | answered: Replace the HEPA filter of Nimbus Compact every 6 months. | answered: Replace the HEPA filter of Nimbus Compact every 6 months. | 1 / 1 / 1 |
| H3 | holdout follow-up | And the other one? | answered: Nimbus Pro: replace the HEPA filter every 12 months. | answered: Replace the HEPA filter of Nimbus Pro every 12 months. | 1 / 1 / 1 |
| H4 | holdout inference | Does the Compact have night mode? | answered: No. Night mode is available only on Nimbus Pro. | answered (inferred): No, the Nimbus Compact does not have night mode. | 1 / 1 / 1 |
| H5 | holdout absent | How much does the Pro cost? | not_found: The guide does not state a price. | not_found: The uploaded documents do not specify the cost of the Nimbus Pro. | 1 / 1 / 1 |
| A7 | STT error | What's the max load for model bee? | answered: Model B's maximum load is 12 units. | answered: The maximum load for Model B is 12 units under normal conditions. | 1 / 1 / 1 |
| A8 | history reset | And what about the other model? | needs_clarification: Which model do you mean? | needs_clarification: Which model did you mean earlier: Model A or Model B? | 1 / 1 / 1 |
| A9 | document overview | What is this document about? | answered: It is the user manual for the Kestrel Dosing System, covering Model A and Model B. | answered: This document is the user manual for the Kestrel Dosing System, covering Model A and Model B. | 1 / 1 / 1 |
| L1 | direct fact (RU) | Какая максимальная нагрузка у модели A? | answered: Максимальная нагрузка модели A — 20 единиц. | answered: Максимальная нагрузка модели A составляет 20 единиц. | 1 / 1 / 1 |
| L2 | follow-up (RU) | А у другой модели? | answered: У модели B максимальная нагрузка 12 единиц в обычных условиях. | answered: Максимальная нагрузка модели B составляет 12 единиц. | 1 / 1 / 1 |
| L3 | absent fact (RU) | Сколько работает модель A от батареи? | not_found: В документе не указано время работы от батареи. | not_found: В загруженных документах не указано, сколько работает модель A от батареи. | 1 / 1 / 1 |
| L4 | direct fact (UA) | Яке максимальне навантаження моделі B? | answered: Максимальне навантаження моделі B — 12 одиниць за звичайних умов. | answered: Максимальне навантаження моделі B становить 12 одиниць за нормальних умов. | 1 / 1 / 1 |
| L5 | exception (UA) | Чи може модель B перевищувати свій звичайний ліміт? | answered: Так: модель B може працювати до 15 одиниць не довше 5 хвилин, якщо температура нижче 20°C. | answered (inferred): Так, модель B може перевищувати свій звичайний ліміт 12 одиниць до 15 одиниць, але не більше 5 хвилин при температурі нижче 20°C. | 1 / 1 / 0 |
| L6 | absent fact (UA) | Скільки коштує модель A? | not_found: У документі ціна не вказана. | not_found: Завантажені документи не вказують вартість моделі A. | 1 / 1 / 1 |
| X1 | inference from a range | Can Model B run at 40°C? | answered: No. The operating temperature for both models is 5°C to 35°C, so 40°C is outside it. | answered (inferred): No, Model B cannot run at 40°C. | 1 / 1 / 1 |
| X2 | indirect fact | What's the maximum temperature for Model A? | answered: 35°C, the top of the operating temperature range (5°C to 35°C). | answered (inferred): The maximum temperature for Model A is 35°C. | 1 / 1 / 1 |
| X3 | absent fact, related line | How long does Model B run on battery? | not_found: The manual does not mention battery operation. Related: both models use the same 12 V power adapter. | not_found: The uploaded documents do not specify how long Model B runs on battery. | 1 / 1 / 1 |
| X4 | slip, one target | How often should I clean the nozzel on Model B? | answered: Assuming you meant the nozzle: clean the dosing nozzle of Model B every 30 days. | answered: Assuming you meant “nozzle”: Clean the dosing nozzle of Model B every 30 days. | 1 / 1 / 1 |
| X5 | slip, model not named (guard) | How often should I clean the nozzel? | needs_clarification: Which model do you mean — Model A or Model B? | needs_clarification: Please specify whether you have Model A or Model B of the Kestrel Dosing System. | 1 / 1 / 1 |

## Citation accuracy

| ID | Expected sources | Actual citations (run 1) | Citation per run |
|---|---|---|---|
| M1 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 / 1 / 1 |
| M3 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 / 1 |
| M2 | manual-v1.pdf p.1 | manual-v1.pdf p.1: "2. Setup: Model A"<br>manual-v1.pdf p.1: "Step 1. Connect the power adapter."<br>manual-v1.pdf p.1: "Step 2. Press and hold the SETUP button for 3 seconds until the status light blinks green."<br>manual-v1.pdf p.1: "Step 3. Select channel 1 on the CHANNEL dial."<br>manual-v1.pdf p.1: "Do not select channel 2 during setup. Channel 2 is reserved for service mode."<br>manual-v1.pdf p.1: "3. Setup: Model B"<br>manual-v1.pdf p.1: "Step 1. Connect the power adapter."<br>manual-v1.pdf p.1: "Step 2. Open the front cover."<br>manual-v1.pdf p.1: "Step 3. Set the MODE switch to position B."<br>manual-v1.pdf p.1: "Step 4. Press START."<br>manual-v1.pdf p.1: "Model B has no SETUP button. Holding START for more than 10 seconds resets Model B to factory settings." | 1 / 1 / 1 |
| M4 | manual-v1.pdf p.3 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions."<br>manual-v1.pdf p.3: "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C." | 1 / 1 / 1 |
| M5 | none (0 citations) | none | 1 / 1 / 1 |
| M6-baseline | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 / 1 / 1 |
| M6 | manual-v2.pdf p.2 | manual-v2.pdf p.2: "Model A: the maximum load is 24 units." | 1 / 1 / 1 |
| R1 | none (0 citations) | none | 1 / 1 / 1 |
| R1b | manual-v1.pdf p.2 | none | 0 / 1 / 1 |
| R2 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 / 1 |
| A1 | manual-v1.pdf p.2, manual-v2.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units."<br>manual-v2.pdf p.2: "Model A: the maximum load is 24 units." | 1 / 1 / 1 |
| A2 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 / 1 / 1 |
| A3 | manual-v1.pdf p.3 | manual-v1.pdf p.3: "Clean the dosing nozzle of Model B every 30 days." | 1 / 1 / 1 |
| A4 | none (0 citations) | none | 1 / 1 / 1 |
| A5 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 24 units." | 1 / 1 / 1 |
| A6 | manual-v1.pdf p.3 | manual-v1.pdf p.3: "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C." | 1 / 0 / 0 |
| H1 | holdout-nimbus.pdf p.1 | holdout-nimbus.pdf p.1: "Nimbus Pro is designed for rooms up to 60 square meters." | 1 / 1 / 1 |
| H2 | holdout-nimbus.pdf p.2 | holdout-nimbus.pdf p.2: "Replace the HEPA filter of Nimbus Compact every 6 months." | 1 / 1 / 1 |
| H3 | holdout-nimbus.pdf p.2 | holdout-nimbus.pdf p.2: "Replace the HEPA filter of Nimbus Pro every 12 months." | 1 / 1 / 1 |
| H4 | holdout-nimbus.pdf p.2 | holdout-nimbus.pdf p.2: "Night mode is available only on Nimbus Pro." | 1 / 1 / 1 |
| H5 | none (0 citations) | none | 1 / 1 / 1 |
| A7 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 / 1 |
| A8 | none (0 citations) | none | 1 / 1 / 1 |
| A9 | manual-v1.pdf p.1 | manual-v1.pdf p.1: "Kestrel Dosing System — User Manual v1"<br>manual-v1.pdf p.1: "This manual covers two models of the Kestrel Dosing System: Model A and Model B." | 1 / 1 / 1 |
| L1 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 / 1 / 1 |
| L2 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 / 1 |
| L3 | none (0 citations) | none | 1 / 1 / 1 |
| L4 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 / 1 |
| L5 | manual-v1.pdf p.3 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions."<br>manual-v1.pdf p.3: "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C." | 1 / 1 / 0 |
| L6 | none (0 citations) | none | 1 / 1 / 1 |
| X1 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Operating temperature for both models: 5°C to 35°C." | 1 / 1 / 1 |
| X2 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Operating temperature for both models: 5°C to 35°C." | 1 / 1 / 1 |
| X3 | none (0 citations) | none | 1 / 1 / 1 |
| X4 | manual-v1.pdf p.3 | manual-v1.pdf p.3: "Clean the dosing nozzle of Model B every 30 days." | 1 / 1 / 1 |
| X5 | none (0 citations) | none | 1 / 1 / 1 |

## Reasoning: inferred, assumed and related answers

All tests, all runs. A wrong inferred answer counts as a critical failure.

| Run | ID | Question | Answer | Why · assumed · related | Reasoning check |
|---|---|---|---|---|---|
| 1 | M4 | Is Model B ever allowed to exceed its normal limit? | answered (inferred): Yes, Model B may exceed its normal limit of 12 units under specific conditions. | why: The exception rule permits Model B to operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C. | — |
| 1 | A1 | What is the maximum for Model A? | conflict (inferred): The documents conflict: manual-v1.pdf says Model A's maximum load is 20 units, but manual-v2.pdf says it is 24 units. | why: The two manuals give different values for the same specification. | — |
| 1 | A6 | Can Model B run at 15 units when it's 25°C? | answered (inferred): No, Model B cannot run at 15 units at 25°C; the exception allowing up to 15 units only applies when the ambient temperature is below 20°C. | why: The exception for Model B to operate up to 15 units is conditional on ambient temperature being below 20°C, which is not met at 25°C. | — |
| 1 | H4 | Does the Compact have night mode? | answered (inferred): No, the Nimbus Compact does not have night mode. | why: Night mode is available only on Nimbus Pro, so it is not available on the Compact. | — |
| 1 | H5 | How much does the Pro cost? | not_found: The uploaded documents do not specify the cost of the Nimbus Pro. | related p.1: "Nimbus Pro is designed for rooms up to 60 square meters."<br>related p.2: "Replace the HEPA filter of Nimbus Pro every 12 months." | — |
| 1 | L5 | Чи може модель B перевищувати свій звичайний ліміт? | answered (inferred): Так, модель B може перевищувати свій звичайний ліміт 12 одиниць до 15 одиниць, але не більше 5 хвилин при температурі нижче 20°C. | why: За винятком, Model B може працювати до 15 одиниць при температурі нижче 20°C протягом не більше 5 хвилин. | — |
| 1 | X1 | Can Model B run at 40°C? | answered (inferred): No, Model B cannot run at 40°C. | why: The operating temperature range for both models is 5°C to 35°C, and 40°C exceeds this limit. | 1 |
| 1 | X2 | What's the maximum temperature for Model A? | answered (inferred): The maximum temperature for Model A is 35°C. | why: The operating temperature range for both models is 5°C to 35°C, so the maximum is 35°C. | — |
| 1 | X3 | How long does Model B run on battery? | not_found: The uploaded documents do not specify how long Model B runs on battery. | — | 0 |
| 1 | X4 | How often should I clean the nozzel on Model B? | answered: Assuming you meant “nozzle”: Clean the dosing nozzle of Model B every 30 days. | assumed: nozzle | 1 |
| 2 | M4 | Is Model B ever allowed to exceed its normal limit? | answered (inferred): Yes, Model B may exceed its normal limit of 12 units under specific conditions. | why: The exception rule permits Model B to operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C. | — |
| 2 | R1b | Model B. | answered (inferred): Model B has a maximum load limit of 12 units under normal conditions, with an exception allowing up to 15 units for no more than 5 minutes when ambient temperature is below 20°C. | why: The limit is determined by comparing the normal maximum load and the exception condition stated in the manual. | — |
| 2 | A1 | What is the maximum for Model A? | conflict (inferred): The manuals disagree: manual v1 says Model A's maximum load is 20 units, while manual v2 says it is 24 units. | why: Two documents give different values for the same specification. | — |
| 2 | A6 | Can Model B run at 15 units when it's 25°C? | not_found: The uploaded documents do not specify whether Model B can run at 15 units at 25°C. However, the exception allowing up to 15 units only applies when ambient temperature is below 20°C. | related p.3: "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C." | — |
| 2 | H4 | Does the Compact have night mode? | answered (inferred): No, the Nimbus Compact does not have night mode. | why: Night mode is available only on Nimbus Pro, so it is not available on Compact. | — |
| 2 | H5 | How much does the Pro cost? | not_found: The uploaded documents do not specify the price of the Nimbus Pro. | related p.1: "Nimbus Pro is designed for rooms up to 60 square meters."<br>related p.2: "Replace the HEPA filter of Nimbus Pro every 12 months." | — |
| 2 | L5 | Чи може модель B перевищувати свій звичайний ліміт? | answered (inferred): Так, модель B може перевищувати свій звичайний ліміт 12 одиниць до 15 одиниць, але не більше 5 хвилин при температурі нижче 20°C. | why: За виключенням, Model B може працювати до 15 одиниць при температурі нижче 20°C протягом не більше 5 хвилин. | — |
| 2 | X1 | Can Model B run at 40°C? | answered (inferred): No, Model B cannot run at 40°C because the operating temperature range for both models is 5°C to 35°C. | why: The operating temperature range is a stated limit, and 40°C exceeds the maximum of 35°C. | 1 |
| 2 | X3 | How long does Model B run on battery? | not_found: The uploaded documents do not specify how long Model B runs on battery. | — | 0 |
| 2 | X4 | How often should I clean the nozzel on Model B? | answered: Assuming you meant “nozzle”: Clean the dosing nozzle of Model B every 30 days. | assumed: nozzle | 1 |
| 3 | M4 | Is Model B ever allowed to exceed its normal limit? | answered (inferred): Yes, Model B may exceed its normal limit of 12 units up to 15 units for no more than 5 minutes when the ambient temperature is below 20°C. | why: The exception rule permits temporary operation above the normal maximum under specified temperature conditions. | — |
| 3 | A1 | What is the maximum for Model A? | conflict (inferred): The maximum load for Model A is 20 units according to manual-v1.pdf and 24 units according to manual-v2.pdf. | why: The two manuals give different values for the same specification. | — |
| 3 | A6 | Can Model B run at 15 units when it's 25°C? | not_found: The uploaded documents do not specify whether Model B can run at 15 units at 25°C. However, the exception allowing up to 15 units only applies when ambient temperature is below 20°C, and the normal maximum load for Model B is 12 units. | related p.3: "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C."<br>related p.2: "Model B: the maximum load is 12 units under normal conditions." | — |
| 3 | H4 | Does the Compact have night mode? | answered (inferred): No, the Nimbus Compact does not have night mode. | why: Night mode is available only on Nimbus Pro, so it is not available on the Compact. | — |
| 3 | H5 | How much does the Pro cost? | not_found: The uploaded documents do not specify the price of the Nimbus Pro. | related p.1: "Nimbus Pro is designed for rooms up to 60 square meters." | — |
| 3 | X1 | Can Model B run at 40°C? | answered (inferred): No, Model B cannot run at 40°C. | why: The operating temperature range for both models is 5°C to 35°C, and 40°C exceeds this limit. | 1 |
| 3 | X2 | What's the maximum temperature for Model A? | answered (inferred): The maximum temperature for Model A is 35°C. | why: The operating temperature range for both models is 5°C to 35°C, so the maximum is 35°C. | — |
| 3 | X3 | How long does Model B run on battery? | not_found: The uploaded documents do not specify how long Model B runs on battery. | — | 0 |
| 3 | X4 | How often should I clean the nozzel on Model B? | answered: Assuming you meant “nozzle”: Clean the dosing nozzle of Model B every 30 days. | assumed: nozzle | 1 |

## Failures

- run 1 R1b: not_found — "I couldn't verify an answer in the uploaded documents." (status not_found ≠ answered; missing: 12; validation attempts 2)
- run 1 X3: not_found — "The uploaded documents do not specify how long Model B runs on battery." (no related line from the expected pages; validation attempts 1)
- run 2 A6: not_found — "The uploaded documents do not specify whether Model B can run at 15 units at 25°C. However, the exception allowing up to 15 units only applies when ambient temperature is below 20°C." (status not_found ≠ answered; validation attempts 2)
- run 2 X3: not_found — "The uploaded documents do not specify how long Model B runs on battery." (no related line from the expected pages; validation attempts 1)
- run 3 A6: not_found — "The uploaded documents do not specify whether Model B can run at 15 units at 25°C. However, the exception allowing up to 15 units only applies when ambient temperature is below 20°C, and the normal maximum load for Model B is 12 units." (status not_found ≠ answered; validation attempts 2)
- run 3 L5: not_found — "I couldn't verify an answer in the uploaded documents." (status not_found ≠ answered; missing: так/може, 15, 5, 20; answer is not in Ukrainian; validation attempts 2)
- run 3 X3: not_found — "The uploaded documents do not specify how long Model B runs on battery." (no related line from the expected pages; validation attempts 1)

Replacement check (M6 vs baseline): answer changed in 3/3 runs.

## Latency (Node, text pipeline)

| Measure | Median | p90 | Max |
|---|---|---|---|
| Retrieval | 0 ms | 1 ms | 5 ms |
| LLM, first attempt | 3561 ms | 8984 ms | 27893 ms |
| Question total (retrieval + LLM incl. retries + validation) | 3738 ms | 9835 ms | 27895 ms |

| Ingestion (Node, 5 runs) | Pages | Median | Max |
|---|---|---|---|
| manual-v1.pdf | 3 | 7 ms | 24 ms |
| manual-v2.pdf | 3 | 4 ms | 7 ms |
| holdout-nimbus.pdf | 2 | 2 ms | 2 ms |

## Cost (LLM only, $0.085/MTok in, $0.4/MTok out — OpenRouter paid list price for the same model, checked 2026-09-10 (called via NVIDIA's free endpoint))

| Measure | Value |
|---|---|
| Input tokens per question (mean) | 2218 |
| Output tokens per question (mean) | 164 |
| Cost per question, mean / max | $0.00025 / $0.00060 |
| Questions that needed a retry | 6/105 (5.7%) |
| Cost of one pass over the P0 tests | $0.00265 |
| Cost per ingestion | $0 (parsing and indexing run locally, no API calls) |
