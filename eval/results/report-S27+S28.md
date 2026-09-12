# Eval report

- Date: 2026-09-12T10:57:15.364Z
- Commit: `8bfcb44 + uncommitted changes` · provider: `nvidia` · model: `nvidia/nemotron-3-super-120b-a12b` · retrieval: `full` · think harder: off · runs per session: 3
- Expected outcomes: `eval/expected.json` (committed before the first run)
- Latency here is the text pipeline in Node (retrieval + LLM + validation). Voice latency is measured in the browser.

## Summary

| Group | Tests | Runs | Factual accuracy | Citation accuracy | Reasoning checks | Pass rate | Critical failures |
|---|---|---|---|---|---|---|---|
| Think better | 2 | 6 | 100.0% | 100.0% | 100.0% | 100.0% | 0 |
| all | 2 | 6 | 100.0% | 100.0% | 100.0% | 100.0% | 0 |

**Acceptance (ТЗ §7.8):** P0 tests passing in ≥ 2/3 of runs: yes. Critical failures: 0.

## Factual accuracy

| ID | Type | Question | Expected | Actual (run 1) | Factual per run |
|---|---|---|---|---|---|
| X4 | slip, one target | How often should I clean the nozzel on Model B? | answered: Assuming you meant the nozzle: clean the dosing nozzle of Model B every 30 days. | answered: Assuming you meant “nozzle”: Clean the dosing nozzle of Model B every 30 days. | 1 / 1 / 1 |
| X5 | slip, model not named (guard) | How often should I clean the nozzel? | needs_clarification: Which model do you mean — Model A or Model B? | needs_clarification: Which model of the Kestrel Dosing System are you using: Model A or Model B? | 1 / 1 / 1 |

## Citation accuracy

| ID | Expected sources | Actual citations (run 1) | Citation per run |
|---|---|---|---|
| X4 | manual-v1.pdf p.3 | manual-v1.pdf p.3: "Clean the dosing nozzle of Model B every 30 days." | 1 / 1 / 1 |
| X5 | none (0 citations) | none | 1 / 1 / 1 |

## Reasoning: inferred, assumed and related answers

All tests, all runs. A wrong inferred answer counts as a critical failure.

| Run | ID | Question | Answer | Why · assumed · related | Reasoning check |
|---|---|---|---|---|---|
| 1 | X4 | How often should I clean the nozzel on Model B? | answered: Assuming you meant “nozzle”: Clean the dosing nozzle of Model B every 30 days. | assumed: nozzle | 1 |
| 2 | X4 | How often should I clean the nozzel on Model B? | answered: Assuming you meant “nozzle”: Clean the dosing nozzle of Model B every 30 days. | assumed: nozzle | 1 |
| 3 | X4 | How often should I clean the nozzel on Model B? | answered: Assuming you meant “nozzle”: Clean the dosing nozzle of Model B every 30 days. | assumed: nozzle | 1 |

## Failures

None.

## Latency (Node, text pipeline)

| Measure | Median | p90 | Max |
|---|---|---|---|
| Retrieval | 5 ms | 19 ms | 19 ms |
| LLM, first attempt | 4706 ms | 6047 ms | 6047 ms |
| Question total (retrieval + LLM incl. retries + validation) | 4727 ms | 6071 ms | 6071 ms |

| Ingestion (Node, 5 runs) | Pages | Median | Max |
|---|---|---|---|
| manual-v1.pdf | 3 | 8 ms | 20 ms |
| manual-v2.pdf | 3 | 6 ms | 8 ms |
| holdout-nimbus.pdf | 2 | 3 ms | 4 ms |

## Cost (LLM only, $0.085/MTok in, $0.4/MTok out — OpenRouter paid list price for the same model, checked 2026-09-10 (called via NVIDIA's free endpoint))

| Measure | Value |
|---|---|
| Input tokens per question (mean) | 2122 |
| Output tokens per question (mean) | 149 |
| Cost per question, mean / max | $0.00024 / $0.00025 |
| Questions that needed a retry | 0/6 (0.0%) |
| Cost of one pass over the P0 tests | $0.00000 |
| Cost per ingestion | $0 (parsing and indexing run locally, no API calls) |
