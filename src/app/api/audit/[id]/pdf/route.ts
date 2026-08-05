import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  void id;
  return NextResponse.json(
    { success: false, error: "PDF export is not implemented yet" },
    { status: 501 },
  );
}