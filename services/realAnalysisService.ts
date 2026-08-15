import { AnswerValue, GithubProjectRecommendation, Project, ProjectReport } from "../types";
import { buildMockReport } from "../data/reportCatalog";
import {
  generateDeepSeekEvaluation,
  generateDeepSeekSearchPlan,
} from "./deepseekService";
import { searchGithubProjects } from "./githubService";
import { isCommerceProject, profileFor } from "../data/projectProfiles";
import { discoverProjectEcosystem } from "./discoveryService";
import { codexCliAdapter } from "../ai/cli/codexCliAdapter";
import { extractRequirementProfile } from "./requirementExtractionService";
import { retrieveKnowledge } from "./knowledgeRetrievalService";
import { applyKnowledgeRules } from "./knowledgeRuleEngine";
import { listKnowledgeItems } from "./knowledgeBaseService";
import { getCapabilitySecret } from "./capabilityService";
import { EcosystemRecommendation, KnowledgeMatch } from "../types";
import { applyAgentPlanToReport, buildAgentPlan, buildInputFingerprint, buildPromptArtifacts, customizeProjectSections } from "./reportCustomizationService";

function str(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}
function arr(value: unknown, fallback: string[]) {
  return Array.isArray(value)
    ? (value.filter((x) => typeof x === "string") as string[])
    : fallback;
}
function number(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : fallback;
}
function percent(value: unknown, fallback: number) {
  const result = number(value, fallback);
  return result > 0 && result <= 1 ? Math.round(result * 100) : result;
}

function requireLiveEvaluation(value: Record<string, unknown>, provider: string) {
  const required = ["title", "summary", "verdict", "acceptanceCriteria", "strategy", "scores", "agents", "models", "risks", "techStack", "workflow", "architecture", "estimates", "confidence"];
  const missing = required.filter((key) => {
    const item = value[key];
    return item === undefined || item === null || (Array.isArray(item) && item.length === 0);
  });
  if (missing.length) {
    throw new Error(`REAL_REPORT_INCOMPLETE:${provider}:${missing.join(",")}`);
  }
}

function ecosystemFromKnowledge(matches: KnowledgeMatch[]): EcosystemRecommendation[] {
  return matches.filter((match) => match.item.kind !== "github").slice(0, 18).map((match) => ({
    id: `kb-${match.item.id}`,
    name: match.item.name,
    category: ["product", "rule", "algorithm"].includes(match.item.kind) ? "ai-tool" : match.item.kind as EcosystemRecommendation["category"],
    description: match.item.summary,
    url: match.item.url || match.item.sourceUrl,
    source: match.item.sourceType === "community" ? "snapshot" : match.item.sourceType === "registry" ? "registry" : match.item.sourceType === "npm" ? "npm" : match.item.sourceType === "github" ? "github" : "official",
    updatedAt: match.item.updatedAt,
    matchScore: match.score,
    reason: `${match.ruleNotes.join("；")}。来源：${match.item.sourceUrl}`,
    capabilities: match.item.capabilities,
    access: match.item.access || "需查看官方文档",
    pricing: match.item.pricing,
    pricingDetails: match.item.pricingDetails,
  }));
}

function knowledgeSnapshot(matches: KnowledgeMatch[], liveSearchAt: string, filteredCount = 0) {
  const items = listKnowledgeItems();
  return { snapshotAt: items.reduce((latest, item) => item.updatedAt > latest ? item.updatedAt : latest, ""), liveSearchAt, itemCount: items.length, sources: Array.from(new Set(matches.map((match) => match.item.sourceUrl))).slice(0, 12), coverage: "官方资料、GitHub、npm/Registry 与精选社区条目；不代表全市场覆盖", inferredCount: 0, filteredCount };
}

export async function analyzeWithDeepSeek(
  project: Project,
  answers: Record<string, AnswerValue>,
  connection: { baseUrl?: string; model?: string; secret?: string; provider?: string },
): Promise<ProjectReport> {
  const searchPlan = await generateDeepSeekSearchPlan(
    project,
    answers,
    connection,
  );
  const githubProjects = await searchGithubProjects(
    project,
    searchPlan.queries,
    { githubToken: getCapabilitySecret("github") },
  );
  const knowledgeProfile = extractRequirementProfile(project, answers);
  const rawKnowledge = retrieveKnowledge(knowledgeProfile);
  const knowledgeMatches = applyKnowledgeRules(knowledgeProfile, rawKnowledge);
  const ecosystem = ecosystemFromKnowledge(knowledgeMatches);
  const result = await generateDeepSeekEvaluation(
    project,
    answers,
    [
      {
        type: "github-evidence",
        items: githubProjects.map((x) => ({
          name: x.name,
          repo: x.repo,
          url: x.url,
          description: x.description,
          stars: x.stars,
          language: x.language,
          updatedAt: x.updatedAt,
        })),
      },
      { type: "ai-ecosystem-evidence", items: ecosystem },
      { type: "knowledge-base-evidence", items: knowledgeMatches.slice(0, 24).map((match) => ({ id: match.item.id, kind: match.item.kind, name: match.item.name, summary: match.item.summary, url: match.item.url || match.item.sourceUrl, matchedBy: match.matchedBy, score: match.score, source: match.item.sourceUrl, updatedAt: match.item.updatedAt })) },
    ],
    connection,
  );
  const usage = {
    promptTokens: searchPlan.usage.promptTokens + result.usage.promptTokens,
    completionTokens:
      searchPlan.usage.completionTokens + result.usage.completionTokens,
    totalTokens: searchPlan.usage.totalTokens + result.usage.totalTokens,
  };
  const ai = result.data;
  requireLiveEvaluation(ai, connection.provider || "deepseek");
  const base = buildMockReport(project);
  const commerce = isCommerceProject(project);
  const profile = profileFor(project);
  const strategy = (
    ai.strategy && typeof ai.strategy === "object" ? ai.strategy : {}
  ) as Record<string, unknown>;
  const estimates = (
    ai.estimates && typeof ai.estimates === "object" ? ai.estimates : {}
  ) as Record<string, unknown>;
  const confidence = (
    ai.confidence && typeof ai.confidence === "object" ? ai.confidence : {}
  ) as Record<string, unknown>;
  const workflow = Array.isArray(ai.workflow) ? ai.workflow : [];
  const report: ProjectReport = {
    ...base,
    projectKind: project.kind,
    projectSummary: {
      ...base.projectSummary,
      title: commerce
        ? `${profile.label}快速评估`
        : str(ai.title, base.projectSummary.title),
      typeLabel: commerce
        ? profile.label
        : str(ai.typeLabel, base.projectSummary.typeLabel),
      summary: str(ai.summary, base.projectSummary.summary),
      verdict: str(ai.verdict, base.projectSummary.verdict),
      score: number(ai.score, base.projectSummary.score),
      status: str(ai.status, base.projectSummary.status),
      acceptanceCriteria: arr(
        ai.acceptanceCriteria,
        base.projectSummary.acceptanceCriteria,
      ),
    },
    strategy: {
      ...base.strategy,
      type:
        (strategy.type as ProjectReport["strategy"]["type"]) ||
        base.strategy.type,
      confidence: percent(strategy.confidence, base.strategy.confidence),
      reason: str(strategy.reason, base.strategy.reason),
      recipe: arr(strategy.recipe, base.strategy.recipe),
    },
    scores: Array.isArray(ai.scores)
      ? ai.scores.flatMap((x) => {
          const v = x as Record<string, unknown>;
          return typeof v?.label === "string"
            ? [{ label: v.label, score: number(v.score, 70) }]
            : [];
        })
      : base.scores,
    agents:
      Array.isArray(ai.agents) && ai.agents.length
        ? ai.agents.map((x, i) => {
            const v = x as Record<string, unknown>;
            return {
              ...base.agents[Math.min(i, base.agents.length - 1)],
              id: `ai-agent-${i}`,
              name: str(v.name, base.agents[i]?.name || "开发 Agent"),
              provider: str(v.provider, "待连接 Provider"),
              role: str(v.role, "执行 Agent"),
              description: str(v.description, "根据当前项目执行评估与实现"),
              reason: str(v.reason, "由 DeepSeek 基于项目上下文匹配"),
              matchScore: number(v.matchScore, 75),
            };
          })
        : base.agents,
    models:
      Array.isArray(ai.models) && ai.models.length
        ? ai.models.map((x, i) => {
            const v = x as Record<string, unknown>;
            return {
              ...base.models[Math.min(i, base.models.length - 1)],
              id: `ai-model-${i}`,
              name: str(v.name, "DeepSeek"),
              provider: str(v.provider, "DeepSeek"),
              modelId: str(v.modelId, connection.model || "deepseek-v4-flash"),
              task: str(v.task, "项目评估与规划"),
              reason: str(v.reason, "由 DeepSeek 基于任务匹配"),
              matchScore: number(v.matchScore, 80),
            };
          })
        : base.models,
    githubProjects,
    ecosystem,
    knowledge: knowledgeSnapshot(knowledgeMatches, new Date().toISOString(), rawKnowledge.length - knowledgeMatches.length),
    techStack:
      Array.isArray(ai.techStack) && ai.techStack.length
        ? ai.techStack.map((x) => {
            const v = x as Record<string, unknown>;
            return {
              layer: str(v.layer, "应用"),
              name: str(v.name, "待定"),
              reasons: arr(v.reasons, ["由 DeepSeek 根据需求推荐"]),
              alternative: str(v.alternative, "待评估"),
              matchScore: number(v.matchScore, 75),
            };
          })
        : base.techStack,
    workflows: workflow.length
      ? workflow.map((x, i) => {
          const v = x as Record<string, unknown>;
          return {
            ...base.workflows[Math.min(i, base.workflows.length - 1)],
            id: `ai-phase-${i + 1}`,
            title: str(v.title, base.workflows[i]?.title || "执行阶段"),
            goal: str(v.goal, "完成可验收交付物"),
            time: str(v.time, "需进一步确认"),
            model: connection.model || "deepseek-v4-flash",
            agent: "DeepSeek 评估 Agent",
          };
        })
      : base.workflows,
    architecture: arr(ai.architecture, base.architecture),
    risks:
      Array.isArray(ai.risks) && ai.risks.length
        ? ai.risks.map((x) => {
            const v = x as Record<string, unknown>;
            return {
              title: str(v.title, "评估信息不足"),
              level: str(v.level, "中风险"),
              probability: str(v.probability, "中"),
              impact: str(v.impact, "中"),
              advice: str(v.advice, "补充验证后再进入开发"),
            };
          })
        : base.risks,
    estimates: {
      ...base.estimates,
      time: {
        ...base.estimates.time,
        display: str(estimates.time, base.estimates.time.display),
        range: str(estimates.time, base.estimates.time.range),
      },
      tokens: {
        ...base.estimates.tokens,
        // Project Token budget is a forecast for implementation work. The
        // DeepSeek calls used to produce this report are tracked separately
        // in actualUsage and must never replace this estimate.
        display: str(estimates.tokens, base.estimates.tokens.display),
        range: str(estimates.tokens, base.estimates.tokens.range),
      },
      cost: {
        ...base.estimates.cost,
        display: str(estimates.cost, base.estimates.cost.display),
        range: str(estimates.cost, base.estimates.cost.range),
      },
      humanEffort: {
        ...base.estimates.humanEffort!,
        display: str(
          estimates.humanEffort,
          base.estimates.humanEffort?.display || "需人工确认",
        ),
        range: str(
          estimates.humanEffort,
          base.estimates.humanEffort?.range || "需人工确认",
        ),
      },
    },
    actualUsage: {
      provider: connection.provider || "deepseek",
      model: connection.model || "deepseek-v4-flash",
      ...usage,
      recordedAt: new Date().toISOString(),
    },
    confidence: {
      ...base.confidence,
      agents:
        (confidence.agents as "高" | "中" | "低") || base.confidence.agents,
      models:
        (confidence.models as "高" | "中" | "低") || base.confidence.models,
      time: (confidence.time as "高" | "中" | "低") || base.confidence.time,
      cost: (confidence.cost as "高" | "中" | "低") || base.confidence.cost,
      github: githubProjects.length
        ? (confidence.github as "高" | "中" | "低") || "中"
        : "低",
    },
    sources: [
      {
        id: "deepseek",
        type: "AI 评估",
        name: `${connection.provider || "deepseek"} · ${connection.model || "deepseek-v4-flash"} 真实分析`,
        updatedAt: new Date().toISOString(),
      },
      {
        id: "deepseek-github-agent",
        type: "研究 Agent",
        name: `DeepSeek 生成 ${searchPlan.queries.length} 组 GitHub 搜索词，核对 ${searchPlan.focus.length || "项目相关"} 项能力`,
        updatedAt: new Date().toISOString(),
        count: String(searchPlan.queries.length),
      },
      {
        id: "ai-ecosystem-live",
        type: "AI 生态发现",
        name: `发现 ${ecosystem.length} 个工具、Agent、LLM、Skill、MCP 与 Plugin 候选`,
        updatedAt: new Date().toISOString(),
        count: String(ecosystem.length),
      },
      {
        id: "knowledge-base",
        type: "知识库 + 规则引擎",
        name: `从 ${listKnowledgeItems().length} 条已发布条目中筛选 ${knowledgeMatches.length} 条，已过滤 ${rawKnowledge.length - knowledgeMatches.length} 条`,
        updatedAt: new Date().toISOString(),
        count: String(knowledgeMatches.length),
      },
      ...(githubProjects.length
        ? [
            {
              id: "github-live",
              type: "GitHub API",
              name: `${githubProjects.length} 个实时仓库搜索结果`,
              url: "https://github.com/search",
              updatedAt: new Date().toISOString(),
              count: String(githubProjects.length),
            },
          ]
        : [
            {
              id: "github-live",
              type: "GitHub API",
              name: "GitHub 搜索未返回结果，请调整项目描述",
              url: "https://github.com/search",
              updatedAt: new Date().toISOString(),
              count: "0",
            },
          ]),
      ...base.sources.filter((x) => x.id !== "github" && x.id !== "deepseek"),
    ],
    generatedAt: new Date().toISOString(),
    projectIdea: project.idea,
    generationMode: "live",
    provider: connection.provider || "deepseek",
    model: connection.model || "deepseek-v4-flash",
    inputFingerprint: buildInputFingerprint(project, answers, "knowledge-v1", "knowledge-base+github"),
  };
  report.agentPlan = buildAgentPlan(project, knowledgeProfile, report, report.model || "deepseek-v4-flash");
  Object.assign(report, applyAgentPlanToReport(report, report.agentPlan));
  report.models = report.models.map((item, index) => index === 0 ? { ...item, provider: report.provider || item.provider, modelId: report.model || item.modelId, name: report.model || item.name, reason: `用户已选择 ${report.provider || item.provider} / ${report.model || item.modelId}，作为本项目主力模型。` } : item);
  Object.assign(report, customizeProjectSections(project, knowledgeProfile, report));
  report.promptArtifacts = buildPromptArtifacts(project, report, report.agentPlan);
  return report;
}

export async function analyzeWithCodex(
  project: Project,
  answers: Record<string, AnswerValue>,
  model?: string,
): Promise<ProjectReport> {
  const base = buildMockReport(project);
  const profile = extractRequirementProfile(project, answers);
  const rawKnowledge = retrieveKnowledge(profile);
  const knowledgeMatches = applyKnowledgeRules(profile, rawKnowledge);
  const knowledgeContext = knowledgeMatches.slice(0, 20).map((match) => ({ id: match.item.id, kind: match.item.kind, name: match.item.name, summary: match.item.summary, url: match.item.url || match.item.sourceUrl, score: match.score, source: match.item.sourceUrl }));
  // Codex can browse, but its prose/JSON is not evidence by itself. First ask
  // it only for search intent, then let the server fetch and validate the
  // repositories before the final report is generated.
  let searchHints: string[] = [];
  try {
    const plan = await codexCliAdapter.generateStructured<{ queries?: unknown[] }>({
      prompt: `你是项目研究 Agent。请基于下面的项目和本地知识库标签，生成最多 5 个用于 GitHub repository 搜索的精准英文查询词。不要返回仓库名称，不要编造链接，不要搜索凭据或个人信息。只返回 JSON：{"queries":["..."]}。项目：${JSON.stringify({ idea: project.idea, kind: project.kind, capabilities: profile.capabilities, tags: profile.tags, stack: profile.stack })}。本地知识库候选：${JSON.stringify(knowledgeContext.slice(0, 10))}`,
      model,
      timeoutMs: 90000,
      maxOutputBytes: 120000,
    });
    searchHints = Array.isArray(plan.queries)
      ? plan.queries.filter((x): x is string => typeof x === "string" && Boolean(x.trim())).slice(0, 5)
      : [];
  } catch (error) {
    // A user-selected Codex connection is authoritative. Do not silently
    // replace it with deterministic/demo discovery when the CLI fails.
    throw error;
  }
  const discovery = await discoverProjectEcosystem(project, answers, searchHints);
  const verifiedGithub = discovery.githubProjects;
  const verifiedGithubContext = verifiedGithub.map((x) => ({
    name: x.name,
    repo: x.repo,
    url: x.url,
    description: x.description,
    stars: x.stars,
    language: x.language,
    license: x.license,
    updatedAt: x.updatedAt,
    source: x.source || "snapshot",
  }));
  const prompt = `你是 AgentScope 的项目评估 Agent。你可以使用联网搜索，但最终报告中的事实必须优先来自本地知识库和服务端已核验的 GitHub 结果。请返回一个完整、合法的 JSON 对象。项目：${JSON.stringify({ idea: project.idea, kind: project.kind, mode: project.evaluationMode })}；访谈答案：${JSON.stringify(answers)}。
规则：1）GitHub 项目只能从“已核验 GitHub 候选”中选择，不能自行编造仓库、Star、链接或更新时间；2）如果候选不够，少推荐，不要用随机热门仓库凑数；3）对类似产品、AI 工具、Agent、模型、Skill、MCP、Plugin 必须说明来源和待确认项；4）不要声称已安装、已授权或已执行未执行的操作；5）Token、时间、成本是项目实施预测，不是本次评估调用消耗。已核验 GitHub 候选：${JSON.stringify(verifiedGithubContext)}。本地知识库候选：${JSON.stringify(knowledgeContext)}。Codex 本次搜索意图：${JSON.stringify(searchHints)}。返回字段：title,typeLabel,summary,verdict,score,status,acceptanceCriteria,strategy,scores,agents,models,githubProjects,risks,techStack,workflow,architecture,estimates,confidence。只输出 JSON，不要 Markdown。`;
  const raw = await codexCliAdapter.generateStructured<Record<string, unknown>>({ prompt, model, timeoutMs: 300000, maxOutputBytes: 4_000_000 });
  requireLiveEvaluation(raw, "codex-cli");
  const text = (value: unknown, fallback: string) => typeof value === "string" && value.trim() ? value : fallback;
  const list = (value: unknown, fallback: string[]) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : fallback;
  const score = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : fallback;
  const verifiedByRepo = new Map(verifiedGithub.map((item) => [item.repo.toLowerCase(), item]));
  const requestedRepos = Array.isArray(raw.githubProjects)
    ? raw.githubProjects.map((item) => String((item as Record<string, unknown>)?.repo || "").toLowerCase()).filter(Boolean)
    : [];
  const selectedVerified = requestedRepos.length
    ? requestedRepos.map((repo) => verifiedByRepo.get(repo)).filter((item): item is GithubProjectRecommendation => Boolean(item))
    : verifiedGithub;
  // Always render server-verified records. The model may enrich the use case,
  // but it cannot replace the URL, repository identity, metrics or evidence.
  const githubProjects = selectedVerified.slice(0, 12).map((item, index) => {
    const modelItem = Array.isArray(raw.githubProjects)
      ? raw.githubProjects.find((candidate) => String((candidate as Record<string, unknown>)?.repo || "").toLowerCase() === item.repo.toLowerCase()) as Record<string, unknown> | undefined
      : undefined;
    return {
      ...item,
      id: `codex-github-${index}-${item.repo.replace(/[^a-z0-9]+/gi, "-")}`,
      similarity: score(modelItem?.similarity, item.similarity),
      recommendation: score(modelItem?.recommendation, item.recommendation),
      recommendedUse: text(modelItem?.recommendedUse, item.recommendedUse),
      source: item.source || "snapshot" as const,
    };
  });
  const report: ProjectReport = {
    ...base,
    projectKind: project.kind,
    projectIdea: project.idea,
    projectSummary: { ...base.projectSummary, title: text(raw.title, base.projectSummary.title), typeLabel: text(raw.typeLabel, base.projectSummary.typeLabel), summary: text(raw.summary, base.projectSummary.summary), verdict: text(raw.verdict, base.projectSummary.verdict), status: text(raw.status, base.projectSummary.status), score: score(raw.score, base.projectSummary.score), acceptanceCriteria: list(raw.acceptanceCriteria, base.projectSummary.acceptanceCriteria) },
    strategy: { ...base.strategy, reason: text((raw.strategy as Record<string, unknown> | undefined)?.reason, base.strategy.reason), recipe: list((raw.strategy as Record<string, unknown> | undefined)?.recipe, base.strategy.recipe) },
    githubProjects,
    ecosystem: discovery.ecosystem.length ? discovery.ecosystem : ecosystemFromKnowledge(knowledgeMatches),
    knowledge: discovery.knowledge,
    risks: Array.isArray(raw.risks) && raw.risks.length ? raw.risks as ProjectReport["risks"] : base.risks,
    architecture: list(raw.architecture, base.architecture),
    actualUsage: { provider: "openai", model: model || process.env.CODEX_MODEL || process.env.AI_REASONING_MODEL || "Codex CLI 默认模型", promptTokens: 0, completionTokens: 0, totalTokens: 0, recordedAt: new Date().toISOString() },
    sources: [{ id: "codex-cli", type: "本地 CLI + ChatGPT OAuth", name: "Codex CLI 搜索意图生成", updatedAt: new Date().toISOString() }, { id: "github-codex-search", type: "GitHub API + Codex 搜索意图", name: `${githubProjects.length} 个服务端核验仓库`, url: "https://github.com/search", updatedAt: new Date().toISOString(), count: String(githubProjects.length) }, { id: "browser-search", type: "浏览器搜索", name: discovery.knowledge.browserSearch?.searchedAt ? `Tavily 搜索 ${discovery.knowledge.browserSearch.resultCount} 个网页结果` : "浏览器搜索未执行", url: "https://tavily.com/", updatedAt: discovery.knowledge.browserSearch?.searchedAt || new Date().toISOString(), count: String(discovery.knowledge.browserSearch?.resultCount || 0) }, { id: "knowledge-base", type: "知识库 + 规则引擎", name: `先从 ${listKnowledgeItems().length} 条已发布条目筛选 ${knowledgeMatches.length} 条`, updatedAt: new Date().toISOString(), count: String(knowledgeMatches.length) }, ...base.sources.filter((source) => source.id !== "github" && source.id !== "deepseek")],
    generatedAt: new Date().toISOString(),
    generationMode: "live",
    provider: "openai",
    model: model || process.env.CODEX_MODEL || process.env.AI_REASONING_MODEL || "Codex CLI 默认模型",
    inputFingerprint: buildInputFingerprint(project, answers, "knowledge-v1", "knowledge-base+github"),
  };
  report.agentPlan = buildAgentPlan(project, profile, report, report.model || "Codex CLI 默认模型");
  Object.assign(report, applyAgentPlanToReport(report, report.agentPlan));
  report.models = report.models.map((item, index) => index === 0 ? { ...item, provider: report.provider || item.provider, modelId: report.model || item.modelId, name: report.model || item.name, reason: `用户已选择 ${report.provider || item.provider} / ${report.model || item.modelId}，作为本项目主力模型。` } : item);
  Object.assign(report, customizeProjectSections(project, profile, report));
  report.promptArtifacts = buildPromptArtifacts(project, report, report.agentPlan);
  return report;
}

