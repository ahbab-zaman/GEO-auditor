import type { Fix } from "@/types/audit";

export const POINTS = {
  structuralAnswerability: {
    aiCrawlerAccess: 10,
    schemaPresence: 10,
    directAnswerClarity: 10,
    faqPresence: 5,
  },
  liveAiCitation: {
    brandRecall: 15,
    domainCitationRate: 20,
    descriptionAccuracy: 10,
  },
  thirdPartyCorroboration: {
    externalPresence: 20,
  },
} as const;

export const PILLAR_MAX = {
  structuralAnswerability: 35,
  liveAiCitation: 45,
  thirdPartyCorroboration: 20,
} as const;

const SEVERITY_BY_SCORE: Array<{ min: number; key: "pass" | "warning" | "critical" }> = [
  { min: 80, key: "pass" },
  { min: 50, key: "warning" },
  { min: 0, key: "critical" },
];

export function getSeverityColor(score: number): "pass" | "warning" | "critical" {
  for (const tier of SEVERITY_BY_SCORE) {
    if (score >= tier.min) return tier.key;
  }
  return "critical";
}

export const EFFORT_BY_CHECK_ID: Record<string, "low" | "medium" | "high"> = {
  "ai-crawler-access": "low",
  "schema-presence": "medium",
  "direct-answer-clarity": "medium",
  "faq-presence": "medium",
  "brand-recall": "high",
  "domain-citation-rate": "high",
  "description-accuracy": "medium",
  "external-presence": "medium",
};

const EFFORT_WEIGHT: Record<Fix["effort"], number> = { low: 3, medium: 2, high: 1 };
const IMPACT_WEIGHT: Record<Fix["impact"], number> = { high: 3, medium: 2, low: 1 };

export function priorityScore(impact: Fix["impact"], effort: Fix["effort"]): number {
  return (IMPACT_WEIGHT[impact] / EFFORT_WEIGHT[effort]) * 10;
}