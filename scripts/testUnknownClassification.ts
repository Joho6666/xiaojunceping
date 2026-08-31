import assert from "node:assert/strict";
import { classifyUnknowns } from "../services/evaluation/unknowns";
import { assessReadiness } from "../services/evaluation/readinessGate";
import { extractRequirementProfile } from "../services/requirements/extractor";
import { buildLiveReport } from "../services/report/builder";
import { scoreAgents } from "../services/recommendation/agentScorer";
import { buildTraceabilityPlan } from "../services/planning/traceability";

function reportFor(idea: string, extra: Partial<Parameters<typeof buildLiveReport>[0]> = {}) {
  const project = { id: idea.slice(0, 8), idea, kind: "general" as const, evaluationMode: "expert" as const, createdAt: new Date().toISOString() };
  const profile = extra.profile || extractRequirementProfile(project);
  return {
    profile,
    report: buildLiveReport({
      project,
      profile,
      githubProjects: [],
      knowledgeMatches: [],
      retrievalMode: "lexical",
      evaluator: { provider: "deepseek", model: "x" },
      evidence: [],
      ...extra,
    }),
  };
}

const stm32 = reportFor("STM32 温控器 Keil DS18B20 OLED");
assert.equal(stm32.profile.needsGithub, false);
assert.ok(!classifyUnknowns(stm32.profile, stm32.report).some((item) => item.field === "github" && item.severity === "blocking"));

const readyProfile = {
  ...stm32.profile,
  completeness: { score: 0.82, missingFields: [], blockingQuestions: [], optionalQuestions: [] },
  requiredFeatures: ["firmware"],
  acceptanceCriteria: ["温度可显示"],
  platforms: ["embedded-device"],
};
const agents = scoreAgents(readyProfile, "deepseek");
const plan = buildTraceabilityPlan(readyProfile, agents.agents);
const stm32Ready = {
  ...stm32.report,
  unknownItems: [],
  blockingIssues: [],
  clarificationQuestions: [],
  projectSummary: { ...stm32.report.projectSummary, status: "ready", acceptanceCriteria: ["温度可显示"] },
  architecture: ["外设驱动"],
  executionPlan: { ...plan, taskCoverage: 1, executorCoverage: 1, coverage: 1 },
};
assert.equal(assessReadiness(readyProfile, stm32Ready), "development_ready");

const vague = reportFor("做一个东西");
vague.report.estimates.cost.display = "unknown";
const costUnknown = classifyUnknowns(vague.profile, vague.report).find((item) => item.field === "hosting-cost");
assert.equal(costUnknown?.severity, "optional");
const proto = {
  ...vague.report,
  unknownItems: classifyUnknowns(vague.profile, vague.report),
  blockingIssues: [],
  clarificationQuestions: [],
  projectSummary: { ...vague.report.projectSummary, status: "ready", acceptanceCriteria: ["可演示"] },
};
assert.notEqual(assessReadiness(vague.profile, proto), "blocked");
assert.ok(["prototype_ready", "research_ready", "not_ready"].includes(assessReadiness(vague.profile, proto)));

const chipProfile = extractRequirementProfile({ id: "chip", idea: "嵌入式温控项目，核心芯片型号还没定", kind: "general", evaluationMode: "expert", createdAt: new Date().toISOString() });
chipProfile.completeness = { score: 0.82, missingFields: [], blockingQuestions: [], optionalQuestions: [] };
chipProfile.requiredFeatures = ["firmware"];
chipProfile.platforms = ["embedded-device"];
chipProfile.needsGithub = false;
const chipReport = {
  ...stm32Ready,
  unknownItems: classifyUnknowns(chipProfile, stm32.report),
};
assert.ok(chipReport.unknownItems.some((item) => item.field === "chip" && item.severity === "blocking"));
assert.notEqual(assessReadiness(chipProfile, chipReport), "development_ready");
console.log("unknown classification tests passed");
