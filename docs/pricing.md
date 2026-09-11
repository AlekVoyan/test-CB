# Pricing assumptions

All prices checked on **2026-09-10** (ElevenLabs on 2026-09-11) on the vendors' public pages. Free credits and trials (Deepgram's $200, any API trial credit) are **ignored**: every cost below uses list prices.

## Unit prices

| Component | What the prototype uses | Price used in the cost model | Source |
|---|---|---|---|
| Reasoning (LLM) | Claude Haiku 4.5, `claude-haiku-4-5`, direct Anthropic API | $1.00 per 1M input tokens, $5.00 per 1M output tokens | [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview), [claude.com/pricing](https://claude.com/pricing) |
| Reasoning (development fallback) | NVIDIA Nemotron 3 Super 120B A12B, `nvidia/nemotron-3-super-120b-a12b`, called on NVIDIA's free hosted API while the Anthropic balance was empty | $0.085 per 1M input tokens, $0.40 per 1M output tokens — OpenRouter's paid list price for the same model (free access is not zero cost) | [openrouter.ai/api/v1/models](https://openrouter.ai/api/v1/models) |
| Speech recognition (prototype) | Web Speech API in Chrome/Edge | $0 direct cost. The browser sends audio to its vendor's speech service; there is no SLA and no guarantee it stays free or available for production traffic. | — |
| Speech synthesis | ElevenLabs Flash v2.5 (`eleven_flash_v2_5`) through `/api/tts`; the browser's own voice when it fails | $0.05 per 1,000 characters (Flash and Turbo API price; v3 and Multilingual v2 cost $0.10). The fallback voice costs $0. | [elevenlabs.io/pricing/api](https://elevenlabs.io/pricing/api) |
| Speech synthesis, on device | Supertonic 3 in the browser (ONNX Runtime Web) | $0 per question. A one-time 399 MB download from Hugging Face per browser: bandwidth, no fee | [huggingface.co/supertone-oss-archive/supertonic-3](https://huggingface.co/supertone-oss-archive/supertonic-3) |
| Speech recognition (production alternative) | Deepgram Nova-3 streaming, pay-as-you-go | $0.0077 per audio minute (list price; a $0.0048 promotional price was shown on the check date) | [deepgram.com/pricing](https://deepgram.com/pricing) |
| Paid intermediaries | None — the server calls the Anthropic API directly | $0 | — |
| Hosting (fixed, separate from variable cost) | Vercel Hobby | $0 per month. Includes 1M function invocations, 4 h active CPU, 100 GB fast data transfer per month; hard caps, cannot buy more; personal, non-commercial use only | [vercel.com/pricing](https://vercel.com/pricing) |

## Formulas

- **Ingestion:** $0 variable. PDF parsing and indexing run in the user's browser; no API call is made.
- **Question:** `input_tokens × $1/1M + output_tokens × $5/1M`, summed over all attempts (retries included, because each retry is billed), `+ spoken_characters / 1000 × $0.05` for the voice (the answer plus the Why line of an inferred answer; $0 when the browser's voice or the on-device voice speaks).
- **Question with hosted recognition (production):** the above `+ question_audio_seconds / 60 × $0.0077`.

Deepgram Aura, priced here before as the production voice, was dropped: Aura-2 speaks English, Spanish, Dutch, French, German, Italian and Japanese, but not Russian or Ukrainian ([deepgram.com](https://deepgram.com/learn/aura-2-now-speaks-dutch-french-german-italian-japanese)).
- **Hosting:** fixed per month, reported separately and never folded into per-question cost.

Measured token counts, retry rate and resulting per-question costs are in `eval/results/report.md` and `docs/DELIVERY_NOTES.md`.
