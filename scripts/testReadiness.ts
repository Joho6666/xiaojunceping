import assert from "node:assert/strict";
import { evaluateRequirementGate } from "../services/evaluation/requirementGate";
import { extractRequirementProfile } from "../services/requirements/extractor";
import { runExpertPipeline } from "../services/evaluation/expertPipeline";

(async () => {
  const vague = extractRequirementProfile({ id: "a", idea: "我要做一个 AI 项目", kind: "general", evaluationMode: "expert", createdAt: new Date().toISOString() });
  assert.equal(evaluateRequirementGate(vague, "expert").allowed, false);

  const report = await runExpertPipeline(
    { id: "a", idea: "我要做一个 AI 项目", kind: "general", evaluationMode: "expert", createdAt: new Date().toISOString() },
    {},
    { provider: "deepseek", model: "deepseek-v4-flash" },
  );
  assert.equal(report.readiness, "needs_clarification");
  assert.ok((report.clarificationQuestions || []).length >= 1);
  console.log("readiness tests passed");
})();
