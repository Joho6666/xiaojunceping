import { getSecret, listConnections } from "./connectionService";
import { upsertKnowledgeItem } from "./knowledgeBaseService";
import { KnowledgeItem, ProviderConnection } from "../types";

function modelItem(connection: ProviderConnection, id: string): KnowledgeItem {
  const now = new Date().toISOString();
  const vendor = connection.provider === "openai" ? "OpenAI" : connection.provider === "deepseek" ? "DeepSeek" : connection.provider === "gemini" ? "Google" : connection.provider === "anthropic" ? "Anthropic" : "Custom Provider";
  return { id: `provider-model-${connection.provider}-${id.replace(/[^a-z0-9._-]/gi, "-")}`, kind: "llm", name: id, vendor, modelId: id, summary: `由已连接的 ${vendor} models API 返回；上下文、模态和价格需要以该模型官方模型卡继续核验。`, url: connection.baseUrl, capabilities: ["Provider 已发现", "模型 ID 可用于路由"], tags: ["llm", "provider-discovered", connection.provider], stack: ["API"], platforms: ["Cloud"], access: "已配置 Provider", pricing: "待官方模型卡确认", sourceType: "official", sourceUrl: `${(connection.baseUrl || "").replace(/\/$/, "")}/models`, updatedAt: now, verifiedAt: now, sourceUpdatedAt: now, confidence: "高", publication: "published", status: "active", lifecycle: "stable" };
}

async function fetchIds(connection: ProviderConnection): Promise<string[]> {
  const secret = getSecret(connection.id);
  if (!secret || !connection.baseUrl) return [];
  const base = connection.baseUrl.replace(/\/$/, "");
  const headers: Record<string, string> = { Authorization: `Bearer ${secret}` };
  if (connection.provider === "anthropic") headers["x-api-key"] = secret;
  const url = connection.provider === "gemini" ? `${base}/models?key=${encodeURIComponent(secret)}` : `${base}/models`;
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`${connection.provider} models API ${response.status}`);
  const payload = await response.json() as { data?: Array<{ id?: string }>; models?: Array<{ name?: string; baseModelId?: string }> };
  return (payload.data || []).map((item) => item.id).filter((id): id is string => Boolean(id)).concat((payload.models || []).map((item) => item.baseModelId || item.name?.replace(/^models\//, "")).filter((id): id is string => Boolean(id)));
}

export async function syncConnectedProviderModels() {
  const results: Array<{ provider: string; discovered: number; error?: string }> = [];
  for (const connection of listConnections().filter((item) => item.mode === "api-key" && item.status !== "expired")) {
    try {
      const ids = Array.from(new Set(await fetchIds(connection)));
      ids.forEach((id) => upsertKnowledgeItem(modelItem(connection, id)));
      results.push({ provider: connection.provider, discovered: ids.length });
    } catch (error) {
      results.push({ provider: connection.provider, discovered: 0, error: error instanceof Error ? error.message : "模型目录读取失败" });
    }
  }
  return results;
}
