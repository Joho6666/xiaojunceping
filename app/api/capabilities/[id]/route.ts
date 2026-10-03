import { NextResponse } from "next/server";
import { listCapabilities, removeCapability } from "../../../../services/capabilityService";
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const capability = listCapabilities().find((item) => item.id === id);
  if (capability) removeCapability(capability.id);
  return NextResponse.json({ ok: true });
}
