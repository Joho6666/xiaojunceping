import { Estimate, RequirementProfile } from "../../types";

export function estimateTime(profile: RequirementProfile): Estimate {
  if (!profile.numberOfFeatures && !profile.projectComplexity) {
    return {
      display: "当前证据不足，需确认项目规模后估算",
      range: "insufficient_evidence",
      confidence: "低",
      breakdown: [{ label: "原因", value: "缺少功能数量、平台和现有代码信息" }],
    };
  }
  const daysLow = Math.max(3, (profile.numberOfFeatures || 2) * 1.5 + (profile.numberOfPlatforms || 1) * 1 + (profile.projectComplexity || 2));
  const daysHigh = daysLow * 2.2;
  const toWeek = (days: number) => (days >= 7 ? `${(days / 7).toFixed(1)} 周` : `${Math.round(days)} 天`);
  return {
    display: `${toWeek(daysLow)}–${toWeek(daysHigh)}`,
    range: "含研究、实现、测试、集成、发布和人工审查",
    confidence: profile.timeline && profile.timeline !== "未知" ? "中" : "低",
    breakdown: [
      { label: "功能规模", value: String(profile.numberOfFeatures || "unknown") },
      { label: "平台数", value: String(profile.numberOfPlatforms || "unknown") },
      { label: "复杂度", value: String(profile.projectComplexity || "unknown") },
    ],
  };
}
