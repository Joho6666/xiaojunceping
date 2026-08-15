import assert from "node:assert/strict";
import { buildMockReport } from "../data/reportCatalog";
import { buildAgentPlan, buildPromptArtifacts } from "../services/reportCustomizationService";
import { extractRequirementProfile } from "../services/requirementExtractionService";

const project = { id: "prompt", idea: "做一个自动处理邮件的 n8n 工作流", kind: "automation" as const, evaluationMode: "expert" as const, createdAt: new Date().toISOString() };
const profile = extractRequirementProfile(project);
const report = buildMockReport(project);
const plan = buildAgentPlan(project, profile, report, "selected-model");
const artifacts = buildPromptArtifacts(project, report, plan);
assert.ok(artifacts.some((artifact) => artifact.type === "master"));
assert.ok(artifacts.some((artifact) => artifact.type === "agents-md"));
assert.ok(artifacts.filter((artifact) => artifact.type === "agent").length === plan.agents.length);
const all = artifacts.map((artifact) => artifact.content).join("\n");
assert.ok(all.includes(project.idea));
assert.ok(all.includes("验收标准"));
assert.ok(all.includes("禁止事项"));
assert.ok(plan.agents.every((agent) => agent.modelId === "selected-model"));
console.log("prompt tests passed");
