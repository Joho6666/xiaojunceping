import { NextResponse } from "next/server";
import { deleteStoredReport, getStoredReport } from "../../../../../services/reportStore";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const report = getStoredReport(params.id);
  return report ? NextResponse.json({ report, source: "sqlite" }) : NextResponse.json({ error: "REPORT_NOT_FOUND" }, { status: 404 });
}

export async function DELETE(_: Request, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  deleteStoredReport(params.id);
  return NextResponse.json({ ok: true });
}
