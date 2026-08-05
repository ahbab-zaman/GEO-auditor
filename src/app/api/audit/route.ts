import { NextRequest, NextResponse } from "next/server";
import { AuditRequestSchema } from "@/schemas/audit";
import { createAudit, runAudit } from "@/lib/pipeline/runAudit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = AuditRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Please provide a valid URL and business name." },
        { status: 400 },
      );
    }
    const { url, businessName } = parsed.data;
    const audit = await createAudit(url, businessName);
    void runAudit(audit.id);
    return NextResponse.json({ success: true, data: { id: audit.id } });
  } catch (error) {
    console.error("[api/audit]", error);
    return NextResponse.json(
      { success: false, error: "Could not start audit" },
      { status: 500 },
    );
  }
}