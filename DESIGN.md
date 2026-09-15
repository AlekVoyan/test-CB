---
name: Ask your documents
description: A voice console for equipment manuals — every answer filed with the quote that proves it.
colors:
  answer-lime: "#d5ea74"
  voice-coral: "#ef9175"
  document-teal: "#74c7ba"
  proof-sage: "#a8d996"
  ink: "#141512"
  filmic-ground: "#161714"
  ground-lift: "#1c1d19"
  surface: "#21231f"
  surface-raised: "#2b2d28"
  text: "#eceee5"
  text-muted: "#b1b5a8"
  text-subtle: "#8f9487"
typography:
  display:
    fontFamily: "Unbounded Variable, Onest Variable, system-ui, sans-serif"
    fontSize: "clamp(30px, 3.4vw, 46px)"
    fontWeight: 600
    lineHeight: 1.05
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Unbounded Variable, Onest Variable, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 550
    letterSpacing: "-0.015em"
  headline:
    fontFamily: "Onest Variable, system-ui, sans-serif"
    fontSize: "clamp(24px, 2.35vw, 34px)"
    fontWeight: 620
    lineHeight: 1.22
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Onest Variable, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Onest Variable, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 650
    letterSpacing: "0.01em"
  mono:
    fontFamily: "JetBrains Mono Variable, ui-monospace, Menlo, monospace"
    fontSize: "0.9em"
    fontFeature: "tnum"
rounded:
  tile: "28px"
  tab: "22px"
  inner: "16px"
  pill: "999px"
spacing:
  gap: "20px"
  tile-padding: "26px 28px"
  page-padding: "44px 32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.answer-lime}"
    rounded: "{rounded.pill}"
    height: "42px"
    padding: "0 18px"
  button-ghost:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "32px"
    padding: "0 13px"
  chip:
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "9px 14px"
  tile-answer:
    backgroundColor: "{colors.answer-lime}"
    textColor: "{colors.ink}"
    rounded: "{rounded.tile}"
    padding: "{spacing.tile-padding}"
  tile-dark:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.tile}"
    padding: "{spacing.tile-padding}"
---

# Design System: Ask your documents

## Overview

**Creative North Star: "The Proof Folder"**

The interface is a small filing cabinet opened at night. Every answer is a folder, and the line that proves it is filed behind it under a tab that names the page. The folder-tab silhouette is not decoration: a tab only exists when it carries information — the answer's status and question, a quote's page, the document count.

The ground is a lifted, filmic near-black with a breath of olive and a static grain, never pure black. On it sit a few pastel tiles, each colour owning exactly one job. Density is calm: large radii, generous padding, one clear focal tile (the answer). Motion is filing: an answer rises, sharpens and settles; everything else is quick feedback.

Visual brief pinned by the user (2026-09-11): shapes and shadows inspired by a dark pastel dashboard reference, colours adjusted rather than copied, black point lifted to a filmic near-black, bento layout.

**Key Characteristics:**
- Filmic ground (#161714) with grain; no pure black anywhere.
- Four pastel tiles, one role each: lime answer, coral voice, teal documents, sage proof.
- Folder-tab silhouettes whose tabs carry data.
- Ink discs for icons, as physical buttons on the pastel.
- Wide geometric display lettering against a plain, legible UI face.

## Colors

A restrained dark neutral field carrying four pastel roles at tile scale.

### Primary
- **Answer Lime** (#d5ea74): the answer tile and the primary action on dark surfaces. The eye should land here first.

### Secondary
- **Voice Coral** (#ef9175): the voice tile and the microphone's icon colour; the "speech → text" segment in the latency bar.

### Tertiary
- **Document Teal** (#74c7ba): the documents tile; the retrieval segment in the latency bar.
- **Proof Sage** (#a8d996): quote folders; the "start of speech" segment in the latency bar.

### Neutral
- **Ink** (#141512): text, discs and primary buttons on every pastel tile. Secondary text on pastel is ink at 74%.
- **Filmic Ground** (#161714) with **Ground Lift** (#1c1d19) as a soft top glow: the page.
- **Surface** (#21231f) and **Surface Raised** (#2b2d28): the measurements tile and controls inside it.
- **Text** (#eceee5), **Text Muted** (#b1b5a8), **Text Subtle** (#8f9487): copy on dark surfaces.

### Named Rules
**The One Job Rule.** Each pastel means one thing — lime answer, coral voice, teal documents, sage proof — in tiles, discs and chart segments alike. A pastel never appears as decoration.

**The Lifted Black Rule.** The darkest paint is #141512 ink on pastel; the page never goes below #161714.

## Typography

**Display Font:** Unbounded (Variable), falling back to Onest and system-ui
**Body Font:** Onest (Variable), falling back to system-ui
**Mono Font:** JetBrains Mono (Variable), for measurements and line ids only

**Character:** A wide, rounded geometric voice for names and titles, paired with a calm humanist UI face. All three families cover Cyrillic including Ukrainian (і ї є ґ).

### Hierarchy
- **Display** (600, clamp(30px, 3.4vw, 46px), 1.05): the page title only.
- **Title** (Unbounded 550, 19px): tile headings and the microphone state line (20px).
- **Headline** (Onest 620, clamp(24px, 2.35vw, 34px), 1.22, max 34ch): the answer itself.
- **Body** (400, 15px, 1.5): everything else; quotes at 17px weight 540.
- **Label** (650, 12px, +0.01em): folder tabs.

### Named Rules
**The Wide Voice Rule.** Unbounded is for names and titles; the answer and every sentence the user reads are set in Onest.

**The Measured Mono Rule.** Mono appears only where a number or id is being measured: timings, tokens, cost, line ids.

## Layout

A 12-column bento grid (max 1280px, 20px gaps, 44px/32px page padding). At ≥1100px: voice (4 columns, two rows) beside documents (8), the answer (8) under documents as the largest tile, quote folders under the answer, measurements under the voice tile. At ≤1100px: 6 columns — voice and documents side by side, then answer, proof and measurements full width. At ≤720px: one column in reading order voice → documents → answer → proof → measurements. Quote folders use `auto-fill` columns of at least 280px so a single quote stays folder-sized.

## Elevation & Depth

Tiles float on the ground with a two-layer soft shadow cast by the whole silhouette, tab included. The surface's shadow is painted first, then the tab with its own shadow, then the surface, which covers the part of the tab's shadow that would fall on it. Inside tiles, depth is tonal: ink washes at 10% for wells, inputs and rows.

### Shadow Vocabulary
- **Tile float** (`box-shadow: 0 1px 1px rgb(0 0 0 / .35), 0 16px 28px rgb(0 0 0 / .36)` on the surface and on the tab, layered as above): every tile. Filed folders carry a 1px hairline instead.
- **Mic lift** (`box-shadow: 0 10px 24px rgb(20 21 18 / .28), 0 2px 4px rgb(20 21 18 / .3)`): the microphone disc only.

### Named Rules
**The Shadow Follows the Silhouette Rule.** The tab casts the tile's shadow too, and no seam may show where tab and surface meet. Tile shadows are box-shadows layered under the surface, never a drop-shadow filter. A filter is recomputed every frame while anything inside or over it moves (an answer filing in, the speaking bars); measured, that took the GPU from the on-device voice and doubled its time to the first sound.

## Shapes

Tiles are 28px-radius rounded rectangles. A tabbed tile drops its top-left radius and grows a tab above it: 28px tall, 22px top-left radius, and a 14px convex corner followed by a 14px concave fillet — tab height is twice the fillet radius, which turns the edge into one continuous S-curve. A tab is never given a height of its own: it reaches from the row's line down to its own folder's edge, and its corner and fillet are each half of that, so a filed folder's shorter tab keeps the same unbroken curve. Inner wells use 16px; controls, chips and switches are full pills; icons sit in circular ink discs (36–44px; the microphone is 104px, 88px on phones).

### Named Rules
**The Tab Carries Data Rule.** A tab appears only when it holds information: the answer's status, a quote's page, the documents count. No empty or decorative tabs.

## Components

### Buttons
- **Shape:** full pill (999px).
- **Primary:** ink background with the tile's own colour as text (lime on the answer tile), 42px tall, 18px side padding. On dark surfaces it inverts to lime with ink text.
- **Press:** scales to 0.97 over 140ms (cubic-bezier(0.23, 1, 0.32, 1)); disabled at 40% opacity.
- **Ghost:** transparent with a 1.5px ink border, 32px tall; an ink wash on hover (fine pointers only).
- **Icon button:** 34px circle on an ink wash (surface-raised on dark tiles).

### Chips
- **Style:** 1.5px ink border, transparent fill, 14px text; used for suggested questions in the empty answer tile.
- **State:** ink wash on hover; 40% opacity when no document is loaded.

### Cards / Containers
- **Corner Style:** 28px (tabbed tiles: 0 at top-left).
- **Background:** one pastel role per tile, or Surface for measurements.
- **Shadow Strategy:** Tile float (see Elevation & Depth).
- **Internal Padding:** 26px 28px (answer 30px 32px; phones 22px 20px).
- **Entrance:** on first view the tiles rise and fade in one by one: voice, documents, answer, measurements. They rise 200px on desktop (the 12-column layout, over 1100px wide) and 64px on smaller screens. Each takes 600ms, 100ms apart, on a quadratic ease-in-out (cubic-bezier(0.45, 0, 0.55, 1)). Both halves are parabolas: even acceleration, then even braking to a soft stop. Under reduced motion they only fade, 40ms apart.

### Inputs / Fields
- **Style:** pill, ink wash fill, ink text, no border at rest.
- **Focus:** 1.5px ink border; elsewhere focus is a 2px outline offset 3px (ink on pastel, lime on dark).

### Language switch
Segmented pill (EN · RU · UA) on an ink wash; the selected language sits on a sliding ink indicator (220ms ease-out) and turns coral. Accessible names are the native language names.

### Signature: the Proof Folder
The answer tile is lime. Its tab carries the status icon and the start of the question, the same on every answer in the stack; the status word opens the card, before the question in quotes. Earlier answers (up to 8) are filed behind it, each on its own plane and each plane a deeper shade of the answer lime: a quarter of the way to the olive #6d7a34 per plane, 0.086 of oklab lightness, so no two folders in the row read as one. The row holds four planes, and the deepest still carries ink at 5.6:1. Clicking a tab brings that answer to the front, view only — follow-ups keep using the latest answer, and a "Back to latest" button returns. Quotes are filed per source paragraph: one sage sheet per paragraph, tabbed "p.N · <the paragraph's first line>". The cited lines sit in focus at 16.5px behind a 3px ink rule. The paragraph's other lines stay at 74% ink, and the lines just before and after it dissolve through a mask, so the sheet reads as a cut-out of the page. The foot carries the line ids as a range, "k of n lines quoted" and "Open in page". More than one paragraph forms a stack, summarised in its head ("4 passages · page 1 · 26 lines"); "Read all" lays the sheets out in a grid. When an answer arrives it is filed: 320ms rise from 10px with a 3px blur clearing (cubic-bezier(0.23, 1, 0.32, 1)); quote folders follow with a 50ms stagger. Reduced motion keeps the fade and drops the movement.

### Folder stack
One folder in front, the rest filed behind it in a fixed order: answers newest first, sheets in page order. Each tab has its own place in one row (up to four side by side, three under 560px, two under 420px) and never moves sideways when another folder comes forward. Every tab starts on the front tab's top line. A filed folder's body lies behind the front one, 8px narrower a side and 3px higher for every folder in front of it, so only a sliver of its edge shows and its tab looks shorter the farther back it is. Nearer folders lie on top of farther ones, and the colour belongs to the plane, not to the folder: the front plane carries the full tone and each one behind is a step deeper. Bringing a folder forward therefore brightens it, and that lighter tone spreads over the front from under its tab: a disc scaled out over 280ms on cubic-bezier(0.23, 1, 0.32, 1), with the words fading in. The folder that was in front sinks into its own place and darkens with it, and any folder between the two steps one plane back. Hovering a filed folder lifts it by 4px and brightens it, tab and edge together, so the silhouette keeps its shape as it moves; it settles back on the line. More folders than fit show a counter ("2 of 7") with ‹ › buttons that bring the previous or next folder forward. The mouse wheel over the tabs scrolls the row without changing the open folder, whose tab holds at the edge once scrolled past, and releases the page at either end. Under reduced motion folders change depth in place and the colour changes at once.

### Reasoning marks
An inferred answer shows a lightbulb on its tab and opens with "Inferred from the document". This label, the other status labels and the "WHY" pill are written in the answer's language. Its rule sits directly under the answer: a small ink pill "WHY" with its text cut out in the tile's own colour, then one sentence at 16px. The same sentence is read aloud after the answer. A not-found answer may file related lines in dark folders with teal tab text, under a stack head that begins "Related, not the answer"; laid out with "Read all", each sheet's tab says it. These lines are context, never proof, so they never take the sage of a quote. When the model offers none, the same dark folder holds the retriever's closest passages under "Closest". An assumed slip shows as a static chip beside Replay: "Interpreted as “nozzle”".

### Think harder switch
A 44×26px switch with an ink outline, above the text field in the voice tile, labelled with a brain icon and one line of explanation. When on, it fills with ink and its knob turns coral (200ms ease-out, instant under reduced motion). When the server's model cannot reason first, the switch is disabled at 45% opacity and the line under it says why: "Needs Claude · this server runs …".

### Voice switch
Above Think harder in the voice tile: a label with a speaker icon, then three pill segments on the ink wash, built like the language switch (the ink indicator slides in 220ms ease-out, the chosen label turns coral): Built-in · ElevenLabs · On device. One line under it says what the chosen voice costs and where it runs. While the on-device model downloads, a 4px ink progress bar sits above that line, which gives the percentage and says the built-in voice speaks meanwhile. ElevenLabs is disabled at 45% when the server has no key, and its title says why.

### Page viewer
"Open in page" shows the real PDF page, rendered by pdf.js at the panel's width. The cited paragraph stays lit while the rest of the page sinks under a 42% veil, and each cited line is framed in lime. On desktop the panel slides in from the left (280ms, iOS-like drawer curve), so the answer and its sheets stay in view on the right. On phones it rises as a bottom sheet at 88% of the screen height. Esc, the close button or the backdrop close it, and focus returns to the button that opened it. Under reduced motion it fades. Zoom runs from 100% (fit to width) to 300% in steps. The level sits between − and + in the panel's head and resets to fit on click. The keyboard (+, −, 0), a pinch, or Ctrl/⌘ with scroll zoom around the point under the pointer: the page scales at once and is rendered sharp when the gesture rests.

### Microphone
A 104px ink disc with a coral icon. While listening, a ring leaves the disc every 1.6s; while speaking, the Replay button shows a three-bar equalizer. Both stop under reduced motion.

## Do's and Don'ts

### Do:
- **Do** keep each pastel to its one role (The One Job Rule).
- **Do** put data on tabs — status, page, counts — and nothing else.
- **Do** give the tab the tile's shadow and let the surface cover its foot. **Don't** use drop-shadow filters on tiles, around their content or under it: they are recomputed every frame while the content moves.
- **Do** keep UI motion under 300ms with the strong ease-out curve, and ship a reduced-motion variant with every animation. The one exception is the first-view tile entrance (600ms, quadratic ease-in-out), which plays once per load.
- **Do** theme the browser surfaces: lime selection with ink text, lime caret, dark scrollbars, visible focus.
- **Do** file extra content behind the front folder (earlier answers, further pages) instead of listing it, and page through it only over the tab strip.
- **Do** keep related and closest lines in dark folders; sage is for proof only.
- **Do** show context from the source itself: the real page with frames, never a retyped or redrawn page.

### Don't:
- **Don't** use pure black or a neon glow on the ground; the lift and the grain are the material.
- **Don't** add kickers or eyebrow labels above headings; tabs are data, not labels.
- **Don't** set answers or quotes in Unbounded, or use mono for anything that is not a measurement or an id.
- **Don't** add a tab to a tile that has nothing to say on it.
- **Don't** give the planes behind new hues; they are deeper shades of the same tone (The One Job Rule).
- **Don't** capture the mouse wheel anywhere but a folder stack's tab strip.
- **Don't** move a tab sideways or park it above the front tab's top line: depth shows in width, tab height, edge and tone. A tab changes colour only by changing plane, never for any other reason. Under the pointer a folder lifts whole and settles back, which is the one time a tab leaves the line.
- **Don't** mark an answer as inferred without its Why line.
