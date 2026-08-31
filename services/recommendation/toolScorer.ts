import { RecommendationResult, RequirementProfile, TechStackRecommendation, ToolRecommendation } from "../../types";
import { createEvidence } from "../evidence/evidenceStore";
import { listKnowledgeItems } from "../knowledgeBaseService";

export function scoreTools(profile: RequirementProfile): RecommendationResult<ToolRecommendation> & { tools: ToolRecommendation[]; techStack: TechStackRecommendation[] } {
  const evidence = createEvidence({
    type: "knowledge-base",
    title: "工具与技术栈匹配",
    confidence: "medium",
    note: (profile.requiredFeatures || []).join(","),
  });
  const items = listKnowledgeItems("ai-tool").concat(listKnowledgeItems("mcp"), listKnowledgeItems("skill"));
  const tags = new Set([...profile.tags, ...profile.capabilities, ...profile.stack].map((item) => item.toLowerCase()));
  const tools: ToolRecommendation[] = items
    .filter((item) => item.tags.some((tag) => tags.has(tag.toLowerCase())) || item.capabilities.some((cap) => tags.has(cap.toLowerCase())))
    .slice(0, 8)
    .map((item) => ({
      name: item.name,
      category: item.kind,
      purpose: item.summary,
      reason: `命中需求标签，来源 ${item.sourceUrl}`,
      required: Boolean(profile.requiredFeatures?.some((feature) => item.summary.toLowerCase().includes(feature.toLowerCase()))),
      alternatives: [],
      evidenceIds: [evidence.id],
    }));
  const techStack: TechStackRecommendation[] = (profile.preferredStack?.length ? profile.preferredStack : profile.stack.length ? profile.stack : ["待确认技术栈"]).map((name, index) => ({
    layer: ["核心能力", "实现框架", "数据与集成", "验证与交付"][index] || "扩展",
    name,
    matchScore: profile.stack.includes(name) ? 80 : 0,
    reasons: profile.stack.includes(name) ? ["出现在项目描述或访谈中"] : ["证据不足，需确认"],
    alternative: "需要结合现有仓库和预算确认",
    evidenceIds: [evidence.id],
  }));
  return { items: tools, tools, techStack, evidence: [evidence] };
}
