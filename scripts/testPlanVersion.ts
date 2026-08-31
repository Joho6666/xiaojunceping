import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

(async () => {
  process.env.AGENTSCOPE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "plan-ver-"));
  const { buildLiveReport } = await import("../services/report/builder");
  const { extractRequirementProfile } = await import("../services/requirements/extractor");
  const { getPreviousPlan, saveEvaluationRun, nextPlanVersion } = await import("../services/historyStore");
  const project = { id: "pv", idea: "校园交友登录聊天", kind: "web" as const, evaluationMode: "expert" as const, createdAt: new Date().toISOString() };
  const profile = extractRequirementProfile(project);
  const blocked = buildLiveReport({
    project,
    profile,
    githubProjects: [],
    knowledgeMatches: [],
    retrievalMode: "lexical",
    evaluator: { provider: "deepseek", model: "x" },
    evidence: [],
    validExecutionPlan: false,
  });
  assert.ok((blocked.planVersion || 0) === 0);
  assert.equal(getPreviousPlan("pv"), null);
  saveEvaluationRun(project, blocked);
  assert.equal(nextPlanVersion("pv"), 1);
  const first = buildLiveReport({
    project,
    profile,
    githubProjects: [],
    knowledgeMatches: [],
    retrievalMode: "lexical",
    evaluator: { provider: "deepseek", model: "x" },
    evidence: [],
    validExecutionPlan: true,
  });
  assert.equal(first.planVersion, 1);
  const second = buildLiveReport({
    project,
    profile: { ...profile, requiredFeatures: [...(profile.requiredFeatures || []), "payment"], numberOfFeatures: (profile.numberOfFeatures || 0) + 1 },
    githubProjects: [],
    knowledgeMatches: [],
    retrievalMode: "lexical",
    evaluator: { provider: "deepseek", model: "x" },
    evidence: [],
    validExecutionPlan: true,
  });
  assert.equal(second.planVersion, 2);
  assert.ok((second.planDiff?.requirementChanges || []).some((item) => /payment/i.test(item)), "Case G requirement");
  assert.ok((second.planDiff?.agentChanges || []).some((item) => /支付/i.test(item)), "Case G agent");
  assert.ok((second.planDiff?.taskChanges || []).some((item) => /payment/i.test(item)), "Case G task");
  assert.ok((second.planDiff?.riskChanges || []).some((item) => /支付/i.test(item)), "Case G risk");
  assert.ok((second.planDiff?.estimateChanges || []).length >= 1, "Case G estimate");
  console.log("plan version tests passed");
})();
