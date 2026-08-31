import { AgentRecommendation, RequirementProfile, TraceabilityPlan, ToolRecommendation } from "../../types";

export function buildTraceabilityPlan(
  profile: RequirementProfile,
  agents: AgentRecommendation[] = [],
  tools: ToolRecommendation[] = [],
): TraceabilityPlan {
  const features = profile.requiredFeatures || [];
  const components = features.map((feature, index) => ({
    id: `COMP-${String(index + 1).padStart(2, "0")}`,
    name: feature,
    requirementIds: [`REQ-${String(index + 1).padStart(2, "0")}`],
  }));
  const tasks = features.map((feature, index) => {
    const reqId = `REQ-${String(index + 1).padStart(2, "0")}`;
    const agent = agents.find((item) => `${item.name} ${item.role}`.toLowerCase().includes(feature.toLowerCase())) || agents[index] || agents[0];
    const toolIds = tools.filter((tool) => `${tool.name} ${tool.purpose}`.toLowerCase().includes(feature.toLowerCase())).map((tool) => tool.name).slice(0, 3);
    return {
      id: `TASK-${String(index + 1).padStart(2, "0")}`,
      requirementIds: [reqId],
      componentId: `COMP-${String(index + 1).padStart(2, "0")}`,
      title: `实现 ${feature}`,
      agentId: agent?.id,
      toolIds,
      acceptanceCriteria: [`${feature} 可演示`, "有来源的外部依赖必须可打开"],
    };
  });
  const missingRequirements = features
    .map((feature, index) => `REQ-${String(index + 1).padStart(2, "0")}`)
    .filter((reqId) => !tasks.some((task) => task.requirementIds.includes(reqId)));
  const coverage = features.length ? (features.length - missingRequirements.length) / features.length : 0;
  return { coverage, missingRequirements, components, tasks };
}
