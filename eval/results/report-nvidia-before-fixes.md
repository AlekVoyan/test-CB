# Eval report

- Date: 2026-09-10T17:26:49.835Z
- Commit: `20bdd17` (code loaded when the run started; the header first showed `016ee32`, the HEAD when the report was written — fixed in run-eval since) · provider: `nvidia` · model: `nvidia/nemotron-3-super-120b-a12b` · retrieval: `full` · runs per session: 3
- Expected outcomes: `eval/expected.json` (committed before the first run)
- Latency here is the text pipeline in Node (retrieval + LLM + validation). Voice latency is measured in the browser.

## Summary

| Group | Tests | Runs | Factual accuracy | Citation accuracy | Pass rate | Critical failures |
|---|---|---|---|---|---|---|
| P0 | 10 | 29 | 100.0% | 100.0% | 100.0% | 0 |
| P1 | 8 | 24 | 75.0% | 75.0% | 75.0% | 0 |
| holdout | 5 | 15 | 100.0% | 100.0% | 100.0% | 0 |
| all | 23 | 68 | 91.2% | 91.2% | 91.2% | 0 |

**Acceptance (ТЗ §7.8):** P0 tests passing in ≥ 2/3 of runs: yes. Critical failures: 0.

**Provider errors (not scored, excluded from the rates above):** 1 — run 1 S2 M2. Details under Failures.

## Factual accuracy

| ID | Type | Question | Expected | Actual (run 1) | Factual per run |
|---|---|---|---|---|---|
| M1 | direct fact | What is the maximum for Model A? | answered: The maximum load for Model A is 20 units. | answered: The maximum load for Model A is 20 units. | 1 / 1 / 1 |
| M3 | follow-up | And what about the other model? | answered: Model B's maximum load is 12 units under normal conditions. | answered: The maximum load for Model B is 12 units under normal conditions. | 1 / 1 / 1 |
| M4 | exception | Is Model B ever allowed to exceed its normal limit? | answered: Yes. Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C. | answered: Yes, Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C. | 1 / 1 / 1 |
| M5 | absent fact | What is the battery life of Model A? | not_found: The manual does not specify battery life. | not_found: The uploaded documents do not specify battery life for Model A, | 1 / 1 / 1 |
| M6-baseline | replacement baseline | What is the maximum for Model A? | answered: The maximum load for Model A is 20 units. | answered: The maximum load for Model A is 20 units. | 1 / 1 / 1 |
| M6 | replacement | What is the maximum for Model A? | answered: The maximum load for Model A is 24 units. | answered: The maximum load for Model A is 24 units. | 1 / 1 / 1 |
| R1 | ambiguity | What is the limit? | needs_clarification: Which model do you mean — Model A or Model B? | needs_clarification: Which model are you asking about, Model A or Model B? | 1 / 1 / 1 |
| R1b | clarification answer | Model B. | answered: Model B's maximum load is 12 units under normal conditions. | answered: The maximum load for Model B is 12 units under normal conditions. | 1 / 1 / 1 |
| R2 | correction | I meant Model B. | answered: Model B's maximum load is 12 units. | answered: The maximum load for Model B is 12 units under normal conditions. | 1 / 1 / 1 |
| A1 | conflicting documents | What is the maximum for Model A? | conflict: manual-v1.pdf says 20 units; manual-v2.pdf says 24 units. | conflict: In manual-v1.pdf, Model A has a maximum load of 20 units. In manual-v2.pdf, Model A has a maximum load of 24 units. | 1 / 1 / 1 |
| A2 | paraphrase | How many units can A handle? | answered: Model A can handle a maximum load of 20 units. | answered: Model A can handle a maximum load of 20 units. | 1 / 1 / 1 |
| A3 | distractor | How often should I clean the nozzle on Model B? | answered: Clean the dosing nozzle of Model B every 30 days. | answered: Clean the dosing nozzle of Model B every 30 days. | 1 / 1 / 1 |
| A4 | unknown entity | What is the maximum load for Model C? | not_found: The manual only covers Model A and Model B. | not_found: The uploaded documents do not specify the maximum load for Model C. | 1 / 1 / 1 |
| A5 | rename (anti-hardcode) | What is the maximum for Model A? | answered: The maximum load for Model A is 24 units. | answered: The maximum load for Model A is 24 units. | 1 / 1 / 1 |
| A6 | exception reasoning | Can Model B run at 15 units when it's 25°C? | answered: No. The exception applies only below 20°C; otherwise Model B's maximum is 12 units. | not_found: The uploaded documents do not specify whether Model B can run at 15 units at 25°C. | 0 / 0 / 0 |
| H1 | holdout direct | What room size is the Pro designed for? | answered: Nimbus Pro is designed for rooms up to 60 square meters. | answered: Nimbus Pro is designed for rooms up to 60 square meters. | 1 / 1 / 1 |
| H2 | holdout direct | How often should I replace the filter on the Compact? | answered: Replace the HEPA filter of Nimbus Compact every 6 months. | answered: Replace the HEPA filter of Nimbus Compact every 6 months. | 1 / 1 / 1 |
| H3 | holdout follow-up | And the other one? | answered: Nimbus Pro: replace the HEPA filter every 12 months. | answered: Replace the HEPA filter of Nimbus Pro every 12 months. | 1 / 1 / 1 |
| H4 | holdout inference | Does the Compact have night mode? | answered: No. Night mode is available only on Nimbus Pro. | answered: No, night mode is available only on Nimbus Pro. | 1 / 1 / 1 |
| H5 | holdout absent | How much does the Pro cost? | not_found: The guide does not state a price. | not_found: The uploaded documents do not specify the cost of the Nimbus Pro. | 1 / 1 / 1 |
| A7 | STT error | What's the max load for model bee? | answered: Model B's maximum load is 12 units. | needs_clarification: Do you mean Model A or Model B? | 0 / 0 / 0 |
| A8 | history reset | And what about the other model? | needs_clarification: Which model do you mean? | needs_clarification: Which model are you asking about: Model A or Model B? | 1 / 1 / 1 |
| M2 | comparison | How do I set up Model A versus Model B? | answered: Model A: connect power, hold SETUP for 3 seconds, select channel 1. Model B: connect power, open the front cover, set MODE to B, press START. | answered: For Model A, connect the power adapter, press and hold the SETUP button for 3 seconds until the status light blinks green, then select channel 1 on the CHANNEL dial. For Model B, connect the power adapter, open the front cover, set the MODE switch to position B, then press START. | 1 / 1 |

## Citation accuracy

| ID | Expected sources | Actual citations (run 1) | Citation per run |
|---|---|---|---|
| M1 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 / 1 / 1 |
| M3 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 / 1 |
| M4 | manual-v1.pdf p.3 | manual-v1.pdf p.3: "Exception: Model B may operate up to 15 units for no more than 5 minutes when ambient temperature is below 20°C." | 1 / 1 / 1 |
| M5 | none (0 citations) | none | 1 / 1 / 1 |
| M6-baseline | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 / 1 / 1 |
| M6 | manual-v2.pdf p.2 | manual-v2.pdf p.2: "Model A: the maximum load is 24 units." | 1 / 1 / 1 |
| R1 | none (0 citations) | none | 1 / 1 / 1 |
| R1b | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 / 1 |
| R2 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model B: the maximum load is 12 units under normal conditions." | 1 / 1 / 1 |
| A1 | manual-v1.pdf p.2, manual-v2.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units."<br>manual-v2.pdf p.2: "Model A: the maximum load is 24 units." | 1 / 1 / 1 |
| A2 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 20 units." | 1 / 1 / 1 |
| A3 | manual-v1.pdf p.3 | manual-v1.pdf p.3: "Clean the dosing nozzle of Model B every 30 days." | 1 / 1 / 1 |
| A4 | none (0 citations) | none | 1 / 1 / 1 |
| A5 | manual-v1.pdf p.2 | manual-v1.pdf p.2: "Model A: the maximum load is 24 units." | 1 / 1 / 1 |
| A6 | manual-v1.pdf p.3 | none | 0 / 0 / 0 |
| H1 | holdout-nimbus.pdf p.1 | holdout-nimbus.pdf p.1: "Nimbus Pro is designed for rooms up to 60 square meters." | 1 / 1 / 1 |
| H2 | holdout-nimbus.pdf p.2 | holdout-nimbus.pdf p.2: "Replace the HEPA filter of Nimbus Compact every 6 months." | 1 / 1 / 1 |
| H3 | holdout-nimbus.pdf p.2 | holdout-nimbus.pdf p.2: "Replace the HEPA filter of Nimbus Pro every 12 months." | 1 / 1 / 1 |
| H4 | holdout-nimbus.pdf p.2 | holdout-nimbus.pdf p.2: "Night mode is available only on Nimbus Pro." | 1 / 1 / 1 |
| H5 | none (0 citations) | none | 1 / 1 / 1 |
| A7 | manual-v1.pdf p.2 | none | 0 / 0 / 0 |
| A8 | none (0 citations) | none | 1 / 1 / 1 |
| M2 | manual-v1.pdf p.1 | manual-v1.pdf p.1: "Step 1. Connect the power adapter."<br>manual-v1.pdf p.1: "Step 2. Press and hold the SETUP button for 3 seconds until the status light blinks green."<br>manual-v1.pdf p.1: "Step 3. Select channel 1 on the CHANNEL dial."<br>manual-v1.pdf p.1: "Step 1. Connect the power adapter."<br>manual-v1.pdf p.1: "Step 2. Open the front cover."<br>manual-v1.pdf p.1: "Step 3. Set the MODE switch to position B."<br>manual-v1.pdf p.1: "Step 4. Press START." | 1 / 1 |

## Failures

- run 1 S2 M2: provider error, not scored — NVIDIA API 503: {"error":{"message":"Service temporarily overloaded","type":"Service Unavailable","code":503}}
- run 1 A6: not_found — "The uploaded documents do not specify whether Model B can run at 15 units at 25°C." (status not_found ≠ answered; missing: 20; validation attempts 1)
- run 1 A7: needs_clarification — "Do you mean Model A or Model B?" (status needs_clarification ≠ answered; missing: 12; validation attempts 1)
- run 2 A6: not_found — "The uploaded documents do not specify whether Model B can run at 15 units at 25°C." (status not_found ≠ answered; missing: 20; validation attempts 1)
- run 2 A7: needs_clarification — "Do you mean Model A or Model B?" (status needs_clarification ≠ answered; missing: 12; validation attempts 1)
- run 3 A6: not_found — "The uploaded documents do not specify whether Model B can run at 15 units at 25°C." (status not_found ≠ answered; missing: 20; validation attempts 1)
- run 3 A7: needs_clarification — "Do you mean Model B?" (status needs_clarification ≠ answered; missing: 12; validation attempts 2)

Replacement check (M6 vs baseline): answer changed in 3/3 runs.

## Latency (Node, text pipeline)

| Measure | Median | p90 | Max |
|---|---|---|---|
| Retrieval | 0 ms | 1 ms | 2 ms |
| LLM, first attempt | 2187 ms | 4311 ms | 13822 ms |
| Question total (retrieval + LLM incl. retries + validation) | 2252 ms | 4431 ms | 13823 ms |

| Ingestion (Node, 5 runs) | Pages | Median | Max |
|---|---|---|---|
| manual-v1.pdf | 3 | 11 ms | 15 ms |
| manual-v2.pdf | 3 | 4 ms | 12 ms |
| holdout-nimbus.pdf | 2 | 2 ms | 3 ms |

## Cost (LLM only, $0.085/MTok in, $0.4/MTok out — OpenRouter paid list price for the same model, checked 2026-09-10 (called via NVIDIA's free endpoint))

| Measure | Value |
|---|---|
| Input tokens per question (mean) | 1359 |
| Output tokens per question (mean) | 69 |
| Cost per question, mean / max | $0.00014 / $0.00027 |
| Questions that needed a retry | 5/68 (7.4%) |
| Cost of one pass over the P0 tests | $0.00141 |
| Cost per ingestion | $0 (parsing and indexing run locally, no API calls) |
