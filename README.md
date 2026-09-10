# Ask your documents by voice

Upload an equipment manual (PDF), ask a question aloud, and get a short spoken answer with an exact quotation and page number. Answers come only from the uploaded documents; replacing the document changes the answer.

> Work in progress — sections below are filled in as the stages land.

## Quick start

```bash
npm install
cp .env.example .env   # then set ANTHROPIC_API_KEY
npm run dev
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local app + `/api/answer` on the Vite dev server |
| `npm run build` | Type-check and build |
| `npm test` | Unit tests (no API key needed) |
| `npm run eval` | Runs `eval/expected.json` against the real pipeline and LLM (needs the key) |
| `npm run fixtures` | Regenerates the fixture PDFs from `fixtures/source/` |
