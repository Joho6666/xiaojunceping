import { AgentRecommendation, PlanSnapshot, RequirementProfile, TraceabilityPlan, ToolRecommendation } from "../../types";
import { detectCycle, topologicalSort } from "./dag";

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
  video: ["视频", "字幕", "切片"],
  dashboard: ["后台", "dashboard", "面板"],
};

const FEATURE_BREAKDOWN: Record<string, string[]> = {
  chat: ["消息 schema/API", "聊天 UI", "E2E 验收"],
  login: ["认证 schema/API", "登录 UI", "E2E 验收"],
  payment: ["支付 schema/API", "支付 UI", "E2E 验收"],
  firmware: ["外设驱动", "控制回路", "硬件联调"],
  video: ["媒体管线", "字幕与切片", "渲染验收"],
  dashboard: ["数据接口", "后台界面", "E2E 验收"],
  auth: ["认证 schema/API", "会话策略", "E2E 验收"],
};

const FEATURE_DEPENDS: Record<string, string[]> = {
  payment: ["login"],
  chat: ["login"],
  dashboard: ["login"],
};

function matchesFeature(haystack: string, feature: string) {
  const hay = normalize(haystack);
  if (hay.includes(normalize(feature))) return true;
  return (FEATURE_ALIASES[feature] || []).some((alias) => hay.includes(normalize(alias)));
}

function partsFor(feature: string) {
  return FEATURE_BREAKDOWN[feature] || [`实现 ${feature}`, `${feature} 验收`];
}

export function buildTraceabilityPlan(
  profile: RequirementProfile,
  agents: AgentRecommendation[] = [],
  tools: ToolRecommendation[] = [],
): TraceabilityPlan {
  const features = profile.requiredFeatures || [];
  const acceptance = profile.acceptanceCriteria || [];
  const components = features.flatMap((feature, featureIndex) => {
    const parts = partsFor(feature);
    return parts.map((name, partIndex) => ({
      id: `COMP-${String(featureIndex + 1).padStart(2, "0")}${String.fromCharCode(65 + partIndex)}`,
      name: `${feature}:${name}`,
      requirementIds: [`REQ-${String(featureIndex + 1).padStart(2, "0")}`],
      feature,
      partIndex,
      partCount: parts.length,
    }));
  });
  const featureFirstTask = new Map<string, string>();
  const tasks = components.map((component) => {
    const featureName = component.feature;
    const agent = agents.find((item) => matchesFeature(`${item.name} ${item.role} ${item.reason}`, featureName));
    const matchedTools = tools.filter((tool) => matchesFeature(`${tool.name} ${tool.purpose}`, featureName)).map((tool) => tool.name).slice(0, 3);
    const matchedAcceptance = acceptance.filter((item) => matchesFeature(item, featureName));
    const taskId = component.id.replace("COMP-", "TASK-");
    if (!featureFirstTask.has(featureName)) featureFirstTask.set(featureName, taskId);
    const dependsOn: string[] = [];
    if (component.partIndex > 0) {
      const prev = components.find((item) => item.feature === featureName && item.partIndex === component.partIndex - 1);
      if (prev) dependsOn.push(prev.id.replace("COMP-", "TASK-"));
    } else {
      for (const parent of FEATURE_DEPENDS[featureName] || []) {
        const parentTask = featureFirstTask.get(parent);
        if (parentTask) dependsOn.push(parentTask);
      }
    }
    return {
      id: taskId,
      requirementIds: component.requirementIds,
      componentId: component.id,
      title: component.name,
      description: `实现 ${component.name}`,
      agentId: agent?.id,
      toolIds: matchedTools,
      dependsOn,
      priority: component.partIndex === 0 ? "high" as const : "medium" as const,
      acceptanceCriteria: matchedAcceptance.length ? matchedAcceptance : [`${featureName} 可演示`],
      acceptanceTests: [`手工验证 ${component.name}`],
      status: "planned" as const,
    };
  });
  const cycle = detectCycle(tasks);
  if (cycle.length) throw new Error("TASK_DAG_CYCLE");
  topologicalSort(tasks);
  const missingRequirements = features
    .map((_, index) => `REQ-${String(index + 1).padStart(2, "0")}`)
    .filter((reqId) => !tasks.some((task) => task.requirementIds.includes(reqId) && task.agentId && task.acceptanceCriteria.length));
  const componentCoverage = features.length ? features.filter((_, index) => components.some((item) => item.requirementIds.includes(`REQ-${String(index + 1).padStart(2, "0")}`))).length / features.length : 0;
  const taskCoverage = features.length ? features.filter((_, index) => tasks.some((item) => item.requirementIds.includes(`REQ-${String(index + 1).padStart(2, "0")}`))).length / features.length : 0;
  const acceptanceCoverage = features.length ? features.filter((_, index) => tasks.some((item) => item.requirementIds.includes(`REQ-${String(index + 1).padStart(2, "0")}`) && item.acceptanceCriteria.length)).length / features.length : 0;
  const executorCoverage = features.length ? features.filter((_, index) => tasks.some((item) => item.requirementIds.includes(`REQ-${String(index + 1).padStart(2, "0")}`) && item.agentId)).length / features.length : 0;
  const coverage = (componentCoverage + taskCoverage + acceptanceCoverage + executorCoverage) / 4;
  return { coverage, componentCoverage, taskCoverage, acceptanceCoverage, executorCoverage, missingRequirements, components: components.map(({ id, name, requirementIds }) => ({ id, name, requirementIds })), tasks, cycle };
}

function names(items: Array<{ name?: string; title?: string; repo?: string }> | undefined) {
  return new Set((items || []).map((item) => item.name || item.title || item.repo || "").filter(Boolean));
}

function setDiff(previous: Set<string>, next: Set<string>) {
  return {
    added: Array.from(next).filter((item) => !previous.has(item)),
    removed: Array.from(previous).filter((item) => !next.has(item)),
  };
}

export function diffPlans(previous?: PlanSnapshot | TraceabilityPlan | null, next?: PlanSnapshot | TraceabilityPlan | null) {
  const prevPlan = previous && "executionPlan" in previous ? previous.executionPlan : previous as TraceabilityPlan | undefined;
  const nextPlan = next && "executionPlan" in next ? next.executionPlan : next as TraceabilityPlan | undefined;
  const prevSnap = previous && "agents" in previous ? previous as PlanSnapshot : undefined;
  const nextSnap = next && "agents" in next ? next as PlanSnapshot : undefined;
  const prevTasks = names(prevPlan?.tasks);
  const nextTasks = names(nextPlan?.tasks);
  const added = Array.from(nextTasks).filter((title) => !prevTasks.has(title));
  const removed = Array.from(prevTasks).filter((title) => !nextTasks.has(title));
  const featureChanges = added.filter((title) => title.includes(":")).map((title) => title.split(":")[0]);
  const agentChanges = prevSnap && nextSnap ? Object.values(setDiff(names(prevSnap.agents), names(nextSnap.agents))).flat() : [];
  const toolChanges = prevSnap && nextSnap ? Object.values(setDiff(names(prevSnap.tools), names(nextSnap.tools))).flat() : [];
  const githubChanges = prevSnap && nextSnap ? Object.values(setDiff(names(prevSnap.githubProjects), names(nextSnap.githubProjects))).flat() : [];
  const modelChanges = prevSnap && nextSnap ? Object.values(setDiff(names(prevSnap.models), names(nextSnap.models))).flat() : [];
  const riskChanges = prevSnap && nextSnap ? Object.values(setDiff(names(prevSnap.risks), names(nextSnap.risks))).flat() : [];
  const requirementChanges = prevSnap && nextSnap
    ? Object.values(setDiff(new Set(prevSnap.profile.requiredFeatures || []), new Set(nextSnap.profile.requiredFeatures || []))).flat()
    : featureChanges;
  const architectureChanges = prevSnap && nextSnap ? Object.values(setDiff(new Set(prevSnap.architecture), new Set(nextSnap.architecture))).flat() : [];
  const estimateChanges = prevSnap && nextSnap && prevSnap.estimates.time.display !== nextSnap.estimates.time.display
    ? [`${prevSnap.estimates.time.display} → ${nextSnap.estimates.time.display}`]
    : [];
  const readinessChanges = prevSnap && nextSnap && prevSnap.readiness !== nextSnap.readiness
    ? [`${prevSnap.readiness || "unknown"} → ${nextSnap.readiness || "unknown"}`]
    : [];
  const reasonParts = [
    requirementChanges.length ? `新增/变更 requirement: ${requirementChanges.join("、")}` : "",
    agentChanges.length ? `Agent: ${agentChanges.join("、")}` : "",
    added.length ? `Tasks: ${added.map((title) => `+ ${title}`).join("；")}` : "",
    estimateChanges.length ? `Time: ${estimateChanges.join("；")}` : "",
    readinessChanges.length ? `Readiness: ${readinessChanges.join("；")}` : "",
  ].filter(Boolean);
  return {
    added,
    removed,
    taskChanges: [...added.map((title) => `+ ${title}`), ...removed.map((title) => `- ${title}`)],
    featureChanges,
    requirementChanges,
    architectureChanges,
    modelChanges,
    agentChanges,
    toolChanges,
    githubChanges,
    riskChanges,
    estimateChanges,
    readinessChanges,
    reason: reasonParts.join("。") || undefined,
  };
}
