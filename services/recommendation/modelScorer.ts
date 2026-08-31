import { Evidence, ModelRecommendation, RequirementProfile } from "../../types";
import { listKnowledgeItems } from "../knowledgeBaseService";
import { createEvidence } from "../evidence/evidenceStore";

export function scoreExecutionModels(profile: RequirementProfile, evaluator: { provider: string; model: string }): { models: ModelRecommendation[]; evidence: Evidence[] } {
  const items = listKnowledgeItems("llm");
  const needVision = /video|image|vision/.test(profile.tags.join(" "));
  const needCode = Boolean(profile.needsTerminal || profile.domain.includes("developer-tool") || profile.domain.includes("embedded") || (profile.requiredFeatures || []).includes("firmware"));
  const evidence: Evidence[] = [];
  const models = items
    .map((item, index) => {
      const modalities = item.modalities || [];
      let score = 40;
      const reasons: string[] = [];
      if (needCode && ((item.modelCapabilities || []).some((cap) => /code|coding|agent/i.test(cap)) || /code|codex|claude|deepseek/i.test(item.name))) {
        score += 20;
        reasons.push("适合代码/工程任务");
      }
      if (needVision && modalities.includes("vision")) {
        score += 15;
        reasons.push("支持视觉输入");
      }
      if (profile.dataSensitivity === "高" && /local|cli|self/i.test(`${item.access} ${item.summary}`)) {
        score += 10;
        reasons.push("更适合受控/本地执行");
      }
      if (item.confidence === "高") score += 8;
      const ev = createEvidence({
        type: "knowledge-base",
        title: item.name,
        url: item.sourceUrl || item.url,
        confidence: item.sourceUrl?.startsWith("http") ? "high" : "medium",
        note: item.summary,
      });
      evidence.push(ev);
      const rec: ModelRecommendation = {
        id: item.id,
        name: item.name,
        provider: item.vendor || "unknown",
        modelId: item.modelId || item.name,
        type: item.modalities || ["text"],
        task: reasons[0] || "候选执行模型",
        contextWindow: item.contextWindow,
        strengths: item.capabilities.slice(0, 4),
        weaknesses: ["价格与可用性需按账户核验"],
        pricingLevel: /免费|free/i.test(item.pricing || "") ? 1 : 3,
        matchScore: Math.min(95, score),
        evidenceIds: [ev.id],
        roleKind: "execution",
        ratings: {
          reasoning: item.confidence === "高" ? 4 : 0,
          coding: (item.modelCapabilities || []).some((cap) => /code|coding/i.test(cap)) ? 4 : 0,
          vision: modalities.includes("vision") ? 4 : 0,
          video: modalities.includes("video") ? 4 : 0,
          speed: 0,
        },
        reason: reasons.join("；") || "知识库候选，尚未被证明为最佳执行模型",
      };
      return rec;
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 6);

  const evaluatorEvidence = createEvidence({
    type: "provider",
    title: `评估模型 ${evaluator.provider}/${evaluator.model}`,
    confidence: "high",
    note: "该模型只用于生成本次评估，不自动等于推荐执行模型",
  });
  evidence.unshift(evaluatorEvidence);
  const evaluatorModel: ModelRecommendation = {
    id: "evaluator-model",
    name: evaluator.model,
    provider: evaluator.provider,
    modelId: evaluator.model,
    type: ["text"],
    task: "评估/规划（非执行默认）",
    strengths: ["用于生成评估报告"],
    weaknesses: ["不能因为被选作评估器就被当成最佳开发模型"],
    pricingLevel: 2,
    matchScore: 0,
    evidenceIds: [evaluatorEvidence.id],
    roleKind: "evaluator",
    ratings: { reasoning: 3, coding: 3, vision: 1, video: 1, speed: 3 },
    reason: "用户选择的评估模型。执行模型从知识库与需求独立打分。",
  };
  return { models: [evaluatorModel, ...models.filter((item) => item.modelId !== evaluator.model)].slice(0, 7), evidence };
}
