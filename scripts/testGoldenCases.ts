import assert from "node:assert/strict";
import { goldenCases } from "../tests/evaluation-cases/cases";
import { extractRequirementProfile } from "../services/requirements/extractor";
import { buildLiveReport } from "../services/report/builder";
import { retrieveKnowledgeHybrid } from "../services/retrieval/hybrid";
import { applyKnowledgeRules } from "../services/knowledgeRuleEngine";

for (const testCase of goldenCases) {
  const project = { id: testCase.id, idea: testCase.idea, kind: "general" as const, evaluationMode: "quick" as const, createdAt: new Date().toISOString() };
  const profile = extractRequirementProfile(project);
  const retrieved = retrieveKnowledgeHybrid(profile);
  const matches = applyKnowledgeRules(profile, retrieved.matches);
  const report = buildLiveReport({
    project: { ...project, kind: profile.projectKind },
    profile,
    githubProjects: [],
    knowledgeMatches: matches,
    retrievalMode: retrieved.retrievalMode,
    evaluator: { provider: "deepseek", model: "deepseek-v4-flash" },
    evidence: [],
  });
  const blob = JSON.stringify({
    idea: testCase.idea,
    domains: profile.domains,
    domain: profile.domain,
    features: profile.requiredFeatures,
    tags: profile.tags,
    capabilities: profile.capabilities,
    stack: profile.stack,
    preferredStack: profile.preferredStack,
    agents: report.agents.map((agent) => agent.name),
    tech: report.techStack.map((item) => item.name),
    summary: report.projectSummary,
  }).toLowerCase();
  for (const word of testCase.required) {
    assert.ok(blob.includes(word.toLowerCase()), `${testCase.id} missing required ${word}`);
  }
  for (const word of testCase.forbidden) {
    assert.ok(!blob.includes(word.toLowerCase()), `${testCase.id} leaked forbidden ${word}`);
  }
  for (const domain of testCase.domains) {
    assert.ok((profile.domains || []).some((item) => item.name === domain) || profile.domain.includes(domain) || blob.includes(domain), `${testCase.id} missing domain ${domain}`);
  }
  assert.equal(report.generationMode, "live");
  assert.equal(report.evaluationEngineVersion, "v2.1.0");
  assert.equal(report.models[0]?.roleKind, "evaluator");
}
console.log(`golden evaluation cases passed: ${goldenCases.length}`);
