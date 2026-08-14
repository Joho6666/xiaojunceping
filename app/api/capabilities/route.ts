import { NextResponse } from "next/server";
import { CapabilityId } from "../../../types";
import { listCapabilities, saveCapability } from "../../../services/capabilityService";
export async function GET() { return NextResponse.json({ capabilities: listCapabilities() }); }
export async function POST(request: Request) { const body = await request.json() as { id?: CapabilityId; secret?: string; endpoint?: string }; if (!body.id) return NextResponse.json({ error: "CAPABILITY_REQUIRED" }, { status: 400 }); const saved = saveCapability(body.id, body.secret, body.endpoint); const capability = listCapabilities().find((item) => item.id === saved.id); return NextResponse.json({ capability }, { status: 201 }); }
