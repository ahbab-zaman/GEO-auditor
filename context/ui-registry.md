# UI Registry

Living document. Updated after every component is built. Read this before building any new component
— match existing patterns exactly before inventing new ones.

## How to Use

Before building any component:

1. Check if a similar component already exists here
2. If yes — match its exact classes
3. If no — build it following ui-rules.md and ui-tokens.md, then add it here

After building any component — update this file with the component name, file path, and exact classes
used.

---

## Components

### AuditForm (landing input card)

File: src/components/audit/AuditForm.tsx
Last updated: 2026-08-06

| Property         | Class                              |
| ---------------- | ---------------------------------- |
| Background       | bg-surface                         |
| Border           | border border-border               |
| Border radius    | rounded-xl                         |
| Text — primary   | text-text-primary                  |
| Text — secondary | text-text-secondary                |
| Text — muted     | text-text-muted                    |
| Spacing          | p-6, space-y-4 (fields), mt-1 (label->input), mt-8 (page) |
| Input            | rounded-md border border-border bg-surface px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent |
| Primary button   | rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground |
| Shadow           | shadow-card                        |
| Accent usage     | accent on primary button + input focus ring |

**Pattern notes:** The landing input card is the reference card: `bg-surface`, `rounded-xl`,
`1px border-border`, `p-6`, `shadow-card`. Primary button + input share this exact style everywhere.

---

### ProgressState (running state)

File: src/components/audit/ProgressState.tsx (updated 2026-08-06)
Last updated: 2026-08-06

| Property          | Class                                             |
| ----------------- | ------------------------------------------------ |
| Type              | Client Component (`"use client"` + framer-motion) |
| Card              | `bg-surface rounded-xl border border-border px-6 py-10 shadow-card` |
| Loader circle     | `h-28 w-28` relative; dashed `border-border` reverse-spin ring; `bg-accent/10 blur-xl animate-glow-pulse` glow |
| Radar sweep       | `conic-gradient(color-mix(accent…))` on `animate-radar-sweep` rotating overlay |
| Center icon       | `Search h-9 w-9 text-accent animate-glow-pulse` |
| Particles         | 3 dots `animate-particle` + staggered `animationDelay` (accent/pass/warning) |
| Orbit dot         | `animate-orbit` + centered `span` of 2px accent |
| Status message    | framer-motion `AnimatePresence mode="wait"` fade + 12px slide + `blur(4px)`→0, ~0.35s, every 3.2s |
| Stage badge       | `rounded-full bg-accent-light px-2.5 py-0.5 text-xs font-medium text-accent` "Stage N of 5" |
| Phase label       | `text-xs text-text-muted` |
| Progress bar      | `h-1 w-full max-w-xs rounded-full bg-surface-secondary` + `w-1/2 animate-progress-slide` gradient accent fill (indeterminate — no fake %) |
| Spacing           | mt-6 (loader->message, h-10 fixed), mt-3 (badge), mt-5 (bar) |

**Pattern notes:** Continuous, AI-inspired reel — no fake percentage. `PHASE_BASE_BY_STATUS` seeds
the reel per backend status (pending=Preparing, scraping=Website Analysis, analyzing=AI Research →
Generating Report) and fast-forwards on stage advance. All CSS loops are tagged `geo-anim` (disabled via
`@media (prefers-reduced-motion: reduce)`). Keyframes live in globals.css as `--animate-spin-slow`,
`--animate-spin-reverse`, `--animate-radar-sweep`, `--animate-glow-pulse`, `--animate-orbit`,
`--animate-particle`, `--animate-progress-slide`. This is the only continuous animation on the site and
renders only pre-completion.

---

### VerdictBanner (opening verdict line)

| Property         | Class                                    |
| ---------------- | ---------------------------------------- |
| Background       | bg-surface-secondary (subtle tint only)  |
| Border           | none — no card border                    |
| Border radius    | none                                     |
| Text             | text-[30px] font-semibold leading-[42px] text-text-primary |
| Spacing          | px-6 py-8                                |
| Shadow           | none                                     |
| Accent usage     | none — no severity color tint            |

**Pattern:** A headline, not a card — sits on the page background (or subtle tint), scale-contrast
30px, no icon, no severity color. First + largest element on the report, above the score ring.

---

### ScoreHero (score ring + pillar bars)

| Property         | Class                                      |
| ---------------- | ------------------------------------------ |
| Background       | none — sits on page background             |
| Border           | none                                       |
| Border radius    | none                                       |
| Ring             | 180px SVG, 10px stroke, track `stroke-border-light`, fill `text-pass/warning/critical` (stroke-current), round linecap |
| Score number     | text-[68px] font-bold leading-[72px] text-text-primary; count-up ≤450ms fires once (skipped if prefers-reduced-motion) |
| Bar fill         | bg-pass / bg-warning / bg-critical (static map) |
| Business name    | text-2xl font-bold leading-8 text-text-primary |
| Spacing          | mt-8 (name->ring), gap-8 (ring + bars), space-y-4 (bars) |
| Shadow           | none                                      |

**Pattern:** Deliberately NOT boxed — the verdict + score are the two scale-contrast moments and sit on
the background. Color via `getSeverityColor()` mapped through static records (`RING_STYLES`/`BAR_STYLES`),
never dynamic `bg-${x}`. Score count-up is the ONLY motion on page load.

---

### PillarBreakdown (per-pillar summary)

| Property         | Class                                  |
| ---------------- | -------------------------------------- |
| Background       | bg-surface (cards), section transparent |
| Border           | border border-border (cards)          |
| Border radius    | rounded-xl (cards)                    |
| Text — heading   | text-base font-semibold text-text-primary |
| Text — meta      | text-sm text-text-muted (points)      |
| Spacing          | space-y-4                             |
| Shadow           | shadow-card on cards (unavailable state + finding cards) |
| Unavailable      | `CircleSlash` icon text-text-muted + one-line reason |

**Pattern:** Renders a section header, then finding cards or a single unavailable-state card with a muted
icon + explanation — never silently hidden.

---

### FindingCard

| Property         | Class                                   |
| ---------------- | ---------------------------------------- |
| Background       | bg-surface                              |
| Border           | border border-border                    |
| Border radius    | rounded-xl                              |
| Shadow           | shadow-card; hover: shadow-card-hover   |
| Text — title     | text-sm font-semibold text-text-primary |
| Text — body      | text-sm leading-6 text-text-secondary   |
| Severity badge   | rounded-full px-2 py-0.5 text-xs + bg/text pair; ALWAYS text label: pass=`Pass`, warning=`Needs work`, critical=`Critical` |
| Unavailable      | `CircleSlash` text-text-muted + one-line reason |
| Spacing          | p-6, gap-2 (badge+title), mt-3 (finding -> evidence) |

**Pattern:** Severity is never color alone — every badge carries a visible text label. Unavailable check
gets a muted `circle-slash` icon, never a severity tag. Cards carry `shadow-card` + `shadow-card-hover`.

---

### EvidenceBlock

| Property             | Class                                 |
| -------------------- | ------------------------------------- |
| Namespace            | (evidence type keys)                  |
| quote bg             | bg-quote-bg, border-l-4 border-border, px-4 py-3, italic text-text-secondary |
| code bg              | bg-code-bg, font-mono text-code-text, overflow-x-auto |
| citations/absence bg | bg-surface-secondary, rounded-lg, px-4 py-3 |
| citations answerText | border-l-2 border-border pl-3, text-[13px] italic |
| Citation pill    | rounded-full px-2.5 py-0.5 text-xs; own domain = `bg-accent-light text-accent`, other = `bg-surface ring-1 ring-inset ring-border text-text-secondary` |
| Not-cited slot       | when ownDomain provided + absent: `rounded-full bg-critical-light px-2.5 py-0.5 text-xs text-critical-foreground` label "Your site: not cited" rendered FIRST |
| Muted source         | text-xs text-text-muted               |
| Shadow               | none (evidence blocks are inset, not cards) |

**Pattern:** Evidence type drives the block style. The citations answerText is a distinct quote-style
block (border-l-2) — the most persuasive artifact. If the own domain is absent, an explicit
"Your site: not cited" pill leads the row. Own-domain highlight via `ownDomain` prop, never `businessCited`.

---

### FixCard

| Property               | Class                                   |
| ---------------------- | ---------------------------------------- |
| Background            | bg-surface                              |
| Border                | border border-border                    |
| Border radius         | rounded-xl                              |
| Shadow              | shadow-card; hover: shadow-card-hover   |
| Text — title          | text-sm font-semibold text-text-primary |
| Text — body           | text-sm leading-5 text-text-secondary   |
| Impact badge high     | bg-accent-light text-accent             |
| Impact badge med/low  | bg-surface-secondary text-text-secondary |
| Effort badge low      | bg-pass-light text-pass-foreground      |
| Effort badge med      | bg-warning-light text-warning-foreground |
| Effort badge high     | bg-critical-light text-critical-foreground |
| Copy button           | rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary |
| Copied feedback       | label swaps to "Copied" ~1.5s, then reverts   |
| Spacing               | p-6, gap-2 (badges), mt-3 (title -> body), mt-2 (copy btn) |

**Pattern:** Client Component (`"use client"` + `navigator.clipboard`), explicit "Copied" feedback ~1.5s,
snippet rendered as `<pre>` in code palette with visible button — never hidden behind a toggle.

---

## Established Conventions (across altered Phase 7 components)

- **Cards** = `bg-surface rounded-xl border border-border px-6 p-4` and now carry the `shadow-card` token
  with a `shadow-card-hover` lift on hover.
- **Severity/status badges** = `rounded-full px-2 py-0.5 text-xs` + bg/text pair; **always** with a text
  label ("Pass" / "Needs work" / "Critical") — never color alone.
- **Unavailable treatment** = muted `CircleSlash` lucide icon at `text-text-muted` + a one-line reason;
  distinct from severity badges and normal cards.
- **Score/verdict scale-contrast** — 30px verdict + 68px score are the only two oversized elements.
- **Motion ceiling** — only the score count-up fires on page load; the only loop is the progress `breathe`
  pulse pre-completion.
- **Guardrail:** never dynamic token classes** (e.g. `` `bg-${x}` ``) — always map through a static class record.
- **Buttons** — primary `rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground`;
  secondary `rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary`.

---

### ReportPdf (PDF export — @react-pdf/renderer)

File: src/components/audit/ReportPdf.tsx
Last updated: 2026-08-06

| Property          | Value                          |
| ----------------- | ------------------------------ |
| Page              | A4, padding 32, fontSize 11, lineHeight 1.5 |
| Palette           | light print-friendly — text `#12141c` / `#565b6e` / `#9498a8`, evidence bg `#f4f5f9`, code bg `#12141c` + text `#e5e7f0`, borders `#e5e7f0` |
| Severity labels   | `[Pass]` / `[Needs work]` / `[Critical]` — ALWAYS text label, color is decorative only (survives grayscale) |
| Own-domain mark   | own citation pill appended with " (your site)"; absent slot = red-bordered pill "Your site: not cited" |
| Structure         | header (brand + business + url + score) → verdict → score → pillar breakdown → findings w/ evidence → prioritized fixes |
| Server-only       | imported ONLY by `GET /api/audit/[id]/pdf` — never a client component |

**Pattern notes:** Mirrors the web report's information hierarchy (no info may be missing), but not
pixel-identical styling. Supported CSS props only (per library-docs.md). Evidence types render inline —
quote/code/absence on `#f4f5f9` with a "Source:" label, citations as wrap-row pills. Copy-pasteable fix
content renders as a dark `Courier` block. Severity is never communicated by color alone.

---

### ReportPage PDF download button (report page chrome)

File: src/app/audit/[id]/page.tsx
Last updated: 2026-08-06

| Property       | Class                                                   |
| -------------- | ------------------------------------------------------- |
| Type           | `<a>` (plain navigation to `/api/audit/[id]/pdf`)       |
| Background     | bg-accent                                               |
| Border radius  | rounded-md                                              |
| Text           | text-sm font-medium text-accent-foreground              |
| Spacing        | px-5 py-2.5                                             |
| Hover          | none (default link behavior)                            |

**Pattern:** Reuses the primary-button token set verbatim (same classes as the Run Audit button). Sits
top-right in the report header row, balanced against the "GEO Auditor" back-link on the left. A real
`<a href>` download, not a client click handler — the PDF route does the work server-side.