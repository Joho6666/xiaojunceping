import assert from "node:assert/strict";
import { runExpertPipeline } from "../services/evaluation/expertPipeline";

(async () => {
  const report = await runExpertPipeline(
    { id: "ex", idea: "我要做一个 AI 项目", kind: "general", evaluationMode: "expert", createdAt: new Date().toISOString() },
    {},
    { provider: "deepseek", model: "deepseek-v4-flash" },
  );
  assert.equal(report.readiness, "needs_clarification");
  assert.equal(report.validExecutionPlan, false);
  assert.ok((report.clarificationQuestions || []).length >= 1);
  console.log("expert pipeline tests passed");
})();
