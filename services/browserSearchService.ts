import { Project, RequirementProfile } from "../types";
import { getCapabilitySecret } from "./capabilityService";

export interface BrowserSearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
  source: "tavily" | "snapshot";
}

function queries(project: Project, profile: RequirementProfile) {
  const nouns = [...profile.goals, ...(profile.requiredFeatures || []), ...profile.tags].slice(0, 6).join(" ");
  return [`${nouns} open source GitHub ${project.kind}`, `${profile.domain.join(" ")} tools Agent MCP Skill`, `${project.idea.slice(0, 160)} official product reference`];
}

export async function searchBrowserSources(project: Project, profile: RequirementProfile): Promise<{ results: BrowserSearchResult[]; queries: string[]; searchedAt?: string; error?: string }> {
  const secret = getCapabilitySecret("web-search");
  const qs = queries(project, profile);
  if (!secret) return { results: [], queries: qs, error: "未配置浏览器搜索 Provider" };
  try {
    const responses = await Promise.all(qs.map(async (query) => {
      const response = await fetch("https://api.tavily.com/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ api_key: secret, query, search_depth: "advanced", max_results: 8, include_answer: false, include_raw_content: false }), signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`浏览器搜索返回 ${response.status}`);
      return await response.json() as { results?: Array<{ title?: string; url?: string; content?: string; score?: number }> };
    }));
    const results = Array.from(new Map(responses.flatMap((payload) => payload.results || []).filter((item) => item.url).map((item) => [item.url, { title: item.title || "未命名结果", url: item.url as string, content: (item.content || "").slice(0, 800), score: item.score, source: "tavily" as const }])).values());
    return { results, queries: qs, searchedAt: new Date().toISOString() };
  } catch (error) {
    return { results: [], queries: qs, error: error instanceof Error ? error.message : "浏览器搜索失败" };
  }
}
