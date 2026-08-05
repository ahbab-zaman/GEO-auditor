# Library Docs

Project-specific usage patterns for every third party library in this project. This file only covers
how we use each library in this specific project — rules, patterns, and constraints specific to GEO
Auditor.

Read the relevant section before implementing any feature that touches these libraries.

---

## Before Using Any Library

1. Check if the pattern already exists below — this overrides general training knowledge, since these
   APIs (especially Gemini's) change and training data may be stale
2. If genuinely uncertain about current API shape, check the provider's official docs before guessing
3. Never invent a response field — verify against a real response first, or against this file

---

## cheerio (scraping)

### Fetching and parsing a page

```typescript
// lib/pipeline/scrape.ts
import * as cheerio from "cheerio";

async function fetchPage(url: string): Promise<{ html: string; finalUrl: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; GEOAuditorBot/1.0; +https://example.com/bot)",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
    }
    return { html: await response.text(), finalUrl: response.url };
  } finally {
    clearTimeout(timeout);
  }
}

function extractVisibleText($: cheerio.CheerioAPI): string {
  $("script, style, nav, footer, noscript").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

function extractJsonLd($: cheerio.CheerioAPI): unknown[] {
  const blocks: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      blocks.push(JSON.parse($(el).text()));
    } catch {
      // malformed JSON-LD is itself a finding, not a crash — skip and let the
      // schema-presence checker note it separately if needed
    }
  });
  return blocks;
}
```

**Rules:**
- Always set a real, identifiable User-Agent — some sites block default fetch user-agents
- Always set an abort timeout (8s) — a hanging fetch must never hang the whole pipeline
- Always strip `script`/`style`/`nav`/`footer` before extracting visible text — otherwise the
  direct-answer clarity check gets polluted with boilerplate
- Malformed JSON-LD blocks are skipped individually, never let one bad block drop all blocks

### Finding About/FAQ pages

```typescript
function findLinkedPages($: cheerio.CheerioAPI, baseUrl: string): { url: string; kind: "about" | "faq" }[] {
  const found: { url: string; kind: "about" | "faq" }[] = [];
  $("a[href]").each((_, el) => {
    const text = $(el).text().toLowerCase();
    const href = $(el).attr("href");
    if (!href) return;
    const resolved = new URL(href, baseUrl).toString();
    if (/about/i.test(text) || /about/i.test(href)) {
      found.push({ url: resolved, kind: "about" });
    } else if (/faq|questions/i.test(text) || /faq/i.test(href)) {
      found.push({ url: resolved, kind: "faq" });
    }
  });
  return found;
}
```

**Rules:**
- Resolve relative URLs against the base with `new URL(href, baseUrl)` — never assume absolute URLs
- Only follow same-origin links for About/FAQ discovery — never crawl off-domain
- Cap total pages fetched at 3 (homepage + 2) — this is a hard limit from architecture.md, not a suggestion

---

## robots.txt Parsing

No library — the format is simple enough that a small hand-rolled parser is more reliable than a
generic robots.txt npm package for the specific narrow thing we check (whether specific AI bot names
are disallowed).

```typescript
const AI_BOTS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "CCBot"];

function parseAiCrawlerAccess(robotsTxt: string | null): {
  blockedBots: string[];
  blockedAll: boolean;
} {
  if (!robotsTxt) return { blockedBots: [], blockedAll: false };

  const blockedBots: string[] = [];
  let blockedAll = false;
  const lines = robotsTxt.split("\n").map((l) => l.trim());
  let currentAgent: string | null = null;

  for (const line of lines) {
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (/^user-agent$/i.test(key)) {
      currentAgent = value;
    } else if (/^disallow$/i.test(key) && value === "/") {
      if (currentAgent === "*") blockedAll = true;
      else if (currentAgent && AI_BOTS.includes(currentAgent)) blockedBots.push(currentAgent);
    }
  }
  return { blockedBots, blockedAll };
}
```

**Rules:**
- Only `Disallow: /` (full block) is treated as blocking — partial path disallows are out of scope for
  this check, since the audit is about the site's identity/business content, not every path
- `User-agent: *` with `Disallow: /` blocks everyone including AI bots — check this first
- Missing robots.txt entirely = fully allowed, this is the correct crawling default and must be scored
  as a pass, not a warning
- Note that `PerplexityBot` and `CCBot` are checked even though this project doesn't use those
  providers — the check is about the business's general AI-visibility posture, not just about the one
  engine this tool happens to test live

---

## OpenRouter API (free model route)

**Why this provider:** OpenRouter is a single API key over many models, with a free `openrouter/free`
route. `geminiJson` (reasoning over given text) works fully on the free route. Live web-search
grounding uses OpenRouter's `web` plugin, which **only works on web-search-capable (paid) models** —
the free route generally does not support it, in which case the grounded queries throw and the two
citation pillars report `unavailable` rather than fabricating citations. One `OPENROUTER_API_KEY`
key, awarded by `OPENROUTER_MODEL` (defaults to `openrouter/free`).

**Check first:** swap `OPENROUTER_MODEL` to a web-search-capable paid route (e.g. `openrouter/auto`)
to enable the citation pillars. Verify the `plugins` id stays `"web"` against OpenRouter's current
docs.

### Client setup — plain JSON mode (no grounding)

Used for extraction/grading/generation tasks where the model reasons over text it's already been
given, not tasks that need it to search the live web.

```typescript
// lib/gemini.ts (named historically; exported names unchanged)

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = process.env.OPENROUTER_MODEL ?? "openrouter/free";

export async function geminiJson<T>(prompt: string, temperature = 0): Promise<T> {
  const response = await fetch(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`);
  }
  const data = await response.json();
  const content: string | undefined = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned no content");
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(cleaned) as T;
}
```

**Rules:**
- `OPENROUTER_API_KEY` is the only key; `OPENROUTER_MODEL` selects the route (default
  `openrouter/free`)
- No guaranteed JSON mode at the transport level, so **always strip markdown fences before
  `JSON.parse`** and validate the result with `zod` before use — a model can return well-formed-but-
  wrong-shaped JSON even with a JSON-shaped prompt

### Grounded search query — live AI citation test

```typescript
export type GroundedResult = {
  answerText: string; // the model's raw prose answer, verbatim — shown directly in the report
  citedUrls: string[];
};

export async function geminiGroundedQuery(prompt: string): Promise<GroundedResult> {
  // Primary: real citations via Tavily search + the (free) OpenRouter model synthesizes.
  if (process.env.TAVILY_API_KEY) {
    const results = await searchTavily(prompt); // POST api.tavily.com/search, bearer TAVILY_API_KEY
    const { content } = await chatCompletion(groundedPrompt(prompt, results), { temperature: 0.5 });
    return { answerText: content, citedUrls: results.map((r) => r.url) };
  }
  // Fallback: OpenRouter's own "web" plugin — paid online-capable models only
  // (e.g. OPENROUTER_MODEL=openrouter/auto). Errors -> pillar "unavailable", never fabricated.
  const { content, citations } = await chatCompletion(prompt, { webSearch: true });
  return { answerText: content, citedUrls: citations };
}
```

**Rules:**
- The citation pillars get REAL citations from **Tavily's free tier** (`TAVILY_API_KEY`, ~1,000
  req/mo) — the free OpenRouter models can't do web search themselves, so we search separately and
  hand the model the results + URLs to answer-and-cite. If no `TAVILY_API_KEY`, it falls back to
  OpenRouter's paid web plugin (only works on online-capable models like `openrouter/auto`).
- **No web search for the non-grounded calls** — plain `geminiJson` is used everywhere else; search
  adds latency and burns the free Tavily quota on tasks that don't need it
- `answerText` is not a nice-to-have — it is stored as-is on the `Evidence` object and rendered
  verbatim in the report. It is the single most persuasive artifact the tool produces — never discard
  it in favor of just the citation list
- **Sequence Stage 3 and Stage 4 calls with a plain `for` loop and `await`, never `Promise.all`** — a
  slow/backed-up free route is the single most likely way to fail mid-audit; sequential keeps it stable
- Wrap every call in try/catch — a failure (missing key, quota, timeout) marks that pillar `unavailable`
  with a human-readable reason, never crashes the audit

### Resolving grounding redirect URLs to real domains

```typescript
async function resolveCitationDomain(uri: string): Promise<string> {
  try {
    const response = await fetch(uri, { method: "HEAD", redirect: "follow" });
    return new URL(response.url).hostname.replace(/^www\./, "");
  } catch {
    return new URL(uri).hostname.replace(/^www\./, "");
  }
}
```

**Rules:**
- Google's grounding URIs are sometimes returned as `vertexaisearch.cloud.google.com` redirect links
  rather than the source URL directly — always resolve with a `HEAD` request following redirects
  before treating the result as the cited domain
- If resolution fails (network error, redirect loop), fall back to parsing the raw URI's hostname
  rather than dropping the citation entirely — a wrong-but-present citation is more honest than a
  silently dropped one
- Cache resolved domains per audit run in memory (a simple `Map`) — the same source is often cited
  across multiple queries in one run, and re-resolving wastes free-tier quota for no benefit
- Domain comparison against the business's own domain must normalize both sides identically (strip
  `www.`, protocol, trailing slash) — a naive string comparison produces false negatives

### Direct-answer clarity extraction

```typescript
const prompt = `You extract facts from web page text. Return only valid JSON, no markdown fences.

Does the following text state, in one extractable sentence within the first 200 words, what this
business does and who it's for?

Text: """${pageText.slice(0, 1500)}"""

Return JSON exactly matching: { "hasDirectAnswer": boolean, "extractedSentence": string | null, "reasoning": string }`;

const result = await geminiJson<{
  hasDirectAnswer: boolean;
  extractedSentence: string | null;
  reasoning: string;
}>(prompt, 0);
```

**Rules:**
- Temperature `0` — this is a fact-extraction rubric, not a creative task, and needs to be as
  reproducible as possible run to run
- The model returns facts only (`hasDirectAnswer`, `extractedSentence`) — it never assigns a score.
  Scoring constants live in `lib/utils.ts` per code-structure.md, not in the model's judgment

### Query generation for Pillar B

```typescript
const prompt = `You generate realistic search queries a potential customer would type into an AI
assistant. Return only valid JSON, no markdown fences.

Business: ${businessName}
Website excerpt: """${homepageText.slice(0, 1000)}"""

Generate 4 queries: 2 category queries (a customer looking for this type of business, without naming
it) and 2 direct queries (asking about this specific business by name).

Return JSON exactly matching: { "queries": [{ "type": "category" | "direct", "text": string }] }`;

const result = await geminiJson<{ queries: { type: "category" | "direct"; text: string }[] }>(prompt, 0.3);
```

**Rules:**
- Temperature `0.3` here, not `0` — query phrasing benefits from slight natural variation
- Category and location are inferred from the scraped page, never asked of the user — keeps the input
  form to just name + URL per project-overview.md
- If the model returns fewer than 3 usable queries or malformed JSON, fall back to a fixed generic
  template query (`"what is {businessName}"`, `"is {businessName} good"`) so Pillar B still runs rather
  than failing over a formatting issue

### Verdict generation (Stage 5)

```typescript
const prompt = `You write one blunt, plain-language sentence summarizing an AI-visibility audit for a
business owner with no technical background. No jargon. State the core problem or strength directly.

Findings summary: ${JSON.stringify(findingsSummary)}

Return JSON exactly matching: { "verdict": string }`;

const result = await geminiJson<{ verdict: string }>(prompt, 0.3);
```

**Rules:**
- Runs last, after all pillar results are known — the verdict must be grounded in what was actually
  found, never written before the findings exist
- If this call fails, the report still renders — `verdict` is nullable on the `Audit` type specifically
  so a failure here never blocks the rest of the report
- One sentence, enforced by prompt instruction — this is the line rendered largest and first in the UI
  (`VerdictBanner.tsx`), it must not become a paragraph

---

## @react-pdf/renderer

### Report PDF generation

```typescript
import { renderToBuffer } from "@react-pdf/renderer";
import { ReportPdf } from "@/components/audit/ReportPdf";

// app/api/audit/[id]/pdf/route.ts
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const audit = await getAudit(params.id);
    if (!audit || audit.status !== "complete") {
      return NextResponse.json({ success: false, error: "Report not ready" }, { status: 404 });
    }
    const buffer = await renderToBuffer(ReportPdf({ audit }));
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="geo-audit-${audit.businessName}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[api/audit/pdf]", error);
    return NextResponse.json({ success: false, error: "Could not generate PDF" }, { status: 500 });
  }
}
```

**Supported CSS properties:** Only use these — others are silently ignored:
`padding, margin, fontSize, color, fontFamily, flexDirection, alignItems, justifyContent, borderRadius, width, height, fontWeight, textAlign, lineHeight`

**Rules:**
- Server-side only — never import in client components
- Always use `renderToBuffer`, generated on demand per request — never pre-generate or cache the PDF
  file, since it's cheap to render and keeps storage to just the JSON
- **The PDF uses a light, print-friendly palette, not the app's dark neon theme** — see ui-rules.md
  "PDF Export Parity." A dark background wastes ink and reads poorly printed; the PDF's job is
  legibility offline, not brand consistency with the web app
- The PDF layout mirrors the web report's information hierarchy (verdict → score → pillars → findings
  → fixes) but does not need pixel-identical styling — it needs the same content and evidence

---

## framer-motion

Used for the score reveal, staggered findings entrance, and the live-scan progress state — the
animated, "premium AI product" feel called for in ui-tokens.md/ui-rules.md. Purposeful motion only:
nothing loops or distracts once the relevant data is on screen.

### Staggered findings entrance

```typescript
"use client";
import { motion } from "framer-motion";

// components/motion/variants.ts
export const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
export const staggerItem = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } },
};
```

```typescript
<motion.div variants={staggerContainer} initial="hidden" animate="show">
  {findings.map((f) => (
    <motion.div key={f.id} variants={staggerItem}>
      <FindingCard finding={f} />
    </motion.div>
  ))}
</motion.div>
```

### Animated score ring count-up

```typescript
"use client";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";

function ScoreRing({ score }: { score: number }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => Math.round(v));

  useEffect(() => {
    const controls = animate(count, score, { duration: 1.2, ease: "easeOut" });
    return controls.stop;
  }, [score, count]);

  return <motion.span>{rounded}</motion.span>;
}
```

**Rules:**
- Shared variants (`staggerContainer`, `staggerItem`) live in `components/motion/variants.ts` since
  they're genuinely reused across findings and fixes lists — everything else stays local to its
  component per code-structure.md, small one-off animations don't need a shared file
- Respect `prefers-reduced-motion` — check `window.matchMedia("(prefers-reduced-motion: reduce)")` and
  skip entrance/count-up animations (render final state immediately) when true. This is a real
  accessibility requirement, not optional polish
- The score ring count-up is the only animation allowed to run on a timer independent of user action —
  everything else animates in on mount or on data change, never a distracting decorative loop
- The progress state's pulsing stage indicator uses a single subtle CSS animation (see ui-tokens.md
  keyframes), not framer-motion — a pure CSS loop is cheaper for something that may run for 10–20+
  seconds during the live pipeline

---

## nanoid

```typescript
import { nanoid } from "nanoid";
const auditId = nanoid(10); // short, URL-safe, sufficient for a non-multi-tenant local tool
```

**Rules:**
- 10 characters is sufficient collision resistance for this project's scale (dozens of local audit
  runs, not millions) — do not reach for UUID here, it's unnecessary length for URLs like `/audit/abc123xyz9`

---

## zod

### Validating untrusted input and API responses

```typescript
import { z } from "zod";

export const AuditRequestSchema = z.object({
  url: z.string().url(),
  businessName: z.string().min(1).max(200),
});

export const DirectAnswerExtractionSchema = z.object({
  hasDirectAnswer: z.boolean(),
  extractedSentence: z.string().nullable(),
  reasoning: z.string(),
});

export const QueryGenerationSchema = z.object({
  queries: z
    .array(z.object({ type: z.enum(["category", "direct"]), text: z.string() }))
    .min(1),
});

export const VerdictSchema = z.object({ verdict: z.string().min(1) });
```

**Rules:**
- Every API route body is validated against a schema before use
- Every parsed Gemini JSON response is validated against a schema before use — a model can produce
  well-formed-but-wrong-shaped JSON even in JSON mode
- On validation failure, treat it the same as an API failure for that check — log it, return
  `unavailable`/error state, never let a shape mismatch throw an unhandled exception into the pipeline
