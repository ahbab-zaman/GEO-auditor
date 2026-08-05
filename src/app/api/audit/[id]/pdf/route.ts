import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getAudit } from "@/lib/storage";
import { ReportPdf } from "@/components/audit/ReportPdf";

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
    if (audit.status !== "complete") {
      return NextResponse.json(
        { success: false, error: "Report not ready" },
        { status: 404 },
      );
    }
    const buffer = await renderToBuffer(ReportPdf({ audit }));
    const safeName = audit.businessName.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
    const filename = `geo-audit-${safeName || audit.id}.pdf`;
    const bytes = new Uint8Array(buffer);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[api/audit/pdf]", error);
    return NextResponse.json(
      { success: false, error: "Could not generate PDF" },
      { status: 500 },
    );
  }
}
