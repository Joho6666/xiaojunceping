import { Estimate, RequirementProfile } from "../../types";
import { modelKnowledgeCatalog } from "../../data/knowledgeCatalog";

function parseUsdPerMillion(value?: string) {
  if (!value) return undefined;
  const match = value.replace(",", "").match(/\$\s*(\d+(?:\.\d+)?)\s*\/\s*M/i);
  return match ? Number(match[1]) : undefined;
}

export function estimateCost(profile: RequirementProfile, tokens: Estimate, evaluator: { provider: string; model: string }): Estimate {
  const numbers = Array.from((tokens.display || "").matchAll(/(\d[\d,]*)/g)).map((match) => Number(match[1].replace(/,/g, "")));
  const lowTokens = numbers[0] || 0;
  const highTokens = numbers[1] || numbers[0] || 0;
  const item = modelKnowledgeCatalog.find((candidate) => (candidate.modelId || "").toLowerCase() === evaluator.model.toLowerCase());
  const input = parseUsdPerMillion(item?.pricingDetails?.input);
  const output = parseUsdPerMillion(item?.pricingDetails?.output);
  const breakdown = [
    { label: "LLM", value: input !== undefined && output !== undefined ? "已按价格快照估算" : "unknown（缺单价）" },
    { label: "Search API", value: "unknown" },
    { label: "Hosting", value: "unknown" },
    { label: "Database", value: "unknown" },
    { label: "Storage", value: "unknown" },
    { label: "Third-party API", value: "unknown" },
    { label: "Deployment", value: "unknown" },
    { label: "Optional SaaS", value: "unknown" },
    { label: "Human Work", value: profile.timeline === "未知" ? "unknown" : "需按人工日确认" },
  ];
  if (input === undefined || output === undefined || !lowTokens) {
    return {
      display: "unknown",
      range: "缺少可核验单价或项目规模，不能给出伪精确成本",
      confidence: "低",
      breakdown,
    };
  }
  const low = (lowTokens * 0.45 / 1_000_000) * input + (lowTokens * 0.55 / 1_000_000) * output;
  const high = (highTokens * 0.45 / 1_000_000) * input + (highTokens * 0.55 / 1_000_000) * output;
  return {
    display: `LLM 约 $${low.toFixed(2)}–$${high.toFixed(2)}；其余成本 unknown`,
    range: `${item?.sourceUrl || "模型价格快照"}；Hosting/DB/SaaS 未计入`,
    confidence: "低",
    breakdown: [{ label: "LLM", value: `$${low.toFixed(2)}–$${high.toFixed(2)}` }, ...breakdown.slice(1)],
  };
}
