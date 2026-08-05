# Progress Tracker

Update this file after every completed feature. Any AI agent reading this should immediately know what
is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 3 — Structural Answerability (05 complete)
**Last completed:** 05 Schema.org Presence Check
**Next:** 06 Direct-Answer Clarity Check

---

## Progress

### Phase 1 — Foundation

- [x] 01 Project Skeleton + Types
- [x] 02 Input → Mock Pipeline → Report Shell
  - [x] Landing form (`AuditForm.tsx`) POSTs to `/api/audit`
  - [x] `POST /api/audit` creates a pending Audit, fires `runAudit()` fire-and-forget
  - [x] Mock pipeline lives in `lib/pipeline/mocks.ts` (`getMockPillarResults`), clearly named per code-structure.md
  - [x] `runAudit.ts` orchestrates stages, sleeps between them, writes final Audit to disk
  - [x] `GET /api/audit/[id]` reads from disk; report page polls every 1.5s
  - [x] `score.ts` (pure `computeScore`) and `fixes.ts` (`deriveFixes`) implemented
  - [x] Report shell: verdict banner, score hero + pillar bars, findings grouped by pillar, fixes sorted by priorityScore
  - [ ] Report UI polish (motion, unavailable-state render pass) deferred to feature 14

> **Scope note:** Feature 02 is functionally complete — the full input → progress → report → disk flow was
> smoke-tested end to end. The motion/polish pass belongs to feature 14 per build-plan.md and is intentionally
> not part of Phase 1.

### Phase 2 — Real Scraping

- [x] 03 Scrape Stage
  - [x] `lib/pipeline/scrape.ts` — `scrapeSite(url)` fetches homepage with browser-like UA, 8s abort timeout
  - [x] Extracts title, visible text (script/style/nav/footer/noscript stripped), JSON-LD blocks, same-origin About/FAQ links
  - [x] Fetches up to 2 linked About/FAQ pages (hard cap of 3 pages total); malformed JSON-LD and sub-page fetch failures skipped individually, never crash the run
  - [x] `runAudit.ts` — sets status `scraping`, runs `scrapeSite`, saves `scrapedPages` to disk before `analyzing`
  - [x] Homepage fetch failure fails the whole audit with a specific error: "Could not reach this website — check the URL and try again."
  - [ ] Live smoke-test of the E2E flow on a real site deferred until Phase 3 (dev server verification skipped this session per user instruction)

### Phase 3 — Structural Answerability (Pillar A)

- [x] 04 AI Crawler Access Check
  - [x] `lib/robots.ts` — `fetchRobotsTxt(origin)` (8s abort, UA; non-OK/timeout → null) + `parseAiCrawlerText` (per-agent blocks for `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `CCBot`; only `Disallow: /` counts as a block)
  - [x] `lib/pipeline/structuralAnswerability.ts` — `checkAiCrawlerAccess(robotsTxt)` + `runStructuralAnswerability(origin)` pillar builder
  - [x] Scoring: missing robots.txt → 10/10 pass (`absence` evidence); none blocked → 10; some blocked → 5; `User-agent: *` `Disallow: /` → 0 (critical); evidence = exact matching robots.txt lines as `code`
  - [x] `runAudit.ts` — real structural pillar replaces the mock; `mocks.ts` split into `getMockLiveAiCitation` + `getMockThirdPartyCorroboration`, structural mock deleted
  - [x] Parser verified against 10 hand-built fixtures (block-all, per-bot, partial paths, case-insensitivity, unrelated bots) — all pass
- [x] 05 Schema.org Presence Check
  - [x] `checkSchemaPresence(pages)` in `structuralAnswerability.ts` — scans all scraped pages' `jsonLdBlocks` (handles arrays, `@graph`, `@type` string/array) for `Organization` / `LocalBusiness` / curated subtype
  - [x] Scoring: complete (`name` + `description`) → 10 pass; present but sparse → 5 warning; absent → 0 critical with `absence` evidence carrying the recommended LocalBusiness snippet
  - [x] `runStructuralAnswerability(origin, pages)` now runs both 04 + 05 checks; `runAudit` passes `scrapedPages`
  - [x] `fixes.ts` — added `schema-presence` copy-paste `<script type="application/ld+json">` block
  - [x] Verified against 11 hand-built fixtures (arrays, @graph, sparse, empty strings, multi-page, BusinessEvent false-positive) — all pass
- [ ] 06 Direct-Answer Clarity Check
- [ ] 07 FAQ Presence Check

### Phase 4 — Live AI Citation Test (Pillar B)

- [ ] 08 Gemini Client
- [ ] 09 Query Generation + Execution
- [ ] 10 Brand Recall + Citation Rate + Accuracy Scoring

### Phase 5 — Third-Party Corroboration (Pillar C)

- [ ] 11 External Presence Check

### Phase 6 — Scoring + Fixes

- [ ] 12 Score Aggregation
- [ ] 13 Fix Generation

### Phase 7 — Report UI Polish + PDF

- [ ] 14 Report UI — Real Data Pass
- [ ] 15 PDF Export

### Phase 8 — Real-World Validation

- [ ] 16 Run Against 3–5 Real Businesses
- [ ] 17 README + Demo Video

---

## Decisions Made During Build

- **Layout: `/src` (not root-level `app/`/`lib/`).** AGENT.md is the entry point and describes a `/src`
  layout with `@/*` → `./src/*`. Some older context files (`architecture.md`, `code-structure.md`) still
  reference root-level `app/`, `lib/`, `types/` — stale. Followed AGENT.md. Old context paths should be
  updated as they're touched.
- **Scaffolded by hand, not `create-next-app`.** Working dir is `D:\Task Assessment` (space + invalid npm
  package name), so `create-next-app .` would fail name validation. `package.json` name is `geo-auditor`.
- **Next.js pinned `15.5.22`** (latest patched 15.5.x) instead of the initially-picked 15.1.4, which has a
  known CVE. Not moving to Next 16 (docs target Next 15; forced major = breaking). Remaining `npm audit`
  highs are transitive (bundled `postcss`, optional `sharp`) only used by `next/image`, which this tool
  doesn't use — left as-is.
- **ESLint flat config** (`eslint.config.mjs`) instead of `next lint`, which is deprecated in Next 15 and
  prompts interactively. `npm run lint` → `eslint .`. `eslint-config-next@15` to match `next@15`.
- **Next.js 15 async-params pattern.** `GET /api/audit/[id]` and `/pdf` `await params`. The `/audit/[id]`
  page is a Client Component (it polls), so it reads the id via `useParams()` rather than awaiting params.

---

## Business Selection (build-plan 17)

_Record the three real businesses chosen for the final submission as soon as they're picked, and why
each one was chosen — this is itself a product decision per build-plan.md's selection criteria
(one low-visibility, one higher-visibility, one different category/size), not an arbitrary pick._

| # | Business | Category | Why chosen |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |

---

## Notes

- Phase 1 `/review` found an own-domain highlight bug in `EvidenceBlock.tsx` (a pill's domain was compared
  against itself, so the accent "own domain" pill rendered for every pill whenever `businessCited` was
  true). `/recover` (Failure Mode 1) fixed it by threading an `ownDomain` prop from the report page through
  `PillarBreakdown → FindingCard → EvidenceBlock`, derived from `audit.url`. Verified: lint + build pass.
- Feature 03 follows the library-docs.md cheerio patterns verbatim (fetchPage, extractVisibleText,
  extractJsonLd, findLinkedPages). One deviation from the docs snippet: `findLinkedPages` also skips
  anchor/self-links by comparing `resolved.pathname` to the homepage pathname and dedupes by full URL —
  prevents re-fetching the homepage via `#faq`-style in-page anchors. Sub-page fetch failures log with
  `[pipeline/scrape]` prefix and are skipped; only the homepage failure fails the audit.
- `runAudit` no longer sleeps during the scraping stage — the real scrape replaced the 1600ms mock delay.
  The 1800ms analyzing delay remains until real pillar checkers (features 04–07) replace the mocks.
- Feature 04: the real structural pillar replaced the mock. `mocks.ts` now exports only
  `getMockLiveAiCitation` and `getMockThirdPartyCorroboration` — the structural mock was deleted outright
  (per code-structure.md's labeling rule, no dead mock path remains).
- Feature 04 review: no functional bugs. Minor cleanup applied — mock structural pillar removed from
  `mocks.ts`, `runAudit` uses `getMockLiveAiCitation`/`getMockThirdPartyCorroboration` directly.
