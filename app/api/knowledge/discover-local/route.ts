import { NextResponse } from "next/server";
import { discoverLocalCapabilities } from "../../../../services/localCapabilityDiscoveryService";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await discoverLocalCapabilities();
  return NextResponse.json({ ...result, items: result.items.map(({ sourcePath: _sourcePath, ...item }) => item) });
}
