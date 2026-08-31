import assert from "node:assert/strict";
import { extractRequirementProfile } from "../services/requirements/extractor";
import { scoreAgents } from "../services/recommendation/agentScorer";
import { buildTraceabilityPlan, diffPlans } from "../services/planning/traceability";
import { detectCycle, topologicalSort } from "../services/planning/dag";

const profile = extractRequirementProfile({
  id: "t",
  idea: "校园交友小程序需要登录、匹配、聊天、资料、内容审核",
  kind: "web",
  evaluationMode: "expert",
  createdAt: new Date().toISOString(),
});
const { agents } = scoreAgents(profile, "deepseek");
const plan = buildTraceabilityPlan(profile, agents);
assert.ok(plan.tasks.length >= (profile.requiredFeatures || []).length);
assert.ok(plan.coverage >= 0 && plan.coverage <= 1);
assert.equal(detectCycle(plan.tasks).length, 0);
assert.ok(topologicalSort(plan.tasks).length === plan.tasks.length);
const loginTask = plan.tasks.find((task) => /login/i.test(task.title));
assert.ok(loginTask);

const next = buildTraceabilityPlan({ ...profile, requiredFeatures: [...(profile.requiredFeatures || []), "payment"] }, agents);
const diff = diffPlans(plan, next);
assert.ok(diff.added.some((title) => /payment/i.test(title)));

const cyclic = [
  { id: "A", requirementIds: [], componentId: "c", title: "A", toolIds: [], acceptanceCriteria: ["a"], dependsOn: ["B"] },
  { id: "B", requirementIds: [], componentId: "c", title: "B", toolIds: [], acceptanceCriteria: ["b"], dependsOn: ["A"] },
];
assert.ok(detectCycle(cyclic).length >= 2);
console.log("traceability tests passed");
