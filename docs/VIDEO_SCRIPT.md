# Video walkthrough — shooting script

Up to three minutes, as the brief asks. Planned at **2:55** at 30 fps. Approved 2026-09-12; shot when Oleh says go.

The film is a screen recording of the running app, cut in Remotion. No generated footage: every frame is the real
product answering real questions. What failed along the way is written down in `DELIVERY_NOTES.md`, which is where it
belongs; three minutes are for showing that the thing works.

**Honesty rule for the edit.** The model takes two to five seconds to answer. The cut shortens that wait to about half
a second, the way any walkthrough does — and scene 9 then shows the measurements panel, which is the actual claim
about speed. Nothing in the film implies a number that was not measured.

## Shot list

| # | Time | On screen | Voice-over | Captured by |
|---|---|---|---|---|
| 1 | 0:00–0:14 | The empty interface: bento grid on filmic near-black, a slow push into the microphone disc. Then `manual-v1.pdf` is dropped in; the document card runs Uploading → Extracting → Indexing → Ready with **153 ms** beside it | "You upload a manual and ask out loud. Indexing runs in the browser — 153 milliseconds for three pages, and nothing leaves the machine." | Playwright, scene 01 |
| 2 | 0:14–0:38 | Live Chrome: the microphone is tapped, the ring pulses, the interim transcript types itself, the final one submits on its own. The answer is spoken aloud; the card rises; the quote sheet under it carries "p. 2" | The question itself: "What is the maximum load for Model A?", then the app answers | **Real Chrome with a microphone (Oleh)** |
| 3 | 0:38–0:56 | Same session: "And what about the other model?" The card changes; the previous answer files itself behind it and darkens. Macro push into the row of tabs | "A follow-up that never names the model: the conversation holds the context, and earlier answers stay one tab away." | Real Chrome |
| 4 | 0:56–1:12 | "Is Model B ever allowed to exceed its normal limit?" → the answer carries a lightbulb and a **WHY** line with the rule it rests on. Macro into the WHY pill | "Some answers are not written anywhere in the document — they follow from a rule it states. Those are marked, and they say what they follow from." | Playwright, scene 02 |
| 5 | 1:12–1:30 | "What is the battery life of Model A?" → "Not in the document", with "Closest passages" opening underneath. Then "What is the limit?" → the clarifying question is spoken, answered by voice with "Model B." → 12 units | "What the document does not contain, it says plainly. An ambiguous question gets a question back, and the answer to it continues by voice." | Playwright + real Chrome for the spoken reply |
| 6 | 1:30–1:44 | Replace with `manual-v2.pdf`; the notice "Documents changed — conversation context reset"; the same question → **24 units**. Split screen: 20 on the left, 24 on the right | "Replace the document and the answer changes with it. The conversation resets, so the old value cannot leak into a new answer." | Playwright, scene 03 |
| 7 | 1:44–2:06 | Quotes: the stack of paragraph sheets, "Open in page" opening the real PDF page with the paragraph lit and the cited lines framed, a pinch to 200%. Quick cut: the same panel on a **scanned book from the Internet Archive**, two columns, frames inside one of them | "Quotes are built by code from the page text, not written by the model, and checked twice. Open one and you get the page itself — including scans and two-column typesetting." | Playwright, scenes 04–05 |
| 8 | 2:06–2:22 | The language switch EN → RU → UA answering the same question three times; beside it the voice switch: Built-in · ElevenLabs · On device, with a moment of each | "One switch carries the whole chain: recognition, answer, voice. Three voices — the system one, a neural one, and a model that runs in this browser for nothing." | Playwright, scene 06 (sound from the live take) |
| 9 | 2:22–2:44 | The measurements panel unfolds: ingestion, question → first audio, recognition, model, validation, tokens, cost. The Copy JSON button. Cut to a terminal: `npm test` → 73 passed, then the head of `report.md` with P0 / P1 / holdout and zero critical failures | "Every question is measured and scored. Factual accuracy and citation accuracy are counted separately, zero critical failures, and a holdout document that nothing was tuned on." | Playwright, scene 07 + terminal capture |
| 10 | 2:44–2:55 | 375 px: the same answer in the phone layout, the quote sheet rising from the bottom. Out to the end card: demo link and repository | "It works from a phone too. The demo and the code are linked below." | Playwright, mobile pass |

## Pipeline

| Layer | Tool |
|---|---|
| Capture | Playwright → headless Chromium, `recordVideo` |
| The voice scenes | Chrome 152 on Oleh's Mac, with system audio recorded |
| Conversion | ffmpeg, h264, faststart |
| Edit | Remotion + React + TypeScript |
| Transitions | `@remotion/transitions` |
| Type | Unbounded and Onest, pinned weights |

**Determinism.** Before the page loads, `localStorage` is seeded (language, voice mode, measurements panel open) and
`Math.random` is replaced by a seeded generator, so the app's own animations fall the same way every time. The model's
answers are not deterministic, so each scene is captured once and its `.webm` becomes the source: the edit can be
re-rendered a month later from the same footage.

**Retina by launch flag, not CSS:** `chromium.launch({ args: ['--force-device-scale-factor=2'] })`. The macro pushes —
the WHY pill, "p. 2", the row of tabs — come from a separate stills pass at `deviceScaleFactor: 6`; a crop from a 2×
frame is mush.

**Finding the cut points.** `ffmpeg -i 02-voice.mp4 -vf "fps=1,scale=180:-1,tile=6x2" -frames:v 1 sheet.png` — one
picture of the whole scene, second by second, which is how you find the frame where the answer starts to sound.

**All motion in the edit comes from the frame number** (`interpolate()`), with no CSS animation in the composition:
Remotion renders out of real time, and a CSS animation simply does not finish. The app's own animations are real and
recorded as they are — they are the product, not decoration.

## What only Oleh can do

1. **One live take with a microphone** — scenes 2, 3 and the spoken "Model B." in scene 5, in Chrome, with system
   audio recorded. Headless Chromium has no microphone, and staging the recognizer in a demo of the product is not on.
2. **The voice-over** — the ten lines above, about 320 words. English recommended; the captions stay English either way.
3. **Order of work:** freeze everything baked into the frame first (the demo URL on the end card, the captions), then
   record the sound. Changing one word in a URL afterwards costs another voice pass.

## Known risks

- **The model takes 2–5 s.** The edit cuts it to about half a second; scene 9 carries the real numbers.
- **Three minutes is a hard ceiling.** The list is planned at 2:55. If the narration runs slower, scene 8 goes down to
  ten seconds first, scene 7 second.
- **The free endpoint is occasionally slow.** Shoot in a quiet hour, take the scenes back to back, drop the bad takes.
