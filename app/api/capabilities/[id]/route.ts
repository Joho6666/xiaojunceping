import { NextResponse } from "next/server";
import { CapabilityId } from "../../../../types";
import { removeCapability } from "../../../../services/capabilityService";
export async function DELETE(_: Request, { params }: { params: { id: CapabilityId } }) { removeCapability(params.id); return NextResponse.json({ ok: true }); }
