const AI_BOTS = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended", "CCBot"];

export const ROBOTS_FETCH_TIMEOUT_MS = 8000;

export async function fetchRobotsTxt(origin: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ROBOTS_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${origin}/robots.txt`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; GEOAuditorBot/1.0; +https://example.com/bot)",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export type AiCrawlerAccess = {
  blockedBots: string[];
  blockedAll: boolean;
  relevantLines: string[];
};

export function parseAiCrawlerText(robotsTxt: string): AiCrawlerAccess {
  const blocks: { agent: string; lines: string[] }[] = [];
  let current: { agent: string; lines: string[] } | null = null;

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (/^user-agent$/i.test(key)) {
      current = { agent: value, lines: [] };
      blocks.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }

  const blockedBots: string[] = [];
  let blockedAll = false;
  const relevantLines: string[] = [];

  const blocksAllCrawlers = (lines: string[]): boolean =>
    lines.some((l) => /^disallow\s*:\s*\/\s*$/i.test(l));

  for (const block of blocks) {
    const isRelevant = block.agent === "*" || AI_BOTS.includes(block.agent);
    if (isRelevant) {
      relevantLines.push(`User-agent: ${block.agent}`, ...block.lines);
    }
    if (block.agent === "*" && blocksAllCrawlers(block.lines)) {
      blockedAll = true;
    } else if (AI_BOTS.includes(block.agent) && blocksAllCrawlers(block.lines)) {
      blockedBots.push(block.agent);
    }
  }

  return { blockedBots, blockedAll, relevantLines };
}
