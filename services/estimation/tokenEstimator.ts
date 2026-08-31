import { Estimate, RequirementProfile } from "../../types";

const PHASES = ["Research", "Architecture", "Implementation", "Testing", "Integration", "Deployment", "Human Review"] as const;

export function estimateTokens(profile: RequirementProfile): Estimate & { phases: Array<{ label: string; tokenRange: [number, number]; reason: string }> } {
  const complexity = profile.projectComplexity || 2;
  const features = profile.numberOfFeatures || 2;
  const integrations = profile.numberOfIntegrations || 0;
  const platforms = profile.numberOfPlatforms || 1;
  const base = 8_000 * complexity + 6_000 * features + 4_000 * integrations + 3_000 * platforms;
  const phases = PHASES.map((label, index) => {
    const weight = [0.08, 0.1, 0.42, 0.14, 0.12, 0.08, 0.06][index];
    const low = Math.round(base * weight);
    const high = Math.round(base * weight * (1.4 + complexity * 0.1));
    return { label, tokenRange: [low, high] as [number, number], reason: `${label} 按复杂度 ${complexity} / 功能 ${features} 估算` };
  });
  const low = phases.reduce((sum, item) => sum + item.tokenRange[0], 0);
  const high = phases.reduce((sum, item) => sum + item.tokenRange[1], 0);
  return {
    display: `${low.toLocaleString()}–${high.toLocaleString()} Token（实施预测）`,
    range: "按功能数、集成数、平台数和复杂度推导，不是固定模板",
    confidence: features >= 3 ? "中" : "低",
    breakdown: phases.map((item) => ({ label: item.label, value: `${item.tokenRange[0].toLocaleString()}–${item.tokenRange[1].toLocaleString()}` })),
    phases,
  };
}
