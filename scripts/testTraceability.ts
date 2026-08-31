import assert from "node:assert/strict";
import { extractRequirementProfile } from "../services/requirements/extractor";
import { scoreAgents } from "../services/recommendation/agentScorer";
import { buildTraceabilityPlan, diffPlans } from "../services/planning/traceability";

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
assert.ok(plan.coverage >= 0 && plan.coverage <= 1);
assert.equal(plan.missingRequirements.length, plan.tasks.filter((task) => !task.agentId).length);
const loginTask = plan.tasks.find((task) => task.title.includes("login"));
assert.ok(loginTask);
assert.ok(loginTask?.agentId, "login should match 认证 Agent");

const next = buildTraceabilityPlan({ ...profile, requiredFeatures: [...(profile.requiredFeatures || []), "payment"] }, agents);
const diff = diffPlans(plan, next);
assert.ok(diff.added.some((title) => title.includes("payment")));
console.log("traceability tests passed");
