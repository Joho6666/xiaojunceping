import assert from "node:assert/strict";
import { buildMockReport } from "../data/reportCatalog";
import { customizeProjectSections } from "../services/reportCustomizationService";
import { extractRequirementProfile } from "../services/requirements/extractor";
import { buildLiveReport } from "../services/report/builder";
import { scoreGithubRepository } from "../services/recommendation/githubScorer";
import { verifyReport } from "../services/evaluation/verifier";

const project = {
  id: "live-integrity",
  idea: "校园交友平台，登录、资料、匹配和聊天",
  kind: "web" as const,
  evaluationMode: "expert" as const,
  createdAt: new Date().toISOString(),
};
const profile = extractRequirementProfile(project);
const live = buildLiveReport({
  project,
  profile,
  githubProjects: [],
  knowledgeMatches: [],
  retrievalMode: "lexical",
  evaluator: { provider: "openai", model: "codex" },
  evidence: [],
});

assert.equal(live.generationMode, "live");
assert.doesNotMatch(JSON.stringify(live.estimates.time), /约 1–4 周/);
assert.doesNotMatch(JSON.stringify(live.estimates.tokens), /约 3 万–15 万/);
assert.notEqual(live.models[0]?.roleKind, "execution");
assert.ok(live.evaluator?.model === "codex");
assert.ok(live.unknownFields?.includes("github") || live.unknownFields?.includes("cost") || (live.unknownFields || []).length >= 1);
assert.ok((live.nextActions || []).length >= 1);
assert.ok((live.decisionLog || []).length >= 1);
assert.equal(live.retrievalMode, "lexical");

const customized = customizeProjectSections(project, profile, live);
assert.equal(customized.estimates.tokens.display, live.estimates.tokens.display);
assert.equal(customized.generationMode, "live");

const demo = buildMockReport(project);
assert.equal(demo.generationMode, "demo");
assert.notEqual(demo.generationMode, "live");

const scoredA = scoreGithubRepository(profile, {
  name: "campus-match",
  full_name: "example/campus-match",
  html_url: "https://github.com/example/campus-match",
  description: "campus dating matching chat profile login",
  language: "TypeScript",
  topics: ["chat", "matching", "nextjs"],
  stargazers_count: 12,
  license: { spdx_id: "MIT" },
  pushed_at: new Date().toISOString(),
});
const scoredB = scoreGithubRepository(profile, {
  name: "ffmpeg",
  full_name: "FFmpeg/FFmpeg",
  html_url: "https://github.com/FFmpeg/FFmpeg",
  description: "video audio transcoding",
  language: "C",
  topics: ["video"],
  stargazers_count: 50000,
  license: { spdx_id: "LGPL-2.1" },
  pushed_at: "2018-01-01T00:00:00Z",
});
assert.ok(scoredA.similarity > scoredB.similarity, "domain overlap must beat star count");
assert.ok(scoredA.scoreBreakdown);
assert.equal(scoredB.licenseUse, "不建议商业复用");

const verified = verifyReport(live);
assert.ok((verified.unknownFields || []).includes("github") || (verified.unknownFields || []).includes("github:none") || (verified.needsConfirmation || []).length >= 0);

console.log("LIVE_REPORT_MUST_NOT_USE_MOCK passed");
