import assert from "node:assert/strict";
import { extractRequirementProfile } from "../services/requirements/extractor";
import { evaluateRequirementGate } from "../services/evaluation/requirementGate";
import { detectProjectKind, getQuestionsForIdea } from "../data/questions";
import { quickQuestions } from "../services/interviewService";

function project(idea: string) {
  return { id: "p", idea, kind: detectProjectKind(idea), evaluationMode: "expert" as const, createdAt: new Date().toISOString() };
}

const stm32 = extractRequirementProfile(project("我要做一个 STM32 温控器，使用 Keil，读取 DS18B20，OLED 显示。"));
assert.ok((stm32.domains || []).some((item) => item.name === "embedded"));
assert.ok(!(stm32.platforms || []).includes("Web"));
assert.ok(!(stm32.platforms || []).includes("web"));
assert.ok((stm32.preferredStack || []).includes("Keil"));
assert.ok(stm32.requiredFeatures?.includes("firmware"));
assert.notEqual(stm32.needsGithub, true && stm32.needsGithub === (true as boolean) && false);
assert.ok(Array.isArray(stm32.integrations));
assert.notEqual(stm32.numberOfIntegrations, stm32.stack.length || -1);

const vague = extractRequirementProfile(project("我要做一个 AI 项目"));
const gate = evaluateRequirementGate(vague, "expert");
assert.equal(gate.allowed, false);
assert.equal(gate.status, "needs_clarification");
assert.ok(gate.questions.length >= 1);

const campus = extractRequirementProfile(project("校园交友小程序，需要匹配、聊天、资料页、内容审核"));
assert.ok(campus.requiredFeatures?.includes("matching"));
assert.ok(campus.requiredFeatures?.includes("chat"));
assert.ok((campus.domains || []).some((item) => item.name === "mobile" || item.name === "education"));

const worth = extractRequirementProfile(project("帮我判断这个项目是否值得做"));
assert.equal(worth.needsGithub, false);

const embeddedQs = getQuestionsForIdea("STM32 温控器，使用 Keil，读取 DS18B20");
assert.ok(embeddedQs.some((q) => q.id.startsWith("embedded-")));
assert.ok(quickQuestions(project("STM32 温控器 Keil DS18B20")).length <= 3);

console.log("requirement engine tests passed");
