import { Evidence, ModelCapabilityProfile, ModelRecommendation, RecommendationResult, RequirementProfile } from "../../types";
import { createEvidence } from "../evidence/evidenceStore";
import { listKnowledgeItems } from "../knowledgeBaseService";
import { modelRankingBreakdown, verifyConfiguredModel } from "../verification/modelVerifier";

function capabilityProfile(item: { modelCapabilities?: string[]; modalities?: string[]; access?: string; summary?: string; confidence?: string; contextWindow?: string }): ModelCapabilityProfile {
  const caps = item.modelCapabilities || [];
  const modalities = item.modalities || [];
  const coding = caps.some((cap) => /code|coding|agent/i.test(cap)) ? 0.8 : undefined;
  const vision = modalities.includes("vision") ? 0.8 : undefined;
  const toolUse = caps.some((cap) => /tool|function|agent/i.test(cap)) ? 0.7 : undefined;
  const reasoning = item.confidence === "高" ? 0.75 : undefined;
  const longContext = item.contextWindow && /128|200|1m|million/i.test(item.contextWindow) ? 0.8 : undefined;
  const localAvailable = /local|cli|self/i.test(`${item.access || ""} ${item.summary || ""}`) || undefined;
  return {
    coding,
    reasoning,
    vision,
    toolUse,
    longContext,
    localAvailable: localAvailable ? true : undefined,
  };
}

export function scoreExecutionModels(profile: RequirementProfile, evaluator: { provider: string; model: string }): RecommendationResult<ModelRecommendation> & { models: ModelRecommendation[] } {
  const items = listKnowledgeItems("llm");
  const needVision = /video|image|vision/.test(profile.tags.join(" "));
  const needCode = Boolean(profile.needsTerminal || profile.domain.includes("developer-tool") || profile.domain.includes("embedded") || (profile.requiredFeatures || []).includes("firmware"));
  const evidence: Evidence[] = [];
  const models = items
    .map((item) => {
      const profileCaps = capabilityProfile(item);
      let score = 40;
      const reasons: string[] = [];
      if (needCode && profileCaps.coding != null) {
        score += Math.round(profileCaps.coding * 25);
        reasons.push("知识库标明适合代码/工程任务");
      }
      if (needVision && profileCaps.vision != null) {
        score += Math.round(profileCaps.vision * 18);
        reasons.push("支持视觉输入");
      }
      if (profile.dataSensitivity === "高" && profileCaps.localAvailable) {
        score += 10;
        reasons.push("更适合受控/本地执行");
      }
      if (item.confidence === "高") score += 8;
      const availability = verifyConfiguredModel(item.vendor, item.modelId || item.name);
      const breakdown = modelRankingBreakdown({
        coding: profileCaps.coding,
        toolUse: profileCaps.toolUse,
        vision: profileCaps.vision,
        cost: /免费|free/i.test(item.pricing || "") ? 0.8 : undefined,
        availability,
      });
      const ev = createEvidence({
        type: "knowledge-base",
        title: item.name,
        url: item.sourceUrl || item.url,
        confidence: item.sourceUrl?.startsWith("http") ? "high" : "medium",
        note: item.summary,
        claims: item.modelId ? [{ id: `${item.id}-model-id`, statement: `Model ID = ${item.modelId}`, field: "modelId", verificationStatus: "unverified" }] : undefined,
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
        capabilityProfile: { ...profileCaps, evidenceIds: [ev.id] },
        rankingBreakdown: breakdown,
        ratings: {
          reasoning: profileCaps.reasoning != null ? Math.round(profileCaps.reasoning * 5) : undefined,
          coding: profileCaps.coding != null ? Math.round(profileCaps.coding * 5) : undefined,
          vision: profileCaps.vision != null ? Math.round(profileCaps.vision * 5) : undefined,
          video: (item.modalities || []).includes("video") ? 4 : undefined,
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
    rankingBreakdown: modelRankingBreakdown({ availability: verifyConfiguredModel(evaluator.provider, evaluator.model) }),
    ratings: {},
    reason: "用户选择的评估模型。执行模型从知识库与需求独立打分。",
  };
  const ranked = [evaluatorModel, ...models.filter((item) => item.modelId !== evaluator.model)].slice(0, 7);
  return { items: ranked, models: ranked, evidence };
}
