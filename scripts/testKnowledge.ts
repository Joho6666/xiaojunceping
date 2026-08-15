import assert from "node:assert/strict";
import { extractRequirementProfile } from "../services/requirementExtractionService";
import { retrieveKnowledge } from "../services/knowledgeRetrievalService";
import { applyKnowledgeRules } from "../services/knowledgeRuleEngine";
import { Project } from "../types";

function project(idea: string, kind: Project["kind"]): Project { return { id: "test", idea, kind, evaluationMode: "quick", createdAt: new Date().toISOString() }; }

const clothing = project("做一个卖衣服的电商网站，支持商品、购物车、订单和支付", "web");
const profile = extractRequirementProfile(clothing);
const matches = applyKnowledgeRules(profile, retrieveKnowledge(profile));
assert.ok(profile.tags.includes("ecommerce"));
assert.ok(matches.some((match) => /Next|Supabase|SaaS|n8n/i.test(match.item.name)));
assert.ok(!matches.some((match) => /FFmpeg|FreeCAD|KiCad/i.test(match.item.name)));

const video = project("自动把长视频剪成短视频并生成字幕", "video");
const videoMatches = applyKnowledgeRules(extractRequirementProfile(video), retrieveKnowledge(extractRequirementProfile(video)));
assert.ok(videoMatches.some((match) => match.item.name === "FFmpeg"));
console.log("knowledge tests passed");
