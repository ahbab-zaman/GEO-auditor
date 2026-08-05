# AGENTS.md — GEO Auditor

> **Read this file first, every session, before touching any code.** It is the entry point. After this, read `context/project-overview.md` and `context/architecture.md` in full before starting any feature, then only the other `context/` files relevant to what you're building.

---

## 1. Project Overview

GEO Auditor tells a business owner whether they actually exist inside AI-generated answers (ChatGPT, Perplexity, Claude, Google AI Overviews) — not just whether they rank on Google. User enters a business name + URL → the tool scrapes the site, queries Google Gemini (Search grounding) with realistic customer questions, cross-checks third-party corroboration, and returns a scored, evidenced report with a prioritized fix list. Single Next.js app, no separate backend, no auth, file-based storage.

---

## 2. Core Technologies

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict, no `any`, no unchecked type assertions)
- **Styling**: Tailwind CSS v4 + shadcn/ui, tokens via `@theme` in `globals.css`
- **Validation**: zod — all untrusted external data (API bodies, Gemini responses, JSON-LD)
- **Scraping**: cheerio (static fetch only — no Playwright/Puppeteer)
- **AI Provider**: Google Gemini (`gemini-2.0-flash`), raw `fetch`, no SDK — single provider by design
- **PDF**: `@react-pdf/renderer`
- **Animation**: framer-motion
- **Icons**: lucide-react
- **IDs**: nanoid
- **Storage**: no database — flat JSON at `src/data/audits/{id}.json`

This project has no auth, no accounts, no billing, no multi-provider AI SDKs. If a task seems to need any of those, it's out of scope — say so rather than installing/building it.

---

## 3. Project Structure

This project uses a **`/src` layout**. All application code lives under `src/`; only root-level config (`next.config.ts`, `tsconfig.json`, `package.json`, `.env*`) sits outside it.

```
/
├── AGENTS.md                      ← this file
├── context/                       ← read after this file
│   ├── project-overview.md
│   ├── architecture.md
│   ├── build-plan.md
│   ├── progress-tracker.md
│   ├── code-structure.md
│   ├── library-docs.md
│   ├── ui-rules.md
│   ├── ui-tokens.md
│   └── ui-registry.md
├── /agent/skills/                        ← /architect /imprint /recover /remember /review
├── next.config.ts
├── tsconfig.json                  → strict: true, "@/*" → "./src/*"
├── package.json
├── .env.local                     → GEMINI_API_KEY (gitignored)
├── .env.example
└── src/
    ├── app/
    │   ├── layout.tsx             → root layout, Inter font var
    │   ├── globals.css            → @theme token definitions, keyframes
    │   ├── page.tsx                → landing + input form
    │   ├── audit/
    │   │   └── [id]/
    │   │       └── page.tsx        → progress state → full report
    │   └── api/
    │       └── audit/
    │           ├── route.ts        → POST, starts pipeline
    │           └── [id]/
    │               ├── route.ts    → GET, status/result
    │               └── pdf/
    │                   └── route.ts → GET, PDF export
    ├── lib/
    │   ├── pipeline/
    │   │   ├── runAudit.ts
    │   │   ├── scrape.ts
    │   │   ├── structuralAnswerability.ts
    │   │   ├── liveAiCitation.ts
    │   │   ├── thirdPartyCorroboration.ts
    │   │   ├── verdict.ts
    │   │   ├── score.ts
    │   │   └── fixes.ts
    │   ├── gemini.ts               → geminiJson() + geminiGroundedQuery()
    │   ├── robots.ts
    │   ├── storage.ts
    │   └── utils.ts
    ├── types/
    │   └── audit.ts
    ├── schemas/
    │   └── audit.ts
    ├── components/
    │   ├── ui/                     → shadcn/ui primitives, index-exported only here
    │   ├── audit/
    │   │   ├── AuditForm.tsx
    │   │   ├── ProgressState.tsx
    │   │   ├── VerdictBanner.tsx
    │   │   ├── ScoreHero.tsx
    │   │   ├── PillarBreakdown.tsx
    │   │   ├── FindingCard.tsx
    │   │   ├── EvidenceBlock.tsx
    │   │   ├── FixCard.tsx
    │   │   └── ReportPdf.tsx
    │   └── motion/
    │       └── variants.ts
    └── data/
        └── audits/
            └── .gitkeep
```

`submission/audits/` (the 3 required real audit outputs) stays at the repo root, outside `src/` — it's a deliverable artifact, not application code.

---

## 4. Import Alias

`tsconfig.json` maps `@/*` → `./src/*`. Always use `@/` — never relative imports going up more than one level.

```typescript
// Correct
import { ScoreHero } from "@/components/audit/ScoreHero";
import { POINTS } from "@/lib/utils";
import type { Audit } from "@/types/audit";

// Never
import { ScoreHero } from "../../../components/audit/ScoreHero";
```

---

## 5. Page Structure

- **Landing** (`src/app/page.tsx`) — business name input, URL input, Run Audit button
- **Audit report** (`src/app/audit/[id]/page.tsx`) — polling progress state → full report once complete
- **API**: `POST /api/audit`, `GET /api/audit/[id]`, `GET /api/audit/[id]/pdf`

No navbar, no multi-page app shell, no settings page. Do not add pages beyond these without checking `project-overview.md`'s "Features Out of Scope" list first.

---

## 6. Pipeline (server-side only)

Orchestrated by `src/lib/pipeline/runAudit.ts`, 7 stages, each wrapped in its own try/catch so one pillar failing never crashes the run. Full stage order and data flow: `context/architecture.md`. Never call Gemini or the scraper from a Client Component — nothing outside `lib/pipeline/` and `lib/gemini.ts` imports `GEMINI_API_KEY` directly.

---

## 7. Context Files — Read in This Order

1. `context/project-overview.md` — what's being built and why
2. `context/architecture.md` — pipeline stages, data model, storage, file structure
3. `context/build-plan.md` — build order, phase by phase
4. `context/progress-tracker.md` — what's actually done so far
5. `context/code-structure.md` — how code in this repo must be written
6. `context/library-docs.md` — exact Gemini call patterns, rate-limit handling, citation URL resolution
7. `context/ui-rules.md` + `context/ui-tokens.md` — visual rules and design tokens
8. `context/ui-registry.md` — what's already been built, to match before inventing something new

---

## 8. Skills Installed

All in `skills/`. Use them — don't skip them because a task feels small.

| Skill | When to run it |
| --- | --- |
| `/architect` | Before building any new feature — think it through and confirm a plan first |
| `/imprint` | After building any UI component — capture its patterns to `ui-registry.md` |
| `/review` | After finishing any feature — verify it against the plan, the architecture, and the design system |
| `/recover` | The moment something goes wrong — diagnose before re-prompting |
| `/remember save` / `/remember restore` | End / start of every session |

---

## 9. UI Guidelines

- Tailwind v4, tokens via `@theme` in `src/app/globals.css` — never hardcode hex values or use Tailwind's built-in color classes.
- No navbar — single focused flow (input → progress → report).
- Font is Inter via `next/font/google`.
- Light theme — see `context/ui-tokens.md` for the full palette.
- Full detail in `context/ui-rules.md` and `context/ui-tokens.md`.

---

## 10. Development Workflow

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — lint

Requires only `GEMINI_API_KEY` in `.env.local` — no other services to run, under 5 minutes to get going per the project's own scoping decision.

---

## 11. Environment Variables

```
GEMINI_API_KEY=...
```

Only one AI provider key exists in this project by design. Never add `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, or any other provider key without first updating `context/library-docs.md` and `context/architecture.md`'s integrations table.

---

## 12. Best Practices & Invariants

- TypeScript strict, no `any`, no unnecessary type assertions.
- Server Components by default; `"use client"` only when state/effects/browser APIs/event listeners require it.
- Route handlers under `src/app/api/` only orchestrate — pipeline/checker logic lives in `src/lib/pipeline/`.
- Every checker function returns a fully-shaped `CheckResult`, never `null`/`undefined` — unavailable is still a real object with a stated reason.
- Every route handler validates with zod and returns `{ success: boolean, data?: T, error?: string }` — never a raw error string or stack trace.
- If the initial scrape fails, the whole audit fails with a clear, specific error — nothing downstream can run without it.

---

## 13. Security

- No auth, no accounts, no sessions — nothing to secure on that front.
- `GEMINI_API_KEY` never hardcoded, never logged, never sent to the client — only read inside `src/lib/gemini.ts`.
- All scraped HTML, JSON-LD, and Gemini responses are untrusted input — validate with zod before treating as typed data, never `JSON.parse()` directly into a trusted type.
- Never log a raw API key or `.env` value to the console or to `memory.md`.
