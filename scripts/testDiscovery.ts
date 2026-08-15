import assert from "node:assert/strict";
import { extractRequirementProfile } from "../services/requirementExtractionService";
import { retrieveKnowledge } from "../services/knowledgeRetrievalService";
import { applyKnowledgeRules } from "../services/knowledgeRuleEngine";

const cases = [
  { idea: "卖衣服的电商网站，商品、SKU、库存、订单和支付", kind: "web" as const, required: ["商品目录", "购物车与订单"] },
  { idea: "AI 视频剪辑，FFmpeg、字幕和渲染", kind: "video" as const, required: ["视频处理"] },
  { idea: "STM32 PCB，KiCad、BOM、Gerber、ERC DRC", kind: "pcb" as const, required: ["原理图"] },
  { idea: "n8n 邮件自动化，Webhook 和 API", kind: "automation" as const, required: ["Workflow", "API", "Webhook"] },
];
for (const item of cases) {
  const project = { id: item.kind, idea: item.idea, kind: item.kind, evaluationMode: "quick" as const, createdAt: new Date().toISOString() };
  const profile = extractRequirementProfile(project);
  for (const capability of item.required) assert.ok(profile.capabilities.includes(capability), `${item.kind} 缺少 ${capability}`);
  const raw = retrieveKnowledge(profile);
  const filtered = applyKnowledgeRules(profile, raw);
  assert.ok(filtered.every((match) => match.item.publication === "published"));
  assert.ok(filtered.every((match) => match.item.status === "active"));
}
console.log("discovery tests passed");
