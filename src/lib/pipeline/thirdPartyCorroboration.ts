import type { CheckResult, Evidence, PillarResult } from "@/types/audit";
import { PILLAR_MAX, POINTS } from "@/lib/utils";
import { geminiGroundedQuery, normalizeHostname, resolveCitationUrl } from "@/lib/gemini";

type CorroborationQuery = {
  label: string;
  prompt: string;
};

const QUERY_SET = (businessName: string, url: string): CorroborationQuery[] => [
  {
    label: "brand + sources",
    prompt: `What independent sources mention ${businessName} (${url})? Cite the source URLs.`,
  },
  {
    label: "reviews",
    prompt: `What do review sites, directories, or news sources say about ${businessName}? Cite the source URLs.`,
  },
  {
    label: "category corroboration",
    prompt: `Find third-party pages that discuss ${businessName} and describe what it is. Prefer independent websites over the business's own site. Cite the source URLs.`,
  },
  {
    label: "official profiles",
    prompt: `What external pages or profiles corroborate ${businessName} (${url})? Include directories, marketplaces, and social profiles if they are independent sources. Cite the source URLs.`,
  },
];

// Google's grounding can return `vertexaisearch.cloud.google.com` redirect URIs. A HEAD-follow
// normally resolves these to the real source, but when that resolution fails (transient network
// error) `resolveCitationUrl` falls back to the raw redirect host. That host is Google's resolver,
// not a third party - it must never count toward the external-domain tier.
const RESOLVER_TRAMPOLINES = ["vertexaisearch.cloud.google.com", "vertexaisearch.googleapis.com"];

type QueryResult = {
  label: string;
  prompt: string;
  answerText: string;
  citedUrls: string[];
};

function severityFor(
  pointsEarned: number,
  pointsPossible: number,
): CheckResult["severity"] {
  if (pointsEarned === pointsPossible) return "pass";
  if (pointsEarned > 0) return "warning";
  return "critical";
}

function safeHostname(url: string): string | null {
  try {
    return normalizeHostname(new URL(url).hostname);
  } catch {
    return null;
  }
}

function unavailablePillar(reason: string): PillarResult {
  return {
    key: "thirdPartyCorroboration",
    label: "Third-Party Corroboration",
    status: "unavailable",
    unavailableReason: reason,
    pointsEarned: 0,
    pointsPossible: PILLAR_MAX.thirdPartyCorroboration,
    checks: [],
  };
}

export async function runThirdPartyCorroboration(
  businessName: string,
  url: string,
): Promise<PillarResult> {
  const ownDomain = normalizeHostname(new URL(url).hostname);
  const cache = new Map<string, string>();

  const queries = QUERY_SET(businessName, url);
  const results: QueryResult[] = [];

  // Small bounded concurrency gives us broader coverage without turning this into a slow
  // serial crawl. The individual grounded queries are independent, so a few in flight at once
  // is the best tradeoff here.
  const CONCURRENCY = 3;
  let cursor = 0;
  async function runOne(): Promise<void> {
    const idx = cursor++;
    if (idx >= queries.length) return;

    const query = queries[idx];
    try {
      const { answerText, citedUrls } = await geminiGroundedQuery(query.prompt);
      results[idx] = {
        label: query.label,
        prompt: query.prompt,
        answerText,
        citedUrls,
      };
    } catch (error) {
      console.error(
        `[pipeline/third-party-corroboration] grounded query failed: ${query.label}`,
        error,
      );
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queries.length) }, () => runOne()));

  const allCitedUrls = results.flatMap((result) => result?.citedUrls ?? []);
  if (allCitedUrls.length === 0) {
    return unavailablePillar("Third-party sources could not be searched.");
  }

  const resolvedUrls: string[] = [];
  for (const uri of allCitedUrls) {
    const resolved = await resolveCitationUrl(uri, cache);
    if (!resolvedUrls.includes(resolved)) resolvedUrls.push(resolved);
  }

  const evidenceUrls = resolvedUrls.filter(
    (resolvedUrl) => !RESOLVER_TRAMPOLINES.includes(safeHostname(resolvedUrl) ?? ""),
  );

  const externalDomains: string[] = [];
  let businessCited = false;
  for (const resolved of evidenceUrls) {
    const domain = safeHostname(resolved);
    if (!domain) continue;
    if (domain === ownDomain) {
      businessCited = true;
      continue;
    }
    if (!externalDomains.includes(domain)) externalDomains.push(domain);
  }

  const pointsPossible = POINTS.thirdPartyCorroboration.externalPresence;
  const externalCount = externalDomains.length;
  const points =
    externalCount >= 3
      ? pointsPossible
      : externalCount >= 1
        ? Math.round(pointsPossible / 2)
        : 0;

  const combinedQuery = queries.map((query) => query.prompt).join("\n\n---\n\n");
  const combinedAnswer = results
    .map((result) => `[${result.label}] ${result.answerText}`)
    .join("\n\n");

  const check: CheckResult =
    externalCount > 0
      ? {
          id: "external-presence",
          label: "External mentions",
          pointsEarned: points,
          pointsPossible,
          finding:
            externalCount >= 3
              ? `The AI pointed to ${externalCount} independent websites mentioning ${businessName} - strong third-party corroboration beyond the business's own site.`
              : `Only ${externalCount} independent website${externalCount === 1 ? "" : "s"} mention${externalCount === 1 ? "s" : ""} ${businessName} - third-party corroboration is thin.`,
          evidence: citationsEvidence(
            combinedQuery,
            combinedAnswer,
            evidenceUrls,
            businessCited,
          ),
          severity: severityFor(points, pointsPossible),
          status: "complete",
        }
      : {
          id: "external-presence",
          label: "External mentions",
          pointsEarned: 0,
          pointsPossible,
          finding: `No independent websites citing ${businessName} were found - the AI has nothing about this business beyond its own site.`,
          evidence: {
            type: "absence",
            source: new URL(url).hostname,
            note: `No third-party source was cited for ${businessName}.`,
          },
          severity: "critical",
          status: "complete",
        };

  return {
    key: "thirdPartyCorroboration",
    label: "Third-Party Corroboration",
    status: "complete",
    pointsEarned: points,
    pointsPossible,
    checks: [check],
  };
}

function citationsEvidence(
  query: string,
  answerText: string,
  citedUrls: string[],
  businessCited: boolean,
): Evidence {
  return {
    type: "citations",
    query,
    answerText,
    citedUrls,
    businessCited,
  };
}
