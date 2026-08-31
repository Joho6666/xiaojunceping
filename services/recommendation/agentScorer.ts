import { AgentRecommendation, DomainName, RequirementProfile } from "../../types";
import { createEvidence } from "../evidence/evidenceStore";

type AgentTemplate = { name: string; role: string; domains: string[] };

const CATALOG: AgentTemplate[] = [
  { name: "需求研究 Agent", role: "把目标转成可验证约束", domains: ["web", "commerce", "education", "productivity", "general"] },
  { name: "架构 Agent", role: "给出可落地的模块边界", domains: ["web", "commerce", "developer-tool", "ai-agent"] },
  { name: "前端 Agent", role: "实现界面与交互闭环", domains: ["web", "mobile", "commerce"] },
  { name: "后端 Agent", role: "实现 API、数据和权限", domains: ["web", "commerce", "data"] },
  { name: "安全审查 Agent", role: "独立审查鉴权、数据和发布风险", domains: ["web", "commerce", "data"] },
  { name: "部署 Agent", role: "把可运行版本发布到目标环境", domains: ["web", "commerce", "developer-tool"] },
  { name: "内容研究 Agent", role: "收集素材与内容约束", domains: ["video", "audio"] },
  { name: "脚本 Agent", role: "生成分镜或剪辑脚本", domains: ["video"] },
  { name: "视频处理 Agent", role: "转码、切片与渲染", domains: ["video"] },
  { name: "字幕 Agent", role: "转写和对齐字幕", domains: ["video", "audio"] },
  { name: "媒体 QA Agent", role: "检查成片质量", domains: ["video", "audio"] },
  { name: "硬件需求 Agent", role: "整理电气与机械约束", domains: ["pcb", "embedded", "industrial"] },
  { name: "Datasheet 研究 Agent", role: "核验芯片与接口资料", domains: ["embedded", "pcb"] },
  { name: "原理图 Agent", role: "绘制并检查原理图", domains: ["pcb"] },
  { name: "固件 Agent", role: "实现 STM32/嵌入式软件", domains: ["embedded"] },
  { name: "PCB 审查 Agent", role: "审查布局与可制造性", domains: ["pcb"] },
  { name: "ERC/DRC 校验 Agent", role: "运行电气和设计规则检查", domains: ["pcb"] },
  { name: "参数化建模 Agent", role: "生成 CAD 几何", domains: ["cad", "industrial"] },
  { name: "制造文件 Agent", role: "导出 STEP/DXF/Gerber", domains: ["cad", "pcb", "industrial"] },
  { name: "流程编排 Agent", role: "连接 API/Webhook/MCP", domains: ["automation", "ai-agent"] },
  { name: "可靠性审查 Agent", role: "处理失败重试与审计", domains: ["automation"] },
];

export function scoreAgents(profile: RequirementProfile, provider: string): { agents: AgentRecommendation[]; evidenceIds: string[] } {
  const domainNames = (profile.domains || []).map((item) => item.name);
  const evidence = createEvidence({
    type: "user-input",
    title: "按多领域需求动态组建 Agent",
    confidence: "medium",
    note: domainNames.join(", ") || profile.projectKind,
  });
  const ranked = CATALOG
    .map((agent) => {
      const overlap = agent.domains.filter((domain) => domainNames.includes(domain as DomainName) || domain === profile.projectKind);
      return { agent, score: overlap.length ? 70 + overlap.length * 8 : 0 };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);
  const fallback = CATALOG.filter((agent) => agent.domains.includes("web") || agent.name.includes("需求") || agent.name.includes("架构")).slice(0, 4);
  const selected = ranked.length ? ranked : fallback.map((agent) => ({ agent, score: 60 }));
  return {
    evidenceIds: [evidence.id],
    agents: selected.map((item, index) => ({
      id: `agent-${index + 1}`,
      name: item.agent.name,
      provider,
      description: item.agent.role,
      role: item.agent.role,
      capabilities: profile.needsMcp ? ["MCP"] : profile.needsTerminal ? ["终端"] : ["仓库"],
      bestFor: profile.requiredFeatures?.slice(0, 3) || profile.goals.slice(0, 2),
      matchScore: Math.min(95, item.score),
      reason: `因项目领域 ${domainNames.slice(0, 3).join(" / ") || profile.projectKind} 需要该角色。`,
      evidenceIds: [evidence.id],
    })),
  };
}
