import {
  AnswerValue,
  EcosystemRecommendation,
  GithubProjectRecommendation,
  KnowledgeMatch,
  Project,
  RequirementProfile,
} from "../types";
import { extractRequirementProfile } from "./requirementExtractionService";
import { listKnowledgeItems } from "./knowledgeBaseService";
import { retrieveKnowledge } from "./knowledgeRetrievalService";
import { applyKnowledgeRules } from "./knowledgeRuleEngine";
import { searchGithubProjects } from "./githubService";
import { getCapabilitySecret } from "./capabilityService";
import { searchBrowserSources } from "./browserSearchService";
import { verifyGithubUrls } from "./githubService";

function ecosystemFromKnowledge(matches: KnowledgeMatch[]): EcosystemRecommendation[] {
  return matches
    .filter((match) => match.item.kind !== "github")
    .slice(0, 24)
    .map((match) => ({
      id: `kb-${match.item.id}`,
      name: match.item.name,
      category: match.item.kind === "product" || match.item.kind === "rule" || match.item.kind === "algorithm"
        ? "ai-tool"
        : match.item.kind as EcosystemRecommendation["category"],
      description: match.item.summary,
      url: match.item.url || match.item.sourceUrl,
      source: match.item.sourceType === "community" ? "snapshot" : match.item.sourceType === "registry" ? "registry" : match.item.sourceType === "npm" ? "npm" : match.item.sourceType === "github" ? "github" : "official",
      updatedAt: match.item.updatedAt,
      matchScore: match.score,
      reason: `${match.ruleNotes.join("；") || "命中项目需求标签"}。来源：${match.item.sourceUrl}`,
      capabilities: match.item.capabilities,
      access: match.item.access || "需查看官方文档",
    }));
}

function snapshotGithub(profile: RequirementProfile): GithubProjectRecommendation[] {
  const terms = new Set([...profile.tags, ...profile.capabilities, ...profile.domain].map((x) => x.toLowerCase()));
  return listKnowledgeItems("github")
    .map((item, index) => {
      const matched = [...item.tags, ...item.capabilities, ...item.stack].filter((x) => terms.has(x.toLowerCase()));
      if (item.tags.some((tag) => tag.toLowerCase() === profile.projectKind)) matched.push(profile.projectKind);
      return {
        item,
        score: Math.min(96, 58 + matched.length * 7 + (item.confidence === "高" ? 12 : 4) - index),
      };
    })
    .filter((x) => x.score >= 60)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ item, score }, index) => ({
      id: `kb-github-${item.id}`,
      name: item.name,
      repo: item.githubUrl?.replace("https://github.com/", "") || item.name,
      url: item.githubUrl || item.url || item.sourceUrl,
      description: item.summary,
      stars: "未读取",
      language: item.stack[0] || "未知",
      license: item.license || "未声明",
      updatedAt: item.updatedAt,
      activity: 60,
      maturity: item.confidence === "高" ? 85 : 70,
      similarity: score,
      recommendation: Math.max(1, 5 - Math.floor(index / 2)),
      stack: item.stack,
      capabilities: item.capabilities,
      recommendedUse: `先阅读 ${item.name} 的 README、许可证和核心目录，再决定复用范围。`,
      reuseRatio: "需本地验证后估计",
      difficulty: "需技术验证",
      risks: ["这是知识库快照，Star、活跃度和版本需重新核对"],
      advice: `来源：${item.sourceUrl}；快照时间：${item.updatedAt}`,
      source: "snapshot" as const,
    }));
}

export async function discoverProjectEcosystem(project: Project, answers: Record<string, AnswerValue> = {}, searchHints: string[] = []) {
  const profile = extractRequirementProfile(project, answers);
  const rawKnowledge = retrieveKnowledge(profile);
  const knowledgeMatches = applyKnowledgeRules(profile, rawKnowledge);
  let githubProjects: GithubProjectRecommendation[] = [];
  let liveSearchAt: string | undefined;
  const browserSearch = await searchBrowserSources(project, profile);
  try {
    githubProjects = await searchGithubProjects(project, [...searchHints, ...profile.tags].slice(0, 8), { githubToken: getCapabilitySecret("github") });
    const browserGithub = await verifyGithubUrls(project, browserSearch.results.map((result) => result.url), { githubToken: getCapabilitySecret("github") }).catch(() => []);
    const seenLive = new Set(githubProjects.map((item) => item.repo.toLowerCase()));
    githubProjects = [...githubProjects, ...browserGithub.filter((item) => !seenLive.has(item.repo.toLowerCase()))];
    if (githubProjects.length) liveSearchAt = new Date().toISOString();
  } catch {
    // The knowledge snapshot remains a valid fallback when GitHub is rate-limited.
  }
  const snapshotProjects = snapshotGithub(profile);
  if (githubProjects.length < 4) {
    const seen = new Set(githubProjects.map((item) => item.repo.toLowerCase()));
    githubProjects = [...githubProjects, ...snapshotProjects.filter((item) => !seen.has(item.repo.toLowerCase()))].slice(0, 12);
  }
  const now = new Date().toISOString();
  return {
    githubProjects,
    ecosystem: ecosystemFromKnowledge(knowledgeMatches),
    knowledge: {
      snapshotAt: listKnowledgeItems().reduce((latest, item) => item.updatedAt > latest ? item.updatedAt : latest, ""),
      liveSearchAt,
      itemCount: listKnowledgeItems().length,
      sources: Array.from(new Set(knowledgeMatches.map((match) => match.item.sourceUrl))).slice(0, 16),
      coverage: "官方资料、GitHub、npm/Registry 与精选社区条目；不代表全市场覆盖",
      inferredCount: 0,
      filteredCount: rawKnowledge.length - knowledgeMatches.length,
      browserSearch: { queries: browserSearch.queries, resultCount: browserSearch.results.length, searchedAt: browserSearch.searchedAt, error: browserSearch.error },
    },
    sources: [
      { id: "knowledge-base", type: "知识库 + 规则引擎", name: `筛选 ${knowledgeMatches.length} 条已发布候选`, updatedAt: now, count: String(knowledgeMatches.length) },
      { id: "github-live", type: liveSearchAt ? "GitHub API" : "GitHub 知识库快照", name: liveSearchAt ? `找到 ${githubProjects.length} 个实时仓库` : `实时搜索不可用，保留 ${githubProjects.length} 个已验证快照`, url: "https://github.com/search", updatedAt: liveSearchAt || now, count: String(githubProjects.length) },
      { id: "browser-search", type: "Tavily 浏览器搜索", name: browserSearch.searchedAt ? `搜索 ${browserSearch.results.length} 个网页结果` : "浏览器搜索未执行", url: "https://tavily.com/", updatedAt: browserSearch.searchedAt || now, count: String(browserSearch.results.length) },
      { id: "ecosystem-matches", type: "AI 生态匹配", name: `匹配 ${ecosystemFromKnowledge(knowledgeMatches).length} 个 Tool / Agent / Model / Skill / MCP / Plugin`, updatedAt: now, count: String(ecosystemFromKnowledge(knowledgeMatches).length) },
    ],
  };
}
