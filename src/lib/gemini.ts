const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const OPENROUTER_CHAT_URL = `${OPENROUTER_BASE}/chat/completions`;
const MODEL = process.env.OPENROUTER_MODEL?.trim() || "openrouter/free";

// Free-tier model IDs get delisted without notice (that's exactly what happened to
// qwen/qwen3-coder:free). Never hard-code a mission to one :free slug — if the configured
// model 404s, rotate down this list so a single delisted model never breaks the audit.
const MODEL_FALLBACKS = [
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-20b:free",
  "openrouter/free",
];
let activeModel = MODEL;

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const SEARCH_MAX_RESULTS = 5;
const SEARCH_TIMEOUT_MS = 12000;

export function normalizeHostname(hostname: string): string {
  return hostname.replace(/^www\./, "").toLowerCase();
}

// Web-search plugin citations are already real source URLs (no Google resolver
// redirects), but we still HEAD-follow to handle any provider redirect or shortlink
// with an in-memory cache per run — the same source recurs across queries.
export async function resolveCitationUrl(
  uri: string,
  cache: Map<string, string>,
): Promise<string> {
  const cached = cache.get(uri);
  if (cached) return cached;

  let finalUrl = uri;
  try {
    const response = await fetch(uri, { method: "HEAD", redirect: "follow" });
    finalUrl = response.url;
  } catch {}
  cache.set(uri, finalUrl);
  return finalUrl;
}

export type GroundedResult = {
  answerText: string;
  citedUrls: string[];
};

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 1;
const RETRY_BACKOFF_MS = 1200;
// OpenRouter free tier enforces a hard per-day request cap ("free-models-per-day"). Once
// reached, every call 429s with a reset timestamp far in the future — retrying can never
// succeed within this run, so we detect that specific cap and abort fast instead of stalling.
const FREE_TIER_DAILY_CAP_MARKERS = [
  "free-models-per-day",
  "openrouter_free_tier_daily",
  "rate limit reached for free tier",
];
// Hard timeout per request. The free route can be backed up, and without this a single
// slow/hung call stalls the whole audit while the report page keeps polling. Timeouts and
// network errors abort immediately (no retry); only transient HTTP statuses (429/5xx) retry.
const REQUEST_TIMEOUT_MS = 15000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isFreeTierDailyCap(body: string): boolean {
  return FREE_TIER_DAILY_CAP_MARKERS.some((marker) => body.toLowerCase().includes(marker));
}

async function callWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastStatus = 0;
  let lastBody = "";
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await delay(RETRY_BACKOFF_MS * attempt);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`OpenRouter request timed out after ${REQUEST_TIMEOUT_MS}ms`);
      }
      throw error;
    }
    clearTimeout(timeout);
    if (!response.ok) {
      lastStatus = response.status;
      // Capture the provider's error body — it names the real cause (auth, quota,
      // model capability) so the pipeline log can tell us exactly why it failed.
      try {
        lastBody = await response.text();
      } catch {}
      // A hard daily-cap 429 will not clear within this run, so fail fast with a clear
      // message rather than burning a retry (and its timeout window) on a call that cannot
      // succeed. Only plain transient 429s still get retried.
      if (response.status === 429 && isFreeTierDailyCap(lastBody)) {
        throw new Error(
          `OpenRouter free-tier daily request limit reached. Add credits or wait for the daily reset to continue. ${lastBody.slice(0, 200)}`,
        );
      }
      if (!RETRYABLE_STATUS.has(response.status)) {
        const detail = lastBody ? ` ${lastBody.slice(0, 300)}` : "";
        throw new Error(`OpenRouter API error: ${lastStatus}${detail}`);
      }
      continue;
    }
    return response;
  }
  const detail = lastBody ? ` ${lastBody.slice(0, 300)}` : "";
  throw new Error(`OpenRouter API error: ${lastStatus}${detail}`);
}

async function chatCompletion(
  prompt: string,
  options: { temperature?: number; webSearch?: boolean },
): Promise<{ content: string; citations: string[] }> {
  const candidates = [activeModel, ...MODEL_FALLBACKS].filter(
    (m, i, all) => all.indexOf(m) === i,
  );

  let lastError: unknown;
  for (const model of candidates) {
    const body: Record<string, unknown> = {
      model,
      messages: [{ role: "user", content: prompt }],
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.webSearch) body.plugins = [{ id: "web", max_results: 5 }];

    let response: Response;
    try {
      response = await callWithRetry(OPENROUTER_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      // A delisted/unavailable free model 404s — rotate to the next candidate instead of
      // failing the whole pillar. Any other error (auth, quota, timeout) propagates.
      if (message.includes("404")) {
        console.error(`[gemini] model ${model} unavailable, trying next candidate`);
        continue;
      }
      throw error;
    }

    const data = await response.json();
    const content: string | undefined = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content.trim() === "") {
      throw new Error("OpenRouter returned no content");
    }
    // Web-plugin citations can arrive in two shapes: `message.citations[].url` (newer) or
    // `message.annotations[].url_citation.url` (original web-plugin shape). Read both so a
    // paid web-capable model produces real citations.
    const message = data.choices?.[0]?.message;
    const direct: { url?: string }[] = message?.citations ?? [];
    const annotated: { url_citation?: { url?: string } }[] = message?.annotations ?? [];
    const citations: string[] = [
      ...direct.map((c) => c.url),
      ...annotated.map((a) => a.url_citation?.url),
    ].filter((u: string | undefined): u is string => Boolean(u));

    // Remember the working model so subsequent calls skip the dead slug.
    activeModel = model;
    return { content, citations };
  }

  throw lastError;
}

export async function geminiJson<T>(
  prompt: string,
  temperature = 0,
): Promise<T> {
  const { content } = await chatCompletion(prompt, { temperature });
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  return JSON.parse(cleaned) as T;
}

type TavilyResult = { title?: string; url?: string; content?: string };

// Real web search via Tavily's free tier — returns actual source URLs. This is the search
// half of the "grounded query"; the model half is a plain OpenRouter call (free models can't
// do OpenRouter's paid web plugin, so we search ourselves and hand the model the results).
async function searchTavily(query: string): Promise<TavilyResult[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        max_results: SEARCH_MAX_RESULTS,
        search_depth: "basic",
        include_answer: false,
        include_images: false,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Web search timed out after ${SEARCH_TIMEOUT_MS}ms`);
    }
    throw error;
  }
  clearTimeout(timeout);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Web search API error: ${response.status} ${body.slice(0, 300)}`);
  }
  const data = await response.json();
  const results: TavilyResult[] = data.results ?? [];
  return results.filter((r) => Boolean(r.url));
}

function groundedPrompt(query: string, results: TavilyResult[]): string {
  const sources = results
    .map(
      (r, i) =>
        `${i + 1}. ${r.title ?? "Untitled"} — ${r.url}\n   ${(r.content ?? "").slice(0, 800)}`,
    )
    .join("\n\n");
  return `You are given live web search results for the query: "${query}".

The following sources were returned (each with its URL):

${sources}

Answer the original question thoroughly, writing naturally as a helpful assistant. Base your answer
only on these sources. When you mention a point, cite the source URL inline as a plain parenthetical,
e.g. (https://example.com/page). Your answer will be shown to a business owner, so be clear and
concrete, but do not invent facts that are not in the sources.`;
}

export async function geminiGroundedQuery(prompt: string): Promise<GroundedResult> {
  // Primary path: real citations via Tavily search + the (free) OpenRouter model synthesizes.
  if (process.env.TAVILY_API_KEY) {
    const results = await searchTavily(prompt);
    if (results.length === 0) {
      throw new Error("Web search returned no results");
    }
    const { content } = await chatCompletion(groundedPrompt(prompt, results), { temperature: 0.5 });
    return { answerText: content, citedUrls: results.map((r) => r.url as string) };
  }

  // Fallback path: OpenRouter's own "web" plugin — only works on paid online-capable models
  // (e.g. OPENROUTER_MODEL=openrouter/auto). An unsupported model errors here, which the
  // pipeline treats as the pillar being "unavailable" rather than fabricating citations.
  const { content, citations } = await chatCompletion(prompt, { webSearch: true });
  return { answerText: content, citedUrls: citations };
}