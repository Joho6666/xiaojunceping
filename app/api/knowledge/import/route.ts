import { NextResponse } from "next/server";
import { upsertKnowledgeItem } from "../../../../services/knowledgeBaseService";
import { KnowledgeItem } from "../../../../types";

export const dynamic = "force-dynamic";

function valid(item: unknown): item is KnowledgeItem {
  if (!item || typeof item !== "object") return false;
  const value = item as Partial<KnowledgeItem>;
  return typeof value.id === "string" && typeof value.name === "string" && typeof value.kind === "string" && typeof value.summary === "string" && Array.isArray(value.capabilities) && Array.isArray(value.tags) && Array.isArray(value.stack) && Array.isArray(value.platforms) && typeof value.sourceUrl === "string" && value.sourceUrl.startsWith("http");
}

function containsSensitiveField(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (/api.?key|token|secret|cookie|authorization|password|private.?key/i.test(key)) return true;
    if (containsSensitiveField(child)) return true;
  }
  return false;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "请上传 JSON 文件" }, { status: 400 });
    const parsed = JSON.parse(await file.text()) as unknown;
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    if (entries.some(containsSensitiveField)) return NextResponse.json({ error: "导入文件包含疑似密钥或 Token 字段，请删除敏感信息后再导入" }, { status: 400 });
    const safe = entries.filter(valid).map((entry) => ({ ...entry, publication: "pending" as const, status: "active" as const, confidence: entry.confidence || "低" as const, updatedAt: entry.updatedAt || new Date().toISOString(), verifiedAt: undefined }));
    if (!safe.length) return NextResponse.json({ error: "文件中没有可导入的知识条目，必须包含名称、类别、摘要、数组字段和 sourceUrl" }, { status: 400 });
    safe.forEach((entry) => upsertKnowledgeItem(entry));
    return NextResponse.json({ imported: safe.length, message: "已导入待确认条目，确认发布前不会参与推荐" });
  } catch {
    return NextResponse.json({ error: "导入失败，请上传合法 JSON 文件" }, { status: 400 });
  }
}
