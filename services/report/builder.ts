import {
  EVALUATION_ENGINE_VERSION,
  Evidence,
  GithubProjectRecommendation,
  KnowledgeMatch,
  PlanSnapshot,
  Project,
  ProjectReport,
  RequirementProfile,
  RetrievalMode,
} from "../../types";
import { scoreAgents } from "../recommendation/agentScorer";
import { scoreExecutionModels } from "../recommendation/modelScorer";
import { scoreTools } from "../recommendation/toolScorer";
import { scoreConfidence } from "../recommendation/confidenceScorer";
import { attachGithubEvidence } from "../recommendation/githubScorer";
import { estimateTokens } from "../estimation/tokenEstimator";
import { estimateTime } from "../estimation/timeEstimator";
import { estimateCost } from "../estimation/costEstimator";
import { createEvidence, mergeEvidence, rewriteEvidenceIds } from "../evidence/evidenceStore";
import { buildAgentPlan, applyAgentPlanToReport, buildPromptArtifacts } from "../reportCustomizationService";
import { assessReadiness } from "../evaluation/readinessGate";
import { planArchitecture } from "../evaluation/architect";
import { classifyUnknowns } from "../evaluation/unknowns";
import { judgeReport } from "../evaluation/finalJudge";
import { assertEvidenceIntegrity, criticalEvidenceCoverage } from "../evidence/integrity";
import { buildTraceabilityPlan, diffPlans } from "../planning/traceability";
import { getPreviousPlan, nextPlanVersion, savePlanSnapshot } from "../historyStore";

function snapshotFromReport(profile: RequirementProfile, report: ProjectReport, version: number): PlanSnapshot {
  return {
    version,
    profile,
    architecture: report.architecture,
    architectureDetail: report.architectureDetail,
    githubProjects: report.githubProjects,
    models: report.models,
    agents: report.agents,
    tools: report.tools,
    risks: report.risks,
    estimates: report.estimates,
    executionPlan: report.executionPlan,
    readiness: report.readiness,
    evidence: report.evidence || [],
  };
}

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
  validExecutionPlan?: boolean;
}): ProjectReport {
  const { project, profile, githubProjects, retrievalMode, evaluator } = input;
  const agents = scoreAgents(profile, evaluator.provider);
  const models = scoreExecutionModels(profile, evaluator);
  const tools = scoreTools(profile);
  const architectureDetail = planArchitecture(profile);
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
  const githubEvidence = attachGithubEvidence(githubProjects);
  const calculationEvidence = createEvidence({
    type: "calculation",
    title: "估算启发式",
    confidence: "low",
    note: `time=${time.display}; cost=${cost.display}`,
  });
  const knowledgeEvidence = input.knowledgeMatches.slice(0, 18).map((match) =>
    createEvidence({
      type: "knowledge-base",
      title: match.item.name,
      url: match.item.sourceUrl || match.item.url,
      confidence: match.item.confidence === "高" ? "high" : "medium",
      note: match.item.summary,
    }),
  );
  const merged = mergeEvidence(input.evidence, models.evidence, tools.evidence, agents.evidence, githubEvidence, [calculationEvidence], knowledgeEvidence);
  const linkedGithub = githubProjects.map((item) => ({ ...item, evidenceIds: rewriteEvidenceIds(item.evidenceIds, merged.idMap) }));
  const linkedAgents = agents.agents.map((item) => ({ ...item, evidenceIds: rewriteEvidenceIds(item.evidenceIds, merged.idMap) }));
  const linkedModels = models.models.map((item) => ({ ...item, evidenceIds: rewriteEvidenceIds(item.evidenceIds, merged.idMap) }));
  const linkedTools = tools.tools.map((item) => ({ ...item, evidenceIds: rewriteEvidenceIds(item.evidenceIds, merged.idMap) }));
  const linkedStack = tools.techStack.map((item) => ({ ...item, evidenceIds: rewriteEvidenceIds(item.evidenceIds, merged.idMap) }));
  const title = project.idea.slice(0, 48) || "项目评估";
  const unknownFields: string[] = [];
  if (!githubProjects.length && profile.needsGithub) unknownFields.push("github");
  if (cost.display === "unknown") unknownFields.push("cost");
  if (time.range === "insufficient_evidence") unknownFields.push("time");

  const feasibility = githubProjects.length || (profile.requiredFeatures || []).length ? Math.round((confidence.details.architecture?.score || 0) * 100) : "unknown";
  const quality = (profile.requiredFeatures || []).length ? Math.round(((confidence.details.tools?.score || 0) * 50 + (confidence.details.architecture?.score || 0) * 50)) : "unknown";
  const evidenceConfidence = Math.round((confidence.details.requirement?.score || 0) * 40 + (confidence.details.github?.score || 0) * 60);
  const decisionEvidenceIds = rewriteEvidenceIds([calculationEvidence.id, ...(linkedAgents[0]?.evidenceIds || [])], merged.idMap);
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
    agents: linkedAgents,
    models: linkedModels,
    githubProjects: linkedGithub,
    referenceProducts: [],
    tools: linkedTools,
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
      evidenceIds: rewriteEvidenceIds(
        knowledgeEvidence.filter((item) => item.title === match.item.name).map((item) => item.id),
        merged.idMap,
      ),
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
    techStack: linkedStack,
    workflows: [],
    alternatives: [],
    architecture: architectureDetail.components,
    estimates: {
      tokens,
      time,
      cost,
      humanEffort: { display: "需人工确认审查节点", range: "unknown", confidence: "低", breakdown: [{ label: "Human Review", value: "unknown" }] },
      automation: { rate: Math.min(80, 40 + (profile.needsTerminal ? 10 : 0) + (profile.needsMcp ? 10 : 0)), aiWork: linkedAgents.map((agent) => agent.name), humanWork: ["许可证确认", "生产发布", "未知项确认"], confidence: "中" },
    },
    risks: [
      ...(!githubProjects.length && profile.needsGithub ? [{ title: "缺少已核验开源参考", level: "中风险", probability: "高", impact: "中", advice: "补充 GitHub token 或更具体的仓库线索后再评估" }] : []),
      ...(profile.dataSensitivity === "高" ? [{ title: "数据敏感", level: "高风险", probability: "中", impact: "高", advice: "先确认部署边界，再选择云服务" }] : []),
      ...((profile.requiredFeatures || []).includes("payment") ? [{ title: "支付回调与对账失败", level: "高风险", probability: "中", impact: "高", advice: "先确认支付 Provider、Webhook 验签和对账，再进入开发" }] : []),
      { title: "估算依赖规模假设", level: "中风险", probability: "高", impact: "中", advice: "功能清单变化后必须重算时间和成本" },
    ],
    confidence: confidence.summary,
    sources: merged.evidence.map((item) => ({ id: item.id, type: item.type, name: item.title, url: item.url, updatedAt: item.retrievedAt || new Date().toISOString() })),
    generatedAt: new Date().toISOString(),
    generationMode: "live",
    provider: evaluator.provider,
    model: evaluator.model,
    connectionMode: evaluator.mode === "cli" ? "cli" : "api-key",
    evidence: merged.evidence,
    unknownFields,
    needsConfirmation: unknownFields.map((field) => `字段 ${field} 证据不足`),
    nextActions: [
      githubProjects[0] ? `Clone ${githubProjects[0].repo}` : profile.needsGithub ? "先补齐可核验 GitHub 参考，再开始施工" : "按施工任务从本机实现开始",
      githubProjects[0] ? "阅读 README、许可证和最近提交" : "用更具体的功能词重新分析",
      "只实现需求画像中的 requiredFeatures",
      "遇到 unknown 字段先确认，不要用模板数字填上",
    ],
    decisionLog: [
      { decision: "评估模型 vs 执行模型", chosen: `${evaluator.provider}/${evaluator.model} 仅作 evaluator`, rejected: ["把评估模型自动当主力开发模型"], reason: "评估者和执行者必须独立", evidenceIds: decisionEvidenceIds },
      { decision: "GitHub 相关度", chosen: "领域/功能/技术栈/成熟度/可维护性/许可证加权", rejected: ["搜索 index", "纯 Star"], reason: "避免伪精确相似度", evidenceIds: rewriteEvidenceIds(linkedGithub[0]?.evidenceIds, merged.idMap) },
    ],
    evaluationEngineVersion: EVALUATION_ENGINE_VERSION,
    retrievalMode,
    evaluator: { provider: evaluator.provider, model: evaluator.model },
    executionModels: linkedModels.filter((item) => item.roleKind === "execution").slice(0, 4).map((item) => ({ role: item.task, provider: item.provider, model: item.modelId })),
    confidenceDetails: confidence.details,
    criticNotes: input.criticNotes || [],
    feasibilityScore: feasibility,
    solutionQualityScore: quality,
    evidenceConfidenceScore: evidenceConfidence,
    requirementCompleteness: profile.completeness?.score,
    estimateMethod: "heuristic-v1",
    planVersion: 1,
    executionPlan: buildTraceabilityPlan(profile, linkedAgents, linkedTools),
  };
  report.architectureDetail = architectureDetail;
  report.unknownItems = classifyUnknowns(profile, report);
  report.validExecutionPlan = input.validExecutionPlan !== false && report.projectSummary.status !== "needs_clarification";
  const previousPlan = getPreviousPlan(project.id);
  if (report.validExecutionPlan) {
    report.planVersion = nextPlanVersion(project.id);
    report.readiness = assessReadiness(profile, report);
    const currentSnap = snapshotFromReport(profile, report, report.planVersion || 1);
    report.planDiff = diffPlans(previousPlan, currentSnap);
    savePlanSnapshot(project.id, report.planVersion || 1, currentSnap);
  } else {
    report.planVersion = previousPlan ? previousPlan.version : 0;
    report.readiness = assessReadiness(profile, report);
  }
  const executorCoverage = report.executionPlan?.executorCoverage ?? 0;
  if (executorCoverage < 1 && (profile.requiredFeatures || []).length) {
    report.blockingIssues = Array.from(new Set([...(report.blockingIssues || []), "存在没有匹配 Agent 的 Required Feature"]));
  }
  report.readiness = assessReadiness(profile, report);
  const missingEvidence = assertEvidenceIntegrity(report);
  if (missingEvidence.length) report.blockingIssues = Array.from(new Set([...(report.blockingIssues || []), ...missingEvidence.map((item) => `证据断链 ${item}`)]));
  const critical = criticalEvidenceCoverage(report, profile);
  if (critical.blocking.length) report.blockingIssues = Array.from(new Set([...(report.blockingIssues || []), ...critical.blocking.map((item) => `关键证据缺失 ${item}`)]));
  const judged = judgeReport(report);
  report.judgeStatus = judged.status;
  report.criticIds = judged.criticIds;
  report.judgeEvidenceIds = judged.evidenceIds;
  const agentPlan = buildAgentPlan(project, profile, report, linkedModels.find((item) => item.roleKind === "execution")?.modelId || evaluator.model);
  report.agentPlan = agentPlan;
  report = { ...report, ...applyAgentPlanToReport(report, agentPlan) };
  report.promptArtifacts = buildPromptArtifacts(project, report, agentPlan);
  return report;
}

export function markDemoReport<T extends { generationMode?: string }>(report: T): T {
  return { ...report, generationMode: "demo" };
}
