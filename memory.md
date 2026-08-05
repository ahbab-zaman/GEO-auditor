# Memory — Phase 2 (Feature 03 Scrape Stage)

Last updated: 2026-08-05

## What was built

- `src/lib/pipeline/scrape.ts` (new) — `scrapeSite(url)`: fetches homepage with browser-like UA and 8s abort timeout, extracts title / visible text (`script, style, nav, footer, noscript` stripped, 2000-char excerpt) / JSON-LD blocks / same-origin About+FAQ links; fetches ≤2 linked pages (hard cap 3 total). Malformed JSON-LD and sub-page fetch failures skipped individually.
- `src/lib/pipeline/runAudit.ts` — real scrape wired into the pipeline: status `scraping` → `scrapeSite` → save `scrapedPages` to disk → `analyzing`. Homepage fetch failure fails the whole audit with "Could not reach this website — check the URL and try again."
- `context/progress-tracker.md` — Phase 2 marked complete; Next = Phase 3, feature 04.
- Committed: `d4fd796` — `feat(phase-2): real scrape stage with homepage + About/FAQ page fetching`.

## Decisions made

- Scrape follows `context/library-docs.md` cheerio patterns verbatim. One deliberate deviation: `findLinkedPages` also skips anchor/self-links (`resolved.pathname === homepagePathname`) and dedupes by full URL, so `#faq`-style in-page anchors never re-fetch the homepage.
- Only homepage failure is fatal to the audit; sub-page failures log `[pipeline/scrape]` and skip — matches "one failure never crashes the pipeline."
- The real scrape replaced the 1600ms mock `sleep` in the scraping stage. The 1800ms `analyzing` sleep stays until real pillar checkers (features 04–07) replace `getMockPillarResults`.

## Problems solved

- Verified `npm run lint` + `npm run build` pass for feature 03.
- Live E2E smoke test on a real site was **deferred** — the developer asked to stop all terminal/`cmd` activity this session. The dev server test attempt was abandoned; record stands in progress-tracker Notes.
- `/imprint` was a no-op: feature 03 built no UI components, so nothing to capture in `ui-registry.md`.

## Current state

- Phase 1 (01, 02) and Phase 2 (03) complete. All pillars still render mock data via `getMockPillarResults` until Phase 3.
- Report UI shell, polling, PDF route stub exist. `scrapedPages` is stored on the Audit but not yet rendered anywhere — it feeds the Phase 3 checkers.
- lint + build green on `main`.

## Next session starts with

- **Feature 04 — AI Crawler Access Check** (Phase 3): fetch `{origin}/robots.txt` (404 → fully allowed, 10/10, `absence` evidence), parse `Disallow` per user-agent block for `GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`, `CCBot`; score 10/5/0; evidence as exact matching robots.txt lines (`code`). Create `src/lib/robots.ts` per architecture.md. `runAudit` will need a real structural-answerability checker to replace its mock pillar.
- Then features 05 (Schema.org presence), 06 (Direct-answer clarity), 07 (FAQ presence).
- Also pending: live E2E smoke test of the full flow on a real site (use a normal `npm run dev` + browser, no raw terminal commands).

## Open questions

- None blocking. Optional: whether to run `/imprint audit` to establish a UI consistency baseline for the existing Phase 1 components (imprint was skipped this session).
