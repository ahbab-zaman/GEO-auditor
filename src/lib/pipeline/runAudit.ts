import { nanoid } from "nanoid";
import type {
  Audit,
  AuditStage,
  PillarResult,
  ScrapedPage,
} from "@/types/audit";
import { getAudit, saveAudit } from "@/lib/storage";
import { computeScore } from "@/lib/pipeline/score";
import { deriveFixes } from "@/lib/pipeline/fixes";
import { scrapeSite, ScrapeError } from "@/lib/pipeline/scrape";
import { runStructuralAnswerability } from "@/lib/pipeline/structuralAnswerability";
import { runLiveAiCitation } from "@/lib/pipeline/liveAiCitation";
import { runThirdPartyCorroboration } from "@/lib/pipeline/thirdPartyCorroboration";
import { generateVerdict } from "@/lib/pipeline/verdict";

// How long one serverless invocation may be "claimed" by a running step before another
// invocation may retake it. Keep this under the platform maxDuration (60s on Vercel Hobby,
// 300s on Pro) so the lock never outlives the function that holds it.
export const STEP_LOCK_MS = Number(process.env.STEP_LOCK_MS ?? 55_000);

// Live-AI is the longest pillacted step. Allow cap via env so deployments with a tight
// function duration budget (e.g. Vercel Hobby, 60s) can dial it under the limit.
export const LIVE_AI_TIMEOUT_MS = Number(process.env.LIVE_AI_TIMEOUT_MS ?? 90_000);

export async function createAudit(url: string, businessName: string): Promise<Audit> {
  const audit: Audit = {
    id: nanoid(10),
    url,
    businessName,
    createdAt: new Date().toISOString(),
    completedAt: null,
    status: "pending",
    error: null,
    stage: "scrape",
    updatedAt: new Date().toISOString(),
    jobLock: null,
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

// Runs exactly ONE stage of the audit and persists the result. Each serverless invocation
// calls this once; the caller triggers the next stage after we return (see /api/jobs/run).
export async function runAuditStep(id: string): Promise<void> {
  let audit: Audit | null = null;
  try {
    audit = await getAudit(id);
    if (!audit) return;
    if (audit.status === "complete" || audit.status === "failed") return;

    const now = Date.now();
    if (audit.jobLock && now < audit.jobLock) return; // another invocation is running it

    const stage: AuditStage =
      audit.stage && audit.stage !== "done" ? audit.stage : "scrape";

    // Claim the step so concurrent/resuming invocations don't double-run it.
    await saveAudit({ ...audit, jobLock: now + STEP_LOCK_MS });

    switch (stage) {
      case "scrape":
        await runScrapeStep(id);
        break;
      case "structural":
        await runStructuralStep(id);
        break;
      case "live-ai":
        await runLiveAiStep(id);
        break;
      case "third-party":
        await runThirdPartyStep(id);
        break;
      case "finalize":
        await runFinalizeStep(id);
        break;
    }
  } catch (error) {
    console.error("[pipeline/step]", error);
    const current = await getAudit(id).catch(() => null);
    if (current && current.status !== "complete" && current.status !== "failed") {
      await saveAudit({
        ...current,
        status: "failed",
        error: "The audit could not complete. Please try again.",
      }).catch(() => {});
    }
  }
}

async function runScrapeStep(id: string): Promise<void> {
  const audit = await getAudit(id);
  if (!audit) return;
  await saveAudit({ ...audit, status: "scraping", updatedAt: new Date().toISOString() });

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
        error:
          error instanceof ScrapeError
            ? error.userMessage
            : "Could not reach this website — check the URL and try again.",
      });
    }
    return;
  }

  const current = await getAudit(id);
  if (!current) return;
  await saveAudit({
    ...current,
    scrapedPages,
    status: "analyzing",
    stage: "structural",
    updatedAt: new Date().toISOString(),
  });
}

async function runStructuralStep(id: string): Promise<void> {
  const audit = await getAudit(id);
  if (!audit) return;
  const structuralAnswerability = await runStructuralAnswerability(
    new URL(audit.url).origin,
    audit.scrapedPages ?? [],
  );
  const current = await getAudit(id);
  if (!current) return;
  await saveAudit({
    ...current,
    pillars: { ...current.pillars, structuralAnswerability },
    stage: "live-ai",
    updatedAt: new Date().toISOString(),
  });
}

async function runLiveAiStep(id: string): Promise<void> {
  const audit = await getAudit(id);
  if (!audit) return;
  const liveAiCitation = await withDeadline(
    runLiveAiCitation(audit.businessName, audit.url, audit.scrapedPages ?? []),
    LIVE_AI_TIMEOUT_MS,
    () => timedOutPillar("liveAiCitation", "Live AI Citation Test", 45),
  );
  const current = await getAudit(id);
  if (!current) return;
  await saveAudit({
    ...current,
    pillars: { ...current.pillars, liveAiCitation },
    stage: "third-party",
    updatedAt: new Date().toISOString(),
  });
}

async function runThirdPartyStep(id: string): Promise<void> {
  const audit = await getAudit(id);
  if (!audit) return;
  const thirdPartyCorroboration = await runThirdPartyCorroboration(
    audit.businessName,
    audit.url,
  );
  const current = await getAudit(id);
  if (!current) return;
  await saveAudit({
    ...current,
    pillars: { ...current.pillars, thirdPartyCorroboration },
    stage: "finalize",
    updatedAt: new Date().toISOString(),
  });
}

async function runFinalizeStep(id: string): Promise<void> {
  const audit = await getAudit(id);
  if (!audit) return;
  const pillars = [
    audit.pillars.structuralAnswerability,
    audit.pillars.liveAiCitation,
    audit.pillars.thirdPartyCorroboration,
  ];
  const score = computeScore(pillars);
  const checks = pillars.flatMap((p) => p.checks);
  const fixes = deriveFixes(checks);
  const verdict = await generateVerdict(audit.businessName, pillars);
  await saveAudit({
    ...audit,
    score,
    fixes,
    verdict,
    status: "complete",
    stage: "done",
    jobLock: null,
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  });
}

function withDeadline<T>(
  promise: Promise<T>,
  ms: number,
  timeoutValue: () => T,
): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(timeoutValue()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(timeoutValue());
      },
    );
  });
}

function timedOutPillar(
  key: PillarResult["key"],
  label: string,
  pointsPossible: number,
): PillarResult {
  return {
    key,
    label,
    status: "unavailable",
    unavailableReason: `Timed out after ${LIVE_AI_TIMEOUT_MS / 1000}s while querying live AI. Report finalized with the completed pillars.`,
    pointsEarned: 0,
    pointsPossible,
    checks: [],
  };
}