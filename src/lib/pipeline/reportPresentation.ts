import type { Audit, PillarResult } from "@/types/audit";

const PUBLIC_UNAVAILABLE_REASON =
  "This section could not be completed for this audit run.";

const TECHNICAL_ERROR_MARKERS = [
  "openrouter",
  "tavily",
  "rate limit",
  "free-tier",
  "free tier",
  "api key",
  "server logs",
  "timeout",
  "model",
];

export function formatPublicUnavailableReason(reason?: string): string {
  if (!reason) return PUBLIC_UNAVAILABLE_REASON;
  const normalized = reason.toLowerCase();
  if (TECHNICAL_ERROR_MARKERS.some((marker) => normalized.includes(marker))) {
    return PUBLIC_UNAVAILABLE_REASON;
  }
  return reason;
}

export function summarizePillars(pillars: Audit["pillars"]): Array<{
  key: string;
  label: string;
  score: string;
  status: PillarResult["status"];
  unavailableReason?: string;
}> {
  return Object.values(pillars).map((pillar) => ({
    key: pillar.key,
    label: pillar.label,
    score: `${pillar.pointsEarned} / ${pillar.pointsPossible}`,
    status: pillar.status,
    unavailableReason:
      pillar.status === "unavailable"
        ? formatPublicUnavailableReason(pillar.unavailableReason)
        : undefined,
  }));
}

export function summarizeFixes(audit: Audit): Array<{
  title: string;
  impact: string;
  effort: string;
}> {
  return audit.fixes.slice(0, 3).map((fix) => ({
    title: fix.title,
    impact: fix.impact,
    effort: fix.effort,
  }));
}
