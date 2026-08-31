import { AgentRecommendation, RequirementProfile } from "../../types";
import { createEvidence } from "../evidence/evidenceStore";

const FEATURE_ROLES: Array<{ feature: RegExp; name: string; role: string }> = [
  { feature: /login|auth|认证/, name: "认证 Agent", role: "实现登录与权限" },
  { feature: /payment|支付/, name: "支付集成 Agent", role: "接入支付 Provider" },
  { feature: /chat|即时/, name: "即时通讯 Agent", role: "实现消息通道" },
  { feature: /matching|匹配/, name: "匹配 Agent", role: "实现推荐/匹配" },
  { feature: /profile|资料/, name: "资料 Agent", role: "实现用户资料" },
  { feature: /moderation|审核/, name: "安全审查 Agent", role: "内容审核与风控" },
  { feature: /firmware|固件/, name: "固件 Agent", role: "实现设备固件" },
  { feature: /schematic|原理图|pcb/, name: "原理图 Agent", role: "原理图与可制造性" },
  { feature: /geometry|cad|dxf/, name: "几何 Agent", role: "生成制造几何" },
  { feature: /video|字幕/, name: "视频处理 Agent", role: "转码切片与字幕" },
  { feature: /workflow|webhook/, name: "流程编排 Agent", role: "连接 API 与失败重试" },
  { feature: /admin|后台/, name: "后台 Agent", role: "管理端与运营工具" },
  { feature: /voice|语音|local-agent|terminal/, name: "本机 Agent", role: "本地语音/终端执行" },
  { feature: /mobile|小程序/, name: "移动端 QA Agent", role: "移动端验收" },
];

export function scoreAgents(profile: RequirementProfile, provider: string): { agents: AgentRecommendation[]; evidenceIds: string[] } {
  const haystack = [...(profile.requiredFeatures || []), ...profile.capabilities, ...profile.tags].join(" ");
  const evidence = createEvidence({
    type: "user-input",
    title: "按所需能力组建 Agent",
    confidence: "medium",
    note: (profile.requiredFeatures || []).join(",") || profile.primaryDomain,
  });
  const selected = FEATURE_ROLES.filter((item) => item.feature.test(haystack)).slice(0, 6);
  const agents = (selected.length ? selected : [{ name: "需求研究 Agent", role: "补齐需求合同后再设计架构" }]).map((item, index) => ({
    id: `agent-${index + 1}`,
    name: item.name,
    provider,
    description: item.role,
    role: item.role,
    capabilities: profile.needsTerminal ? ["终端"] : profile.needsGithub ? ["GitHub"] : ["仓库"],
    bestFor: profile.requiredFeatures?.slice(0, 3) || profile.goals.slice(0, 2),
    matchScore: selected.length ? 78 : 0,
    reason: selected.length ? `因所需能力命中：${item.name.replace(" Agent", "")}` : "需求不足，只保留研究角色",
    evidenceIds: [evidence.id],
  }));
  return { evidenceIds: [evidence.id], agents };
}
