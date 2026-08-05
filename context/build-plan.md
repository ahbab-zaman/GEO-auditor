# Build Plan

## Core Principle

Given the 8–12 hour budget: build the pipeline skeleton with mock/stubbed pillar results first so the
full input → progress → report → PDF flow is visible and clickable early. Then replace each pillar's
mock with the real checker one at a time, in order of what's hardest to get wrong (scraping first,
since everything downstream depends on it). Never spend time polishing UI for a pillar whose data
isn't real yet.

---

## Phase 1 — Foundation

### 01 Project Skeleton + Types

**Logic:**
- Next.js app router project, TypeScript strict
- `types/audit.ts` — full data model from architecture.md
- `lib/storage.ts` — read/write JSON to `/data/audits/{id}.json`, create `/data/audits/.gitkeep`
- `lib/utils.ts` — point allocation constants (single source of truth, referenced everywhere else)

---

### 02 Input → Mock Pipeline → Report Shell

Build the entire flow end to end with **fully mocked** pillar data, so the shape of the report is
locked in before any real checker is written.

**UI:**
- `/` — business name input, URL input, Run Audit button
- `/audit/[id]` — polling state (icon + stage label, pulse animation per ui-tokens.md's Progress
  Indicator), then full report render once `status: complete`
- Score hero — total /100, three pillar bars
- Findings list grouped by pillar — finding text, evidence block (styled by evidence type), severity tag
- Fix list — sorted by priorityScore, impact/effort badges, copy button on any fix with `copyPasteContent`

**Logic:**
- `POST /api/audit` — creates Audit record with `status: pending`, writes to disk, kicks off `runAudit()` (fire-and-forget, not awaited by the request)
- `runAudit()` in this phase calls **hardcoded mock pillar results** matching the real shape, sleeps briefly between stages to simulate progress, writes final Audit to disk
- `GET /api/audit/[id]` — reads from disk, returns current state
- Frontend polls every 1.5s until `status` is `complete` or `failed`

---

## Phase 2 — Real Scraping

### 03 Scrape Stage

**Logic:**
- `lib/pipeline/scrape.ts` — fetch homepage with a real browser-like User-Agent, parse with cheerio
- Extract: title, visible text (strip nav/footer/script/style), all JSON-LD `<script type="application/ld+json">` blocks, internal links
- Identify and fetch up to 2 more pages if a link text/href matches About/FAQ patterns
- Store as `ScrapedPage[]` on the Audit
- Hard timeout per fetch (8s) — if homepage fetch fails, audit `status: failed` with clear `error`
- Handle malformed JSON-LD gracefully (try/catch per block, skip invalid ones, don't crash the scrape)

---

## Phase 3 — Structural Answerability (Pillar A)

### 04 AI Crawler Access Check

**Logic:**
- Fetch `{origin}/robots.txt`, if 404 → treat as fully allowed (10/10), evidence type `absence` noting "no robots.txt found, so no AI crawlers are blocked"
- Parse `Disallow` rules per `User-agent` block, check specifically for `GPTBot`, `ClaudeBot`,
  `PerplexityBot`, `Google-Extended`, `CCBot`
- Score: 10 pts if none blocked, 5 if some blocked, 0 if all blocked or `Disallow: /` under `User-agent: *`
- Evidence: exact matching robots.txt lines as `code` evidence

### 05 Schema.org Presence Check

**Logic:**
- From scraped `jsonLdBlocks`, check for `@type` matching `Organization`, `LocalBusiness`, or a
  relevant subtype, and separately `FAQPage`
- Score: 10 if a business-identity schema type is present and has `name` + `description` populated, 5 if present but sparse, 0 if absent
- Evidence: the actual JSON-LD block (truncated) as `code` evidence, or `absence` evidence with the exact snippet the business should add

### 06 Direct-Answer Clarity Check

**Logic:**
- Take homepage `rawTextExcerpt`, send to Gemini (plain JSON mode, no grounding) with a rubric prompt: "does the first 200
  words state, in an extractable single sentence, what this business does and for whom?"
- Model returns structured JSON: `{ hasDirectAnswer: boolean, extractedSentence: string | null, reasoning: string }`
- Deterministic scoring in code from that JSON (not model-assigned points): 10 if `hasDirectAnswer` true, 0 if false — binary, no partial credit, to keep the rubric honest and simple
- Evidence: `quote` evidence using `extractedSentence` if found, or the actual opening text if not, so the business owner sees exactly what an AI would (fail to) extract

### 07 FAQ Presence Check

**Logic:**
- Detect explicit Q&A structure — FAQPage schema (already extracted) OR heading patterns matching question format (`?` in headings) with adjacent answer text
- Score: 5 if either present, 0 if not
- Evidence: quote of a detected Q&A pair, or `absence` noting none found

---

## Phase 4 — Live AI Citation Test (Pillar B)

### 08 Gemini Client

**Logic:**
- `lib/gemini.ts` — `geminiJson()` (plain JSON mode) and `geminiGroundedQuery()` (Search grounding, returns `answerText` + `citedUrls`) per library-docs.md
- Wrapped in try/catch — on failure, this and all dependent checks return `status: unavailable` with a human-readable reason stored (never the raw API error shown to the user)
- Sequential execution only for grounded calls (`for` + `await`, never `Promise.all`) to respect the free-tier rate limit — see library-docs.md

### 09 Query Generation + Execution

**Logic:**
- Given `businessName`, `url` domain, and scraped homepage text, generate 3–5 realistic customer
  queries via Gemini (plain JSON mode): mix of category queries ("best [inferred category] in [inferred location]") and direct queries ("what is [businessName]", "is [businessName] good")
- Location/category inferred from scraped content, not user input — keeps this working for any business without extra form fields
- Run each query against Gemini with Search grounding, capture `answerText` (verbatim) + `citedUrls` per query
- Resolve any Google redirect citation URLs to their real domain before storing (see library-docs.md)

### 10 Brand Recall + Citation Rate + Accuracy Scoring

**Logic:**
- Brand recall (15 pts): fraction of category-style queries where businessName appears anywhere in `answerText` → scaled to 15
- Own-domain citation rate (20 pts): fraction of all queries where the business's own (resolved) domain appears in `citedUrls` → scaled to 20
- AI description accuracy (10 pts): for queries where the business is mentioned, a Gemini JSON-mode call compares `answerText` against the scraped homepage content, flags contradictions → 10 if consistent, 5 if partially, 0 if materially wrong or absent
- Evidence: `citations` evidence type per query, storing the exact query text, the full verbatim `answerText`, all cited URLs, and whether the business's domain was among them — this is the single most important evidence block in the whole report (see project-overview.md differentiators)

---

## Phase 5 — Third-Party Corroboration (Pillar C)

### 11 External Presence Check

**Logic:**
- One Gemini grounded query: "What do people say about [businessName] ([url])? Cite your sources."
- Parse `citedUrls`, resolve each to a real domain, filter out any matching the business's own domain
- Count remaining distinct external domains
- Score: 20 if 3+ external domains, 10 if 1–2, 0 if none
- Evidence: `citations` evidence listing `answerText` plus the external domains found, or `absence` evidence stating none were found

---

## Phase 6 — Scoring + Fixes

### 12 Verdict Generation

**Logic:**
- `lib/pipeline/verdict.ts` — after all three pillars complete, send a compact findings summary to
  Gemini (plain JSON mode) and request one blunt, plain-language sentence per library-docs.md's verdict prompt
- Stored on `Audit.verdict`, nullable — a failure here never blocks the rest of the report
- Runs strictly after Stage 2–4, never before — the verdict must reflect real findings, not be
  generated speculatively and hoped to match
- The verdict prompt/logic must be checked against the total-invisibility case (see build-plan 17) —
  when every pillar scores near zero, the verdict is the single most important sentence in the report
  and must still read as specific to this business, not a generic "you scored low" line

### 13 Score Aggregation

**Logic:**
- `lib/pipeline/score.ts` — pure function, sums `pointsEarned` across all `CheckResult`s per pillar and overall, no external calls, fully unit-testable with hand-constructed `PillarResult[]` fixtures

### 14 Fix Generation

**Logic:**
- `lib/pipeline/fixes.ts` — one `Fix` derived per `CheckResult` where `severity !== 'pass'`
- `impact` mapped from the check's `pointsPossible` (higher possible points → higher impact)
- `effort` hardcoded per check id (a lookup table in `lib/utils.ts`) since effort is a property of the
  fix type, not the specific business — e.g. adding a robots.txt line is always `low` effort, restructuring homepage copy is always `medium`
- `priorityScore` = impact weight ÷ effort weight, used for sort order
- `copyPasteContent` populated wherever the fix is literally a snippet (robots.txt line, JSON-LD block); left `null` for content-strategy fixes that can't be handed over verbatim (e.g. "add an FAQ section")

---

## Phase 7 — Report UI Polish + PDF

### 15 Report UI — Real Data Pass

**UI:**
- Replace mock rendering assumptions with real edge cases: `unavailable` pillar state, `absence` evidence rendering, long citation lists, empty fix lists, missing verdict
- `VerdictBanner` renders first, above the score ring, styled per ui-rules.md and ui-tokens.md's
  Verdict Banner component tokens — no card border, scale-contrast typography, no severity color tint
- Single score count-up animation on the hero number only (≤500ms, ease-out, fires once) — per
  ui-tokens.md's Score Ring component tokens. **Do not** stagger the findings list, fix list, or any
  other element into view — one motion moment on the page load is the ceiling, not a starting point
- Progress state (`/audit/[id]` pre-completion) uses the pulse animation defined in ui-tokens.md's
  Progress Indicator tokens — no spinner ring, no percentage bar
- Copy button on fix cards gives explicit "Copied" feedback for ~1.5s per ui-tokens.md
- Score ring/bar colored by range (reuse pattern from ui-tokens.md)
- Severity tags always pair color with a visible text label ("Pass" / "Needs work" / "Critical") — never color alone
- Jargon terms rendered with inline explainer text, not a separate glossary page or hover-only tooltip (must also work in the static PDF)

### 16 PDF Export

**Logic:**
- `components/audit/ReportPdf.tsx` — `@react-pdf/renderer` document mirroring the web report layout, using the light print-friendly palette per ui-rules.md
- Severity communicated via visible text labels in the PDF too (not color alone), since it may be
  viewed in grayscale or printed
- `GET /api/audit/[id]/pdf` — loads Audit JSON, renders via `renderToBuffer`, returns as `application/pdf` download
- No storage of the PDF itself — generated on demand each time

---

## Phase 8 — Real-World Validation

### 17 Run Against 3–5 Real Businesses

**Business selection — not arbitrary, pick with intent:**
- **One low-visibility business** — a real site where the tool should surface a genuinely low score
  and a compelling "you're invisible" verdict. This is the moment the brief describes wanting to
  build for (project-overview.md, "What Makes This Submission Stand Out" #1) — pick a business likely
  to actually land there, don't hope for it.
- **One higher-visibility business** — a site with decent schema, clear direct-answer copy, and some
  existing AI mentions. Proves the tool doesn't just always say "you're bad" regardless of input —
  a scoring system that never produces a good result is as suspect as one that never produces a bad one.
- **One different category/size from the other two** (e.g. local service business vs. e-commerce vs.
  SaaS) — so the three submitted reports read as genuinely dynamic and business-specific, not like
  the same template with swapped names.
- Record which three were chosen and why in progress-tracker.md's Notes section as soon as they're picked.

**Edge cases to explicitly verify, not just the ones that come up naturally:**
- Missing robots.txt, sites with no JSON-LD, sites that block scraping, businesses Gemini has never heard of, free-tier rate limit hits
- **Total invisibility** — a business where all three pillars come back genuinely near-zero (no
  citations, no third-party mentions, weak structural signals). Verify explicitly that the report still
  renders as a compelling, specific, non-broken document at rock bottom — this is arguably the most
  important state to get right, since it's the exact moment the product exists to create. Don't let it
  only be discovered by accident during the real-business runs; deliberately test for it.

- Copy the 3 chosen final audit JSONs (+ PDF) into `/submission/audits/`

### 18 README + Demo Video

- Write README per the deliverable requirements (run instructions, what was cut and why, real vs mocked, what's next)
- Pull directly from progress-tracker.md's "Decisions Made During Build" section when writing the
  "what I chose to cut and why" / assumptions parts of the README — every deviation or assumption
  logged during the build should show up here, not be reconstructed from memory at hour 11
- Record 3–5 min walkthrough — per the brief, narrate the decisions behind each pillar and each cut,
  not just a feature tour of what the tool does

---

## Phase 9 — Optional Stretch (only if time remains after Phase 8)

Not required for a complete submission. Only attempt these after all 18 core features are done and
validated against real businesses — a polished 18-feature tool beats an 18-feature tool plus two
broken stretch features. If attempted, document them clearly as stretch additions in the README, per
the brief's honesty requirement.

### 19 Competitor Snapshot (optional)

- Given a second, competitor business name (optional second input field, collapsed by default), run
  the same Pillar B queries and show a side-by-side citation comparison on the report
- Deliberately not part of core scope — doubles the live AI calls per audit, and the brief's own
  guidance is "go deep, not wide." Only worth adding once the core three pillars are airtight

### 20 Streaming Pipeline Progress via SSE (optional)

- Replace the 1.5s polling loop from build-plan 02 with a Server-Sent Events stream so stage updates
  render the instant they happen server-side, instead of on the next poll tick
- Pure technical-execution polish — does not change report quality or research depth, so it's ordered
  last

### 21 `llms.txt` Presence Check (optional)

- Fetch `{origin}/llms.txt` — an emerging, explicit AI-crawler-preference standard, distinct from
  `robots.txt` — and check for its presence as a small additional Structural Answerability signal
- Cheap to add (a single fetch + presence check, same pattern as robots.txt) but genuinely uncommon in
  other GEO tools — worth attempting only after the three core pillars are airtight, per the brief's
  "go deep, not wide" guidance. Document clearly as a stretch addition and explain the reasoning for
  its inclusion, same as every other check, per code-structure.md and the brief's "defend every check"
  requirement

---

## Feature Count

| Phase | Features |
|---|---|
| Phase 1 — Foundation | 2 |
| Phase 2 — Scraping | 1 |
| Phase 3 — Structural Answerability | 4 |
| Phase 4 — Live AI Citation | 3 |
| Phase 5 — Third-Party Corroboration | 1 |
| Phase 6 — Scoring + Fixes | 3 |
| Phase 7 — Report UI + PDF | 2 |
| Phase 8 — Validation + Delivery | 2 |
| **Core Total** | **18** |
| Phase 9 — Optional Stretch | 3 (not required) |
