import type {
  CheckResult,
  Evidence,
  PillarResult,
  ScrapedPage,
} from "@/types/audit";
import { z } from "zod";
import { PILLAR_MAX, POINTS } from "@/lib/utils";
import {
  geminiGroundedQuery,
  geminiJson,
  normalizeHostname,
  resolveCitationUrl,
} from "@/lib/gemini";
import {
  DescriptionAccuracySchema,
  QueryGenerationSchema,
} from "@/schemas/audit";

type GeneratedQuery = { type: "category" | "direct"; text: string };

type QueryResult = {
  query: string;
  type: "category" | "direct";
  answerText: string;
  citedUrls: string[];
  businessCited: boolean;
};

const brandMentioned = (businessName: string, answerText: string): boolean =>
  answerText.toLowerCase().includes(businessName.toLowerCase());

function severityFor(
  pointsEarned: number,
  pointsPossible: number,
): CheckResult["severity"] {
  if (pointsEarned === pointsPossible) return "pass";
  if (pointsEarned > 0) return "warning";
  return "critical";
}

function unavailablePillar(reason: string): PillarResult {
  return {
    key: "liveAiCitation",
    label: "Live AI Citation Test",
    status: "unavailable",
    unavailableReason: reason,
    pointsEarned: 0,
    pointsPossible: PILLAR_MAX.liveAiCitation,
    checks: [],
  };
}

export async function runLiveAiCitation(
  businessName: string,
  url: string,
  pages: ScrapedPage[],
): Promise<PillarResult> {
  const homepage = pages.find((page) => page.kind === "homepage");
  const homepageUrl = homepage?.url ?? url;
  const homepageText = homepage?.rawTextExcerpt ?? "";
  const ownDomain = normalizeHostname(new URL(homepageUrl).hostname);

  let queries: GeneratedQuery[];
  try {
    queries = await generateQueries(businessName, homepageText);
  } catch (error) {
    console.error("[pipeline/live-ai-citation] query generation failed", error);
    return unavailablePillar("Live AI queries could not be generated.");
  }

  const cache = new Map<string, string>();
  const results: QueryResult[] = [];

  // Sequential (for + await), never Promise.all, to respect the free-tier rate limit.
  for (const query of queries) {
    try {
      const { answerText, citedUrls } = await geminiGroundedQuery(query.text);
      const resolvedUrls: string[] = [];
      for (const uri of citedUrls) {
        const resolved = await resolveCitationUrl(uri, cache);
        if (!resolvedUrls.includes(resolved)) resolvedUrls.push(resolved);
      }
      results.push({
        query: query.text,
        type: query.type,
        answerText,
        citedUrls: resolvedUrls,
        businessCited: resolvedUrls.some(
          (uri) => normalizeHostname(new URL(uri).hostname) === ownDomain,
        ),
      });
    } catch (error) {
      console.error(`[pipeline/live-ai-citation] query failed: ${query.text}`, error);
    }
  }

  if (results.length === 0) {
    return unavailablePillar("No live AI answers could be retrieved.");
  }

  const checks: CheckResult[] = [
    brandRecallCheck(businessName, results),
    domainCitationRateCheck(ownDomain, results),
    await descriptionAccuracyCheck(businessName, homepageText, results),
  ];

  const pointsEarned = checks.reduce((sum, check) => sum + check.pointsEarned, 0);
  return {
    key: "liveAiCitation",
    label: "Live AI Citation Test",
    status: "complete",
    pointsEarned,
    pointsPossible: PILLAR_MAX.liveAiCitation,
    checks,
  };
}

async function generateQueries(
  businessName: string,
  homepageText: string,
): Promise<GeneratedQuery[]> {
  const prompt = `You generate realistic search queries a potential customer would type into an AI
assistant. Return only valid JSON, no markdown fences.

Business: ${businessName}
Website excerpt: """${homepageText.slice(0, 1000)}"""

Generate 4 queries: 2 category queries (a customer looking for this type of business, without naming
it) and 2 direct queries (asking about this specific business by name).

Return JSON exactly matching: { "queries": [{ "type": "category" | "direct", "text": string }] }`;

  try {
    const raw = await geminiJson<z.infer<typeof QueryGenerationSchema>>(prompt, 0.3);
    const parsed = QueryGenerationSchema.safeParse(raw);
    if (!parsed.success) throw new Error("Model returned malformed query-generation JSON");

    const queries = parsed.data.queries.filter((q) => q.text.trim().length > 0);
    if (queries.length < 3) throw new Error("Model returned too few queries");

    return queries;
  } catch (error) {
    console.error("[pipeline/live-ai-citation] falling back to template queries", error);
    return fallbackQueries(businessName);
  }
}

function fallbackQueries(businessName: string): GeneratedQuery[] {
  return [
    { type: "category", text: `best ${businessName} service near me` },
    { type: "category", text: `top-rated ${businessName} in the area` },
    { type: "direct", text: `what is ${businessName}` },
    { type: "direct", text: `is ${businessName} good` },
  ];
}

function brandRecallCheck(
  businessName: string,
  results: QueryResult[],
): CheckResult {
  const pointsPossible = POINTS.liveAiCitation.brandRecall;
  const category = results.filter((r) => r.type === "category");
  const considered = category.length > 0 ? category : results;
  const mentioned = considered.filter((r) => brandMentioned(businessName, r.answerText));

  const points = Math.round((mentioned.length / considered.length) * pointsPossible);

  const rep =
    mentioned.find((r) => r.type === "category") ??
    mentioned[0] ??
    considered.find((r) => r.type === "category") ??
    considered[0];

  const finding =
    points === pointsPossible
      ? `AI answers recalled ${businessName} by name in every category query.`
      : points > 0
        ? `AI answers recalled ${businessName} in ${mentioned.length} of ${considered.length} category queries — some of the time it answers without naming this business.`
        : `AI answers to category questions did not recall ${businessName} by name at all.`;

  return {
    id: "brand-recall",
    label: "Brand recall",
    pointsEarned: points,
    pointsPossible,
    finding,
    evidence: citationsEvidence(rep),
    severity: severityFor(points, pointsPossible),
    status: "complete",
  };
}

function domainCitationRateCheck(
  ownDomain: string,
  results: QueryResult[],
): CheckResult {
  const pointsPossible = POINTS.liveAiCitation.domainCitationRate;
  const cited = results.filter((r) => r.businessCited);
  const points = Math.round((cited.length / results.length) * pointsPossible);

  const rep = cited[0] ?? results[0];

  const finding =
    points === pointsPossible
      ? `The AI cited ${ownDomain} (the business's own site) in every answer.`
      : points > 0
        ? `The AI cited the business's own website (${ownDomain}) in ${cited.length} of ${results.length} answers.`
        : `The AI did not cite ${ownDomain} (the business's own website) in any answer.`;

  return {
    id: "domain-citation-rate",
    label: "Own-domain citation rate",
    pointsEarned: points,
    pointsPossible,
    finding,
    evidence: citationsEvidence(rep),
    severity: severityFor(points, pointsPossible),
    status: "complete",
  };
}

async function descriptionAccuracyCheck(
  businessName: string,
  homepageText: string,
  results: QueryResult[],
): Promise<CheckResult> {
  const pointsPossible = POINTS.liveAiCitation.descriptionAccuracy;

  const considered = results.filter((r) => brandMentioned(businessName, r.answerText));

  if (considered.length === 0) {
    return {
      id: "description-accuracy",
      label: "AI description accuracy",
      pointsEarned: 0,
      pointsPossible,
      finding:
        `The AI never discussed ${businessName}, so there was no description to compare against the site's own content.`,
      evidence: citationsEvidence(results[0]),
      severity: "critical",
      status: "complete",
    };
  }

  const grades: number[] = [];
  for (const result of considered) {
    try {
      grades.push(
        await gradeDescriptionAccuracy(businessName, homepageText, result.answerText),
      );
    } catch (error) {
      console.error("[pipeline/live-ai-citation] accuracy grade failed", error);
    }
  }

  if (grades.length === 0) {
    return {
      id: "description-accuracy",
      label: "AI description accuracy",
      pointsEarned: 0,
      pointsPossible,
      finding: "The AI description accuracy check could not be completed.",
      evidence: { type: "absence", source: "homepage", note: "The AI grading call failed." },
      severity: "warning",
      status: "unavailable",
      unavailableReason: "The AI grading call failed.",
    };
  }

  const average = grades.reduce((sum, g) => sum + g, 0) / grades.length;
  const points =
    average >= 0.99
      ? pointsPossible
      : average >= 0.5
        ? Math.round(pointsPossible / 2)
        : 0;

  const rep = considered[0];
  const finding =
    points === pointsPossible
      ? `AI descriptions of ${businessName} are consistent with what the business says about itself.`
      : points > 0
        ? `AI descriptions of ${businessName} are partially consistent with the site's own content.`
        : `AI descriptions of ${businessName} conflict with what the business says about itself.`;

  return {
    id: "description-accuracy",
    label: "AI description accuracy",
    pointsEarned: points,
    pointsPossible,
    finding,
    evidence: citationsEvidence(rep),
    severity: severityFor(points, pointsPossible),
    status: "complete",
  };
}

async function gradeDescriptionAccuracy(
  businessName: string,
  homepageText: string,
  answerText: string,
): Promise<number> {
  const prompt = `You verify one fact: whether an AI assistant's description of a business is consistent
with the business's own homepage. Return only valid JSON, no markdown fences.

Business name: ${businessName}

AI description:
"""${answerText.slice(0, 1500)}"""

Business homepage text:
"""${homepageText.slice(0, 1500)}"""

Ignore missing details. Report only material contradictions (wrong product, wrong location, wrong
audience, or another hard factual conflict).

Return JSON exactly matching: { "consistent": boolean, "contradictions": [string] }`;

  const raw = await geminiJson<z.infer<typeof DescriptionAccuracySchema>>(prompt, 0);
  const parsed = DescriptionAccuracySchema.safeParse(raw);
  if (!parsed.success) throw new Error("Model returned malformed accuracy JSON");

  if (parsed.data.consistent) return 1;
  return parsed.data.contradictions.length === 0 ? 0.5 : 0;
}

function citationsEvidence(result: QueryResult): Evidence {
  return {
    type: "citations",
    query: result.query,
    answerText: result.answerText,
    citedUrls: result.citedUrls,
    businessCited: result.businessCited,
  };
}