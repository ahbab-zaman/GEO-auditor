# UI Tokens

Design tokens for GEO Auditor. Use these exact values throughout the codebase — never hardcode colors
or use raw Tailwind color classes in components.

---

## How to Use

This project uses **Tailwind CSS v4**. All design tokens are defined using the `@theme` directive in
`app/globals.css`. No `tailwind.config.ts` needed for colors or tokens.

```tsx
// Correct
className="bg-surface text-text-primary border-border"

// Never — hardcoded hex values
className="bg-[#101828] text-[#F6F7FB]"

// Never — raw Tailwind color classes
className="bg-green-500 text-red-600"
```

---

## globals.css — Complete Token Definition

```css
@import "tailwindcss";

@theme {
  /* Font */
  --font-sans: "Inter", sans-serif;

  /* Page and surface backgrounds */
  --color-background: #f7f8fb;
  --color-surface: #ffffff;
  --color-surface-secondary: #f4f5f9;

  /* Borders */
  --color-border: #e5e7f0;
  --color-border-light: #eef0f6;

  /* Text */
  --color-text-primary: #12141c;
  --color-text-secondary: #565b6e;
  --color-text-muted: #9498a8;

  /* Primary accent — deep indigo (trust, analysis, not "marketing purple") */
  --color-accent: #3730e0;
  --color-accent-dark: #2a24ab;
  --color-accent-light: #eceafe;
  --color-accent-foreground: #ffffff;

  /* Pass / high score — green */
  --color-pass: #0e9f6e;
  --color-pass-light: #e5f9f1;
  --color-pass-foreground: #05704c;

  /* Warning / mid score — amber */
  --color-warning: #d97706;
  --color-warning-light: #fef3e2;
  --color-warning-foreground: #92400e;

  /* Critical / low score — red */
  --color-critical: #dc2626;
  --color-critical-light: #fdecec;
  --color-critical-foreground: #991b1b;

  /* Evidence block backgrounds */
  --color-quote-bg: #f4f5f9;
  --color-code-bg: #12141c;
  --color-code-text: #e5e7f0;

  /* Border radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
}
```

---

## Color Usage Guide

### Score / Severity Ranges

The score ring, pillar bars, and finding severity tags all use the same three-tier system — never a
different palette per component.

| Range | Meaning | Token |
|---|---|---|
| 80–100 | Strong | `text-pass` / `bg-pass-light` |
| 50–79 | Needs work | `text-warning` / `bg-warning-light` |
| 0–49 | Critical gap | `text-critical` / `bg-critical-light` |

### Finding Severity Tags

| Severity | Background | Text |
|---|---|---|
| `pass` | `bg-pass-light` | `text-pass-foreground` |
| `warning` | `bg-warning-light` | `text-warning-foreground` |
| `critical` | `bg-critical-light` | `text-critical-foreground` |

### Evidence Blocks

| Evidence type | Background | Notes |
|---|---|---|
| `quote` | `bg-quote-bg` | Italicized, left border `4px solid var(--color-border)` |
| `code` | `bg-code-bg` | Monospace, `text-code-text`, used for robots.txt lines / JSON-LD snippets |
| `citations` | `bg-surface-secondary` | Rendered as a list of source pills, business's own domain highlighted in `accent` if present, `critical-light` if absent |
| `absence` | `bg-surface-secondary` | Muted italic text, no icon decoration — stating absence plainly, not dramatically |

### Fix Impact / Effort Badges

| Value | Background | Text |
|---|---|---|
| Impact: high | `bg-accent-light` | `text-accent` |
| Impact: medium / low | `bg-surface-secondary` | `text-text-secondary` |
| Effort: low | `bg-pass-light` | `text-pass-foreground` |
| Effort: medium | `bg-warning-light` | `text-warning-foreground` |
| Effort: high | `bg-critical-light` | `text-critical-foreground` |

---

## Typography

| Element | Size | Weight | Line height | Color token |
|---|---|---|---|---|
| Business name / report title | 24px | 700 | 32px | `text-text-primary` |
| Score number (hero) | 48px | 700 | 52px | `text-text-primary` (colored by range for the ring itself) |
| Pillar heading | 16px | 600 | 24px | `text-text-primary` |
| Finding title | 14px | 600 | 20px | `text-text-primary` |
| Body / finding text | 14px | 400 | 22px | `text-text-secondary` |
| Evidence text | 13px | 400 | 20px | `text-text-secondary` (monospace for `code` type) |
| Muted / meta text | 12px | 400 | 16px | `text-text-muted` |

Font family: **Inter** — import from Google Fonts via `next/font/google`.

---

## Spacing

| Token | Value | Usage |
|---|---|---|
| `gap-2` | 8px | Badge/tag gaps |
| `gap-3` | 12px | Within a finding card |
| `gap-4` | 16px | Between findings in a list |
| `gap-6` | 24px | Between pillar sections |
| `gap-8` | 32px | Between major report sections (hero / findings / fixes) |
| `p-6` | 24px | Card padding |

---

## Component Tokens

### Cards (finding cards, fix cards, pillar summary cards)

```
background: bg-surface
border: 1px solid var(--color-border)
border-radius: 12px (rounded-xl)
padding: 24px (p-6)
box-shadow: 0px 1px 3px rgba(0,0,0,0.06)
```

### Score Ring

```
track: var(--color-border-light)
fill: colored by range (pass/warning/critical)
stroke-width: 8px
size: 140px
```

### Buttons

**Primary (Run Audit, Download PDF):**
```
background: bg-accent
color: text-accent-foreground
border-radius: rounded-md
padding: px-5 py-2.5
font-weight: font-medium
```

**Secondary (Copy fix):**
```
background: bg-surface
border: 1px solid var(--color-border)
color: text-text-primary
border-radius: rounded-md
padding: px-3 py-1.5
```

### Input Fields

```
background: bg-surface
border: 1px solid var(--color-border)
border-radius: rounded-md
padding: px-3 py-2
focus: ring-1 ring-accent border-accent
```

---

## Invariants

- Never use hex values directly in components — always use CSS variables via Tailwind tokens
- Font is Inter — always import via `next/font/google`
- Score/severity color logic lives in one shared utility (`lib/utils.ts` → `getSeverityColor(score)`),
  never re-implemented per component — this is what keeps the ring, bars, and tags visually consistent
- The accent color is never used to signal severity — it is reserved for actions (buttons, links, "own
  domain cited" highlight) so it never gets visually confused with the pass/warning/critical system
