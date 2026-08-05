# Architecture

System design for GEO Auditor. Read this before touching the pipeline, the data model, or storage.
This file is the source of truth for how data flows and is shaped — build-plan.md is the source of
truth for build order.

---

## System Overview

```
User (browser)
   │
   ▼
POST /api/audit  { url, businessName }
   │
   ▼
Pipeline runs server-side, in order, writing progress as it goes:

  Stage 1 — Scrape          fetch homepage + up to 2 linked pages (About/FAQ), parse with cheerio
  Stage 2 — Structural      robots.txt fetch + parse, JSON-LD extraction, direct-answer LLM grading,
            Answerability   FAQ detection            → Pillar A findings
  Stage 3 — Live AI Test    Gemini (Search grounding), 3–5 queries, citation + raw-answer extraction,
                             accuracy check                                → Pillar B findings
  Stage 4 — Third-Party     Gemini (Search grounding) query for external mentions
            Corroboration                             → Pillar C findings
  Stage 5 — Verdict         one-sentence plain-language summary generated from the completed findings
  Stage 6 — Score           pure function combines all findings into final score + fix list
  Stage 7 — Persist         write full Audit object to /data/audits/{id}.json
   │
   ▼
GET /api/audit/[id]  → poll status, then return full Audit JSON once complete
   │
   ▼
/audit/[id] renders report from Audit JSON
GET /api/audit/[id]/pdf → renders same Audit JSON through @react-pdf/renderer
```

Each stage is independent and wrapped in its own try/catch. A failure in one pillar never crashes the
run — it produces a `status: 'unavailable'` result for that pillar with a stated reason, which the
report UI displays honestly rather than silently omitting.

---

## Storage

No database. Each completed (or failed) audit is a single JSON file:

```
/data/audits/{auditId}.json
```

This is sufficient because:
- No user accounts to scope data to
- No querying/filtering across audits needed — always fetched by id
- File-based storage makes the three required real-business audits trivially reproducible and
  inspectable (open the JSON, see exactly what was found)

`/data` is gitignored except for a `/data/audits/.gitkeep`. The three real submitted audit reports are
copied out of `/data/audits/` into `/submission/audits/` as the deliverable artifacts.

**Deployment constraint — read this before adding a live link.** Direct filesystem writes only work
reliably on a local run. Most serverless hosts (Vercel included) ship a **read-only filesystem outside
`/tmp`**, and `/tmp` itself is not guaranteed to persist across cold starts or separate function
invocations — a write in the POST handler may not be visible to the GET handler moments later. This
project's deliverable is a local run + demo video, so this is not blocking, but it must be a stated
decision, not a surprise discovered late:

- **Default plan:** local run only. No live link in the README unless explicitly upgraded below.
- **If a live link is added:** either (a) deploy to a host with a persistent disk/volume rather than
  serverless functions, or (b) explicitly document that hosted demo data is ephemeral (`/tmp`, may
  reset between requests) and is a known limitation, not a bug. Do not silently ship a live link that
  intermittently 404s on its own audits.

---

## Data Model

```typescript
// types/audit.ts

export type AuditStatus = "pending" | "scraping" | "analyzing" | "complete" | "failed";

export type Audit = {
  id: string;
  url: string;
  businessName: string;
  createdAt: string; // ISO
  completedAt: string | null;
  status: AuditStatus;
  error: string | null; // set only if status === 'failed'

  verdict: string | null; // one plain-language sentence, generated last, shown first in the UI

  scrapedPages: ScrapedPage[];

  pillars: {
    structuralAnswerability: PillarResult;
    liveAiCitation: PillarResult;
    thirdPartyCorroboration: PillarResult;
  };

  score: {
    total: number; // 0-100, sum of pillar points earned
    maxTotal: 100;
  };

  fixes: Fix[]; // sorted by priority, descending
};

export type ScrapedPage = {
  url: string;
  kind: "homepage" | "about" | "faq" | "other";
  title: string;
  rawTextExcerpt: string; // first ~2000 chars, used as LLM input + evidence source
  jsonLdBlocks: unknown[]; // raw parsed JSON-LD, if any
  fetchedAt: string;
};

export type PillarResult = {
  key: "structuralAnswerability" | "liveAiCitation" | "thirdPartyCorroboration";
  label: string;
  status: "complete" | "unavailable";
  unavailableReason?: string; // required if status is 'unavailable'
  pointsEarned: number;
  pointsPossible: number;
  checks: CheckResult[];
};

export type CheckResult = {
  id: string; // e.g. 'ai-crawler-access', 'schema-presence', 'direct-answer-clarity'
  label: string; // human readable, no jargon, or jargon + inline explainer
  pointsEarned: number;
  pointsPossible: number;
  finding: string; // what was found, specific to this business
  evidence: Evidence;
  severity: "pass" | "warning" | "critical";
};

export type Evidence =
  | { type: "quote"; source: string; text: string } // exact excerpt from the site
  | { type: "code"; source: string; snippet: string } // e.g. robots.txt line, JSON-LD block
  | {
      type: "citations";
      query: string;
      answerText: string; // the AI's raw answer, verbatim — the single most persuasive artifact in the report
      citedUrls: string[];
      businessCited: boolean;
    }
  | { type: "absence"; source: string; note: string }; // explicitly nothing found, stated honestly

export type Fix = {
  id: string;
  relatedCheckId: string;
  title: string;
  explanation: string; // plain language, jargon explained inline
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  priorityScore: number; // impact/effort combined, used for sort order
  copyPasteContent: string | null; // ready-to-use snippet, or null if the fix is non-code advice
};
```

---

## Scoring Formula

Scoring is a **pure function** — `computeScore(pillars: PillarResult[]): Audit["score"]` — with no
side effects, fully unit-testable, and never influenced by LLM output directly. LLM-graded checks
(e.g. direct-answer clarity) produce a `CheckResult` with points already assigned by deterministic
rubric logic in the checker itself, not by asking the LLM "what score should this get."

Point allocation (see project-overview.md for pillar rationale):

| Pillar | Points | Checks |
|---|---|---|
| Structural Answerability | 35 | AI crawler access (10), Schema.org presence (10), Direct-answer clarity (10), FAQ presence (5) |
| Live AI Citation Test | 45 | Brand recall across category queries (15), Own-domain citation rate (20), AI description accuracy (10) |
| Third-Party Corroboration | 20 | External source count found (0/2/3+ tiers → 0/10/20) |

If a pillar is `unavailable` (e.g. Gemini API failed or hit a rate limit for this run), its `pointsPossible` is
still counted toward `maxTotal` but `pointsEarned` is 0, and the report visibly states the pillar
could not be completed and why — never silently dropped from the denominator.

---

## External Integrations

| Service | Used for | Failure mode |
|---|---|---|
| Target website (fetch + cheerio) | Stage 1 scrape | If homepage fetch fails, audit fails entirely — nothing to score |
| `{url}/robots.txt` | AI crawler access check | Missing robots.txt = treated as "all crawlers allowed" (correct default), not an error |
| Google Gemini (`gemini-2.0-flash`, Search grounding) | Live AI citation test + third-party corroboration | Pillar marked unavailable, rest of audit still completes |
| Google Gemini (`gemini-2.0-flash`, JSON mode, no grounding) | Direct-answer clarity grading, query generation, verdict generation | Check/stage marked unavailable, rest of pipeline still completes |

Single provider by design — see project-overview.md "Why Gemini, Not a Paid Engine." One `GEMINI_API_KEY`
covers every AI call in the pipeline; grounding is toggled per-call via the `tools` parameter, not via a
separate provider.

**Free-tier rate limiting:** Gemini's free tier caps requests per minute. Stage 3 and Stage 4 calls are
executed **sequentially, not in parallel** (`for` loop with `await`, not `Promise.all`) specifically to
stay under this limit reliably — see library-docs.md for the exact pattern. This is a deliberate
tradeoff of a few seconds of extra pipeline time for reliability on every run.

---

## File Structure

Full repository tree. An AI agent picking up this project mid-build should be able to locate any file
it needs from this alone — every path below either already exists at the end of build-plan.md's Phase
1, or is created by a specific numbered feature in build-plan.md (noted inline).

```
geo-auditor/
├── .env.local                        → GEMINI_API_KEY (gitignored)
├── .env.example                      → checked in, documents required vars with no real values
├── .gitignore                        → node_modules, .next, .env.local, /data/audits/*.json
├── next.config.ts
├── tsconfig.json                     → strict: true
├── package.json
├── README.md                         → deliverable, written in Phase 8 (build-plan 17)
│
├── app/
│   ├── layout.tsx                    → root layout, Inter + Space Grotesk font vars, dark theme class on <html>
│   ├── globals.css                   → @theme token definitions (see ui-tokens.md), keyframes
│   ├── page.tsx                      → landing + input form                          [build-plan 02]
│   ├── audit/
│   │   └── [id]/
│   │       └── page.tsx              → progress state → full report                  [build-plan 02, 14]
│   └── api/
│       └── audit/
│           ├── route.ts              → POST, starts pipeline                         [build-plan 02]
│           └── [id]/
│               ├── route.ts          → GET, status/result                            [build-plan 02]
│               └── pdf/
│                   └── route.ts      → GET, PDF export                               [build-plan 15]
│
├── lib/
│   ├── pipeline/
│   │   ├── runAudit.ts               → orchestrates all 7 stages, writes to disk      [build-plan 02, 12]
│   │   ├── scrape.ts                 → Stage 1                                        [build-plan 03]
│   │   ├── structuralAnswerability.ts → Stage 2, checks 04–07                         [build-plan 04-07]
│   │   ├── liveAiCitation.ts         → Stage 3, checks 08–10                          [build-plan 08-10]
│   │   ├── thirdPartyCorroboration.ts → Stage 4                                       [build-plan 11]
│   │   ├── verdict.ts                → Stage 5, one-sentence summary generation       [build-plan 12]
│   │   ├── score.ts                  → Stage 6, pure scoring function                 [build-plan 12]
│   │   └── fixes.ts                  → derives Fix[] from CheckResult[]               [build-plan 13]
│   ├── gemini.ts                     → Gemini client — geminiJson() + geminiGroundedQuery() [build-plan 08]
│   ├── robots.ts                     → robots.txt fetch + AI-bot parsing              [build-plan 04]
│   ├── storage.ts                    → read/write /data/audits/{id}.json              [build-plan 01]
│   └── utils.ts                      → POINTS constants, getSeverityColor(), effort lookup table [build-plan 01]
│
├── types/
│   └── audit.ts                      → Audit, ScrapedPage, PillarResult, CheckResult, Evidence, Fix [build-plan 01]
│
├── schemas/
│   └── audit.ts                      → zod schemas: AuditRequestSchema, Gemini response shapes [build-plan 01]
│
├── components/
│   ├── ui/                           → shadcn/ui primitives (button, input, badge) — index-exported only here
│   ├── audit/
│   │   ├── AuditForm.tsx             → landing page input card                        [build-plan 02]
│   │   ├── ProgressState.tsx         → stage-by-stage progress UI                      [build-plan 02]
│   │   ├── VerdictBanner.tsx         → the one-sentence opening line                   [build-plan 14]
│   │   ├── ScoreHero.tsx             → animated score ring + pillar bars               [build-plan 02, 14]
│   │   ├── PillarBreakdown.tsx       → per-pillar summary card                         [build-plan 02]
│   │   ├── FindingCard.tsx           → single finding + evidence renderer              [build-plan 02, 14]
│   │   ├── EvidenceBlock.tsx         → renders quote/code/citations/absence variants    [build-plan 14]
│   │   ├── FixCard.tsx               → single fix + copy button                        [build-plan 02, 14]
│   │   └── ReportPdf.tsx             → @react-pdf/renderer document definition          [build-plan 15]
│   └── motion/
│       └── variants.ts               → shared framer-motion variants (stagger container/item) [build-plan 14]
│
├── data/
│   └── audits/
│       └── .gitkeep                  → JSON per audit written here at runtime, gitignored otherwise
│
└── submission/
    └── audits/                       → the 3 required real audit JSON + PDF outputs    [build-plan 16]
```

**Rules for the AI agent navigating this tree:**
- If a file's purpose isn't obvious from this list, check code-structure.md's naming conventions before creating a new one — don't guess a new location for something that already has a defined home here.
- `schemas/` (zod) and `types/` (TypeScript types) are intentionally separate — types describe shape at compile time, schemas validate shape at runtime for anything crossing an external boundary (API request bodies, Gemini responses). Do not merge them into one file.
- `components/motion/variants.ts` is the only shared animation file — see ui-rules.md for why per-component variants are otherwise preferred.
- Nothing outside `lib/pipeline/` and `lib/gemini.ts` should ever import `GEMINI_API_KEY` directly — route through the pipeline layer.
