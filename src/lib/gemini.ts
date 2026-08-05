const OPENROUTER_BASE = "https://openrouter.ai/api/v1";
const OPENROUTER_CHAT_URL = `${OPENROUTER_BASE}/chat/completions`;
const MODEL = process.env.OPENROUTER_MODEL ?? "openrouter/free";

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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callWithRetry(url: string, init: RequestInit): Promise<Response> {
  let lastStatus = 0;
  let lastBody = "";
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await delay(RETRY_BACKOFF_MS * attempt);
    const response = await fetch(url, init);
    if (!response.ok) {
      lastStatus = response.status;
      // Capture the provider's error body — it names the real cause (auth, quota,
      // model capability) so the pipeline log can tell us exactly why it failed.
      try {
        lastBody = await response.text();
      } catch {}
      if (!RETRYABLE_STATUS.has(response.status)) break;
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
  const body: Record<string, unknown> = {
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
  };
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.webSearch) body.plugins = [{ id: "web", max_results: 5 }];

  const response = await callWithRetry(OPENROUTER_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  const content: string | undefined = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new Error("OpenRouter returned no content");
  }
  const citations: string[] =
    (data.choices?.[0]?.message?.citations as { url?: string }[] | undefined ?? [])
      .map((c) => c.url)
      .filter((u: string | undefined): u is string => Boolean(u));

  return { content, citations };
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

export async function geminiGroundedQuery(prompt: string): Promise<GroundedResult> {
  // OpenRouter's "web" plugin supplies real live-search citations. Not every model
  // (especially free/:free routes) supports it — an unsupported model returns an
  // error here, which the pipeline treats as the pillar being "unavailable" rather
  // than fabricating citations.
  const { content, citations } = await chatCompletion(prompt, { webSearch: true });
  return { answerText: content, citedUrls: citations };
}