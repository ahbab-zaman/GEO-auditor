# Memory — Phase 4 (Pillar B) Complete

Last updated: 2026-08-05

## What was built

- `src/lib/pipeline/liveAiCitation.ts` — **Pillar B fully real**:
  - `runLiveAiCitation(businessName, url, pages)` — generates queries, runs them grounded, scores all three checks.
  - `generateQueries` (geminiJson, temp 0.3, zod `QueryGenerationSchema`) — 2 category + 2 direct queries; category/location inferred from scraped homepage excerpt; falls back to 4 template queries on malformed/too-few output.
  - Each query → `geminiGroundedQuery` in a **sequential `for`+`await` loop** (never Promise.all — free-tier rate limit). Per-query failure logged and skipped; all-fail → pillar `unavailable`.
  - `brand-recall` (/15): fraction of category answers mentioning businessName (substring, case-insensitive) → scaled.
  - `domain-citation-rate` (/20): fraction of queries whose resolved citations include the business's own normalized domain → scaled.
  - `description-accuracy` (/10): per mentioned query, `gradeDescriptionAccuracy` (geminiJson, temp 0, zod `DescriptionAccuracySchema`) comparing answer vs homepage → average → 10/5/0; brand never mentioned → 0 critical; all grades fail → check `unavailable`.
  - Evidence: `citations` per check (query + verbatim answerText + resolved citedUrls + businessCited).
- `src/lib/gemini.ts` — added `normalizeHostname(hostname)` (strip www + lowercase) and `resolveCitationUrl(uri, cache)` (HEAD + follow redirects, in-memory cache Map, raw-URI fallback on failure).
- `src/schemas/audit.ts` — added `DescriptionAccuracySchema` ({ consistent: boolean, contradictions: string[] }).
- `src/lib/pipeline/runAudit.ts` — Pillar B now real: `await runLiveAiCitation(...)` replaces `getMockLiveAiCitation`.
- `src/lib/pipeline/mocks.ts` — `getMockLiveAiCitation` deleted outright; only `getMockThirdPartyCorroboration` remains (Pillar C).

## Decisions made

- Citation URLs stored as **resolved final URLs** (HEAD-followed), not raw `vertexaisearch.cloud.google.com` redirects — EvidenceBlock renders clean domain pills.
- Description accuracy graded per mentioned query, averaged, then tiered 10/≥0.99, 5/≥0.5, 0 otherwise. No mentioned query → 0 critical ("absent"), matching build-plan's "materially wrong or absent".
- Accuracy grading loop also sequential (JSON-mode calls still eat quota).
- Query-gen fallback category queries embed the business name ("best {name} service near me") — a fallback, never a primary path; beats failing the pillar.

## Problems solved

- Phase 4 verified against **6 stubbed-fetch fixtures** in `C:\Users\DELL\AppData\Local\Temp\opencode\live-ai-test.mjs` (full pass 45, partial scaling, template fallback, all-grounded-fail unavailable, brand-absent critical, grade-fail unavailable) — all pass. Run with: `node --loader file:///C:/Users/DELL/AppData/Local/Temp/opencode/alias-loader.mjs --experimental-strip-types ...\live-ai-test.mjs`.
- Node TS alias loader on Windows: `--loader` + file URL works; `--import` needed a `register()` call which Node 22.18 rejects. Use the plain `--loader file:///...` form.
- First build failed with a stale `.next` cache `/_document` error — cleared `.next`, clean build green.

## Current state

- **Phases 1–4 complete.** Pillars A (35) + B (45) are 100% real. Pillar C (Third-Party, 20) still mocked via `getMockThirdPartyCorroboration`.
- lint + build green on `main`.
- No UI built this session → `/imprint` no-op for Phase 4.
- `.env.local` has a real `GEMINI_API_KEY` set (live calls possible).

## Next session starts with

- **Phase 5 — Feature 11 Third-Party Corroboration**: build `lib/pipeline/thirdPartyCorroboration.ts` — one grounded query "What do people say about [businessName] ([url])? Cite your sources.", parse+resolve `citedUrls` (reuse `normalizeHostname`/`resolveCitationUrl` + shared cache), filter out the business's own domain, count distinct external domains → 20 if 3+, 10 if 1–2, 0 if none; `citations` evidence. Then replace the Pillar C mock in `runAudit`.
- Then Phase 6 (12 verdict, 13 score aggregation — mostly done, 14 fixes polish), Phase 7 (UI real-data pass + PDF), Phase 8 (3–5 real businesses + README + demo).
- **Still pending:** live E2E smoke test on a real site (now that Pillar B is real, run once with real Gemini to see real citations).

## Open questions

- None blocking. Per library-docs.md, re-verify the `gemini-2.0-flash` model/endpoint against Google's docs when the live Gemini path is exercised.
