import assert from "node:assert/strict";
import { buildMockReport } from "../data/reportCatalog";
import { buildAgentPlan, buildInputFingerprint, buildPromptArtifacts, customizeProjectSections } from "../services/reportCustomizationService";
import { extractRequirementProfile } from "../services/requirementExtractionService";

const base = { evaluationMode: "expert" as const, createdAt: new Date().toISOString() };
const commerce = { id: "commerce", idea: "卖衣服的 Web 电商，需要商品、SKU、库存、购物车和订单", kind: "web" as const, ...base };
const video = { id: "video", idea: "把长视频自动切成带字幕的短视频", kind: "video" as const, ...base };
const commerceProfile = extractRequirementProfile(commerce);
const videoProfile = extractRequirementProfile(video);
assert.ok(commerceProfile.capabilities.includes("商品目录"));
assert.ok(videoProfile.capabilities.includes("视频处理"));

const commerceReport = customizeProjectSections(commerce, commerceProfile, buildMockReport(commerce));
const videoReport = customizeProjectSections(video, videoProfile, buildMockReport(video));
assert.notEqual(commerceReport.projectSummary.title, videoReport.projectSummary.title);
assert.notDeepEqual(commerceReport.techStack, videoReport.techStack);
assert.ok(JSON.stringify(commerceReport).includes("商品目录"));
assert.ok(JSON.stringify(videoReport).includes("FFmpeg"));

const commercePlan = buildAgentPlan(commerce, commerceProfile, commerceReport, "commerce-model");
const videoPlan = buildAgentPlan(video, videoProfile, videoReport, "video-model");
assert.notDeepEqual(commercePlan.agents.map((agent) => agent.name), videoPlan.agents.map((agent) => agent.name));
assert.ok(commercePlan.agents.some((agent) => agent.name.includes("Web")));
assert.ok(videoPlan.agents.some((agent) => agent.name.includes("视频")));

const commercePrompt = buildPromptArtifacts(commerce, commerceReport, commercePlan)[0].content;
const videoPrompt = buildPromptArtifacts(video, videoReport, videoPlan)[0].content;
assert.notEqual(commercePrompt, videoPrompt);
assert.ok(commercePrompt.includes(commerce.idea));
assert.ok(videoPrompt.includes("FFmpeg"));
assert.notEqual(buildInputFingerprint(commerce, {}, "kb-1", "github"), buildInputFingerprint(video, {}, "kb-1", "github"));
console.log("customization tests passed");
