# Project Overview

## About the Project

GEO Auditor is a tool that tells a business owner whether they actually exist inside AI-generated
answers — ChatGPT, Perplexity, Claude, Google AI Overviews — not just whether they rank on Google.

A user enters a business (at minimum a website URL). The tool scrapes the site, queries a real AI
engine with the kinds of questions a customer would actually ask, and cross-checks the business's
footprint elsewhere on the web. It returns a single visibility score with a full breakdown, a list of
specific evidenced findings, and a prioritized fix list the owner can act on immediately.

This is a take-home submission for Phaze AI (Product Developer, AI Products). It is not a SaaS — no
auth, no accounts, no billing, no production deployment requirement. The report itself is the product
being evaluated.

---

## The Problem It Solves

SEO's entire playbook — keywords, backlinks, meta tags — was built for a search engine that returns a
list of links. AI engines don't do that. They synthesize an answer from a handful of sources they
choose to trust, and most businesses have no visibility into why they were or weren't one of those
sources. A business can rank #1 on Google and be invisible in every AI answer about their own
category, and never know it.

GEO Auditor makes that invisibility visible, with evidence, and tells the owner exactly what to fix
first.

---

## Why These Three Checks (and not others)

Research question: what actually makes an AI engine cite one source over another? Two things showed
up consistently — (1) AI engines can only cite what they can technically access and structurally parse,
and (2) AI engines overwhelmingly cite third-party consensus over a company's own marketing copy. A
third, more direct signal — just asking a real AI engine and watching what it does — closes the loop
between theory and reality.

That gave three pillars, each testing something the other two can't:

| Pillar | Weight | Question it answers | What it can't answer |
|---|---|---|---|
| Structural Answerability | 35 pts | Can an AI engine even access and parse this site? | Whether the AI actually chooses to use it |
| Live AI Citation Test | 45 pts | Does a real AI engine actually mention/cite this business today? | Why — needs the other two pillars for root cause |
| Third-Party Corroboration | 20 pts | Does anyone other than the business itself vouch for it online? | Nothing about the business's own site quality |

**Research trail — keep this visible, not just the conclusion.** The brief weighs "Research & what you
chose to check" as the single biggest grading category (30%), and it's reading reasoning, not just
final picks. As sources get read and AI engines get poked at during research, log what was actually
checked — articles/docs read, early GEO tools inspected, and specific observations from testing real
queries against an AI engine (e.g. "Gemini cited the Yelp listing over the business's own homepage for
a near-identical query three times in a row") — as a running list, even informally, so the README's
research section can point to specifics instead of asserting conclusions with nothing under them.

Deliberately excluded (documented in README as cut, not missed):
- **Classic technical SEO** (page speed, meta descriptions, backlink count) — well-covered by existing
  tools, not GEO-specific, doesn't predict AI citation behavior.
- **Multi-engine live testing** (ChatGPT + Claude + Gemini in parallel) — Gemini's Google Search
  grounding alone gives native, verifiable citations in one deterministic pass, on a free API tier;
  adding paid engines multiplies cost and API surface without changing the finding quality for a first
  version. Flagged as first thing to add with more time.
- **Content freshness/update frequency** — plausible signal, but not verifiable within a single scrape
  without historical data; would need to be honestly labeled speculative.

---

## Why Gemini, Not a Paid Engine

The live citation test needs an AI engine that (a) actually browses/searches the live web rather than
answering from training data, and (b) returns real, checkable source URLs — not just prose. Google
Gemini's **Search grounding** tool does both, and unlike Perplexity or OpenAI's browsing tools, it's
available on a genuinely free API tier through Google AI Studio, no card required. That constraint
turned into a design decision worth stating plainly in the README: the whole tool runs on a single
free API key, so anyone reviewing this submission can run it themselves in minutes without needing to
provision a paid account first. One provider also means one client, one auth pattern, one failure mode
to handle — less surface area for an 8–12 hour build.

---

## Users

A small business owner or marketer who ranks fine on Google, has heard the term "AI search" or "GEO,"
and wants to know in plain language: am I invisible, why, and what do I do about it. Not an SEO
professional — the report must never require the reader to already know what "schema markup" means.

---

## Pages

```
/                      → Landing + audit input (business name + URL)
/audit/[id]            → Running state → full report once complete
/api/audit              → POST — kicks off a new audit run
/api/audit/[id]         → GET — poll audit status / fetch result
/api/audit/[id]/pdf     → GET — generate and download PDF version of the report
```

No navbar, no auth, no multi-page app shell — this is a single focused flow: enter a business, watch it
run, read the report, export it.

---

## Core User Flow

1. User lands on `/`, enters a business name and website URL
2. Submits → redirected to `/audit/[id]` showing a live progress state (scraping → querying AI → cross-checking → scoring)
3. Pipeline runs server-side across all three pillars (see architecture.md for stages)
4. Report renders in place once complete:
   - Score hero: total /100, ring or bar breakdown by pillar
   - Findings list: grouped by pillar, each with evidence (quoted text, screenshot-equivalent snippet, or citation list) and a severity tag
   - Fix list: ordered by impact × effort, each fix copy-pasteable where the fix is text/code (e.g. exact JSON-LD block to paste in, exact robots.txt line to add)
5. User can download the same report as a PDF from the report page

---

## Report Requirements (non-negotiable — this is what's graded)

- Total score always shown with its pillar breakdown visible — never a bare number
- Every finding has: what was checked → what was found → evidence → what it should be instead
- Every fix has: what to do, why it matters (plain language), estimated effort, estimated impact,
  and copy-pasteable content when the fix is a text/code artifact (JSON-LD snippet, robots.txt line,
  an FAQ block draft)
- No jargon without an inline one-line explanation ("Schema markup — a hidden code block that tells AI
  systems what your page is about, without changing how it looks to visitors.")
- Findings are specific to the audited business — nothing generic that would read identically for any
  other site. If a pillar can't produce a specific finding, the pipeline must say so honestly rather
  than filling in generic advice.

---

## Features In Scope

- URL + business name input, single-page flow
- Server-side scraping of the target site (homepage + up to 2 linked pages: About, FAQ if present)
- robots.txt fetch and AI-crawler access parsing
- Schema.org JSON-LD detection and validation
- Direct-answer clarity check (LLM-graded, with the exact excerpt used as evidence)
- FAQ content detection
- Live query of Google Gemini (Search-grounded) with 3–5 realistic customer questions per business,
  citation extraction, and the raw AI answer text captured as evidence
- Third-party presence check via the same Gemini search-grounded query pattern
- Deterministic, transparent scoring formula (pure function, fully unit-testable)
- Web report UI with full breakdown
- PDF export of the same report
- File-based persistence of completed audits (JSON on disk) so the three required real-business runs are reproducible without re-spending API calls

## Features Out of Scope

- Auth, accounts, billing
- A database — file-based JSON storage is sufficient and explicitly preferred per the brief
- Production deployment — local run + demo video is the deliverable
- Tests/CI/Docker — not graded, skipped
- Mobile responsiveness — not graded
- Multi-engine live AI testing (ChatGPT, Claude, in addition to Gemini) — noted as v2
- Historical tracking / re-running audits over time to show trend
- Handling arbitrary/adversarial websites — built and tuned against 3–5 real businesses, not general-purpose

---

## What Makes This Submission Stand Out

The brief scores Research (30%) and Report Quality (25%) as 55% of the total — most candidates will
compete on Technical Execution instead, because it's the part that's easiest to control. These are the
deliberate choices aimed at the two categories that actually decide the outcome:

1. **The verdict line is the first thing anyone reads.** Every report opens with one AI-generated
   sentence stating the finding in plain terms before any score or breakdown — e.g. "AI search engines
   currently don't know you exist outside your own website." This is the exact "moment" the brief
   describes wanting to build for. Most GEO tools bury this fact under a dashboard.
2. **The raw AI answer is shown, not summarized.** When Gemini is asked "who is [business]" and
   doesn't mention them, the report shows the actual answer text it gave instead — proof, in the AI's
   own words, rather than a claim about what the AI said. This is the single most persuasive artifact
   in the whole report and it's rendered prominently, not buried in a citations list.
3. **Every unavailable result is shown, not hidden.** If a free-tier rate limit kills a pillar mid-run,
   the report says so plainly instead of quietly showing a lower score with no explanation. This is a
   product-judgment signal, not just an engineering nicety — it's the difference between a tool that
   feels trustworthy and one that feels like it's guessing.
4. **Zero paid dependencies, stated as a decision.** The entire pipeline runs on one free-tier API key.
   This isn't a limitation to apologize for in the README — it's evidence of scoping a real product
   decision (cost, reproducibility, reviewer friction) rather than defaulting to whatever API is most
   familiar.
5. **The report is designed to be forwarded.** PDF export exists specifically so a marketer/agency
   using this tool can hand the exact report to a business owner or client with no further editing —
   matching the brief's "copy-pasteable wherever the fix allows it" requirement at the level of the
   whole deliverable, not just individual fixes.

---

## Success Criteria

- Running the tool against a business the reviewer has never seen produces specific, evidenced, non-generic findings
- The score breakdown is fully traceable — every point can be explained
- At least one finding per audit is something a typical SEO tool would not surface (the crawler-access or citation-test findings)
- Report reads cleanly for a non-technical business owner end to end
- Pipeline runs against 3–5 real, messy real-world sites without crashing
- Three real audit reports are included as actual outputs, not mocked
