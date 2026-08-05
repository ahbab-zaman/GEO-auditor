# Memory — Phases 5–6 Complete + Phase 7 UI Update

Last updated: 2026-08-06

## What was built

- **Phase 5 — `src/lib/pipeline/thirdPartyCorroboration.ts`** (Pillar C fully real):
  - `runThirdPartyCorroboration(businessName, url)` — one grounded query `"What do people say about [businessName] ([url])? Cite your sources."`
  - Resolves citations via shared `resolveCitationUrl` cache, dedupes, filters own domain; `RESOLVER_TRAMPOLINES = ["vertexaisearch.cloud.google.com", "vertexaisearch.googleapis.com"]` dropped from count + evidence (fixes score inflation).
  - Scores `external-presence` /20: 20 if 3+ external domains, 10 if 1–2, 0 if none. Evidence: `citations` or `absence` when none. Query failure → pillar `unavailable`.
  - `mocks.ts` **deleted outright** — zero mocks left anywhere.
- **Phase 6 — `src/lib/pipeline/verdict.ts`** (Feature 12): `generateVerdict(businessName, pillars)` via `geminiJson` (temp 0.3) + zod `VerdictSchema`; runs after all pillars; per-pillar findings in prompt (total-invisibility safe); nullable — failure returns `null`, never blocks. Replaces the old hardcoded string in `runAudit`.
- **Phase 6 — fixes polish** (Feature 14): `TITLE_BY_CHECK_ID` + `EXPLANATION_BY_CHECK_ID` for all 8 check ids in `fixes.ts` — real plain-language business-owner copy replaces the placeholder.
- **Phase 7 UI update** (from changed ui-tokens/ui-rules/build-plan 15):
  - `globals.css` — added `--shadow-card` (0 1px 3px rgba(0,0,0,.06)), `--shadow-card-hover` (0 2px 6px), and `--animate-breathe` keyframe.
  - `VerdictBanner` — borderless `bg-surface-secondary`, `text-[30px] font-semibold leading-[42px] text-text-primary`, no severity tint, py-8.
  - `ScoreHero` — now client component, borderless, 180px SVG ring (10px stroke, `stroke-border-light` track, `text-pass/warning/critical stroke-current` fill, round linecap), 68px number, single 450ms ease-out count-up via `useCountUp` (skips on `prefers-reduced-motion`).
  - `ProgressState` — lucide stage icon `h-8 w-8 text-text-muted animate-breathe`; spinner ring + percentage removed.
  - `FindingCard` — severity badges show text labels "Pass"/"Needs work"/"Critical" (never color alone); unavailable check uses `CircleSlash` muted icon; `shadow-card` + `hover:shadow-card-hover`.
  - `EvidenceBlock` — "Your site: not cited" `critical-light` pill rendered FIRST when `ownDomain` absent; answerText now quote-style `border-l-2 pl-3 text-[13px] italic`.
  - `PillarBreakdown` — unavailable pillar gets muted `CircleSlash` icon + reason.
  - `FixCard` — copied feedback 2000ms → 1500ms; card shadow/hover.
  - Landing `app/page.tsx` — 3 steps (Globe/MessageCircle/BarChart3) with muted icons below the form.
  - `ui-registry.md` — rewritten to reflect all new patterns.
- Test harnesses in `C:\Users\DELL\AppData\Local\Temp\opencode\`: `third-party-test.mjs` (8 fixtures), `phase6-test.mjs` (11 fixtures), `e2e-live.mjs`, `scrape-test.mjs`, `live-single.mjs`, `live-raw.mjs`, alias loader `geoalias-loader.mjs` (points at `D:/GEO_Audit/src`).

## Decisions made

- Unresolved Google grounding redirect hosts (`vertexaisearch.*`) must never count as third-party domains — real score-inflation bug (2 externals + 1 failed resolve would have jumped 10 → 20).
- Severity is never color alone — every badge pairs a visible text label.
- Only two scale-contrast moments on the page: verdict (30px) + score (68px). Only one motion on page load: score count-up. Progress pulse is the only loop.
- Verdict is nullable; a failed/slow verdict call never blocks the report.

## Problems solved

- **AI provider swapped Gemini → OpenRouter** (this session): `lib/gemini.ts` now calls OpenRouter `chat/completions` with `Authorization: Bearer $OPENROUTER_API_KEY`. `qwen/qwen3-coder:free` was **delisted (404)**, so config now uses the faster `openai/gpt-oss-20b:free` (qwen3-next-80b was the previous pick — slower), and calls **auto-rotate through `MODEL_FALLBACKS` on 404** so a delisted free slug never breaks a run again.
- **Citation pillars now use Tavily** (this session, Option 1): free OpenRouter models can't do web search, so `geminiGroundedQuery` queries **Tavily** (`TAVILY_API_KEY`, free ~1,000 req/mo) for real result URLs, then has the free OpenRouter model synthesize an answer citing them → returns those URLs as citations. Without `TAVILY_API_KEY` it falls back to OpenRouter's paid `web` plugin (online-capable models only), else Pillar B/C report `unavailable`.
- **Speed/UX on the "Asking a real AI" stage** (this session): that stage runs 4 Tavily+LLM round-trips; OpenRouter **free-tier is queued** so first token takes 10–25s/call (code itself is instant). Added **bounded concurrency** (limit 4) to the live-query loop and the description-accuracy grading loop in `liveAiCitation.ts` (was fully serial `for + await`), and a **hard 90s wall-clock budget** (`withDeadline` wrapping `runLiveAiCitation` in `runAudit.ts`) so the audit ALWAYS completes within a defined time — a runaway/slow stage resolves to a timed-out `unavailable` pillar with 0 points rather than making owners wait indefinitely.
- Stale `.next` cache causes `TypeError: a[d] is not a function` prerender errors on `/` — clear `.next` and rebuild (recurring, known).
- Node TS alias loader: plain `--loader file:///...` form; never `--import`.

## Current state

- **Phases 1–7 functionally complete** (PDF export exists: `ReportPdf.tsx` + `GET /api/audit/[id]/pdf` + Download PDF button). `components/motion/variants.ts` is the only referenced-but-unconfirmed file.
- This session enhanced `ReportPdf.tsx`'s score block to mirror the web `ScoreHero` exactly (prominent business name, big score on the 100-scale, per-pillar progress bars) — it had previously only shown a bare "Overall score" line.
- All three pillars (A 35 + B 45 + C 20) + verdict + fixes are 100% real. Zero mocks.
- lint + build green on `main` (build required `.next` clear this session).
- `.env.local` has a real `OPENROUTER_API_KEY` with `OPENROUTER_MODEL=openai/gpt-oss-20b:free` (no Gemini key anymore; `TAVILY_API_KEY=` placeholder present).

## Next session starts with

- **Phase 7 — Feature 16 PDF Export**: build `components/audit/ReportPdf.tsx` (@react-pdf/renderer, light print-friendly palette per ui-rules, severity as visible text labels not color alone, mirrors hero → pillar → findings → fixes hierarchy, copy-paste snippets as plain text blocks) + wire `GET /api/audit/[id]/pdf` route (currently 501 stub) via `renderToBuffer`. Library pattern in `context/library-docs.md`.
- Then Phase 8 (3–5 real businesses + README + demo; pick with intent per build-plan 17, record in progress-tracker Business Selection table).
- **Still pending:** live E2E smoke test on OpenRouter free (expect Pillar A real, Pillar B/C `unavailable` until a web-capable paid model is set).

## Open questions

- None blocking. When a paid web-capable OpenRouter model is set, verify the `web` plugin citation shape against OpenRouter's current docs.
