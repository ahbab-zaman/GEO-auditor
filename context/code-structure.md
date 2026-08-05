# Code Standards

Implementation rules and conventions for the entire project. The AI agent must follow these in every
session without exception. These rules prevent pattern drift across sessions.

---

## Engineering Mindset

- **Think before implementing** — understand what is being built and why before writing a single line
- **Read context files first** — never assume, always verify against architecture.md and project-overview.md
- **Scope is sacred** — this is an 8–12 hour build. Never add a feature not in build-plan.md, even if it seems like a quick win
- **Every check must be testable in isolation** — each checker function takes a `ScrapedPage[]` or query result and returns a `CheckResult`; test it with a hand-built fixture before wiring it into the pipeline
- **Honesty over completeness** — if a check can't produce a real answer for this business, the checker must return an honest `unavailable`/`absence` result, never a fabricated or generic one. This is graded directly (see project-overview.md report requirements).
- **One thing at a time** — complete one checker fully, verify its output on a real site, before starting the next
- **Failures are expected** — every checker, every API call, every pipeline stage wrapped in try/catch. One pillar failing must never crash the whole audit.

---

## Mock Data — Labeling Rule

The brief is explicit on this: *"A fake result presented as real is an instant no."* This applies to
code as much as to the submitted reports.

- Mock/stubbed pillar data (build-plan.md's Phase 1, feature 02) must live in its own clearly-named
  function or file — e.g. `getMockPillarResult()` in a file like `lib/pipeline/mocks.ts` — never inlined
  directly inside `runAudit.ts` or a real checker function where it could be mistaken for live output.
- The function name itself must say "mock" — no vague names like `getDefaultResult()` or
  `getFallbackData()` that could read as a legitimate fallback path rather than a placeholder.
- As each real checker replaces its mock (Phase 2 onward), delete the corresponding mock call from
  `runAudit.ts` entirely — don't leave it commented out or behind a flag. Once a checker is real, no
  code path in the shipped repo should be able to silently produce mock output instead.
- If any mock data remains in the final submission for a reason (e.g. a pillar that was intentionally
  left stubbed due to time), it must be labeled in both the code (per the naming rule above) and the
  README's "what's real vs mocked" section — the two must agree exactly, since a reviewer checking one
  against the other is the whole point of the rule.

---

## TypeScript

- Strict mode enabled in tsconfig.json — no exceptions
- Never use `any` — use `unknown` and narrow the type
- Never use type assertions (`as SomeType`) unless absolutely necessary and commented why — this matters especially when parsing scraped HTML and JSON-LD, which is inherently untrusted input
- All function parameters and return types must be explicitly typed
- Use `type` for object shapes and unions — use `interface` only for extendable component props
- All async functions must have proper error handling — never let promises float unhandled
- Use `const` by default — only use `let` when reassignment is necessary
- Untrusted external data (scraped HTML text, JSON-LD blocks, API responses) must be validated with `zod` before being treated as typed data — never trust `JSON.parse()` output directly

---

## Next.js 15 Conventions

- App Router only — no Pages Router
- React 19 — use React 19 APIs throughout
- All components are Server Components by default
- Only add `"use client"` when the component requires:
  - useState or useReducer (e.g. polling state on the report page)
  - useEffect (e.g. the polling interval itself)
  - Event listeners (e.g. copy-to-clipboard buttons on fixes)
- Never add `"use client"` to layout files unless absolutely required
- Route handlers live in `app/api/` — never put pipeline/checker logic directly in route handlers, only orchestration calls into `lib/pipeline/`
- The audit pipeline runs server-side only — never call Perplexity, OpenAI, or the scraper from a Client Component
- Always read Next.js documentation before implementing any Next.js specific feature — APIs may differ from training data

---

## File and Folder Naming

- Folders: kebab-case
- Component files: PascalCase — `ScoreHero.tsx`, `FindingCard.tsx`
- Utility/lib files: camelCase — `perplexity.ts`, `runAudit.ts`
- Type files: camelCase — `audit.ts`
- API route files: always `route.ts`
- One component per file — never export multiple components from one file
- Checker functions live one-per-file under `lib/pipeline/`, named for what they check, not for the pillar (e.g. `structuralAnswerability.ts` contains all 4 checks as separate exported functions — do not split into 4 files, they share scraped-page context and a shared file keeps that obvious)

---

## Component Structure

```typescript
"use client"; // only if needed

// 1. External imports
import { useState } from "react";

// 2. Internal imports
import { FindingCard } from "@/components/audit/FindingCard";
import type { PillarResult } from "@/types/audit";

// 3. Type definitions
type Props = {
  pillar: PillarResult;
};

// 4. Component
export function PillarBreakdown({ pillar }: Props) {
  // derived values
  // return JSX
}
```

- Never use default exports for components — always named exports
- Props type defined directly above the component
- No inline styles — all styling via Tailwind classes using tokens from ui-tokens.md

---

## API Route Handlers

```typescript
// app/api/audit/route.ts

import { NextRequest, NextResponse } from "next/server";
import { runAudit } from "@/lib/pipeline/runAudit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // validate with zod
    const audit = await createAudit(body.url, body.businessName);
    runAudit(audit.id); // fire and forget — do not await, pipeline updates disk as it goes
    return NextResponse.json({ success: true, data: { id: audit.id } });
  } catch (error) {
    console.error("[api/audit]", error);
    return NextResponse.json(
      { success: false, error: "Could not start audit" },
      { status: 500 },
    );
  }
}
```

- Every route handler has a try/catch
- Every route handler validates the request body with `zod` before processing
- Errors are logged with the route path as prefix: `[api/audit]`
- Always return `{ success: boolean, data?: T, error?: string }`
- Never return raw data without the success wrapper
- Never expose raw error messages or stack traces in the response — log them, return a human-readable string

---

## Pipeline / Checker Functions

```typescript
// lib/pipeline/structuralAnswerability.ts

export async function checkAiCrawlerAccess(
  robotsTxt: string | null,
): Promise<CheckResult> {
  try {
    // implementation
    return { id: "ai-crawler-access", /* ... */ };
  } catch (error) {
    console.error("[pipeline/ai-crawler-access]", error);
    return {
      id: "ai-crawler-access",
      status: "unavailable" /* per architecture.md shape */,
      /* ... */
    };
  }
}
```

- Every checker function has a try/catch and never throws out of the pipeline
- Every checker returns a fully-shaped `CheckResult`, never `null` or `undefined` — an unavailable check is still a real object with `status: unavailable` and a reason
- Checkers never import from `components/` or `app/`
- Checkers never use React hooks or browser APIs
- Checkers are pure with respect to their inputs where possible — scraped data and API responses are passed in as arguments, not re-fetched inside the checker

---

## Error Handling

- Never use empty catch blocks — always log or handle
- Console errors always include context prefix: `[pipeline/stage-name]` or `[api/route-name]`
- User-facing errors must be human readable — never expose raw error messages
- A pillar failure never surfaces a raw error to the report UI — it surfaces `unavailableReason`, a short human-readable sentence set by the checker itself
- If the initial scrape fails, the whole audit fails with a clear, specific error (e.g. "Could not reach this website — check the URL and try again"), since nothing downstream can run without it

---

## Environment Variables

All environment variables defined in `.env.local`. Never hardcode any key anywhere in the codebase.
`.env.example` is checked into the repo with the variable name and no value, so a reviewer knows
exactly what to provide — this is what makes the "under 5 minutes to run" requirement realistic.

| Variable | Used In |
|---|---|
| `GEMINI_API_KEY` | `lib/gemini.ts` — the only AI provider in this project, free tier via Google AI Studio |

Only one AI provider key exists in this project by design — see project-overview.md "Why Gemini, Not a
Paid Engine." Do not add `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, or any other AI provider key without
first updating library-docs.md and architecture.md's integrations table.

---

## Scoring Constants

All point allocations are defined once as constants and imported everywhere they're needed — never
hardcoded inline in a checker or in the UI.

```typescript
// lib/utils.ts
export const POINTS = {
  structuralAnswerability: {
    aiCrawlerAccess: 10,
    schemaPresence: 10,
    directAnswerClarity: 10,
    faqPresence: 5,
  },
  liveAiCitation: {
    brandRecall: 15,
    domainCitationRate: 20,
    descriptionAccuracy: 10,
  },
  thirdPartyCorroboration: {
    externalPresence: 20,
  },
} as const;
```

---

## Import Aliases

Always use the `@/` alias — never use relative imports that go up more than one level.

```typescript
// Correct
import { ScoreHero } from "@/components/audit/ScoreHero";
import { POINTS } from "@/lib/utils";

// Never
import { ScoreHero } from "../../../components/audit/ScoreHero";
```

---

## Comments

- No comments explaining what the code does — code must be self-explanatory
- Comments only for why — especially for scoring thresholds and effort/impact mappings that encode a judgment call, since those judgment calls need to be defensible in the README
- Never leave TODO comments in committed code — if it's deferred, it belongs in build-plan.md or the README's "what's next" section, not a code comment

---

## Dependencies

Never install a new package without a clear reason. Before installing anything check:

1. Does shadcn/ui already have this component?
2. Does Next.js already provide this functionality?
3. Is there a simpler native solution?

Approved dependencies for this project:

- `cheerio` — HTML parsing for scraping
- `zod` — schema validation for all external/untrusted data
- `@react-pdf/renderer` — PDF report generation
- `framer-motion` — score reveal, staggered findings entrance, all purposeful UI motion
- `lucide-react` — icons
- `tailwindcss` — styling
- `shadcn/ui` components — UI primitives
- `nanoid` — audit id generation

No AI provider SDK is installed — Gemini is called via plain `fetch` in `lib/gemini.ts` (see
library-docs.md). This keeps the dependency footprint minimal and avoids an SDK version treadmill for
a single, narrow usage pattern.

Do not install any other packages without updating this list first. In particular: no Playwright/
Puppeteer for scraping (static fetch + cheerio is sufficient for the target businesses and keeps setup
under the 5-minute run requirement), no database driver, no auth library, no `openai`/`@anthropic-ai`/
`perplexity` SDKs.
