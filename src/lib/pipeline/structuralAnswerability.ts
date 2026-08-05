import type { CheckResult, PillarResult } from "@/types/audit";
import { POINTS, PILLAR_MAX } from "@/lib/utils";
import { fetchRobotsTxt, parseAiCrawlerText } from "@/lib/robots";

export function checkAiCrawlerAccess(robotsTxt: string | null): CheckResult {
  const pointsPossible = POINTS.structuralAnswerability.aiCrawlerAccess;
  try {
    if (robotsTxt === null) {
      return {
        id: "ai-crawler-access",
        label: "AI crawler access",
        pointsEarned: pointsPossible,
        pointsPossible,
        finding:
          "No robots.txt file was found, so AI search engines are allowed to read this site by default.",
        evidence: {
          type: "absence",
          source: "/robots.txt",
          note: "No robots.txt found, so no AI crawlers are blocked.",
        },
        severity: "pass",
        status: "complete",
      };
    }

    const access = parseAiCrawlerText(robotsTxt);

    if (access.blockedAll) {
      return {
        id: "ai-crawler-access",
        label: "AI crawler access",
        pointsEarned: 0,
        pointsPossible,
        finding:
          "robots.txt blocks all crawlers with Disallow: /, which also blocks every AI search engine.",
        evidence: {
          type: "code",
          source: "/robots.txt",
          snippet: access.relevantLines.join("\n") || robotsTxt.trim(),
        },
        severity: "critical",
        status: "complete",
      };
    }

    if (access.blockedBots.length > 0) {
      return {
        id: "ai-crawler-access",
        label: "AI crawler access",
        pointsEarned: 5,
        pointsPossible,
        finding: `robots.txt blocks some AI crawlers (${access.blockedBots.join(
          ", ",
        )}), so AI answers may miss this site.`,
        evidence: {
          type: "code",
          source: "/robots.txt",
          snippet: access.relevantLines.join("\n") || robotsTxt.trim(),
        },
        severity: "warning",
        status: "complete",
      };
    }

    return {
      id: "ai-crawler-access",
      label: "AI crawler access",
      pointsEarned: pointsPossible,
      pointsPossible,
      finding: "No AI crawler is blocked in robots.txt, so AI search engines can read this site.",
      evidence:
        access.relevantLines.length > 0
          ? { type: "code", source: "/robots.txt", snippet: access.relevantLines.join("\n") }
          : {
              type: "absence",
              source: "/robots.txt",
              note: "robots.txt contains no rules that block AI crawlers.",
            },
      severity: "pass",
      status: "complete",
    };
  } catch (error) {
    console.error("[pipeline/ai-crawler-access]", error);
    return {
      id: "ai-crawler-access",
      label: "AI crawler access",
      pointsEarned: 0,
      pointsPossible,
      finding: "The robots.txt file could not be checked.",
      evidence: { type: "absence", source: "/robots.txt", note: "Could not be checked." },
      severity: "warning",
      status: "unavailable",
      unavailableReason: "robots.txt could not be fetched.",
    };
  }
}

export async function runStructuralAnswerability(origin: string): Promise<PillarResult> {
  const robotsTxt = await fetchRobotsTxt(origin);
  const checks: CheckResult[] = [checkAiCrawlerAccess(robotsTxt)];
  const pointsEarned = checks.reduce((sum, check) => sum + check.pointsEarned, 0);
  return {
    key: "structuralAnswerability",
    label: "Structural Answerability",
    status: "complete",
    pointsEarned,
    pointsPossible: PILLAR_MAX.structuralAnswerability,
    checks,
  };
}