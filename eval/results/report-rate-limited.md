# Eval report

- Date: 2026-09-12T12:19:49.082Z
- Commit: `f3e1daf + uncommitted changes` · provider: `nvidia` · model: `nvidia/nemotron-3-super-120b-a12b` · retrieval: `full` · think harder: off · runs per session: 3
- Expected outcomes: `eval/expected.json` (committed before the first run)
- Latency here is the text pipeline in Node (retrieval + LLM + validation). Voice latency is measured in the browser.

## Summary

| Group | Tests | Runs | Factual accuracy | Citation accuracy | Reasoning checks | Pass rate | Critical failures |
|---|---|---|---|---|---|---|---|
| P0 | 9 | 16 | 90.6% | 93.8% | — | 87.5% | 0 |
| P1 | 9 | 16 | 100.0% | 100.0% | — | 100.0% | 0 |
| holdout | 3 | 5 | 100.0% | 100.0% | — | 100.0% | 0 |
| RU/UA | 6 | 10 | 100.0% | 100.0% | — | 100.0% | 0 |
| Think better | 5 | 9 | 100.0% | 100.0% | 66.7% | 77.8% | 0 |
| all | 32 | 56 | 97.3% | 98.2% | 66.7% | 92.9% | 0 |

**Acceptance (ТЗ §7.8):** P0 tests passing in ≥ 2/3 of runs: NO — R1, R1b. Critical failures: 0.

**Provider errors (not scored, excluded from the rates above):** 41 — run 1 S7 (setup ask), run 1 S9 A2, run 1 S10 A3, run 1 S11 A4, run 1 S14 H1, run 1 S16 A7, run 1 S17 (setup ask), run 1 S18 A9, run 1 S19 L1, run 1 S21 L4, run 1 S22 L5, run 1 S24 X1, run 1 S25 X2, run 1 S26 X3, run 1 S29 L7, run 2 S1 M1, run 2 S5 M6-baseline, run 2 S6 R1, run 2 S7 (setup ask), run 2 S9 A2, run 2 S10 A3, run 2 S14 H1, run 2 S18 A9, run 2 S19 L1, run 2 S21 L4, run 2 S22 L5, run 2 S28 X5, run 2 S29 L7-baseline, run 3 S1 M1, run 3 S2 M2, run 3 S6 R1, run 3 S7 (setup ask), run 3 S8 A1, run 3 S13 A6, run 3 S14 H2, run 3 S15 H4, run 3 S19 L2, run 3 S21 L4, run 3 S23 L6, run 3 S24 X1, run 3 S28 X5. Details under Failures.

**Not scored because an earlier step of the same session hit a provider error** (the conversation they depend on never happened): run 1 R2 (after a setup question), run 1 H2 (after H1), run 1 H3 (after H1), run 1 A8 (after a setup question), run 1 L2 (after L1), run 2 M3 (after M1), run 2 M6 (after M6-baseline), run 2 R1b (after R1), run 2 R2 (after a setup question), run 2 H2 (after H1), run 2 H3 (after H1), run 2 L2 (after L1), run 2 L7 (after L7-baseline), run 3 M3 (after M1), run 3 R1b (after R1), run 3 R2 (after a setup question), run 3 H3 (after H2), run 3 H5 (after H4).

## Factual accuracy

| ID | Type | Question | Expected | Actual (run 1) | Factual per run |
|---|---|---|---|---|---|
| M1 | direct fact | What is the maximum for Model A? | answered: The maximum load for Model A is 20 units. | answered: The maximum load for Model A is 20 units. | 1 |
| M3 | follow-up | And what about the other model? | answered: Model B's maximum load is 12 units under normal conditions. | answered: The maximum load for Model B is 12 units under normal conditions. | 1 |
| M2 | comparison | How do I set up Model A versus Model B? | answered: Model A: connect power, hold SETUP for 3 seconds, select channel 1. Model B: connect power, open the front cover, set MODE to B, press START. | answered: For Model A, connect the power adapter, press and hold the SETUP button for 3 seconds until the status light blinks green, then select channel 1 on the CHANNEL dial. For Model B, connect the power adapter, open the front cover, set the MODE switch to position B, then press START. | 1 / 1 |
| M4 | exception | Is Model B ever allowed to exceed its normal limit? | answered: Yes. Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C. | answered (inferred): Yes, Model B may exceed its normal limit of 12 units under specific conditions. | 1 / 1 / 1 |
| M5 | absent fact | What is the battery life of Model A? | not_found: The manual does not specify battery life. | not_found: The uploaded documents do not specify the battery life of Model A. | 1 / 1 / 1 |
| M6-baseline | replacement baseline | What is the maximum for Model A? | answered: The maximum load for Model A is 20 units. | answered: The maximum load for Model A is 20 units. | 1 / 1 |
| M6 | replacement | What is the maximum for Model A? | answered: The maximum load for Model A is 24 units. | answered: The maximum load for Model A is 24 units. | 1 / 1 |
| R1 | ambiguity | What is the limit? | needs_clarification: Which model do you mean — Model A or Model B? | needs_clarification: Which limit are you asking about? For example, the maximum load limit, minimum load limit, continuous operation limit, or reservoir capacity? | 0.5 |
| R1b | clarification answer | Model B. | answered: Model B's maximum load is 12 units under normal conditions. | needs_clarification: Which limit are you asking about for Model B? For example, the maximum load limit, minimum load limit, continuous operation limit, or reservoir capacity? | 0 |
| A1 | conflicting documents | What is the maximum for Model A? | conflict: manual-v1.pdf says 20 units; manual-v2.pdf says 24 units. | conflict (inferred): The manuals disagree: manual v1 says Model A's maximum load is 20 units, but manual v2 says it is 24 units. | 1 / 1 |
| A5 | rename (anti-hardcode) | What is the maximum for Model A? | answered: The maximum load for Model A is 24 units. | answered: The maximum load for Model A is 24 units. | 1 / 1 / 1 |
| A6 | exception reasoning | Can Model B run at 15 units when it's 25°C? | answered: No. The exception applies only below 20°C; otherwise Model B's maximum is 12 units. | answered (inferred): No, Model B cannot run at 15 units at 25°C because the exception allowing up to 15 units only applies when the ambient temperature is below 20°C. | 1 / 1 |
| H4 | holdout inference | Does the Compact have night mode? | answered: No. Night mode is available only on Nimbus Pro. | answered (inferred): No, the Nimbus Compact does not have night mode. | 1 / 1 |
| H5 | holdout absent | How much does the Pro cost? | not_found: The guide does not state a price. | not_found: The uploaded documents do not specify the cost of the Nimbus Pro. | 1 / 1 |
| L3 | absent fact (RU) | Сколько работает модель A от батареи? | not_found: В документе не указано время работы от батареи. | not_found: В загруженных документах не указано, сколько работает модель A от батареи. | 1 / 1 / 1 |
| L6 | absent fact (UA) | Скільки коштує модель A? | not_found: У документі ціна не вказана. | not_found: Завантажені документи не вказують ціну на модель A. | 1 / 1 |
| X4 | slip, one target | How often should I clean the nozzel on Model B? | answered: Assuming you meant the nozzle: clean the dosing nozzle of Model B every 30 days. | answered: Assuming you meant “nozzle”: Clean the dosing nozzle of Model B every 30 days. | 1 / 1 / 1 |
| X5 | slip, model not named (guard) | How often should I clean the nozzel? | needs_clarification: Which model do you mean — Model A or Model B? | needs_clarification: Assuming you meant “nozzle”: Which model of the Kestrel Dosing System are you using: Model A or Model B? | 1 |
| L7-baseline | direct fact (RU) (RU) | Какая максимальная нагрузка у модели A? | answered: Максимальная нагрузка модели A — 20 единиц. | answered: Максимальная нагрузка у модели A составляет 20 единиц. | 1 / 1 |
| A4 | unknown entity | What is the maximum load for Model C? | not_found: The manual only covers Model A and Model B. | not_found: The uploaded documents do not specify the maximum load for Model C load. | 1 / 1 |
| A7 | STT error | What's the max load for model bee? | answered: Model B's maximum load is 12 units. | answered: The maximum load for Model B is 12 units under normal conditions. | 1 / 1 |
| A8 | history reset | And what about the other model? | needs_clarification: Which model do you mean? | needs_clarification: Which model were you asking about before? | 1 / 1 |
| X1 | inference from a range | Can Model B run at 40°C? | answered: No. The operating temperature for both models is 5°C to 35°C, so 40°C is outside it. | answered (inferred): No, Model B cannot run at 40°C. | 1 |
| X2 | indirect fact | What's the maximum temperature for Model A? | answered: 35°C, the top of the operating temperature range (5°C to 35°C). | answered (inferred): The maximum temperature for Model A is 35°C. | 1 / 1 |
| X3 | absent fact, related line | How long does Model B run on battery? | not_found: The manual does not mention battery operation. Related: both models use the same 12 V power adapter. | not_found: The uploaded documents do not specify how long Model B runs on battery. | 1 / 1 |
| A2 | paraphrase | How many units can A handle? | answered: Model A can handle a maximum load of 20 units. | answered: Model A can handle a maximum of 20 units. | 1 |
| A3 | distractor | How often should I clean the nozzle on Model B? | answered: Clean the dosing nozzle of Model B every 30 days. | answered: Clean the dosing nozzle of Model B every 30 days. | 1 |
| H1 | holdout direct | What room size is the Pro designed for? | answered: Nimbus Pro is designed for rooms up to 60 square meters. | answered: Nimbus Pro is designed for rooms up to 60 square meters. | 1 |
| A9 | document overview | What is this document about? | answered: It is the user manual for the Kestrel Dosing System, covering Model A and Model B. | answered: This document is the user manual for the Kestrel Dosing System, covering Model A and Model B. | 1 |
| L1 | direct fact (RU) | Какая максимальная нагрузка у модели A? | answered: Максимальная нагрузка модели A — 20 единиц. | answered: Максимальная нагрузка у модели A составляет 20 единиц. | 1 |
| L5 | exception (UA) | Чи може модель B перевищувати свій звичайний ліміт? | answered: Так: модель B може працювати до 15 одиниць не довше 5 хвилин, якщо температура нижче 20°C. | answered (inferred): Так, модель B може перевищувати свій звичайний ліміт до 15 одиниць, але не більше 5 хвилин при температурі нижче 20°C. | 1 |
| L7 | language switch after a Russian turn (UA) | А яке максимальне навантаження моделі B? | answered: Максимальне навантаження моделі B — 12 одиниць за звичайних умов. | answered: Максимальне навантаження моделі B становить 12 одиниць в нормальних умовах. | 1 |

## Citation accuracy

| ID | Expected sources | Actual citations (run 1) | Citation per run |
|---|---|---|---|
| M1 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 |
| M3 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 |
| M2 | manual-v1.pdf p.1 | manual-v1.pdf p.1: "2. Setup: Model A"<br>manual-v1.pdf p.1: "Step 1. Connect the power adapter."<br>manual-v1.pdf p.1: "Step 2. Press and hold the SETUP button for 3 seconds until the status light blinks green."<br>manual-v1.pdf p.1: "Step 3. Select channel 1 on the CHANNEL dial."<br>manual-v1.pdf p.1: "Do not select channel 2 during setup. Channel 2 is reserved for service mode."<br>manual-v1.pdf p.1: "3. Setup: Model B"<br>manual-v1.pdf p.1: "Step 1. Connect the power adapter."<br>manual-v1.pdf p.1: "Step 2. Open the front cover."<br>manual-v1.pdf p.1: "Step 3. Set the MODE switch to position B."<br>manual-v1.pdf p.1: "Step 4. Press START."<br>manual-v1.pdf p.1: "Model B has no SETUP button. Holding START for more than 10 seconds resets Model B to factory settings." | 1 / 1 |
| M4 | manual-v1.pdf p.3 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions."<br>manual-v1.pdf p.3: "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C." | 1 / 1 / 1 |
| M5 | none (0 citations) | none | 1 / 1 / 1 |
| M6-baseline | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 / 1 |
| M6 | manual-v2.pdf p.2 | manual-v2.pdf p.2: "Model A: the maximum load is 24 units." | 1 / 1 |
| R1 | none (0 citations) | none | 1 |
| R1b | manual-v1.pdf p.2 | none | 0 |
| A1 | manual-v1.pdf p.2, manual-v2.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units."<br>manual-v2.pdf p.2: "Model A: the maximum load is 24 units." | 1 / 1 |
| A5 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 24 units." | 1 / 1 / 1 |
| A6 | manual-v1.pdf p.3 | manual-v1.pdf p.3: "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C." | 1 / 1 |
| H4 | holdout-nimbus.pdf p.2 | holdout-nimbus.pdf p.2: "Night mode is available only on Nimbus Pro." | 1 / 1 |
| H5 | none (0 citations) | none | 1 / 1 |
| L3 | none (0 citations) | none | 1 / 1 / 1 |
| L6 | none (0 citations) | none | 1 / 1 |
| X4 | manual-v1.pdf p.3 | manual-v1.pdf p.3: "Clean the dosing nozzle of Model B every 30 days." | 1 / 1 / 1 |
| X5 | none (0 citations) | none | 1 |
| L7-baseline | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 / 1 |
| A4 | none (0 citations) | none | 1 / 1 |
| A7 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 |
| A8 | none (0 citations) | none | 1 / 1 |
| X1 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Operating temperature for both models: 5°C to 35°C." | 1 |
| X2 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Operating temperature for both models: 5°C to 35°C." | 1 / 1 |
| X3 | none (0 citations) | none | 1 / 1 |
| A2 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 |
| A3 | manual-v1.pdf p.3 | manual-v1.pdf p.3: "Clean the dosing nozzle of Model B every 30 days." | 1 |
| H1 | holdout-nimbus.pdf p.1 | holdout-nimbus.pdf p.1: "Nimbus Pro is designed for rooms up to 60 square meters." | 1 |
| A9 | manual-v1.pdf p.1 | manual-v1.pdf p.1: "Kestrel Dosing System — User Manual v1"<br>manual-v1.pdf p.1: "1. Introduction"<br>manual-v1.pdf p.1: "This manual covers two models of the Kestrel Dosing System: Model A and Model B." | 1 |
| L1 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 |
| L5 | manual-v1.pdf p.3 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions."<br>manual-v1.pdf p.3: "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C." | 1 |
| L7 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 |

## Reasoning: inferred, assumed and related answers

All tests, all runs. A wrong inferred answer counts as a critical failure.

| Run | ID | Question | Answer | Why · assumed · related | Reasoning check |
|---|---|---|---|---|---|
| 1 | M4 | Is Model B ever allowed to exceed its normal limit? | answered (inferred): Yes, Model B may exceed its normal limit of 12 units under specific conditions. | why: The exception rule allows Model B to operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C. | — |
| 1 | A1 | What is the maximum for Model A? | conflict (inferred): The manuals disagree: manual v1 says Model A's maximum load is 20 units, but manual v2 says it is 24 units. | why: Two documents give different values for the same specification. | — |
| 1 | A6 | Can Model B run at 15 units when it's 25°C? | answered (inferred): No, Model B cannot run at 15 units at 25°C because the exception allowing up to 15 units only applies when the ambient temperature is below 20°C. | why: The exception for Model B to operate up to 15 units is conditional on ambient temperature being below 20°C, which is not met at 25°C. | — |
| 1 | H4 | Does the Compact have night mode? | answered (inferred): No, the Nimbus Compact does not have night mode. | why: Night mode is available only on Nimbus Pro, so it is not available on the Compact. | — |
| 1 | X4 | How often should I clean the nozzel on Model B? | answered: Assuming you meant “nozzle”: Clean the dosing nozzle of Model B every 30 days. | assumed: nozzle | 1 |
| 1 | X5 | How often should I clean the nozzel? | needs_clarification: Assuming you meant “nozzle”: Which model of the Kestrel Dosing System are you using: Model A or Model B? | assumed: nozzle | — |
| 2 | M4 | Is Model B ever allowed to exceed its normal limit? | answered (inferred): Yes, Model B may exceed its normal limit of 12 units up to 15 units for no more than 5 minutes when the ambient temperature is below 20°C. | why: The exception for Model B permits temporary operation above the normal maximum under specific temperature conditions. | — |
| 2 | A1 | What is the maximum for Model A? | conflict (inferred): The maximum load for Model A is 20 units according to manual v1 and 24 units according to manual v2. | why: The two documents give different values for the same specification. | — |
| 2 | A6 | Can Model B run at 15 units when it's 25°C? | answered (inferred): No, Model B cannot run at 15 units at 25°C; the exception allowing up to 15 units only applies when the ambient temperature is below 20°C. | why: The exception for Model B to operate up to 15 units is conditional on ambient temperature being below 20°C, which is not met at 25°C. | — |
| 2 | H4 | Does the Compact have night mode? | answered (inferred): No, the Nimbus Compact does not have night mode. | why: Night mode is available only on Nimbus Pro, so it is not available on the Compact. | — |
| 2 | X1 | Can Model B run at 40°C? | answered (inferred): No, Model B cannot run at 40°C. | why: The operating temperature range for both models is 5°C to 35°C, and 40°C exceeds this limit. | 1 |
| 2 | X2 | What's the maximum temperature for Model A? | answered (inferred): The maximum temperature for Model A is 35°C. | why: The operating temperature range for both models is 5°C to 35°C, so the maximum is 35°C. | — |
| 2 | X3 | How long does Model B run on battery? | not_found: The uploaded documents do not specify how long Model B runs on battery. | — | 0 |
| 2 | X4 | How often should I clean the nozzel on Model B? | answered: Assuming you meant “nozzle”: Clean the dosing nozzle of Model B every 30 days. | assumed: nozzle | 1 |
| 3 | M4 | Is Model B ever allowed to exceed its normal limit? | answered (inferred): Yes, Model B may exceed its normal limit of 12 units up to 15 units for no more than 5 minutes when the ambient temperature is below 20°C. | why: The exception for Model B permits temporary operation above the normal maximum under specific temperature conditions. | — |
| 3 | L5 | Чи може модель B перевищувати свій звичайний ліміт? | answered (inferred): Так, модель B може перевищувати свій звичайний ліміт до 15 одиниць, але не більше 5 хвилин при температурі нижче 20°C. | why: Виключення дозволяє тимчасове збільшення навантаження за певних умов. | — |
| 3 | X2 | What's the maximum temperature for Model A? | answered (inferred): The maximum temperature for Model A is 35°C. | why: The operating temperature range for both models is given as 5°C to 35°C, so the maximum is 35°C. | — |
| 3 | X3 | How long does Model B run on battery? | not_found: The uploaded documents do not specify how long Model B runs on battery. | — | 0 |
| 3 | X4 | How often should I clean the nozzel on Model B? | answered: Assuming you meant “nozzle”: Clean the dosing nozzle of Model B every 30 days. | assumed: nozzle | 1 |

## Failures

- run 1 S7 (setup ask): provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S9 A2: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S10 A3: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S11 A4: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S14 H1: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S16 A7: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S17 (setup ask): provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S18 A9: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S19 L1: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S21 L4: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S22 L5: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S24 X1: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S25 X2: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S26 X3: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 S29 L7: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S1 M1: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S5 M6-baseline: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S6 R1: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S7 (setup ask): provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S9 A2: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S10 A3: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S14 H1: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S18 A9: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S19 L1: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S21 L4: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S22 L5: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S28 X5: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 2 S29 L7-baseline: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S1 M1: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S2 M2: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S6 R1: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S7 (setup ask): provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S8 A1: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S13 A6: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S14 H2: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S15 H4: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S19 L2: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S21 L4: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S23 L6: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S24 X1: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 3 S28 X5: provider error, not scored — NVIDIA API 429: {"status":429,"title":"Too Many Requests"}
- run 1 R1: needs_clarification — "Which limit are you asking about? For example, the maximum load limit, minimum load limit, continuous operation limit, or reservoir capacity?" (missing: Model A, Model B; validation attempts 1)
- run 1 R1b: needs_clarification — "Which limit are you asking about for Model B? For example, the maximum load limit, minimum load limit, continuous operation limit, or reservoir capacity?" (status needs_clarification ≠ answered; missing: 12; validation attempts 1)
- run 2 X3: not_found — "The uploaded documents do not specify how long Model B runs on battery." (no related line from the expected pages; validation attempts 1)
- run 3 X3: not_found — "The uploaded documents do not specify how long Model B runs on battery." (no related line from the expected pages; validation attempts 1)

Replacement check (M6 vs baseline): answer changed in 3/3 runs.

## Latency (Node, text pipeline)

| Measure | Median | p90 | Max |
|---|---|---|---|
| Retrieval | 1 ms | 4 ms | 60 ms |
| LLM, first attempt | 6356 ms | 13312 ms | 24363 ms |
| Question total (retrieval + LLM incl. retries + validation) | 6364 ms | 13321 ms | 24367 ms |

| Ingestion (Node, 5 runs) | Pages | Median | Max |
|---|---|---|---|
| manual-v1.pdf | 3 | 8 ms | 24 ms |
| manual-v2.pdf | 3 | 5 ms | 7 ms |
| holdout-nimbus.pdf | 2 | 2 ms | 3 ms |

## Cost (LLM only, $0.085/MTok in, $0.4/MTok out — OpenRouter paid list price for the same model, checked 2026-09-10 (called via NVIDIA's free endpoint))

| Measure | Value |
|---|---|
| Input tokens per question (mean) | 2108 |
| Output tokens per question (mean) | 149 |
| Cost per question, mean / max | $0.00024 / $0.00032 |
| Questions that needed a retry | 0/56 (0.0%) |
| Cost of one pass over the P0 tests | $0.00132 |
| Cost per ingestion | $0 (parsing and indexing run locally, no API calls) |
