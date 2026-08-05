import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getAudit } from "@/lib/storage";
import { triggerAuditStep } from "@/lib/jobs";

// If the report page keeps polling a stage that stopped being worked on (a serverless
// function was killed, or a step trigger was lost), resume the job once its lock has expired.
const STALL_MS = 25_000;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const audit = await getAudit(id);
    if (!audit) {
      return NextResponse.json(
        { success: false, error: "Audit not found" },
        { status: 404 },
      );
    }

    if (
      (audit.status === "pending" ||
        audit.status === "scraping" ||
        audit.status === "analyzing") &&
      (!audit.jobLock || Date.now() >= audit.jobLock) &&
      Date.now() - timestampMs(audit.updatedAt) > STALL_MS
    ) {
      after(() => {
        triggerAuditStep(audit.id).catch((error) =>
          console.error("[api/audit/id] resume trigger failed", error),
        );
      });
    }

    return NextResponse.json({ success: true, data: audit });
  } catch (error) {
    console.error("[api/audit/id]", error);
    return NextResponse.json(
      { success: false, error: "Could not load audit" },
      { status: 500 },
    );
  }
}

function timestampMs(iso: string | undefined): number {
  if (!iso) return 0;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}