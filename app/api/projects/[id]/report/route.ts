import { NextResponse } from "next/server";
import { deleteStoredReport, getStoredReport } from "../../../../../services/reportStore";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const report = getStoredReport(params.id);
  return report ? NextResponse.json({ report, source: "sqlite" }) : NextResponse.json({ error: "REPORT_NOT_FOUND" }, { status: 404 });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  deleteStoredReport(params.id);
  return NextResponse.json({ ok: true });
}
