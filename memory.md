# Memory — Phase 3 (Features 04 + 05)

Last updated: 2026-08-05

## What was built

- `src/lib/robots.ts` (new) — `fetchRobotsTxt(origin)` (8s abort, GEOAuditorBot UA; non-OK/timeout → null) + `parseAiCrawlerText` (per-`User-agent` block parsing for `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `CCBot`; only `Disallow: /` counts as a block; `User-agent: *` `Disallow: /` → blockedAll).
- `src/lib/pipeline/structuralAnswerability.ts` — now has two checkers: `checkAiCrawlerAccess(robotsTxt)` and `checkSchemaPresence(pages)`, plus `runStructuralAnswerability(origin, pages)` pillar builder. Schema detection handles JSON-LD arrays, `@graph`, string/array `@type`, and a curated `LOCAL_BUSINESS_SUBTYPES` set (exact matches only, avoids `BusinessEvent`-style false positives).
- `src/lib/pipeline/runAudit.ts` — real structural pillar (04 + 05) replaces the mock; passes `scrapedPages` into the pillar builder.
- `src/lib/pipeline/mocks.ts` — split into `getMockLiveAiCitation` + `getMockThirdPartyCorroboration`; the structural mock was deleted outright (no dead mock path remains, per code-structure.md).
- `src/lib/pipeline/fixes.ts` — added `schema-presence` copy-paste `<script type="application/ld+json">` block.
- `context/progress-tracker.md` — Phase 3 now 2 of 4 features done; Next = 06 Direct-Answer Clarity.

## Decisions made

- Feature 04 scoring: missing robots.txt → 10/10 pass (`absence` evidence); some bots blocked → 5; all blocked (`*` `Disallow: /`) → 0. Evidence is the exact matching robots.txt lines as `code`.
- Feature 05 scoring: schema complete (`name` + `description` populated) → 10 pass; present-but-sparse → 5 warning; absent → 0 critical with `absence` note carrying the recommended LocalBusiness snippet.
- `checkSchemaPresence` scans **all** scraped pages (homepage + About/FAQ), not just the homepage — a business-identity block on an About page still counts.
- Followed library-docs.md robots parser pattern verbatim, extended to also return the relevant block lines for evidence. One deliberate choice: only `Disallow: /` is treated as blocking; `Allow: /` overriding a `Disallow: /` in the same block is not handled (matches the documented pattern, real-world rare).

## Problems solved

- Feature 04 parser verified against 10 fixtures; Feature 05 schema checker against 11 fixtures (arrays, `@graph`, sparse, empty name/desc, multi-page source, `BusinessEvent` false-positive guard). All pass.
- Reviewer-style pass on both features found no functional bugs. Minor cleanup applied for 04: removed the now-dead structural mock from `mocks.ts`.
- No UI components built → `/imprint` no-op for both features.

## Current state

- Phases 1–2 and Phase 3 features 04 + 05 complete. Pillars B (live AI citation) and C (third-party) still mock via `getMockLiveAiCitation`/`getMockThirdPartyCorroboration`.
- The 1800ms `analyzing` sleep in `runAudit` stays until all four structural checkers (04–07) are real.
- lint + build green on `main`.

## Next session starts with

- **Feature 06 — Direct-Answer Clarity Check**: take homepage `rawTextExcerpt`, send to Gemini (plain JSON mode, no grounding) with the library-docs.md rubric prompt; model returns `{ hasDirectAnswer, extractedSentence, reasoning }`; deterministic scoring in code (10 binary / 0); `quote` evidence. Requires `lib/gemini.ts` (`geminiJson` per library-docs.md) + zod schema (library-docs zod section). Wire into `runStructuralAnswerability(origin, pages)` — note it will need the homepage text, so the signature may grow.
- Then 07 FAQ Presence (FAQPage schema OR question-style headings).
- Also still pending: live E2E smoke test of the full flow on a real site (a normal `npm run dev` + browser, no raw terminal commands).

## Open questions

- None blocking. `gemini-2.0-flash` model name/endpoint should be re-verified against Google's docs when Feature 06 lands, per library-docs.md.
