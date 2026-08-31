import assert from "node:assert/strict";
import { classifySourceUrl } from "../services/verification/sourceVerifier";
import { verifyReport } from "../services/evaluation/verifier";
import { buildLiveReport } from "../services/report/builder";
import { extractRequirementProfile } from "../services/requirements/extractor";

assert.equal(classifySourceUrl("https://platform.openai.com/docs"), "official");
assert.equal(classifySourceUrl("https://github.com/foo/bar"), "github");
assert.equal(classifySourceUrl("https://medium.com/foo"), "blog");

const project = { id: "v", idea: "校园交友平台需要登录聊天", kind: "web" as const, evaluationMode: "quick" as const, createdAt: new Date().toISOString() };
const profile = extractRequirementProfile(project);
const report = buildLiveReport({
  project,
  profile,
  githubProjects: [{ id: "g", name: "x", repo: "x/x", url: "not-a-url", description: "", stars: "0", language: "", license: "", updatedAt: "", activity: 0, maturity: 0, similarity: 80, recommendation: 3, stack: [], capabilities: [], recommendedUse: "", reuseRatio: "", difficulty: "", risks: [], advice: "" }],
  knowledgeMatches: [],
  retrievalMode: "lexical",
  evaluator: { provider: "deepseek", model: "deepseek-v4-flash" },
  evidence: [{ id: "bad", type: "github", title: "fake", url: "not-a-url", confidence: "high", verificationStatus: "verified" }],
});
const verified = verifyReport(report);
assert.ok((verified.unknownFields || []).some((item) => item.includes("github")));
assert.ok((verified.blockingIssues || []).length >= 1 || (verified.evidence || []).some((item) => item.verificationStatus !== "verified"));
console.log("verification tests passed");
