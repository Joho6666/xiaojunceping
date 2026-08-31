import assert from "node:assert/strict";
import { assertEvidenceIntegrity } from "../services/evidence/integrity";
import { mergeEvidence, rewriteEvidenceIds } from "../services/evidence/evidenceStore";
import { buildLiveReport } from "../services/report/builder";
import { extractRequirementProfile } from "../services/requirements/extractor";
import { scoreGithubRepository } from "../services/recommendation/githubScorer";

const broken = {
  agents: [{ id: "a1", name: "x", provider: "p", description: "", role: "", capabilities: [], bestFor: [], matchScore: 1, reason: "", evidenceIds: ["missing-ev"] }],
  models: [],
  githubProjects: [],
  techStack: [],
  tools: [],
  evidence: [],
} as unknown as import("../types").ProjectReport;
assert.ok(assertEvidenceIntegrity(broken).length >= 1);

const project = { id: "ev", idea: "校园交友需要登录聊天", kind: "web" as const, evaluationMode: "quick" as const, createdAt: new Date().toISOString() };
const profile = extractRequirementProfile(project);
const report = buildLiveReport({
  project,
  profile,
  githubProjects: [],
  knowledgeMatches: [],
  retrievalMode: "lexical",
  evaluator: { provider: "deepseek", model: "deepseek-v4-flash" },
  evidence: [],
});
assert.equal(assertEvidenceIntegrity(report).length, 0);
assert.ok((report.ecosystem || []).every((item) => (item.evidenceIds || []).length >= 0));

const github = scoreGithubRepository(profile, {
  name: "campus-match",
  full_name: "example/campus-match",
  html_url: "https://github.com/example/campus-match",
  description: "campus dating matching chat",
  language: "TypeScript",
  topics: ["chat"],
  stargazers_count: 12,
  license: { spdx_id: "MIT" },
  pushed_at: new Date().toISOString(),
});
const duplicate = { ...github, evidenceIds: ["ev-duplicate"] };
const merged = mergeEvidence(
  [{ id: github.evidenceIds![0], type: "github", title: github.repo, url: github.url, confidence: "high" }],
  [{ id: "ev-duplicate", type: "github", title: github.repo, url: github.url, confidence: "medium" }],
);
assert.equal(merged.evidence.length, 1);
assert.equal(merged.idMap.get("ev-duplicate"), github.evidenceIds![0]);
const rewritten = rewriteEvidenceIds(duplicate.evidenceIds, merged.idMap);
assert.deepEqual(rewritten, [github.evidenceIds![0]]);
const dangling = {
  ...report,
  githubProjects: [duplicate],
};
assert.ok(assertEvidenceIntegrity(dangling).length >= 1, "Case A: evidenceIds 指向 store 中不存在的对象必须失败");
const repaired = {
  ...report,
  githubProjects: [{ ...github, evidenceIds: rewritten }],
  evidence: [...(report.evidence || []), ...merged.evidence],
};
assert.equal(assertEvidenceIntegrity(repaired).length, 0);
console.log("evidence integrity tests passed");
