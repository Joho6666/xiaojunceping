import { AnswerValue, Project, RequirementProfile } from "../types";

const byKind: Record<Project["kind"], { domain: string[]; capabilities: string[]; tags: string[] }> = {
  video: { domain: ["视频", "媒体"], capabilities: ["视频处理", "素材管理"], tags: ["video", "media"] },
  web: { domain: ["Web", "网站"], capabilities: ["Web 应用", "认证", "数据库"], tags: ["web", "saas"] },
  cad: { domain: ["CAD", "制造"], capabilities: ["参数化建模", "格式转换"], tags: ["cad", "3d"] },
  pcb: { domain: ["PCB", "硬件"], capabilities: ["原理图", "ERC/DRC"], tags: ["pcb", "hardware"] },
  automation: { domain: ["自动化", "业务流程"], capabilities: ["Workflow", "API", "Webhook"], tags: ["automation", "api"] },
  general: { domain: ["软件项目"], capabilities: ["需求理解", "代码实现"], tags: ["software"] },
};

function flattenAnswers(answers: Record<string, AnswerValue>) {
  return Object.values(answers).flatMap((value) => Array.isArray(value) ? value : [value]).filter(Boolean).join(" ");
}

export function extractRequirementProfile(project: Project, answers: Record<string, AnswerValue> = {}): RequirementProfile {
  const text = `${project.idea} ${flattenAnswers(answers)}`.toLowerCase();
  const base = byKind[project.kind] || byKind.general;
  const capabilities = [...base.capabilities];
  const tags = [...base.tags];
  const stack: string[] = [];
  const platforms: string[] = ["Web"];
  const add = (capability: string, tag: string) => { if (!capabilities.includes(capability)) capabilities.push(capability); if (!tags.includes(tag)) tags.push(tag); };
  if (/电商|卖衣服|购物|商品|支付|订单|商城|零售/.test(text)) { add("商品目录", "ecommerce"); add("购物车与订单", "commerce"); }
  if (/next\.js|react|typescript/.test(text)) stack.push("Next.js", "React", "TypeScript");
  if (/supabase|postgres|数据库/.test(text)) { stack.push("Supabase", "PostgreSQL"); add("数据库", "backend"); }
  if (/github|开源|仓库/.test(text)) add("GitHub 研究", "github");
  if (/mcp/.test(text)) add("MCP", "mcp");
  if (/私有|隐私|敏感|本地部署/.test(text)) return { projectKind: project.kind, domain: base.domain, goals: [project.idea], capabilities, tags, stack, platforms: ["Web", "Self-host"], constraints: ["隐私数据需受控"], dataSensitivity: "高", needsLiveSearch: true };
  return { projectKind: project.kind, domain: base.domain, goals: [project.idea], capabilities, tags, stack, platforms, constraints: [], dataSensitivity: "未知", needsLiveSearch: true };
}
