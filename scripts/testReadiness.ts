import assert from "node:assert/strict";
import { evaluateRequirementGate } from "../services/evaluation/requirementGate";
import { extractRequirementProfile } from "../services/requirements/extractor";
import { runExpertPipeline } from "../services/evaluation/expertPipeline";
import { runQuickPipeline } from "../services/evaluation/quickPipeline";
import { classifyUnknowns } from "../services/evaluation/unknowns";
import { assessReadiness } from "../services/evaluation/readinessGate";
import { buildLiveReport } from "../services/report/builder";
import { scoreAgents } from "../services/recommendation/agentScorer";
import { buildTraceabilityPlan } from "../services/planning/traceability";

(async () => {
  const vague = extractRequirementProfile({ id: "a", idea: "我要做一个 AI 项目", kind: "general", evaluationMode: "expert", createdAt: new Date().toISOString() });
  assert.equal(evaluateRequirementGate(vague, "expert").allowed, false);

  const report = await runExpertPipeline(
    { id: "a", idea: "我要做一个 AI 项目", kind: "general", evaluationMode: "expert", createdAt: new Date().toISOString() },
    {},
    { provider: "deepseek", model: "deepseek-v4-flash" },
  );
  assert.equal(report.readiness, "needs_clarification");
  assert.equal(report.validExecutionPlan, false);
  assert.ok((report.clarificationQuestions || []).length >= 1);

  const quick = await runQuickPipeline(
    { id: "q", idea: "我要做一个 AI 项目", kind: "general", evaluationMode: "quick", createdAt: new Date().toISOString() },
    {},
    { provider: "deepseek", model: "deepseek-v4-flash" },
  );
  assert.equal(quick.readiness, "needs_clarification");
  assert.equal(quick.validExecutionPlan, false);

  const stm32Project = { id: "stm", idea: "STM32 温控器 Keil DS18B20 OLED", kind: "general" as const, evaluationMode: "expert" as const, createdAt: new Date().toISOString() };
  const stm32Profile = extractRequirementProfile(stm32Project);
  stm32Profile.completeness = { score: 0.82, missingFields: [], blockingQuestions: [], optionalQuestions: [] };
  stm32Profile.requiredFeatures = ["firmware"];
  stm32Profile.acceptanceCriteria = ["温度可显示"];
  stm32Profile.platforms = ["embedded-device"];
  stm32Profile.needsGithub = false;
  const agents = scoreAgents(stm32Profile, "deepseek");
  const plan = buildTraceabilityPlan(stm32Profile, agents.agents);
  const stm32Report = buildLiveReport({
    project: stm32Project,
    profile: stm32Profile,
    githubProjects: [],
    knowledgeMatches: [],
    retrievalMode: "lexical",
    evaluator: { provider: "deepseek", model: "x" },
    evidence: [],
    validExecutionPlan: true,
  });
  stm32Report.unknownItems = classifyUnknowns(stm32Profile, stm32Report).filter((item) => item.field !== "github");
  stm32Report.blockingIssues = [];
  stm32Report.clarificationQuestions = [];
  stm32Report.projectSummary.status = "ready";
  stm32Report.architecture = ["外设驱动"];
  stm32Report.executionPlan = { ...plan, taskCoverage: 1, executorCoverage: 1, coverage: 1 };
  assert.equal(assessReadiness(stm32Profile, stm32Report), "development_ready");

  const costReport = { ...stm32Report, estimates: { ...stm32Report.estimates, cost: { ...stm32Report.estimates.cost, display: "unknown" } } };
  costReport.unknownItems = classifyUnknowns(stm32Profile, costReport);
  assert.ok(costReport.unknownItems.some((item) => item.field === "hosting-cost" && item.severity === "optional"));
  assert.notEqual(assessReadiness(stm32Profile, { ...costReport, blockingIssues: [], clarificationQuestions: [], projectSummary: { ...costReport.projectSummary, status: "ready" } }), "blocked");

  const chipProfile = extractRequirementProfile({ id: "chip", idea: "嵌入式温控项目，核心芯片型号还没定", kind: "general", evaluationMode: "expert", createdAt: new Date().toISOString() });
  chipProfile.completeness = { score: 0.82, missingFields: [], blockingQuestions: [], optionalQuestions: [] };
  chipProfile.requiredFeatures = ["firmware"];
  chipProfile.platforms = ["embedded-device"];
  chipProfile.needsGithub = false;
  const chipUnknowns = classifyUnknowns(chipProfile, stm32Report);
  assert.ok(chipUnknowns.some((item) => item.field === "chip" && item.severity === "blocking"));
  assert.notEqual(assessReadiness(chipProfile, { ...stm32Report, unknownItems: chipUnknowns }), "development_ready");
  console.log("readiness tests passed");
})();
