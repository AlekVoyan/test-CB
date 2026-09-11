# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary (confirmed 2026-09-11):** a reviewer evaluating this test assignment, on a laptop in desktop Chrome, who uploads a manual and asks questions aloud.
- **Scenario from the brief:** someone holding an equipment manual who needs a short spoken answer and the exact line that proves it.

## Product Purpose

Answer spoken questions about uploaded equipment manuals: a one- or two-sentence spoken answer plus the verbatim quoted line and its page. When the documents do not contain the answer, say so explicitly. Replacing a document changes the answer. Success means correct and verifiable answers, measured latency and cost, and a reproducible test set.

## Positioning

The model never writes the quote. Every line of the PDF gets an id; the model returns ids and the app copies the verbatim line, then re-checks it against the page text. Answers that fail validation are never spoken.

## Operating Context

- Desktop Chrome or Edge (Web Speech API), laptop microphone; other browsers get a text box.
- Up to two text-based PDFs, at most ten pages in total. No OCR.
- English is the evaluated language; answers in Russian and Ukrainian are an additional capability. Quotes stay in the document's language.
- Documents and the index live in the browser tab; the server only calls the model.

## Capabilities and Constraints

- Upload, replace and remove PDFs with limits (file count, pages, size, text layer).
- Voice and typed questions; statuses: answered, not found, needs clarification, conflict; follow-ups and corrections; conversation resets when the document set changes.
- Measurements panel: ingestion, STT, retrieval, model, time to first audio, tokens, cost.
- Model providers: Claude Haiku 4.5 (target) and an NVIDIA-hosted Nemotron model (used while the Anthropic balance was empty).
- No accounts, payments, storage or native app.

## Brand Commitments

- Working name: "Ask your documents". No logo.
- Visual brief pinned by the user (2026-09-11): inspired by a dark dashboard reference — folder-tab card shapes, large radii, soft layered shadows, pastel accent tiles; black point lifted to a filmic near-black with a barely visible tint; bento layout; colors adjusted rather than copied.

## Evidence on Hand

- Fixture manuals in `fixtures/` (Kestrel Dosing System v1/v2, Nimbus Air Purifier holdout) are synthetic and must be labeled as such where a visitor could mistake them for real products.
- Eval results in `eval/results/`. No testimonials, customers or benchmarks exist; none may be invented.

## Product Principles

1. Proof before polish: every answer shows its verbatim source and page.
2. Say "not in the document" rather than guess.
3. Measure, don't claim: latency and cost come from real runs.
4. One screen holds the whole task: upload, ask, answer, proof.

## Accessibility & Inclusion

Keyboard-operable controls with visible focus, a text fallback where speech recognition is missing, reduced-motion support, and glyph coverage for Cyrillic including Ukrainian (і ї є ґ).
