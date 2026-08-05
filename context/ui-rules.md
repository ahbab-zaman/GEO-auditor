# UI Rules

Concise rules for building the GEO Auditor UI. These cover the patterns and constraints needed to keep
a two-page app (input + report) consistent, readable by a non-technical business owner, and fast to
build within an 8–12 hour budget.

---

## Design Point of View

This is not a dashboard. It is a document — closer to an editorial report or a diagnosis than a SaaS
admin panel. Every generic-tool instinct (dense cards, everything boxed, everything the same weight)
works against the one thing this product needs to do: make one sentence and one number feel
inevitable the moment the page loads.

Three principles guide every design decision below:

1. **Contrast in scale, not in decoration.** Extraordinary comes from restraint plus one or two
   moments of real scale contrast — the verdict sentence, the score number — not from adding more
   colors, more shadows, or more motion. If everything is emphasized, nothing is.
2. **Editorial rhythm over dashboard density.** Generous white space, a clear reading order, one idea
   per section. This is read top to bottom once, carefully — not scanned repeatedly like an admin
   panel. Reuse the existing token set (ui-tokens.md) with intention rather than introducing new
   colors; distinctiveness comes from typography, spacing, and hierarchy, not a bigger palette.
3. **Every visual choice should make the evidence more credible, not more decorative.** A shadow, a
   border, a rule line — each one should help the reader trust the finding underneath it. If a visual
   flourish doesn't do that, cut it.

If a new design token (a display font size, a texture value) is genuinely needed to execute something
below, flag it — don't silently add it to ui-tokens.md without noting the addition.

---

## Font

Always import Inter via `next/font/google` in the root layout.

```typescript
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
```

Apply the font variable class to the `<html>` tag in root layout. Never use system fonts.

**Scale contrast is the signature move.** Inter's variable weight axis is enough to do this without a
second typeface: the score number and the verdict sentence should feel dramatically larger than
everything around them (see Score Hero and Verdict Banner below). Do not add a second display font —
one typeface used with real conviction reads more intentional than two typefaces used cautiously.

---

## Layout

- Page max-width: 840px, centered — this is a document to be read carefully, not a dashboard to scan,
  so the content column stays narrow
- Page padding: 32px on all sides, 16px on mobile-width viewports (not a graded requirement, but don't
  actively break at narrow widths either — it costs nothing to use responsive padding)
- Gap between report sections (hero / pillars / findings / fixes): 32px
- No navbar — this is a single-flow tool, not a multi-page app. The only persistent chrome is a small
  logo/title linking back to `/` from the report page
- **Avoid boxing everything in a card by default.** A card is for a discrete, evidence-bearing unit
  (a finding, a fix, a pillar summary) — not for every section wrapper. The verdict banner and the
  score hero should feel like they sit directly on the page background, not inside another box; too
  many nested cards is what makes AI-built UIs read as templated

---

## Landing / Input Page

- Centered, vertically generous — this is the entire first impression, keep it to one clear action
- One card: business name input, URL input, single primary "Run Audit" button
- No secondary options, no settings, no advanced mode — the pipeline infers everything else per
  architecture.md
- Below the form: 3 short lines explaining what happens (scrape → ask a real AI → score), so the user
  isn't staring at a spinner with no context once they submit. Pair each line with a small
  `lucide-react` icon (e.g. globe, message-circle, bar-chart) at `text-text-muted` — this triples
  scannability for near-zero build cost and gives the landing page a visual anchor beyond the form
  itself

---

## Progress State (`/audit/[id]` before complete)

- Single centered card, same width as the eventual report hero
- Show the current stage as a full plain-language sentence, not a fragment or internal stage name —
  "Reading your website…" not "Scraping"; "Asking a real AI what it knows about you…" not "Querying AI"
- Never show a raw percentage — stages are not evenly timed (Gemini queries take longer than a
  robots.txt fetch) and a fake progress bar would be misleading
- If `status: failed`, show the audit's `error` message plainly with a "Try again" link back to `/`

---

## Score Hero

- Score ring/number is the first thing on the report **after** the Verdict Banner — largest element
  on the page, but not competing with the banner for the reader's first moment of attention (see
  Verdict Banner below for the reading order)
- Push the score number to real scale contrast — noticeably larger than the typography scale in
  ui-tokens.md implies is "big," this is the second signature moment on the page after the verdict
  sentence and should read that way
- Immediately below the ring: three compact pillar bars, each showing `pointsEarned / pointsPossible`
  and the pillar label, colored per ui-tokens.md severity ranges
- Business name and audited URL shown above the ring as report context
- **Animation:** a single, restrained count-up on the score number is allowed (under ~500ms, easing
  out, no bounce) — this resolves the sole purpose of drawing the eye to the number once, right after
  the verdict has landed. Do not stagger the pillar bars, the findings list, or anything else on load —
  one moment of motion on the page, not a cascade of them. A page where everything animates in reads
  as a demo reel, not a diagnosis someone should trust

---

## Verdict Banner

- Renders first, above the score ring — this is the single most important sentence in the report and
  the exact "moment" the product exists to create (see project-overview.md)
- Give it real typographic weight of its own: noticeably larger and looser line-height than body text,
  generous padding around it, and enough surrounding white space that it doesn't compete visually with
  the score ring immediately below it
- Sits directly on the page background or on a very subtle `bg-surface-secondary` tint — not a bordered
  card with the same visual weight as a finding card. It should read as a headline, not as one card
  among several
- No icon, no severity color tint on the banner itself — its impact comes from scale and isolation, not
  decoration. Color-coding it would also visually conflate it with a severity tag, which it is not

---

## Findings

- Grouped under their pillar, in the pillar order defined in architecture.md (Structural
  Answerability → Live AI Citation → Third-Party Corroboration) — always this order, it mirrors how a
  reader should think about the problem: can AI see you → does AI use you → does anyone else vouch for you
- Every finding card follows this exact structure, top to bottom:
  1. Severity tag + check label (jargon terms get inline explainer text directly under the label, not
     a tooltip — this must be readable in the PDF too, where hover states don't exist)
  2. Finding sentence — specific to this business, one to two sentences
  3. Evidence block — styled per its `Evidence` type per ui-tokens.md
- **Severity is never communicated by color alone.** Every severity tag carries a visible text label
  ("Critical," "Needs work," "Pass") alongside its color, never color/background tint by itself — this
  matters for accessibility and specifically for the PDF, which may be viewed in grayscale or on a poor
  screen
- Never collapse/hide findings behind an accordion — the brief requires every finding to carry
  evidence visibly, hiding it by default works against that
- A `pass` severity finding still shows its evidence — a business owner should be able to verify a
  claimed strength just as easily as a claimed weakness
- Subtle hover state on finding cards (a slight shadow lift or border darken, nothing more) signals
  interactivity is not required here but reinforces that this is a considered surface, not a static dump

---

## Fixes

- Rendered as its own section after all findings, sorted by `priorityScore` descending — the highest
  impact-per-effort fix is always first
- Each fix card: title, plain-language explanation, impact badge, effort badge, and — if
  `copyPasteContent` is present — a code block with a visible "Copy" button
- **Copy button gives explicit feedback on click** — swap the label to "Copied" (or a checkmark icon)
  for ~1.5s before reverting. A click with no confirmation reads as broken, not as polish
- Never bury the copy-pasteable content below a "show more" toggle — per the brief, the fix should be
  handed to the owner directly, not described
- Fixes with `copyPasteContent: null` still get a clear, concrete next action in the explanation text —
  never leave a fix as vague strategic advice with nothing actionable underneath it

---

## Citations Evidence (Pillar B / C)

This is the single most important evidence type in the report — render it with extra care:

- List every query actually run and its answer's cited domains, not just a summary count
- Render the raw `answerText` in a distinct, slightly larger quote-style treatment than the citation
  pills beneath it — it is explicitly the single most persuasive artifact in the whole report
  (project-overview.md) and should look like proof, not like metadata
- The business's own domain, if present in a citation list, is visually distinct (accent-colored pill)
  from other cited domains — this is the exact "moment" the report needs to land
- **If the business's domain is absent from all citations, do not just omit it — show an explicit
  empty slot or a "Your site: not cited" row at the top of the citation list**, so the absence is a
  visible gap the reader's eye catches, not something they'd only notice by counting what's missing

---

## Jargon Handling

Any term a business owner wouldn't know on first read (schema markup, JSON-LD, crawler, GEO, citation)
gets a one-line plain-language explainer directly inline, in muted text, the first time it appears in
a finding or fix. Do not build a separate glossary page or rely on tooltips — this must also work
correctly in the static PDF export.

---

## Empty / Unavailable States

- A pillar marked `unavailable` renders its section header and point total as `0 / [possible]`, with a
  single explanatory line instead of finding cards — states plainly what went wrong ("Live AI testing
  could not complete — the AI provider did not respond") without technical error detail
- **Give the unavailable state its own calm, deliberate visual treatment** — a muted icon (e.g.
  `lucide-react`'s `circle-slash` or similar at `text-text-muted`) plus the one-line reason, styled
  distinctly from both a severity tag and a normal finding card. It must communicate "we tried, here's
  why it's incomplete," not read like a layout bug or a missing component
- Never silently omit an unavailable pillar from the layout — its absence must be visible and explained,
  consistent with the project's "honesty over completeness" principle in code-structure.md

---

## PDF Export Parity

The PDF (`components/audit/ReportPdf.tsx`) mirrors this same content hierarchy: hero → pillar summary →
findings with evidence → fixes with copy-pasteable content rendered as plain text blocks (no interactive
copy button, obviously, but the exact snippet text must still be present and clearly delimited). The PDF
does not need to be pixel-identical to the web report, but no information shown on the web report may be
missing from the PDF — including the text severity labels above, since color alone won't survive
grayscale printing.

---

## Do Nots

- Never use raw Tailwind color classes (`bg-green-500`, `text-red-600`) — use project tokens only
- Never hide evidence behind an interaction (accordion, hover, click-to-reveal) — it must be visible by default
- Never show a score without its breakdown on the same screen
- Never render a generic/templated sentence that isn't drawn from this business's actual scraped or queried data
- Never use `position: fixed` for UI elements
- Never build a settings/config page — there is nothing to configure per project-overview.md scope
- Never communicate severity by color alone — always pair with a text label
- Never stagger multiple elements into view on page load — one restrained motion moment (the score
  count-up) is the ceiling, not a starting point
