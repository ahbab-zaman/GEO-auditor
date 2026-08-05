# Memory — Phase 5 (Pillar C) Complete

Last updated: 2026-08-06

## What was built

- `src/lib/pipeline/thirdPartyCorroboration.ts` — **Pillar C fully real**:
  - `runThirdPartyCorroboration(businessName, url)` — one grounded query: `"What do people say about [businessName] ([url])? Cite your sources."`
  - Resolves every citation via `resolveCitationUrl` (shared cache, HEAD-follow), dedupes, filters out the business's own domain.
  - `RESOLVER_TRAMPOLINES = ["vertexaisearch.cloud.google.com", "vertexaisearch.googleapis.com"]` — unresolved Google grounding redirect hosts are dropped from the count + evidence so they can never inflate the external-domain tier.
  - Scores `external-presence` (/20): 20 if 3+ distinct external domains, 10 if 1–2, 0 if none; severity pass/warning/critical from the same `severityFor` helper used by Pillar B.
  - Evidence: `citations` (query + verbatim answerText + resolved citedUrls + businessCited) when externals found; `absence` evidence when none.
  - Grounded-query failure → pillar `unavailable` with human reason.
- `src/lib/pipeline/runAudit.ts` — `await runThirdPartyCorroboration(analyzing.businessName, analyzing.url)` replaces `getMockThirdPartyCorroboration`.
- `src/lib/pipeline/mocks.ts` — **deleted outright** (was the last mock; no mocks remain anywhere).
- Test harness `C:\Users\DELL\AppData\Local\Temp\opencode\third-party-test.mjs` + alias loader `geoalias-loader.mjs` (points at `D:/GEO_Audit/src` — the old `alias-loader.mjs` points at a different project). Run: `node --loader file:///C:/Users/DELL/AppData/Local/Temp/opencode/geoalias-loader.mjs --experimental-strip-types ...\third-party-test.mjs`.

## Decisions made

- Unresolved `vertexaisearch.cloud.google.com` redirect citations must never count as a third-party domain — this fixes a real score-inflation bug (2 external domains + 1 failed resolve would have jumped 10 → 20).
- Pillar C evidence keeps the own-domain pill when the AI cited it (highlighted via `EvidenceBlock`'s `ownDomain` prop) — parity with Pillar B's evidence; `citations` shows all resolved urls, externals counted separately.

## Problems solved

- **Score-inflation bug:** Google grounding URIs that fail HEAD-resolution fall back to the raw redirect host in `resolveCitationUrl`; counting that host as "external" inflated the tier. Fixed by filtering trampoline hostnames before counting and before storing evidence.
- Node TS alias loader quirk already known — plain `--loader file:///...` form, never `--import`.

## Current state

- **Phases 1–5 complete.** Pillars A (35) + B (45) + C (20) are all **100% real — zero mocks left in the codebase** (`mocks.ts` deleted).
- lint + build green on `main`. 8 stubbed-fetch fixtures for Pillar C all pass.
- `.env.local` has a real `GEMINI_API_KEY` set.
- UI untouched this session → `/imprint` no-op again.

## Next session starts with

- **Phase 6 — Scoring + Fixes**: (12) build `lib/pipeline/verdict.ts` — after all three pillars complete, send a compact findings summary to Gemini (JSON mode) for one blunt plain-language sentence; stored on `Audit.verdict` (nullable — failure never blocks the report); must be checked against the total-invisibility case (build-plan 17). Currently `runAudit.ts:113` still sets a **hardcoded generic verdict string** — replace it with the real generator. (13) `computeScore` already exists/used in `runAudit` — verify pure + unit-testable. (14) `deriveFixes` already exists — verify per check, severity, impact/effort/priority mapping.
- Then Phase 7 (real-data UI pass + PDF), Phase 8 (3–5 real businesses + README + demo).
- **Still pending:** live E2E smoke test on a real site (run once with real Gemini now that all three pillars are real).

## Open questions

- None blocking. Per library-docs.md, re-verify the `gemini-2.0-flash` model/endpoint against Google's docs when the live Gemini path is exercised.
