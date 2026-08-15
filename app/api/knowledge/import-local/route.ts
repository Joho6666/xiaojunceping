import { NextResponse } from "next/server";
import { upsertKnowledgeItem } from "../../../../services/knowledgeBaseService";
import { LocalDiscoveryItem } from "../../../../services/localCapabilityDiscoveryService";

export const dynamic = "force-dynamic";

function valid(item: unknown): item is LocalDiscoveryItem {
  if (!item || typeof item !== "object") return false;
  const value = item as Partial<LocalDiscoveryItem>;
  return typeof value.id === "string" && typeof value.name === "string" && typeof value.summary === "string" && ["skill", "mcp", "agent", "ai-tool"].includes(String(value.kind)) && value.sensitiveDataRead === false;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { items?: unknown; confirm?: boolean };
    if (body.confirm !== true) return NextResponse.json({ error: "请先在页面确认要同步本机发现结果" }, { status: 400 });
    const items = Array.isArray(body.items) ? body.items.filter(valid) : [];
    if (!items.length) return NextResponse.json({ error: "没有可同步的本机 Skill 或 MCP" }, { status: 400 });
    const now = new Date().toISOString();
    items.forEach((item) => upsertKnowledgeItem({
      id: item.id,
      kind: item.kind === "mcp" ? "mcp" : item.kind === "skill" ? "skill" : "agent",
      name: item.name,
      vendor: "本机检测",
      summary: item.summary,
      url: item.sourceUrl,
      capabilities: [item.kind === "mcp" ? "MCP 工具" : item.kind === "skill" ? "本地 Skill" : "本地 Agent"],
      tags: ["local", item.kind, item.detectedBy],
      stack: [item.access],
      platforms: [process.platform === "win32" ? "Windows" : process.platform],
      access: item.access,
      pricing: item.pricing,
      sourceType: "snapshot",
      sourceUrl: item.sourceUrl || `local://discovery/${item.id}`,
      updatedAt: now,
      verifiedAt: now,
      confidence: item.confidence,
      publication: "published",
      status: "active",
    }));
    return NextResponse.json({ imported: items.length, message: `已同步 ${items.length} 个本机能力` });
  } catch {
    return NextResponse.json({ error: "本机能力同步失败" }, { status: 400 });
  }
}
