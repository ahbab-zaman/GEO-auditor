const GROQ_BASE = "https://api.groq.com/openai/v1";
const GROQ_CHAT_URL = `${GROQ_BASE}/chat/completions`;
const GROQ_MODEL = "groq/compound";
const GROQ_TIMEOUT_MS = 90_000;

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const OPENROUTER_CHAT_URL = `${OPENROUTER_BASE}/chat/completions`;
const OPENROUTER_MODEL = "openrouter/free";
const OPENROUTER_TIMEOUT_MS = 15_000;

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const SEARCH_MAX_RESULTS = 5;
const SEARCH_TIMEOUT_MS = 12_000;

// OpenRouter free tier can still rate-limit or delist a route. Keep the fallback to a single
// stable slug so the code does not rotate across extra models.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 1;
const RETRY_BACKOFF_MS = 1200;
const OPENROUTER_FREE_TIER_DAILY_CAP_MARKERS = [
  "free-models-per-day",
  "openrouter_free_tier_daily",
  "rate limit reached for free tier",
];

type ChatCompletionOptions = {
  temperature?: number;
  webSearch?: boolean;
};

type ProviderConfig = {
  name: string;
  url: string;
  model: string;
  timeoutMs: number;
  apiKey: string | undefined;
  supportsWebPlugin: boolean;
  freeTierDailyCapMarkers?: string[];
};

const GROQ_PROVIDER: ProviderConfig = {
  name: "Groq Compound",
  url: GROQ_CHAT_URL,
  model: GROQ_MODEL,
  timeoutMs: GROQ_TIMEOUT_MS,
  apiKey: process.env.GROQ_API_KEY,
  supportsWebPlugin: false,
};

const OPENROUTER_PROVIDER: ProviderConfig = {
  name: "OpenRouter",
  url: OPENROUTER_CHAT_URL,
  model: OPENROUTER_MODEL,
  timeoutMs: OPENROUTER_TIMEOUT_MS,
  apiKey: process.env.OPENROUTER_API_KEY,
  supportsWebPlugin: true,
  freeTierDailyCapMarkers: OPENROUTER_FREE_TIER_DAILY_CAP_MARKERS,
};

export function normalizeHostname(hostname: string): string {
  return hostname.replace(/^www\./, "").toLowerCase();
}

// Web-search citations are already real source URLs, but we still HEAD-follow to handle
// provider redirects or shortlinks with an in-memory cache per run.
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

type SearchResult = { title?: string; url?: string; content?: string };
type ExecutedTool = { search_results?: SearchResult[] };
type CompletionMessage = {
  content?: string;
  citations?: { url?: string }[];
  annotations?: { url_citation?: { url?: string } }[];
  executed_tools?: ExecutedTool[];
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toStringArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === "string") return [item];
      if (item && typeof item === "object") {
        const url = (item as { url?: unknown }).url;
        return typeof url === "string" ? [url] : [];
      }
      return [];
    });
  }
  if (typeof value === "object") {
    return Object.values(value).flatMap((item) => toStringArray(item));
  }
  return [];
}

function isFreeTierDailyCap(body: string, markers?: string[]): boolean {
  if (!markers) return false;
  const lower = body.toLowerCase();
  return markers.some((marker) => lower.includes(marker));
}

async function callWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  label: string,
  freeTierDailyCapMarkers?: string[],
): Promise<Response> {
  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await delay(RETRY_BACKOFF_MS * attempt);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`${label} request timed out after ${timeoutMs}ms`);
      }
      throw error;
    }
    clearTimeout(timeout);

    if (!response.ok) {
      lastStatus = response.status;
      try {
        lastBody = await response.text();
      } catch {}

      if (response.status === 429 && isFreeTierDailyCap(lastBody, freeTierDailyCapMarkers)) {
        throw new Error(
          `${label} daily request limit reached. Add credits or wait for the reset to continue. ${lastBody.slice(0, 200)}`,
        );
      }

      if (!RETRYABLE_STATUS.has(response.status)) {
        const detail = lastBody ? ` ${lastBody.slice(0, 300)}` : "";
        throw new Error(`${label} API error: ${lastStatus}${detail}`);
      }
      continue;
    }

    return response;
  }

  const detail = lastBody ? ` ${lastBody.slice(0, 300)}` : "";
  throw new Error(`${label} API error: ${lastStatus}${detail}`);
}

function extractCitations(message: CompletionMessage | undefined): string[] {
  if (!message) return [];

  const fromCitations = (message.citations ?? [])
    .map((citation) => citation.url)
    .filter((url): url is string => Boolean(url));

  const fromAnnotations = (message.annotations ?? [])
    .map((annotation) => annotation.url_citation?.url)
    .filter((url): url is string => Boolean(url));

  const fromTools = (message.executed_tools ?? []).flatMap((tool) =>
    toStringArray(tool.search_results),
  );

  return [...new Set([...fromCitations, ...fromAnnotations, ...fromTools])];
}

async function callCompletion(
  provider: ProviderConfig,
  prompt: string,
  options: ChatCompletionOptions,
): Promise<{ content: string; citations: string[] }> {
  if (!provider.apiKey) {
    throw new Error(`${provider.name} API key is not set`);
  }

  const body: Record<string, unknown> = {
    model: provider.model,
    messages: [{ role: "user", content: prompt }],
  };
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.webSearch && provider.supportsWebPlugin) {
    body.plugins = [{ id: "web", max_results: SEARCH_MAX_RESULTS }];
  }

  const response = await callWithRetry(
    provider.url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(body),
    },
    provider.timeoutMs,
    provider.name,
    provider.freeTierDailyCapMarkers,
  );

  const data = await response.json();
  const message: CompletionMessage | undefined = data.choices?.[0]?.message;
  const content = message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new Error(`${provider.name} returned no content`);
  }

  return { content, citations: extractCitations(message) };
}

async function groqCompletion(
  prompt: string,
  options: ChatCompletionOptions,
): Promise<{ content: string; citations: string[] }> {
  return callCompletion(GROQ_PROVIDER, prompt, options);
}

async function openRouterCompletion(
  prompt: string,
  options: ChatCompletionOptions,
): Promise<{ content: string; citations: string[] }> {
  return callCompletion(OPENROUTER_PROVIDER, prompt, options);
}

export async function geminiJson<T>(
  prompt: string,
  temperature = 0,
): Promise<T> {
  try {
    const { content } = await groqCompletion(prompt, { temperature });
    const cleaned = content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "");
    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.error("[gemini] Groq JSON call failed, falling back to OpenRouter", error);
    const { content } = await openRouterCompletion(prompt, { temperature });
    const cleaned = content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/, "");
    return JSON.parse(cleaned) as T;
  }
}

type TavilyResult = { title?: string; url?: string; content?: string };

// Real web search via Tavily's free tier. This remains only as a fallback path for when Groq's
// compound system is unavailable.
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

async function fallbackGroundedQuery(prompt: string): Promise<GroundedResult> {
  if (process.env.TAVILY_API_KEY) {
    const results = await searchTavily(prompt);
    if (results.length === 0) {
      throw new Error("Web search returned no results");
    }
    const { content } = await openRouterCompletion(groundedPrompt(prompt, results), {
      temperature: 0.5,
    });
    return { answerText: content, citedUrls: results.map((r) => r.url as string) };
  }

  const { content, citations } = await openRouterCompletion(prompt, { webSearch: true });
  return { answerText: content, citedUrls: citations };
}

export async function geminiGroundedQuery(prompt: string): Promise<GroundedResult> {
  try {
    return await fallbackGroundedQuery(prompt);
  } catch (error) {
    console.error("[gemini] grounded query failed", error);
    return { answerText: "No grounded answer could be retrieved.", citedUrls: [] };
  }
}
