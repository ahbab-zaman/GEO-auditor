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
Last updated: 2026-08-05

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
| Shadow           | shadow-sm                          |
| Accent usage     | accent on primary button + input focus ring |

**Pattern notes:** The landing input card is the reference for all cards in the app: `bg-surface`,
`rounded-xl`, `1px border-border`, `p-6`. Primary button + input share this exact style everywhere.

---

### ProgressState (running state)

File: src/components/audit/ProgressState.tsx
Last updated: 2026-08-05

| Property         | Class                            |
| ---------------- | -------------------------------- |
| Background       | bg-surface                       |
| Border           | border border-border             |
| Border radius    | rounded-xl                       |
| Text — primary   | text-text-primary                |
| Text — secondary | text-text-muted                  |
| Spacing          | p-6, flex-col items-center, mt-4 (label) |
| Shadow           | none                             |
| Accent usage     | spinner border-t-accent          |

**Pattern notes:** Spinner is a pure CSS border trick (`border-2 border-border border-t-accent animate-spin`) — matches ui-rules.md "no framer-motion on the progress spinner". Centered column, same width as the report hero.

---

### VerdictBanner (opening verdict line)

File: src/components/audit/VerdictBanner.tsx
Last updated: 2026-08-05

| Property         | Class                               |
| ---------------- | ----------------------------------- |
| Background       | bg-accent-light                     |
| Border           | border border-border                |
| Border radius    | rounded-xl                          |
| Text             | text-lg font-semibold text-accent-dark |
| Spacing          | px-6 py-5                           |
| Shadow           | none                                |
| Accent usage     | accent-light banner + accent-dark text |

**Pattern notes:** The accent is reserved for this verdict banner + actions, never for severity — per ui-tokens.md invariant. Intentionally visually distinct from severity cards.

---

### ScoreHero (score ring + pillar bars)

File: src/components/audit/ScoreHero.tsx
Last updated: 2026-08-05

| Property         | Class                            |
| ---------------- | -------------------------------- |
| Background       | bg-surface                       |
| Border           | border border-border             |
| Border radius    | rounded-xl                       |
| Ring track       | bg-border-light, stroke 8px      |
| Ring fill        | bg-pass / bg-warning / bg-critical (static map) |
| Bar fill         | bg-pass / bg-warning / bg-critical |
| Text             | text-[48px] font-bold for score; text-sm text-text-muted for meta |
| Spacing          | p-6, flex items-center gap-6 (ring + bars) |
| Shadow           | none                             |

**Pattern notes:** Ring/bar color is chosen via `getSeverityColor()` from `lib/utils.ts` mapped through static class maps (`RING_STYLES`/`BAR_STYLES`) — never dynamic `bg-${x}` (Tailwind can't compile that). Bars are `h-2 rounded-full bg-border-light` tracks with a colored fill at width %.

---

### PillarBreakdown (per-pillar summary)

File: src/components/audit/PillarBreakdown.tsx
Last updated: 2026-08-05

| Property         | Class                            |
| ---------------- | -------------------------------- |
| Background       | bg-surface (card), section transparent |
| Border           | border border-border (cards)     |
| Border radius    | rounded-xl (cards)               |
| Text — heading   | text-base font-semibold text-text-primary |
| Text — meta      | text-sm text-text-muted (points) |
| Spacing          | space-y-4                        |
| Shadow           | none                             |

**Pattern notes:** Renders its own section header, then either FindingCards or a single unavailable-state card (`bg-surface` + explanatory line). Unavailable pillars are always visible with an explanation — never silently hidden.

---

### FindingCard

File: src/components/audit/FindingCard.tsx
Last updated: 2026-08-05

| Property         | Class                            |
| ---------------- | -------------------------------- |
| Background       | bg-surface                       |
| Border           | border border-border             |
| Border radius    | rounded-xl                       |
| Text — title     | text-sm font-semibold text-text-primary |
| Text — body      | text-sm leading-6 text-text-secondary |
| Severity badge   | rounded-full px-2 py-0.5 text-xs + severity bg/text: pass=`bg-pass-light text-pass-foreground`, warning=`bg-warning-light text-warning-foreground`, critical=`bg-critical-light text-critical-foreground` |
| Spacing          | p-6, gap-2 (badge+title), mt-3 (finding -> evidence) |
| Shadow           | none                             |

**Pattern notes:** Severity tag always precedes the label. Evidence block sits below the finding, always visible, `mt-3`. Card is `p-6` + `rounded-xl` — same as AuditForm/FixCard.

---

### EvidenceBlock

File: src/components/audit/EvidenceBlock.tsx
Last updated: 2026-08-05

| Property         | Class                            |
| ---------------- | -------------------------------- |
| quote bg         | bg-quote-bg, border-l-4 border-border, px-4 py-3, italic text-text-secondary |
| code bg          | bg-code-bg, font-mono text-code-text, overflow-x-auto |
| citations/absence bg | bg-surface-secondary, rounded-lg, px-4 py-3 |
| Citation pill    | rounded-full px-2.5 py-0.5 text-xs; own domain = `bg-accent-light text-accent`, other = `bg-surface ring-1 ring-inset ring-border text-text-secondary` |
| Muted source     | text-xs text-text-muted          |

**Pattern notes:** Evidence type drives the block style entirely. All evidence blocks start with a muted source line, then the content. Citations render as pills via `flex flex-wrap gap-2`. Own-domain highlight: `EvidenceBlock` receives an optional `ownDomain` prop (threaded from the report page via `PillarBreakdown → FindingCard → EvidenceBlock`, derived from `audit.url`); a pill is highlighted accent only when its resolved domain equals `ownDomain`. Never rely on the citations `businessCited` boolean to pick which pill to highlight — it can't identify the specific pill at this layer.

---

### FixCard

File: src/components/audit/FixCard.tsx
Last updated: 2026-08-05

| Property               | Class                            |
| ---------------------- | -------------------------------- |
| Background             | bg-surface                       |
| Border                 | border border-border             |
| Border radius          | rounded-xl                       |
| Text — title           | text-sm font-semibold text-text-primary |
| Text — body            | text-sm leading-6 text-text-secondary |
| Impact badge high      | bg-accent-light text-accent      |
| Impact badge med/low   | bg-surface-secondary text-text-secondary |
| Effort badge low       | bg-pass-light text-pass-foreground |
| Effort badge med       | bg-warning-light text-warning-foreground |
| Effort badge high      | bg-critical-light text-critical-foreground |
| Copy block             | bg-code-bg px-4 py-3, pre font-mono text-code-text |
| Secondary (copy) btn   | rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary |
| Spacing                | p-6, gap-2 (badges), mt-3 (title -> body), mt-2 (copy btn) |
| Shadow                 | none                             |

**Pattern notes:** Copy button is a Client Component interaction (`"use client"` + `navigator.clipboard`), styled as the standard secondary button. Copy content rendered as a `<pre>` in the code palette with a visible button below.

---

## Established Conventions (across all Phase 1 components)

- **Cards** = `bg-surface rounded-xl border border-border p-6`. `shadow-sm` appears only on the landing input card so far — cards elsewhere use no shadow, which slightly deviates from ui-tokens.md's card spec (`0px 1px 3px rgba(0,0,0,0.06)`). Flagged in review.
- **Severity/status badges** = `rounded-full px-2 py-0.5 text-xs` + the bg/text pair from ui-tokens.md.
- **Inputs** = `rounded-md border border-border bg-surface px-3 py-2 focus:border-accent focus:ring-1 focus:ring-accent`.
- **Primary button** = `rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground`. **Secondary button** = `rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary`.
- **Guardrail:** never build dynamic token classes (e.g. `` `bg-${x}` ``) — always map through a static class record.