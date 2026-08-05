import type { CheckResult, Fix } from "@/types/audit";
import { EFFORT_BY_CHECK_ID, priorityScore } from "@/lib/utils";

export const COPY_PASTE_CONTENT_BY_CHECK_ID: Partial<Record<string, string>> = {
  "ai-crawler-access": [
    "# geo-auditor: allow AI search engines to read your site",
    "User-agent: GPTBot",
    "Allow: /",
    "",
    "User-agent: ClaudeBot",
    "Allow: /",
    "",
    "User-agent: PerplexityBot",
    "Allow: /",
    "",
    "User-agent: Google-Extended",
    "Allow: /",
  ].join("\n"),
};

export function deriveFixes(checks: CheckResult[]): Fix[] {
  const fixes: Fix[] = [];
  for (const check of checks) {
    if (check.severity === "pass") continue;
    const effort = EFFORT_BY_CHECK_ID[check.id] ?? "medium";
    const impact = check.pointsPossible >= 15 ? "high" : "medium";
    fixes.push({
      id: `${check.id}-fix`,
      relatedCheckId: check.id,
      title: `Fix ${check.label.toLowerCase()}`,
      explanation:
        "This fix needs to be written per-business once the real pipeline is wired up.",
      impact,
      effort,
      priorityScore: priorityScore(impact, effort),
      copyPasteContent: COPY_PASTE_CONTENT_BY_CHECK_ID[check.id] ?? null,
    });
  }
  return fixes.sort((a, b) => b.priorityScore - a.priorityScore);
}