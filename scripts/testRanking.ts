import assert from "node:assert/strict";
import { scoreGithubRepository } from "../services/recommendation/githubScorer";
import { extractRequirementProfile } from "../services/requirements/extractor";

const profile = extractRequirementProfile({ id: "r", idea: "校园交友匹配聊天资料", kind: "web", evaluationMode: "quick", createdAt: new Date().toISOString() });
const a = scoreGithubRepository(profile, { name: "campus", full_name: "ex/campus", html_url: "https://github.com/ex/campus", description: "campus matching chat profile", topics: ["chat"], language: "TypeScript", stargazers_count: 10, license: { spdx_id: "MIT" }, pushed_at: new Date().toISOString() });
const b = scoreGithubRepository(profile, { name: "ffmpeg", full_name: "FFmpeg/FFmpeg", html_url: "https://github.com/FFmpeg/FFmpeg", description: "video encoder", topics: ["video"], language: "C", stargazers_count: 50000, license: { spdx_id: "LGPL-2.1" }, pushed_at: "2018-01-01T00:00:00Z" });
assert.ok(a.similarity > b.similarity);
console.log("ranking tests passed");
