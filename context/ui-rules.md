# UI Rules

Concise rules for building the GEO Auditor UI. These cover the patterns and constraints needed to keep
a two-page app (input + report) consistent, readable by a non-technical business owner, and fast to
build within an 8–12 hour budget.

---

## Font

Always import Inter via `next/font/google` in the root layout.

```typescript
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
```

Apply the font variable class to the `<html>` tag in root layout. Never use system fonts.

---

## Layout

- Page max-width: 840px, centered — this is a document to be read carefully, not a dashboard to scan,
  so the content column stays narrow
- Page padding: 32px on all sides, 16px on mobile-width viewports (not a graded requirement, but don't
  actively break at narrow widths either — it costs nothing to use responsive padding)
- Gap between report sections (hero / pillars / findings / fixes): 32px
- No navbar — this is a single-flow tool, not a multi-page app. The only persistent chrome is a small
  logo/title linking back to `/` from the report page

---

## Landing / Input Page

- Centered, vertically generous — this is the entire first impression, keep it to one clear action
- One card: business name input, URL input, single primary "Run Audit" button
- No secondary options, no settings, no advanced mode — the pipeline infers everything else per
  architecture.md
- Below the form: 3 short lines explaining what happens (scrape → ask a real AI → score), so the user
  isn't staring at a spinner with no context once they submit

---

## Progress State (`/audit/[id]` before complete)

- Single centered card, same width as the eventual report hero
- Show the current stage as plain language, not internal stage names: "Reading your website" →
  "Asking AI what it knows about you" → "Checking who else talks about you" → "Calculating your score"
- Never show a raw percentage — stages are not evenly timed (Perplexity queries take longer than
  robots.txt fetch) and a fake progress bar would be misleading
- If `status: failed`, show the audit's `error` message plainly with a "Try again" link back to `/`

---

## Score Hero

- Score ring/number is the first thing on the report — largest element on the page
- Immediately below the ring: three compact pillar bars, each showing `pointsEarned / pointsPossible`
  and the pillar label, colored per ui-tokens.md severity ranges
- Business name and audited URL shown above the ring as report context
- No animation/count-up needed — clarity over polish given the time budget

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
- Never collapse/hide findings behind an accordion — the brief requires every finding to carry
  evidence visibly, hiding it by default works against that
- A `pass` severity finding still shows its evidence — a business owner should be able to verify a
  claimed strength just as easily as a claimed weakness

---

## Fixes

- Rendered as its own section after all findings, sorted by `priorityScore` descending — the highest
  impact-per-effort fix is always first
- Each fix card: title, plain-language explanation, impact badge, effort badge, and — if
  `copyPasteContent` is present — a code block with a visible "Copy" button
- Never bury the copy-pasteable content below a "show more" toggle — per the brief, the fix should be
  handed to the owner directly, not described
- Fixes with `copyPasteContent: null` still get a clear, concrete next action in the explanation text —
  never leave a fix as vague strategic advice with nothing actionable underneath it

---

## Citations Evidence (Pillar B / C)

This is the single most important evidence type in the report — render it with extra care:

- List every query actually run and its answer's cited domains, not just a summary count
- The business's own domain, if present in a citation list, is visually distinct (accent-colored pill)
  from other cited domains — this is the exact "moment" the report needs to land
- If the business's domain is absent from all citations, show that plainly rather than omitting the
  citations list — the absence of their own domain among competitor/third-party citations is itself
  the finding

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
- Never silently omit an unavailable pillar from the layout — its absence must be visible and explained,
  consistent with the project's "honesty over completeness" principle in code-structure.md

---

## PDF Export Parity

The PDF (`components/audit/ReportPdf.tsx`) mirrors this same content hierarchy: hero → pillar summary →
findings with evidence → fixes with copy-pasteable content rendered as plain text blocks (no interactive
copy button, obviously, but the exact snippet text must still be present and clearly delimited). The PDF
does not need to be pixel-identical to the web report, but no information shown on the web report may be
missing from the PDF.

---

## Do Nots

- Never use raw Tailwind color classes (`bg-green-500`, `text-red-600`) — use project tokens only
- Never hide evidence behind an interaction (accordion, hover, click-to-reveal) — it must be visible by default
- Never show a score without its breakdown on the same screen
- Never render a generic/templated sentence that isn't drawn from this business's actual scraped or queried data
- Never use `position: fixed` for UI elements
- Never build a settings/config page — there is nothing to configure per project-overview.md scope
