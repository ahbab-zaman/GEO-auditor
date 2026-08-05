import type { PillarResult } from "@/types/audit";
import { geminiJson } from "@/lib/gemini";
import { VerdictSchema } from "@/schemas/audit";
import { z } from "zod";

type FindingsSummary = {
  businessName: string;
  totalScore: number;
  totalPossible: number;
  pillarFindings: { label: string; pointsEarned: number; pointsPossible: number; finding: string }[];
};

function buildSummary(businessName: string, pillars: PillarResult[]): FindingsSummary {
  const totalScore = pillars.reduce((sum, p) => sum + p.pointsEarned, 0);
  const totalPossible = pillars.reduce((sum, p) => sum + p.pointsPossible, 0);
  const pillarFindings = pillars.map((p) => ({
    label: p.label,
    pointsEarned: p.pointsEarned,
    pointsPossible: p.pointsPossible,
    finding:
      p.status === "complete"
        ? p.checks.map((c) => c.finding).join(" ")
        : `Could not be checked: ${p.unavailableReason ?? "unknown reason"}`,
  }));
  return { businessName, totalScore, totalPossible, pillarFindings };
}

export async function generateVerdict(
  businessName: string,
  pillars: PillarResult[],
): Promise<string | null> {
  const summary = buildSummary(businessName, pillars);

  const prompt = `You write one blunt, plain-language sentence summarizing an AI-visibility audit for a
business owner with no technical background. No jargon. State the core problem or strength directly,
and make it specific to this actual business and score — never a generic "you scored low" line even if
every pillar scored near zero. Say what is missing now, or what is already working.

Audit summary: ${JSON.stringify(summary)}

Return JSON exactly matching: { "verdict": string }`;

  try {
    const raw = await geminiJson<z.infer<typeof VerdictSchema>>(prompt, 0.3);
    const parsed = VerdictSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("[pipeline/verdict] malformed verdict JSON");
      return null;
    }
    return parsed.data.verdict.trim();
  } catch (error) {
    console.error("[pipeline/verdict] verdict generation failed", error);
    return null;
  }
}