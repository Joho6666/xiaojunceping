import { ConfidenceDimension, ConfidenceLevel, GithubProjectRecommendation, RequirementProfile } from "../../types";

function level(score: number): ConfidenceLevel {
  if (score >= 0.75) return "高";
  if (score >= 0.45) return "中";
  return "低";
}

export function scoreConfidence(input: {
  profile: RequirementProfile;
  github: GithubProjectRecommendation[];
  retrievalMode: "lexical" | "hybrid";
  hasLiveGithub: boolean;
  costKnown: boolean;
  timeKnown: boolean;
}) {
  const requirement = Math.min(0.95, 0.35 + (input.profile.requiredFeatures?.length || 0) * 0.08 + (input.profile.domains?.length || 0) * 0.05);
  const github = input.hasLiveGithub ? Math.min(0.95, 0.5 + input.github.filter((item) => item.url.startsWith("http")).length * 0.05) : 0.25;
  const tools = input.profile.stack.length ? 0.7 : 0.4;
  const models = 0.55;
  const cost = input.costKnown ? 0.6 : 0.3;
  const time = input.timeKnown ? 0.55 : 0.28;
  const architecture = input.profile.projectComplexity ? Math.max(0.3, 1 - input.profile.projectComplexity * 0.08) : 0.4;
  const details: Record<string, ConfidenceDimension> = {
    requirement: { score: requirement, level: level(requirement), reason: input.profile.requiredFeatures?.length ? "已从描述/访谈抽出功能" : "功能清单偏少，需求置信度有限" },
    github: { score: github, level: level(github), reason: input.hasLiveGithub ? "仓库来自 GitHub API 核验" : "没有实时 GitHub 结果，不能宣称高相关" },
    tools: { score: tools, level: level(tools), reason: input.profile.stack.length ? "技术栈来自用户输入或明确关键词" : "技术栈多为推断" },
    models: { score: models, level: level(models), reason: "执行模型来自知识库匹配，不是评估模型自动当选" },
    cost: { score: cost, level: level(cost), reason: input.costKnown ? "存在可核验单价" : "缺少准确规模与 API 调用频率，成本置信度低" },
    time: { score: time, level: level(time), reason: input.timeKnown ? "存在明确工期约束" : "缺少项目规模，时间只能给范围或 unknown" },
    architecture: { score: architecture, level: level(architecture), reason: "架构建议依赖需求完整度" },
  };
  return {
    details,
    summary: {
      agents: details.architecture.level,
      models: details.models.level,
      tokens: details.cost.level,
      time: details.time.level,
      cost: details.cost.level,
      github: details.github.level,
      explanation: Object.values(details).map((item) => item.reason),
    },
  };
}
