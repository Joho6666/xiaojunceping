import { AgentRecommendation, RequirementProfile, TraceabilityPlan, ToolRecommendation } from "../../types";

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

const FEATURE_ALIASES: Record<string, string[]> = {
  login: ["认证", "登录", "auth", "账号"],
  chat: ["聊天", "即时", "消息"],
  matching: ["匹配", "推荐"],
  profile: ["资料"],
  moderation: ["审核", "安全", "风控"],
  firmware: ["固件", "嵌入式"],
  payment: ["支付"],
  catalog: ["商品", "目录"],
  geometry: ["几何", "cad"],
  schematic: ["原理图", "pcb"],
};

function matchesFeature(haystack: string, feature: string) {
  const hay = normalize(haystack);
  if (hay.includes(normalize(feature))) return true;
  return (FEATURE_ALIASES[feature] || []).some((alias) => hay.includes(normalize(alias)));
}

export function buildTraceabilityPlan(
  profile: RequirementProfile,
  agents: AgentRecommendation[] = [],
  tools: ToolRecommendation[] = [],
): TraceabilityPlan {
  const features = profile.requiredFeatures || [];
  const acceptance = profile.acceptanceCriteria || [];
  const components = features.map((feature, index) => ({
    id: `COMP-${String(index + 1).padStart(2, "0")}`,
    name: feature,
    requirementIds: [`REQ-${String(index + 1).padStart(2, "0")}`],
  }));
  const tasks = features.map((feature, index) => {
    const reqId = `REQ-${String(index + 1).padStart(2, "0")}`;
    const agent = agents.find((item) => matchesFeature(`${item.name} ${item.role} ${item.reason}`, feature));
    const matchedTools = tools.filter((tool) => matchesFeature(`${tool.name} ${tool.purpose}`, feature)).map((tool) => tool.name).slice(0, 3);
    const matchedAcceptance = acceptance.filter((item) => matchesFeature(item, feature));
    return {
      id: `TASK-${String(index + 1).padStart(2, "0")}`,
      requirementIds: [reqId],
      componentId: `COMP-${String(index + 1).padStart(2, "0")}`,
      title: `实现 ${feature}`,
      agentId: agent?.id,
      toolIds: matchedTools,
      acceptanceCriteria: matchedAcceptance.length ? matchedAcceptance : [`${feature} 可演示`],
    };
  });
  const missingRequirements = tasks.filter((task) => !task.agentId).flatMap((task) => task.requirementIds);
  const coverage = features.length ? (features.length - missingRequirements.length) / features.length : 0;
  return { coverage, missingRequirements, components, tasks };
}

export function diffPlans(previous?: TraceabilityPlan | null, next?: TraceabilityPlan | null) {
  const prevTasks = new Set((previous?.tasks || []).map((task) => task.title));
  const nextTasks = new Set((next?.tasks || []).map((task) => task.title));
  return {
    added: Array.from(nextTasks).filter((title) => !prevTasks.has(title)),
    removed: Array.from(prevTasks).filter((title) => !nextTasks.has(title)),
  };
}
