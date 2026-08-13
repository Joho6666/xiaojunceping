import { AnswerValue, Project, ProjectReport } from "../types";
import { buildMockReport } from "../data/reportCatalog";
import {
  generateDeepSeekEvaluation,
  generateDeepSeekSearchPlan,
} from "./deepseekService";
import { searchGithubProjects } from "./githubService";
import { isCommerceProject, profileFor } from "../data/projectProfiles";
import { discoverEcosystem } from "./ecosystemDiscoveryService";

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

export async function analyzeWithDeepSeek(
  project: Project,
  answers: Record<string, AnswerValue>,
  connection: { baseUrl?: string; model?: string; secret?: string },
): Promise<ProjectReport> {
  const searchPlan = await generateDeepSeekSearchPlan(
    project,
    answers,
    connection,
  );
  const githubProjects = await searchGithubProjects(
    project,
    searchPlan.queries,
  );
  const ecosystem = await discoverEcosystem(project, searchPlan.queries);
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
              modelId: str(v.modelId, connection.model || "deepseek-chat"),
              task: str(v.task, "项目评估与规划"),
              reason: str(v.reason, "由 DeepSeek 基于任务匹配"),
              matchScore: number(v.matchScore, 80),
            };
          })
        : base.models,
    githubProjects,
    ecosystem,
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
            model: connection.model || "deepseek-chat",
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
      provider: "deepseek",
      model: connection.model || "deepseek-chat",
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
        name: `${connection.model || "deepseek-chat"} 真实分析`,
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
  };
  return report;
}
