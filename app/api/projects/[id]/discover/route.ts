import { NextResponse } from "next/server";
import { discoverProjectEcosystem } from "../../../../../services/discoveryService";
import { AnswerValue, Project } from "../../../../../types";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json() as { project?: Project; answers?: Record<string, AnswerValue> };
    if (!body.project || body.project.id !== params.id) return NextResponse.json({ error: "PROJECT_REQUIRED" }, { status: 400 });
    return NextResponse.json(await discoverProjectEcosystem(body.project, body.answers || {}));
  } catch (error) {
    return NextResponse.json({ error: "DISCOVERY_FAILED", message: error instanceof Error ? error.message : "生态检索失败" }, { status: 502 });
  }
}
