import * as cheerio from "cheerio";
import type { ScrapedPage } from "@/types/audit";

const USER_AGENT =
  "Mozilla/5.0 (compatible; GEOAuditorBot/1.0; +https://example.com/bot)";
const FETCH_TIMEOUT_MS = 8000;
const MAX_PAGES = 3;
const TEXT_EXCERPT_LENGTH = 2000;

type FetchResult = { html: string; finalUrl: string };
type LinkedPage = { url: string; kind: "about" | "faq" };

async function fetchPage(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`Fetch failed with status ${response.status}`);
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
  const homepage = await fetchPage(url);
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