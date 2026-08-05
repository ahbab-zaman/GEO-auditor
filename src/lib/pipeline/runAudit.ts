import { nanoid } from "nanoid";
import type { Audit, AuditStatus, PillarResult, ScrapedPage } from "@/types/audit";
import { getAudit, saveAudit } from "@/lib/storage";
import { computeScore } from "@/lib/pipeline/score";
import { deriveFixes } from "@/lib/pipeline/fixes";
import { getMockLiveAiCitation, getMockThirdPartyCorroboration } from "@/lib/pipeline/mocks";
import { scrapeSite } from "@/lib/pipeline/scrape";
import { runStructuralAnswerability } from "@/lib/pipeline/structuralAnswerability";

export async function createAudit(url: string, businessName: string): Promise<Audit> {
  const audit: Audit = {
    id: nanoid(10),
    url,
    businessName,
    createdAt: new Date().toISOString(),
    completedAt: null,
    status: "pending",
    error: null,
    verdict: null,
    scrapedPages: [],
    pillars: {
      structuralAnswerability: {
        key: "structuralAnswerability",
        label: "Structural Answerability",
        status: "unavailable",
        unavailableReason: "Pending",
        pointsEarned: 0,
        pointsPossible: 35,
        checks: [],
      },
      liveAiCitation: {
        key: "liveAiCitation",
        label: "Live AI Citation Test",
        status: "unavailable",
        unavailableReason: "Pending",
        pointsEarned: 0,
        pointsPossible: 45,
        checks: [],
      },
      thirdPartyCorroboration: {
        key: "thirdPartyCorroboration",
        label: "Third-Party Corroboration",
        status: "unavailable",
        unavailableReason: "Pending",
        pointsEarned: 0,
        pointsPossible: 20,
        checks: [],
      },
    },
    score: { total: 0, maxTotal: 100 },
    fixes: [],
  };
  await saveAudit(audit);
  return audit;
}

export async function runAudit(id: string): Promise<void> {
  try {
    const audit = await getAudit(id);
    if (!audit) return;

    await setStatus(id, "scraping");

    let scrapedPages: ScrapedPage[];
    try {
      scrapedPages = await scrapeSite(audit.url);
    } catch (error) {
      console.error("[pipeline/scrape]", error);
      const failed = await getAudit(id);
      if (failed) {
        await saveAudit({
          ...failed,
          status: "failed",
          error: "Could not reach this website — check the URL and try again.",
        });
      }
      return;
    }

    const scraped = await getAudit(id);
    if (!scraped) return;
    await saveAudit({ ...scraped, scrapedPages });

    await setStatus(id, "analyzing");

    const analyzing = await getAudit(id);
    if (!analyzing) return;

    const structuralAnswerability = await runStructuralAnswerability(
      new URL(analyzing.url).origin,
      analyzing.scrapedPages,
    );
    const liveAiCitation = getMockLiveAiCitation(analyzing.businessName, analyzing.url);
    const thirdPartyCorroboration = getMockThirdPartyCorroboration();

    const pillars = [structuralAnswerability, liveAiCitation, thirdPartyCorroboration];

    const completed = { ...analyzing, pillars: pillarMap(pillars) };

    const score = computeScore(pillars);
    const checks = pillars.flatMap((p) => p.checks);
    const fixes = deriveFixes(checks);

    await saveAudit({
      ...completed,
      score,
      fixes,
      verdict: `${analyzing.businessName} is currently visible to AI search engines in some ways, but has major gaps that are easy to close.`,
      status: "complete",
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[pipeline/run-audit]", error);
    const audit = await getAudit(id);
    if (audit) {
      await saveAudit({
        ...audit,
        status: "failed",
        error: "The audit could not complete. Please try again.",
      });
    }
  }
}

function pillarMap(pillars: PillarResult[]): Audit["pillars"] {
  return {
    structuralAnswerability: pillars[0],
    liveAiCitation: pillars[1],
    thirdPartyCorroboration: pillars[2],
  };
}

async function setStatus(id: string, status: AuditStatus): Promise<void> {
  const audit = await getAudit(id);
  if (!audit) return;
  await saveAudit({ ...audit, status });
}