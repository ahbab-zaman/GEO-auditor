<div align="center">

# GEO Auditor

**Find out whether your business actually exists inside AI answers — not just on Google.**

</div>

GEO Auditor tells a business owner one thing no traditional SEO tool can: whether an AI assistant (ChatGPT, Perplexity, Claude, Google AI Overviews) can see, understand, and *cite* their business. You enter a name and a URL; it scrapes the site, asks a live AI engine the questions a real customer would ask, cross-checks third-party corroboration, and returns a scored, evidenced report with a prioritized, copy-paste-ready fix list.

---

## Table of Contents

- [Why this exists](#why-this-exists)
- [What it does](#what-it-does)
- [The three pillars](#the-three-pillars)
- [Pipeline architecture](#pipeline-architecture)
- [Scoring](#scoring)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [API reference](#api-reference)
- [Data model](#data-model)
- [Project structure](#project-structure)
- [Design decisions & tradeoffs](#design-decisions--tradeoffs)
- [What's deliberately out of scope](#whats-deliberately-out-of-scope)
- [Deployment](#deployment)
- [Known limitations](#known-limitations)
- [Roadmap](#roadmap)

---

## Why this exists

SEO's entire playbook — keywords, backlinks, meta descriptions — was built for a search engine that
returns a **list of links**. AI engines don't do that. They synthesize a paragraph from a handful of
sources they choose to trust, and most businesses have zero visibility into why they were or weren't
one of those sources. A business can rank #1 on Google and be *invisible* in every AI answer about its
own category, and never know it.

GEO Auditor exists to make that invisibility visible — with evidence — and to tell the owner exactly
what to fix first, in plain language.

The core research question driving the design: **what actually makes an AI engine cite one source over
another?** Two signals showed up consistently:

1. An AI engine can only cite what it can *technically access and structurally parse*.
2. AI engines overwhelmingly cite **third-party consensus** over a company's own marketing copy.

A third, more direct signal — just ask a real AI engine and watch what it does — closes the loop
between theory and reality. Those three signals became the three pillars.

---

## What it does

A typical audit run:

1. User enters a `businessName` and `url` on the landing page.
2. The tool **scrapes** the site (homepage + up to 2 linked About/FAQ pages).
3. It inspects **robots.txt**, schema.org JSON-LD, direct-answer copy, and FAQ structure.
4. It asks a **live AI engine** 4 realistic customer questions, capturing the raw answer text and every
   cited URL verbatim.
5. It checks whether *anyone else* on the web vouches for the business.
6. It generates a one-sentence plain-language **verdict**, a deterministic **0–100 score** with a full
   pillar breakdown, and a **prioritized fix list** with copy-pasteable snippets.
7. The report renders in the browser and can be **exported as a PDF** that is safe to forward.

---

## The three pillars

| Pillar | Weight | Question it answers | What it can't answer |
|---|---|---|---|
| **Structural Answerability** | 35 pts | Can an AI engine even access and parse this site? | Whether the AI actually *chooses* to use it |
| **Live AI Citation Test** | 45 pts | Does a real AI engine actually mention/cite this business today? | Why — needs the other two pillars for root cause |
| **Third-Party Corroboration** | 20 pts | Does anyone other than the business itself vouch for it online? | Nothing about the business's own site quality |

Each pillar is broken into checks with deterministic scoring:

| Pillar | Checks (points) |
|---|---|
| Structural Answerability | AI crawler access (10), schema.org presence (10), direct-answer clarity (10), FAQ presence (5) |
| Live AI Citation Test | Brand recall across category queries (15), own-domain citation rate (20), AI description accuracy (10) |
| Third-Party Corroboration | External source count — 0/1–2/3+ tiers → 0/10/20 |

---

## Pipeline architecture

The audit runs **server-side** as a sequence of **independent, self-triggered steps**. Each step runs
in its own serverless invocation, one stage at a time, persisting progress to storage after each one.
This keeps any single step inside a platform's function-duration budget and makes the audit resumable.

```
POST /api/audit  { url, businessName }
   │  (creates audit, triggers first step in a fresh invocation)
   ▼
/api/jobs/run  →  runAuditStep(id)  →  runs ONE stage, then triggers the next
   │
   ├─ scrape       fetch homepage + up to 2 linked pages, parse with cheerio
   ├─ structural    robots.txt + JSON-LD + direct-answer grading + FAQ detection → Pillar A
   ├─ live-ai       live AI engine, 4 customer queries, citations + accuracy        → Pillar B
   ├─ third-party   live AI query for external mentions                             → Pillar C
   └─ finalize      verdict → score → fixes → mark complete
   │
   ▼
GET /api/audit/[id]  → poll status, then return full Audit JSON once complete
   │
   ▼
/audit/[id] renders the report        GET /api/audit/[id]/pdf renders a PDF
```

**Resilience model.** Every stage is wrapped in its own try/catch. A failure — API key exhausted, a
rate limit, a slow model route, a deadline exceeded — never crashes the run. It produces a
`status: "unavailable"` pillar (or a `failed` audit only when the site itself is unreachable) with a
stated reason, which the report UI displays honestly instead of silently lowering the score.

**Concurrency safety.** Each step writes a `jobLock` timestamp before running. A second invocation that
sees an active lock skips the step, preventing double-runs on retry or resume.

---

## Scoring

Scoring is a **pure function** (`computeScore`) with no side effects. AI models **never** assign
scores — LLM-graded checks (e.g. direct-answer clarity) produce facts, and deterministic rubric logic
in the checker turns those facts into points. This makes every point traceable and every score
testable.

Key rules:

- Sum of pillar `pointsEarned` over `pointsPossible` (max 100).
- An `unavailable` pillar earns **0** but still counts its `pointsPossible` in the denominator — it is
  never silently dropped, and the report states why it couldn't complete.

---

## Tech stack

| Area | Choice | Why |
|---|---|---|
| Framework | **Next.js 15** (App Router) | Server Components, route handlers, one coherent server+client app |
| Language | **TypeScript** (strict, no `any`) | Safety across untrusted data |
| Styling | **Tailwind CSS v4** + shadcn/ui | Tokens via `@theme`, consistent light theme |
| Validation | **zod** | All untrusted input and model responses validated at runtime |
| Scraping | **cheerio** | Static fetch only — no headless browser needed |
| AI provider | **Groq Compound** primary, **OpenRouter** fallback (raw `fetch`) | Groq handles built-in web search; OpenRouter free is the backup route |
| Web search citations | **Groq Compound** built-in search, **Tavily** fallback | Groq handles live web queries; Tavily remains as a fallback search path |
| PDF | **@react-pdf/renderer** | Generate PDF on demand, no browser needed |
| Animation | **framer-motion** | Purposeful, restrained motion |
| Storage | **Supabase Postgres** (prod) **or** local JSON files (dev) | See [Storage](#data-model) |

### The AI provider decision

The tool runs on **Groq Compound first** and falls back to **OpenRouter free** if Groq fails. Groq
handles the live web search directly and returns cited sources; if Groq is unavailable, grounded
calls can fall back to Tavily search plus OpenRouter synthesis when `TAVILY_API_KEY` is set. Without
Groq and without Tavily, the citation pillars may report `unavailable` rather than fabricating
citations.

This is a deliberate scoping decision: a reviewer can run the whole tool in minutes with no paid
account provisioning, and one provider means one client, one auth path, one failure mode.

---

## Getting started

### Prerequisites

- Node.js 18+ (Next.js 15 requirement)
- A [Groq](https://console.groq.com) API key (`GROQ_API_KEY`)
- An [OpenRouter](https://openrouter.ai) API key (`OPENROUTER_API_KEY`) for fallback
- Optionally a [Tavily](https://tavily.com) key for fallback live-citation search

### Install & run (local, file-based storage — no database required)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
#  -> fill in GROQ_API_KEY (required), OPENROUTER_API_KEY (required). TAVILY_API_KEY is optional.

# 3. Run the dev server
npm run dev
#  -> open http://localhost:3000
```

That's it. Without Supabase variables set, audits persist to `src/data/audits/*.json` on the local
filesystem, so `next dev` works with no database at all.

### Production-grade commands

```bash
npm run dev     # start the dev server
npm run build   # production build
npm run start   # run the production build
npm run lint    # lint (eslint)
```

---

## Environment variables

All real values live in `.env.local` (gitignored). Documented with placeholders in `.env.example`.

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | ✅ | Groq Compound key for primary model calls and live web search |
| `OPENROUTER_API_KEY` | ✅ | OpenRouter key for fallback model calls |
| `TAVILY_API_KEY` | ❌ | Optional; enables fallback live search citations when Groq is unavailable |
| `SUPABASE_URL` | ❌ | Enables Postgres storage (used on Vercel where the FS is read-only). Leave unset for local file storage. |
| `SUPABASE_SERVICE_ROLE_KEY` | ❌ | Service-role key for Supabase storage. |
| `AUDIT_JOB_SECRET` | ❌ | Guard on the `/api/jobs/run` self-trigger. |
| `APP_URL` | ❌ | Base URL used to self-trigger the next audit step off-Host (derived automatically on Vercel). |
| `LIVE_AI_TIMEOUT_MS` | ❌ | Cap the live-AI stage (default `45000`) so it stays under the function duration limit. |
| `RUN_TIMEOUT_MS` | ❌ | Total wall-clock budget for the audit (default `90000` = 1.5 min). When nearly spent, the pipeline stops gathering (remaining pillars report `unavailable`) and finalizes immediately, so a report is always produced within this window. |
| `STEP_LOCK_MS` | ❌ | Concurrent-step lock span (default 55s). |

---

## API reference

All responses use the envelope shape:
`{ success: boolean, data?: T, error?: string }`.

| Method & path | Body (zod-validated) | Behavior |
|---|---|---|
| `POST /api/audit` | `{ url: string, businessName: string }` | Creates an audit (id in `data.id`), triggers the first pipeline stage in a fresh invocation. Returns fast. |
| `GET /api/audit/[id]` | — | Returns the current audit (in-progress status or full report). Client polls ~1.5s until `complete`/`failed`. |
| `GET /api/audit/[id]/pdf` | — | Renders the report to PDF on demand via `@react-pdf/renderer`. `404` if not found/not complete, `500` on render failure. |
| `POST /api/jobs/run` | `{ id: string }` | Internal step runner. Runs one pipeline stage, then chains the callback to `triggerAuditStep`. Guarded by optional `AUDIT_JOB_SECRET`. |

---

## Data model

The full type definitions live in `src/types/audit.ts`. Core shape:

```typescript
type Audit = {
  id: string;              // nanoid(10)
  url: string;
  businessName: string;
  createdAt: string;      // ISO
  completedAt: string | null;
  status: "pending" | "scraping" | "analyzing" | "complete" | "failed";
  error: string | null;                             // set only if status === 'failed'
  stage?: "scrape" | "structural" | "live-ai" | "third-party" | "finalize" | "done";
  jobLock?: number | null;                          // serverless step-runner bookkeeping
  verdict: string | null;                           // one plain-language sentence, shown first
  scrapedPages: ScrapedPage[];
  pillars: {
    structuralAnswerability: PillarResult;  // 35
    liveAiCitation: PillarResult;           // 45
    thirdPartyCorroboration: PillarResult;  // 20
  };
  score: { total: number; maxTotal: number };       // maxTotal 100
  fixes: Fix[];                                      // sorted by priority, desc
};

type CheckResult = {
  id: string; label: string;
  pointsEarned: number; pointsPossible: number;
  finding: string;                                  // what was found — specific to the business
  evidence: Evidence;
  severity: "pass" | "warning" | "critical";
  status: "complete" | "unavailable";
  unavailableReason?: string;
};

type Evidence =
  | { type: "quote"; source: string; text: string }            // exact site excerpt
  | { type: "code"; source: string; snippet: string }        // robots.txt line, JSON-LD block
  | { type: "citations"; query: string; answerText: string; citedUrls: string[]; businessCited: boolean }
  | { type: "absence"; source: string; note: string };        // honestly-stated nothing found
```

**Storage backends.** `src/lib/storage.ts` dispatches to either:

- **Supabase Postgres** — when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set (production on
  Vercel, where the filesystem is read-only and ephemeral). Each `Audit` is stored as a row in the
  `audits` table with the full object in a `data` JSON column, upserted on `id`.
- **Local filesystem** — fallback so `next dev` works with no database. Each audit is a pretty-printed
  JSON file at `src/data/audits/{id}.json`.

---

## Project structure

```
src layout — all app code lives under src/.
├── app/
│   ├── page.tsx                   # landing + audit form
│   ├── layout.tsx                 # root layout (Inter font)
│   ├── globals.css                # Tailwind v4 @theme tokens, keyframes
│   ├── audit/[id]/page.tsx        # progress state → full report (polls)
│   └── api/
│       ├── audit/route.ts         # POST — start audit
│       ├── audit/[id]/route.ts    # GET — status/result
│       ├── audit/[id]/pdf/route.ts# GET — PDF export
│       └── jobs/run/route.ts      # POST — step-runner (self-triggered)
├── lib/
│   ├── pipeline/                  # runAudit, scrape, structuralAnswerability,
│   │                              # liveAiCitation, thirdPartyCorroboration,
│   │                              # verdict, score, fixes
│   ├── gemini.ts                 # geminiJson() + geminiGroundedQuery()
│   ├── jobs.ts                   # step-trigger helpers
│   ├── storage.ts                # Supabase or filesystem persistence
│   ├── robots.ts                 # robots.txt fetch + AI-bot parsing
│   └── utils.ts                  # point constants, severity colors, effort table
├── types/audit.ts               # compile-time types
├── schemas/audit.ts             # zod runtime validation
├── components/
│   ├── ui/                      # shadcn/ui primitives
│   ├── audit/                   # AuditForm, ProgressState, VerdictBanner, ScoreHero,
│   │                            # PillarBreakdown, FindingCard, EvidenceBlock, FixCard, ReportPdf
│   └── motion/variants.ts       # shared animation variants
└── data/audits/                 # local JSON written at runtime (gitignored *.json)
```

Two rules worth calling out for anyone navigating this repo:

- **`types/` vs `schemas/`.** Types describe shape at compile time; schemas validate shape at runtime
  for anything crossing an external boundary (API bodies, model responses). They are never merged.
- **No code outside `lib/pipeline/` and `lib/gemini.ts` ever reads `OPENROUTER_API_KEY` directly.** All
  model interactions sit behind the pipeline layer; nothing client-side ever touches the key.

---

## Design decisions & tradeoffs

- **File-based persistence for a slow, step-based pipeline.** Each stage runs separately and persists before the next
  step runs, keeping the audit within function limits and making it resumable.
- **Sequential, not parallel, on the web calls.** The live-query stages run in a `for`+`await` loop,
  never `Promise.all`. On a backed-up serverless route, few seconds of added latency is a fair trade for stability on
  every run.
- **Citations are counted honestly, not naively.** Citation URLs are deduplicated and
  redirect-resolved before counting. Google's grounding can wrap URLs in `vertexaisearch.*` redirect
  hosts; those are dropped so they can't inflate the third-party domain count.
- **Severity is never conveyed by color alone.** Every severity tag pairs color with a visible text
  label ("Pass" / "Needs work" / "Critical") — it always survives grayscale and the printed PDF.
- **An `unavailable` is shown, not hidden.** Rate limits and timeouts degrade to a stated reason rather
  than a silently lower score. This is a trust decision, not an afterthought.
- **`answerText` is treated as evidence, not a summary.** The raw AI answer is stored and rendered verbatim —
  the single most persuasive artifact in the report.
- **The verdict is nullable.** A failed verdict call never blocks a complete report — the report just
  renders without the opening line.

### What's deliberately out of scope

These choices are conscious product decisions — each documented rather than assumed missed — driven by
the "go deep, not wide" principle of the brief.

- **Auth, accounts, billing** — no sessions, nothing to lock down.
- **A database as the default** — Postgres is only used when hosting demands it; files suit a local tool.
- **Production deployment** — the deliverable is a local run + demo video, not a live-deployed SaaS.
- **Tests/CI/Docker** — not graded for this submission; each scoring check was validated with fixtures.
- **Multi-engine live testing (ChatGPT + Claude + Gemini)** — flagged as the first v2 add; one engine keeps
  cost/API surface down.
- **Classic technical SEO** (speed, meta descriptions, backlinks) — well-covered by existing tools, not
  GEO-specific.
- **Handling arbitrary/adversarial websites** — built and tuned against real businesses, not a
  general-purpose crawler.

---

## Deployment

The project is designed to run against two host options keyed by filesystem behavior:

- **Local (default).** File-backed storage, `next dev` with no database. This is the primary demo.
- **Vercel + Supabase.** Use Postgres storage (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) because
  Vercel's filesystem is read-only outside `/tmp` and `/tmp` isn't durable across invocations. The
  step-chaining runner (`POST /api/jobs/run` + `after()` self-trigger) is built for this model; make
  sure each step stays under your plan's `maxDuration` — the `LIVE_AI_TIMEOUT_MS` env lets you dial the
  longest stage down (e.g. `45000` on the Hobby 60s limit).

> **Deployment warning.** Do not ship a live link that relies on the filesystem backend and a
> serverless host — audits will intermittently 404. Either use the Supabase backend or host on a a
> persistent-disk server. This is stated, not assumed.

---

## Known limitations

- Free OpenRouter routes can be slow, queued, or rate-limited; a cold start may take 10–25s per live
  call. The tool handles this by degrading to `unavailable` with a reason — it doesn't hang forever.
- Without `GROQ_API_KEY` and without `TAVILY_API_KEY`, the two citation pillars may report
  `unavailable` rather than fabricating citations. That's intentional.
- Citations come from Groq Compound's built-in web search first; when Groq is unavailable and
  `TAVILY_API_KEY` is set, the fallback path uses Tavily search results handed to OpenRouter to
  synthesize an answer and cite them.

---

## Roadmap

- **Core pipeline** — foundation, real scraping, all three pillars, scoring, verdict, fixes: 100% real, zero mocks.
- **Report UI polish + PDF export** — done.
- **Real-business validation (3 runs)** — in progress.
- **README + demo video** — this README is done; demo video pending.

**Future / v2 ideas** (out of the base scope, each requiring a product-thinking pass first):
- Multi-engine live testing (ChatGPT, Claude, and so on) with per-engine breakdown.
- Competitor snapshot — run the same Pillar B queries against a competitor and compare side-by-side.
- Time-series auditing — re-run same business over weeks to show a trend.
- `llms.txt` presence as an additional structural signal.
- Content freshness / update-frequency signal (needs historical data to avoid speculation).

---

## License

Private / assessment submission — see the repository owner for reuse terms.

---

*Built as a take-home assessment for **Phaze AI (Product Developer, AI Products)**. The report is the
product.*
