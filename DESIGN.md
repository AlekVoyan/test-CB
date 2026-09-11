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

The interface is a small filing cabinet opened at night. Every answer is a folder, and the line that proves it is filed behind it under a tab that names the page. The folder-tab silhouette is not decoration: a tab only exists when it carries information — the answer's status, a quote's page, the document count.

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

Tiles float on the ground with a two-layer soft shadow applied as a filter, so the tab and the stacked folders cast the same shadow as the tile they belong to. Inside tiles, depth is tonal: ink washes at 10% for wells, inputs and rows.

### Shadow Vocabulary
- **Tile float** (`filter: drop-shadow(0 1px 1px rgb(0 0 0 / .35)) drop-shadow(0 16px 28px rgb(0 0 0 / .36))`): every tile and stacked folder.
- **Mic lift** (`box-shadow: 0 10px 24px rgb(20 21 18 / .28), 0 2px 4px rgb(20 21 18 / .3)`): the microphone disc only.

### Named Rules
**The Shadow Follows the Silhouette Rule.** Shadows are drop-shadow filters on the whole folder, never box-shadows on a rectangle that ignores the tab.

## Shapes

Tiles are 28px-radius rounded rectangles. A tabbed tile drops its top-left radius and grows a tab above it: 28px tall, 22px top-left radius, and a 14px convex corner followed by a 14px concave fillet — tab height is twice the fillet radius, which turns the edge into one continuous S-curve. Inner wells use 16px; controls, chips and switches are full pills; icons sit in circular ink discs (36–44px; the microphone is 104px, 88px on phones).

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
- **Entrance:** on first view the tiles rise 64px and fade in one by one: voice, documents, answer, measurements. Each takes 520ms on the strong ease-in-out curve (gathers speed, then settles), 70ms apart. Under reduced motion they only fade, 40ms apart.

### Inputs / Fields
- **Style:** pill, ink wash fill, ink text, no border at rest.
- **Focus:** 1.5px ink border; elsewhere focus is a 2px outline offset 3px (ink on pastel, lime on dark).

### Language switch
Segmented pill (EN · RU · UA) on an ink wash; the selected language sits on a sliding ink indicator (220ms ease-out) and turns coral. Accessible names are the native language names.

### Signature: the Proof Folder
The answer tile is lime with its status on the tab. Earlier answers (up to 8) are filed behind it: each is a deeper shade of the answer lime by age and shows the start of its question on a tab peeking above the front folder's edge. Hovering lifts a filed folder by 8px; clicking brings it to the front, view only — follow-ups keep using the latest answer, and a "Back to latest" button returns. Quotes are filed per page: one sage folder per cited page, tab "Page N · k lines", every line verbatim at 17px with the file name and line ids underneath. More than one page forms a stack of its own, with "Show all" laying the pages out in a grid. When an answer arrives it is filed: 320ms rise from 10px with a 3px blur clearing (cubic-bezier(0.23, 1, 0.32, 1)); quote folders follow with a 50ms stagger. Reduced motion keeps the fade and drops the movement.

### Folder stack
One front folder with the rest filed behind it. Each filed folder sits 12px higher than the one in front of it (transform only, 240ms ease-out), so their top edges read as stacked folders; their tabs step to the right beside the front tab (from 36% of the stack width in 20% steps; two tabs under 560px, one under 420px). Nearer folders lie on top of farther ones, so no folder body hides a nearer tab. Up to three peek; more show a counter ("2–4 of 7") with ‹ › buttons. The mouse wheel pages through filed folders only over the tab strip, and releases the page at either end. Under reduced motion the folders fade instead of moving.

### Reasoning marks
An inferred answer says so on its tab: "Inferred from the document", with a lightbulb. Its rule sits directly under the answer: a small ink pill "WHY" with its text cut out in the tile's own colour, then one sentence at 16px. The same sentence is read aloud after the answer. A not-found answer may file related lines in a dark folder whose tab reads "Related, not the answer · Page N" in teal. These lines are context, never proof, so they never take the sage of a quote. When the model offers none, the same dark folder holds the retriever's closest passages under "Closest". An assumed slip shows as a static chip beside Replay: "Interpreted as “nozzle”".

### Think harder switch
A 44×26px switch with an ink outline, above the text field in the voice tile, labelled with a brain icon and one line of explanation. When on, it fills with ink and its knob turns coral (200ms ease-out, instant under reduced motion). When the server's model cannot reason first, the switch is disabled at 45% opacity and the line under it says why: "Needs Claude · this server runs …".

### Microphone
A 104px ink disc with a coral icon. While listening, a ring leaves the disc every 1.6s; while speaking, the Replay button shows a three-bar equalizer. Both stop under reduced motion.

## Do's and Don'ts

### Do:
- **Do** keep each pastel to its one role (The One Job Rule).
- **Do** put data on tabs — status, page, counts — and nothing else.
- **Do** use drop-shadow filters so tabs and stacked folders share the tile's shadow.
- **Do** keep UI motion under 300ms with the strong ease-out curve, and ship a reduced-motion variant with every animation. The one exception is the first-view tile entrance (520ms, ease-in-out), which plays once per load.
- **Do** theme the browser surfaces: lime selection with ink text, lime caret, dark scrollbars, visible focus.
- **Do** file extra content behind the front folder (earlier answers, further pages) instead of listing it, and page through it only over the tab strip.
- **Do** keep related and closest lines in dark folders; sage is for proof only.

### Don't:
- **Don't** use pure black or a neon glow on the ground; the lift and the grain are the material.
- **Don't** add kickers or eyebrow labels above headings; tabs are data, not labels.
- **Don't** set answers or quotes in Unbounded, or use mono for anything that is not a measurement or an id.
- **Don't** add a tab to a tile that has nothing to say on it.
- **Don't** give earlier answers new hues; they are deeper shades of the answer lime (The One Job Rule).
- **Don't** capture the mouse wheel anywhere but a folder stack's tab strip.
- **Don't** mark an answer as inferred without its Why line.
