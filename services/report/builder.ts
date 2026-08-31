import {
  EVALUATION_ENGINE_VERSION,
  Evidence,
  GithubProjectRecommendation,
  KnowledgeMatch,
  Project,
  ProjectReport,
  RequirementProfile,
  RetrievalMode,
} from "../../types";
import { scoreAgents } from "../recommendation/agentScorer";
import { scoreExecutionModels } from "../recommendation/modelScorer";
import { scoreTools } from "../recommendation/toolScorer";
import { scoreConfidence } from "../recommendation/confidenceScorer";
import { estimateTokens } from "../estimation/tokenEstimator";
import { estimateTime } from "../estimation/timeEstimator";
import { estimateCost } from "../estimation/costEstimator";
import { mergeEvidence } from "../evidence/evidenceStore";
import { buildAgentPlan, applyAgentPlanToReport, buildPromptArtifacts } from "../reportCustomizationService";
import { assessReadiness } from "../evaluation/readinessGate";
import { buildTraceabilityPlan, diffPlans } from "../planning/traceability";
import { getPreviousPlan, nextPlanVersion, savePlanSnapshot } from "../historyStore";

export function buildLiveReport(input: {
  project: Project;
  profile: RequirementProfile;
  githubProjects: GithubProjectRecommendation[];
  knowledgeMatches: KnowledgeMatch[];
  retrievalMode: RetrievalMode;
  evaluator: { provider: string; model: string; mode?: string };
  evidence: Evidence[];
  criticNotes?: string[];
  llmSummary?: { title?: string; verdict?: string; summary?: string; strategyReason?: string };
}): ProjectReport {
  const { project, profile, githubProjects, retrievalMode, evaluator } = input;
  const agents = scoreAgents(profile, evaluator.provider);
  const models = scoreExecutionModels(profile, evaluator);
  const tools = scoreTools(profile);
  const tokens = estimateTokens(profile);
  const time = estimateTime(profile);
  const cost = estimateCost(profile, tokens, evaluator);
  const confidence = scoreConfidence({
    profile,
    github: githubProjects,
    retrievalMode,
    hasLiveGithub: githubProjects.some((item) => item.source === "live" && item.url.startsWith("http")),
    costKnown: cost.display !== "unknown",
    timeKnown: time.range !== "insufficient_evidence",
  });
  const evidence = mergeEvidence(input.evidence, models.evidence, tools.evidence);
  const title = project.idea.slice(0, 48) || "项目评估";
  const unknownFields: string[] = [];
  if (!githubProjects.length) unknownFields.push("github");
  if (cost.display === "unknown") unknownFields.push("cost");
  if (time.range === "insufficient_evidence") unknownFields.push("time");

  const feasibility = githubProjects.length || (profile.requiredFeatures || []).length ? Math.round((confidence.details.architecture?.score || 0) * 100) : "unknown";
  const quality = (profile.requiredFeatures || []).length ? Math.round(((confidence.details.tools?.score || 0) * 50 + (confidence.details.architecture?.score || 0) * 50)) : "unknown";
  const evidenceConfidence = Math.round((confidence.details.requirement?.score || 0) * 40 + (confidence.details.github?.score || 0) * 60);
  let report: ProjectReport = {
    id: project.id,
    projectKind: profile.projectKind,
    projectIdea: project.idea,
    projectSummary: {
      title,
      typeLabel: (profile.domains || []).map((item) => item.name).slice(0, 3).join(" / ") || project.kind,
      stage: "评估",
      audience: profile.userType || "未确认",
      summary: input.llmSummary?.summary || `${project.idea}。本报告只使用已核验来源、知识库和可解释评分；证据不足的字段标记为 unknown。`,
      verdict: input.llmSummary?.verdict || (githubProjects.length ? "可行，但需先核验未知项再施工" : "证据不足，不能给出强结论"),
      score: typeof evidenceConfidence === "number" ? evidenceConfidence : 0,
      status: unknownFields.length ? "needs_confirmation" : "ready",
      acceptanceCriteria: profile.acceptanceCriteria || [],
    },
    strategy: {
      type: githubProjects[0]?.licenseUse === "核心二开" ? "基于开源项目二次开发" : "从零开发",
      confidence: Math.round((confidence.details.architecture?.score || 0) * 100),
      reason: input.llmSummary?.strategyReason || "策略来自需求画像、许可证适合度和可核验仓库，而不是固定三套模板。",
      recipe: [profile.projectKind, ...profile.stack.slice(0, 3), evaluator.model].filter(Boolean),
      savings: { time: time.display, tokens: tokens.display },
    },
    scores: Object.entries(confidence.details).map(([label, value]) => ({ label, score: Math.round(value.score * 100) })),
    agents: agents.agents,
    models: models.models,
    githubProjects,
    referenceProducts: [],
    tools: tools.tools,
    ecosystem: input.knowledgeMatches.filter((match) => match.item.kind !== "github").slice(0, 18).map((match) => ({
      id: `kb-${match.item.id}`,
      name: match.item.name,
      category: ["product", "rule", "algorithm"].includes(match.item.kind) ? "ai-tool" : match.item.kind as "ai-tool",
      description: match.item.summary,
      url: match.item.url || match.item.sourceUrl,
      source: match.item.sourceType === "github" ? "github" : match.item.sourceType === "npm" ? "npm" : match.item.sourceType === "registry" ? "registry" : "official",
      updatedAt: match.item.updatedAt,
      matchScore: match.score,
      reason: `${match.matchedBy.slice(0, 4).join("、") || "知识库命中"}。来源：${match.item.sourceUrl}`,
      evidenceIds: [],
      capabilities: match.item.capabilities,
      access: match.item.access || "需查看官方文档",
      pricing: match.item.pricing,
      pricingDetails: match.item.pricingDetails,
    })),
    knowledge: {
      snapshotAt: new Date().toISOString(),
      itemCount: input.knowledgeMatches.length,
      sources: Array.from(new Set(input.knowledgeMatches.map((match) => match.item.sourceUrl))).slice(0, 12),
      coverage: "知识库 + 实时来源；不代表全市场覆盖",
      inferredCount: 0,
      filteredCount: 0,
    },
    interfaces: [],
    techStack: tools.techStack,
    workflows: [],
    alternatives: [],
    architecture: agents.agents.map((agent) => agent.name),
    estimates: {
      tokens,
      time,
      cost,
      humanEffort: { display: "需人工确认审查节点", range: "unknown", confidence: "低", breakdown: [{ label: "Human Review", value: "unknown" }] },
      automation: { rate: Math.min(80, 40 + (profile.needsTerminal ? 10 : 0) + (profile.needsMcp ? 10 : 0)), aiWork: agents.agents.map((agent) => agent.name), humanWork: ["许可证确认", "生产发布", "未知项确认"], confidence: "中" },
    },
    risks: [
      ...(!githubProjects.length ? [{ title: "缺少已核验开源参考", level: "中风险", probability: "高", impact: "中", advice: "补充 GitHub token 或更具体的仓库线索后再评估" }] : []),
      ...(profile.dataSensitivity === "高" ? [{ title: "数据敏感", level: "高风险", probability: "中", impact: "高", advice: "先确认部署边界，再选择云服务" }] : []),
      { title: "估算依赖规模假设", level: "中风险", probability: "高", impact: "中", advice: "功能清单变化后必须重算时间和成本" },
    ],
    confidence: confidence.summary,
    sources: evidence.map((item) => ({ id: item.id, type: item.type, name: item.title, url: item.url, updatedAt: item.retrievedAt || new Date().toISOString() })),
    generatedAt: new Date().toISOString(),
    generationMode: "live",
    provider: evaluator.provider,
    model: evaluator.model,
    connectionMode: evaluator.mode === "cli" ? "cli" : "api-key",
    evidence,
    unknownFields,
    needsConfirmation: unknownFields.map((field) => `字段 ${field} 证据不足`),
    nextActions: [
      githubProjects[0] ? `Clone ${githubProjects[0].repo}` : "先补齐可核验 GitHub 参考，再开始施工",
      githubProjects[0] ? "阅读 README、许可证和最近提交" : "用更具体的功能词重新分析",
      "只实现需求画像中的 requiredFeatures",
      "遇到 unknown 字段先确认，不要用模板数字填上",
    ],
    decisionLog: [
      { decision: "评估模型 vs 执行模型", chosen: `${evaluator.provider}/${evaluator.model} 仅作 evaluator`, rejected: ["把评估模型自动当主力开发模型"], reason: "评估者和执行者必须独立" },
      { decision: "GitHub 相关度", chosen: "领域/功能/技术栈/成熟度/可维护性/许可证加权", rejected: ["搜索 index", "纯 Star"], reason: "避免伪精确相似度" },
    ],
    evaluationEngineVersion: EVALUATION_ENGINE_VERSION,
    retrievalMode,
    evaluator: { provider: evaluator.provider, model: evaluator.model },
    executionModels: models.models.filter((item) => item.roleKind === "execution").slice(0, 4).map((item) => ({ role: item.task, provider: item.provider, model: item.modelId })),
    confidenceDetails: confidence.details,
    criticNotes: input.criticNotes || [],
    feasibilityScore: feasibility,
    solutionQualityScore: quality,
    evidenceConfidenceScore: evidenceConfidence,
    requirementCompleteness: profile.completeness?.score,
    estimateMethod: "heuristic-v1",
    planVersion: 1,
    executionPlan: buildTraceabilityPlan(profile, agents.agents, tools.tools),
  };
  const previousPlan = getPreviousPlan(project.id);
  report.planVersion = nextPlanVersion(project.id);
  report.planDiff = diffPlans(previousPlan, report.executionPlan);
  if (report.executionPlan) savePlanSnapshot(project.id, report.planVersion || 1, report.executionPlan);
  if ((report.executionPlan?.coverage || 0) < 1 && (profile.requiredFeatures || []).length) {
    report.blockingIssues = Array.from(new Set([...(report.blockingIssues || []), "存在没有匹配 Agent 的 Required Feature"]));
  }
  report.readiness = assessReadiness(profile, report);
  const agentPlan = buildAgentPlan(project, profile, report, models.models.find((item) => item.roleKind === "execution")?.modelId || evaluator.model);
  report.agentPlan = agentPlan;
  report = { ...report, ...applyAgentPlanToReport(report, agentPlan) };
  report.promptArtifacts = buildPromptArtifacts(project, report, agentPlan);
  return report;
}

export function markDemoReport<T extends { generationMode?: string }>(report: T): T {
  return { ...report, generationMode: "demo" };
}
