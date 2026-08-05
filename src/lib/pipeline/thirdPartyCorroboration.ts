import type { CheckResult, Evidence, PillarResult } from "@/types/audit";
import { PILLAR_MAX, POINTS } from "@/lib/utils";
import { geminiGroundedQuery, normalizeHostname, resolveCitationUrl } from "@/lib/gemini";

const QUERY_TEMPLATE = (businessName: string, url: string): string =>
  `What do people say about ${businessName} (${url})? Cite your sources.`;

// Google's grounding can return `vertexaisearch.cloud.google.com` redirect URIs. A HEAD-follow
// normally resolves these to the real source, but when that resolution fails (transient network
// error) `resolveCitationUrl` falls back to the raw redirect host. That host is Google's resolver,
// not a third party — it must never count toward the external-domain tier.
const RESOLVER_TRAMPOLINES = ["vertexaisearch.cloud.google.com", "vertexaisearch.googleapis.com"];

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

  let answerText: string;
  let citedUrls: string[];
  try {
    ({ answerText, citedUrls } = await geminiGroundedQuery(
      QUERY_TEMPLATE(businessName, url),
    ));
  } catch (error) {
    console.error("[pipeline/third-party-corroboration] grounded query failed", error);
    return unavailablePillar("Third-party sources could not be searched.");
  }

  const resolvedUrls: string[] = [];
  for (const uri of citedUrls) {
    const resolved = await resolveCitationUrl(uri, cache);
    if (!resolvedUrls.includes(resolved)) resolvedUrls.push(resolved);
  }

  const evidenceUrls = resolvedUrls.filter(
    (url) => !RESOLVER_TRAMPOLINES.includes(safeHostname(url) ?? ""),
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

  const check: CheckResult =
    externalCount > 0
      ? {
          id: "external-presence",
          label: "External mentions",
          pointsEarned: points,
          pointsPossible,
          finding:
            externalCount >= 3
              ? `The AI pointed to ${externalCount} independent websites mentioning ${businessName} — strong third-party corroboration beyond the business's own site.`
              : `Only ${externalCount} independent website${externalCount === 1 ? "" : "s"} mention${externalCount === 1 ? "s" : ""} ${businessName} — third-party corroboration is thin.`,
          evidence: citationsEvidence(
            QUERY_TEMPLATE(businessName, url),
            answerText,
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
          finding: `No independent websites citing ${businessName} were found — the AI has nothing about this business beyond its own site.`,
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