import { NextResponse } from "next/server";
import { syncKnowledge } from "../../../../services/knowledgeSyncService";
export const dynamic = "force-dynamic";

export async function POST() {
  const run = await syncKnowledge();
  return NextResponse.json(run, { status: run.status === "failed" ? 502 : 200 });
}
