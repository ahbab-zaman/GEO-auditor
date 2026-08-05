import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { runAuditStep } from "@/lib/pipeline/runAudit";
import { getAudit } from "@/lib/storage";
import { jobSecret, triggerAuditStep } from "@/lib/jobs";

// Each invocation handles a single audit stage, so we ask Vercel for the longest allowed
// serverless duration for this route (Hobby allows 60s; Pro allows 300s).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const secret = jobSecret();
  if (secret && req.headers.get("x-audit-secret") !== secret) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let id: string;
  try {
    const body = await req.json();
    id = String(body.id ?? "");
  } catch {
    return NextResponse.json({ success: false, error: "Bad request" }, { status: 400 });
  }
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing audit id" }, { status: 400 });
  }

  const audit = await getAudit(id);
  if (!audit) {
    return NextResponse.json({ success: false, error: "Audit not found" }, { status: 404 });
  }
  if (audit.status === "complete" || audit.status === "failed") {
    return NextResponse.json({ success: true, data: { status: audit.status } });
  }
  if (audit.jobLock && Date.now() < audit.jobLock) {
    return NextResponse.json({ success: true, data: { status: "locked" } });
  }

  await runAuditStep(id);

  const afterRun = await getAudit(id);
  const finished =
    !afterRun || afterRun.status === "complete" || afterRun.status === "failed";
  if (!finished && afterRun) {
    // Kick off the next stage in a fresh invocation. `after` holds the current function open
    // just long enough for this outgoing fetch, so each step gets its own duration budget.
    after(() => {
      triggerAuditStep(id).catch((error) =>
        console.error("[jobs/run] next step trigger failed", error),
      );
    });
  }

  return NextResponse.json({ success: true });
}