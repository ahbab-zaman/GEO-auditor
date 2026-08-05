# Progress Tracker

Update this file after every completed feature. Any AI agent reading this should immediately know what
is done, what is in progress, and what is next.

---

## Current Status

**Phase:** Phase 6 — Scoring + Fixes (COMPLETE — 12–14 done)
**Last completed:** 14 Fix Generation polish + pending work (per-check fix explanations)
**Next:** Phase 7 — Report UI Polish + PDF (15 real-data pass, 16 PDF export)

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
- [x] 06 Direct-Answer Clarity Check
  - [x] `checkDirectAnswerClarity(homepageText)` in `structuralAnswerability.ts` — homepage `rawTextExcerpt` (first 1500 chars) → `geminiJson` (temp 0) with library-docs rubric prompt
  - [x] Result zod-validated via `DirectAnswerExtractionSchema` (schemas/audit.ts); binary 10/0 scoring in code
  - [x] Evidence: `quote` of `extractedSentence` (pass) or the actual opening text (fail); API failure → `unavailable` with human-readable reason
  - [x] `runStructuralAnswerability` now runs 04 + 05 + 06; verified against 6 fixtures (stubbed fetch: failure, success, fences, no-answer, null-sentence, malformed shape) — all pass
- [x] 07 FAQ Presence Check
  - [x] `checkFaqPresence(pages)` in `structuralAnswerability.ts` — FAQPage schema (arrays/@graph handled) OR question-style headings; 5 / 0 scoring; `quote` evidence of first Q&A pair, `absence` when none
  - [x] `ScrapedPage` gained a `headings: string[]` field, populated in `scrape.ts` (`h1–h6` extraction)
  - [x] `runStructuralAnswerability` now runs all four checks 04–07; verified against 8 fixtures — all pass
- [x] **Phase 3 complete — Pillar A (Structural Answerability) is fully real.** Removed the 1800ms analyzing `sleep` from `runAudit` (it only simulated the mock structural pillar). `getMockPillarResults` fully deleted; only Pillars B + C remain mocked.

### Phase 4 — Live AI Citation Test (Pillar B)

- [x] 08 Gemini Client
  - [x] `lib/gemini.ts` — `geminiJson` + `geminiGroundedQuery` already existed (feature-03 era); added `normalizeHostname(hostname)` and cache-backed `resolveCitationUrl(uri, cache)` (HEAD + follow redirects; falls back to raw URI hostname on failure) per library-docs.md
- [x] 09 Query Generation + Execution
  - [x] `lib/pipeline/liveAiCitation.ts` — `runLiveAiCitation(businessName, url, pages)`:
  - [x] `generateQueries` (geminiJson, temp 0.3, zod `QueryGenerationSchema`; falls back to 4 template queries if malformed/<3) — category + direct mix, category/location inferred from scraped homepage text
  - [x] Each query run via `geminiGroundedQuery` in a sequential `for`+`await` loop (never Promise.all — free-tier rate limit); redirect citation URLs resolved to real URLs via the shared `resolveCitationUrl` cache; per-query failure logged and skipped, never crashes the run
  - [x] All queries failing → pillar `status: unavailable` with a human-readable reason; query-generation failure → template fallback keeps the pillar running
- [x] 10 Brand Recall + Citation Rate + Accuracy Scoring
  - [x] `brand-recall` (/15): fraction of category queries whose `answerText` mentions the business name → scaled
  - [x] `domain-citation-rate` (/20): fraction of all queries whose resolved citations include the business's own normalized domain → scaled
  - [x] `description-accuracy` (/10): per mentioned query, geminiJson grade (zod `DescriptionAccuracySchema`) comparing answer vs homepage text → average → 10/5/0; brand never mentioned → 0 critical ("absent"); all grades fail → check `unavailable`
  - [x] Evidence: `citations` type per check (query + verbatim answerText + resolved citedUrls + businessCited)
  - [x] Verified against 6 stubbed-fetch fixtures (full pass 45, partial scaling, template fallback, all-grounded-fail unavailable, brand-absent critical, grade-fail unavailable) — all pass
- [x] **Phase 4 complete — Pillar B (Live AI Citation Test) is fully real.** `getMockLiveAiCitation` deleted from `mocks.ts`; `runAudit` now calls `runLiveAiCitation`. Only Pillar C remains mocked (`getMockThirdPartyCorroboration`).

### Phase 5 — Third-Party Corroboration (Pillar C)

- [x] 11 External Presence Check
  - [x] `lib/pipeline/thirdPartyCorroboration.ts` — `runThirdPartyCorroboration(businessName, url)`:
  - [x] One grounded query `"What do people say about [businessName] ([url])? Cite your sources."` via `geminiGroundedQuery`
  - [x] Every citation resolved via the shared `resolveCitationUrl` cache (HEAD + follow redirects); deduped
  - [x] `RESOLVER_TRAMPOLINES = ["vertexaisearch.cloud.google.com", "vertexaisearch.googleapis.com"]` — unresolved Google grounding redirect hosts are dropped from the count AND evidence so they can never inflate the external-domain tier (fixes a real score-inflation bug found during fixture testing)
  - [x] Own domain filtered out (business's own site never counts as third-party); remaining distinct external domains counted
  - [x] Scoring: 20 if 3+ external domains, 10 if 1–2, 0 if none; severity pass/warning/critical via same `severityFor` pattern as Pillar B
  - [x] Evidence: `citations` (query + verbatim answerText + resolved citedUrls + businessCited) when externals found; `absence` evidence when none; grounded-query failure → pillar `unavailable` with human reason
  - [x] `runAudit.ts` — `await runThirdPartyCorroboration(...)` replaces the mock
  - [x] **`mocks.ts` deleted outright** — no mocks remain anywhere in the codebase
  - [x] Verified against 8 stubbed-fetch fixtures (3+ externals, 1–2, single, own-only, empty, dedupe+filter, trampoline-not-inflating, query-fail unavailable) — all pass

### Phase 6 — Scoring + Fixes

- [x] 12 Verdict Generation
  - [x] `lib/pipeline/verdict.ts` — `generateVerdict(businessName, pillars)` via `geminiJson` (temp 0.3), zod `VerdictSchema`
  - [x] Runs strictly after all three pillars complete (called on finished `pillars` array in `runAudit`, never before)
  - [x] Prompt sends per-pillar findings (not just the total score) and explicitly requires business-specific language even at near-zero scores — total-invisibility case covered per build-plan 17
  - [x] Nullable: any failure (API error, malformed/wrong-shape JSON) returns `null`, never throws, never blocks the report; `VerdictBanner` renders nothing when null
  - [x] `runAudit.ts` — hardcoded verdict string replaced with the real generator
  - [x] Verified against 3 stubbed fixtures (success, API failure → null, malformed shape → null) — all pass
- [x] 13 Score Aggregation
  - [x] `lib/pipeline/score.ts` — pure `computeScore(pillars)` already existed and is correct: sums per-pillar `pointsEarned`/`pointsPossible`; no external calls; `maxTotal` 100; unavailable pillars earn 0 but still count in the denominator
- [x] 14 Fix Generation
  - [x] `lib/pipeline/fixes.ts` — one fix per non-pass check; `impact` from `pointsPossible` (≥15 → high, else medium); `effort` from `EFFORT_BY_CHECK_ID` lookup; `priorityScore` = impact÷effort; sorted desc; `copyPasteContent` only for literal snippets
  - [x] **Polish:** placeholder explanations replaced with real per-check `TITLE_BY_CHECK_ID` + `EXPLANATION_BY_CHECK_ID` for all 8 check ids (plain-language, business-owner-facing)
  - [x] Verified against stubbed fixtures (fix count, sort order, unique ids, copy-paste presence, impact mapping) — all pass
- [x] **Phase 6 complete — Scoring + Fixes fully real.** All three pillars (A 35 + B 45 + C 20) and the verdict are now 100% real. Zero mocks in the codebase.

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
- Phases 5 & 6 (post-memory): Pillar C + verdict + real fix explanations all built. `mocks.ts` deleted.
- **Live E2E smoke test (real Gemini, `mozilla.org`):** full pipeline mechanics verified end-to-end in
  ~3s — scrape → Pillar A real scoring (15/100: ai-crawler-active 10/10 from Mozilla's real robots.txt,
  schema 0/10, faq 5/5) → score → fixes → persist → status complete. Every Gemini-backed check returned
  429 this run and degraded to `unavailable` with a human reason (as designed — the build-plan 17
  "free-tier rate limit" edge case handled correctly). However, the `.env.local` key's **daily free-tier
  quota is exhausted** (`limit: 0` on `generate_content_free_tier_requests`, persisted across 60s+), so
  the live *answer/citation* path (Pillar B/C scoring, verdict) could not be exercised. Run
  `e2e-live.mjs` again after the quota resets (or with a fresh key) to see real citations. Harness:
  `C:\Users\DELL\AppData\Local\Temp\opencode\e2e-live.mjs`.
