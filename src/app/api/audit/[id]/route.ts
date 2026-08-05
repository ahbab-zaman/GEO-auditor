import { NextRequest, NextResponse } from "next/server";
import { getAudit } from "@/lib/storage";

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
    return NextResponse.json({ success: true, data: audit });
  } catch (error) {
    console.error("[api/audit/id]", error);
    return NextResponse.json(
      { success: false, error: "Could not load audit" },
      { status: 500 },
    );
  }
}