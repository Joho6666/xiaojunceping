import { NextResponse } from "next/server";
import { latestSync, listKnowledgeItems } from "../../../../services/knowledgeBaseService";
export const dynamic = "force-dynamic";

export async function GET() {
  const items = listKnowledgeItems();
  const models = items.filter((item) => item.kind === "llm" && item.modelId);
  return NextResponse.json({ count: items.length, modelCount: models.length, models: models.slice().sort((a, b) => (a.vendor || "").localeCompare(b.vendor || "") || a.name.localeCompare(b.name)).map((item) => ({ id: item.id, name: item.name, vendor: item.vendor, modelId: item.modelId, contextWindow: item.contextWindow, maxOutput: item.maxOutput, modalities: item.modalities, lifecycle: item.lifecycle, sourceUrl: item.sourceUrl, updatedAt: item.sourceUpdatedAt || item.updatedAt })), byKind: items.reduce<Record<string, number>>((result, item) => { result[item.kind] = (result[item.kind] || 0) + 1; return result; }, {}), latestSync: latestSync(), coverage: "当前已索引官方模型目录、GitHub、MCP Registry、npm/Registry 与精选社区条目；不宣称覆盖全市场，模型以精确 ID 和来源时间为准" });
}
