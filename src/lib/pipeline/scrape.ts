import * as cheerio from "cheerio";
import type { ScrapedPage } from "@/types/audit";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 8000;
const MAX_PAGES = 3;
const TEXT_EXCERPT_LENGTH = 2000;
const MAX_RETRIES = 2;
const RETRY_BACKOFF_MS = 750;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

type FetchResult = { html: string; finalUrl: string };
type LinkedPage = { url: string; kind: "about" | "faq" };

export class ScrapeError extends Error {
  userMessage: string;

  constructor(message: string, userMessage: string) {
    super(message);
    this.name = "ScrapeError";
    this.userMessage = userMessage;
  }
}

class HttpStatusError extends Error {
  status: number;

  constructor(status: number) {
    super(`Fetch failed with status ${status}`);
    this.name = "HttpStatusError";
    this.status = status;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOnce(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) {
      throw new HttpStatusError(response.status);
    }
    return { html: await response.text(), finalUrl: response.url };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Fetch timed out after ${FETCH_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPage(url: string): Promise<FetchResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) await delay(RETRY_BACKOFF_MS * attempt);
    try {
      return await fetchOnce(url);
    } catch (error) {
      lastError = error;
      const retryable =
        error instanceof HttpStatusError && RETRYABLE_STATUS.has(error.status);
      if (!retryable) throw error;
    }
  }
  throw lastError;
}

function scrapeErrorMessage(error: unknown): string {
  if (error instanceof HttpStatusError) {
    if (error.status === 429) {
      return "This website is blocking or rate-limiting our scanner (too many requests). Try again in a few minutes.";
    }
    if (error.status === 403) {
      return "This website is blocking automated access (403).";
    }
    return `The website returned an error (HTTP ${error.status}).`;
  }
  if (error instanceof Error && error.message.includes("timed out")) {
    return "The website took too long to respond.";
  }
  return "Could not reach this website — check the URL and try again.";
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
      // malformed JSON-LD is skipped individually, never dropped collectively
    }
  });
  return blocks;
}

function findLinkedPages(
  $: cheerio.CheerioAPI,
  baseUrl: string,
  origin: string,
): LinkedPage[] {
  const homepagePathname = new URL(baseUrl).pathname;
  const seen = new Set<string>([`${origin}${homepagePathname}`]);
  const found: LinkedPage[] = [];

  $("a[href]").each((_, el) => {
    const text = $(el).text().toLowerCase();
    const href = $(el).attr("href");
    if (!href) return;

    let resolved: URL;
    try {
      resolved = new URL(href, baseUrl);
    } catch {
      return;
    }
    if (resolved.origin !== origin) return;
    if (resolved.pathname === homepagePathname) return;

    const url = resolved.toString();
    if (seen.has(url)) return;

    if (/about/i.test(text) || /about/i.test(href)) {
      seen.add(url);
      found.push({ url, kind: "about" });
    } else if (/faq|questions/i.test(text) || /faq/i.test(href)) {
      seen.add(url);
      found.push({ url, kind: "faq" });
    }
  });

  return found.slice(0, MAX_PAGES - 1);
}

function extractHeadings($: cheerio.CheerioAPI): string[] {
  const headings: string[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text) headings.push(text);
  });
  return headings;
}

function buildPage(
  url: string,
  html: string,
  kind: ScrapedPage["kind"],
): ScrapedPage {
  const $ = cheerio.load(html);
  return {
    url,
    kind,
    title: $("title").text().replace(/\s+/g, " ").trim() || url,
    rawTextExcerpt: extractVisibleText($).slice(0, TEXT_EXCERPT_LENGTH),
    jsonLdBlocks: extractJsonLd($),
    headings: extractHeadings($),
    fetchedAt: new Date().toISOString(),
  };
}

export async function scrapeSite(url: string): Promise<ScrapedPage[]> {
  let homepage: FetchResult;
  try {
    homepage = await fetchPage(url);
  } catch (error) {
    const userMessage = scrapeErrorMessage(error);
    throw new ScrapeError(
      `Homepage fetch failed for ${url}`,
      userMessage,
    );
  }
  const homepageUrl = homepage.finalUrl;
  const homepagePage = buildPage(homepageUrl, homepage.html, "homepage");
  const origin = new URL(homepageUrl).origin;

  const pages: ScrapedPage[] = [homepagePage];

  const linked = findLinkedPages(cheerio.load(homepage.html), homepageUrl, origin);
  for (const link of linked) {
    try {
      const page = await fetchPage(link.url);
      pages.push(buildPage(page.finalUrl, page.html, link.kind));
    } catch (error) {
      console.error(`[pipeline/scrape] failed to fetch ${link.url}`, error);
    }
  }

  return pages;
}