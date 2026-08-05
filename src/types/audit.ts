export type AuditStatus = "pending" | "scraping" | "analyzing" | "complete" | "failed";

// The audit runs as a sequence of serverless-safe steps. `stage` says which step to run next.
export type AuditStage =
  | "scrape"
  | "structural"
  | "live-ai"
  | "third-party"
  | "finalize"
  | "done";

export const AUDIT_STAGES: Exclude<AuditStage, "done">[] = [
  "scrape",
  "structural",
  "live-ai",
  "third-party",
  "finalize",
];

export type Audit = {
  id: string;
  url: string;
  businessName: string;
  createdAt: string;
  completedAt: string | null;
  status: AuditStatus;
  error: string | null;

  // Step-runner bookkeeping (introduced for serverless deployments).
  stage?: AuditStage;
  updatedAt?: string;
  jobLock?: number | null;

  verdict: string | null;

  scrapedPages: ScrapedPage[];

  pillars: {
    structuralAnswerability: PillarResult;
    liveAiCitation: PillarResult;
    thirdPartyCorroboration: PillarResult;
  };

  score: {
    total: number;
    maxTotal: number;
  };

  fixes: Fix[];
};

export type ScrapedPage = {
  url: string;
  kind: "homepage" | "about" | "faq" | "other";
  title: string;
  rawTextExcerpt: string;
  jsonLdBlocks: unknown[];
  headings: string[];
  fetchedAt: string;
};

export type PillarKey =
  | "structuralAnswerability"
  | "liveAiCitation"
  | "thirdPartyCorroboration";

export type PillarResult = {
  key: PillarKey;
  label: string;
  status: "complete" | "unavailable";
  unavailableReason?: string;
  pointsEarned: number;
  pointsPossible: number;
  checks: CheckResult[];
};

export type CheckResult = {
  id: string;
  label: string;
  pointsEarned: number;
  pointsPossible: number;
  finding: string;
  evidence: Evidence;
  severity: "pass" | "warning" | "critical";
  status: "complete" | "unavailable";
  unavailableReason?: string;
};

export type Evidence =
  | { type: "quote"; source: string; text: string }
  | { type: "code"; source: string; snippet: string }
  | {
      type: "citations";
      query: string;
      answerText: string;
      citedUrls: string[];
      businessCited: boolean;
    }
  | { type: "absence"; source: string; note: string };

export type Fix = {
  id: string;
  relatedCheckId: string;
  title: string;
  explanation: string;
  impact: "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  priorityScore: number;
  copyPasteContent: string | null;
};