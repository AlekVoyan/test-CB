# Pricing assumptions

All prices checked on **2026-09-10** on the vendors' public pages. Free credits and trials (Deepgram's $200, any API trial credit) are **ignored**: every cost below uses list prices.

## Unit prices

| Component | What the prototype uses | Price used in the cost model | Source |
|---|---|---|---|
| Reasoning (LLM) | Claude Haiku 4.5, `claude-haiku-4-5`, direct Anthropic API | $1.00 per 1M input tokens, $5.00 per 1M output tokens | [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview), [claude.com/pricing](https://claude.com/pricing) |
| Speech recognition (prototype) | Web Speech API in Chrome/Edge | $0 direct cost. The browser sends audio to its vendor's speech service; there is no SLA and no guarantee it stays free or available for production traffic. | — |
| Speech synthesis (prototype) | `speechSynthesis` with local OS voices | $0 | — |
| Speech recognition (production alternative) | Deepgram Nova-3 streaming, pay-as-you-go | $0.0077 per audio minute (list price; a $0.0048 promotional price was shown on the check date) | [deepgram.com/pricing](https://deepgram.com/pricing) |
| Speech synthesis (production alternative) | Deepgram Aura-1 | $0.015 per 1,000 characters | [deepgram.com/pricing](https://deepgram.com/pricing) |
| Paid intermediaries | None — the server calls the Anthropic API directly | $0 | — |
| Hosting (fixed, separate from variable cost) | Vercel Hobby | $0 per month. Includes 1M function invocations, 4 h active CPU, 100 GB fast data transfer per month; hard caps, cannot buy more; personal, non-commercial use only | [vercel.com/pricing](https://vercel.com/pricing) |

## Formulas

- **Ingestion:** $0 variable. PDF parsing and indexing run in the user's browser; no API call is made.
- **Question, prototype:** `input_tokens × $1/1M + output_tokens × $5/1M`, summed over all attempts (retries included, because each retry is billed).
- **Question, production voice:** prototype cost + `question_audio_seconds / 60 × $0.0077` + `answer_characters / 1000 × $0.015`.
- **Hosting:** fixed per month, reported separately and never folded into per-question cost.

Measured token counts, retry rate and resulting per-question costs are in `eval/results/report.md` and `docs/DELIVERY_NOTES.md`.
