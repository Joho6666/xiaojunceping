import assert from "node:assert/strict";
import { extractRequirementProfile } from "../services/requirements/extractor";
import { scoreAgents } from "../services/recommendation/agentScorer";
import { buildTraceabilityPlan } from "../services/planning/traceability";

const profile = extractRequirementProfile({
  id: "t",
  idea: "校园交友小程序需要登录、匹配、聊天、资料、内容审核",
  kind: "web",
  evaluationMode: "expert",
  createdAt: new Date().toISOString(),
});
const { agents } = scoreAgents(profile, "deepseek");
for (const feature of ["login", "matching", "chat"]) {
  assert.ok(profile.requiredFeatures?.includes(feature), `missing feature ${feature}`);
}
const plan = buildTraceabilityPlan(profile, agents);
assert.equal(plan.tasks.length, (profile.requiredFeatures || []).length);
assert.equal(plan.coverage, 1);
assert.equal(plan.missingRequirements.length, 0);
console.log("traceability tests passed");
