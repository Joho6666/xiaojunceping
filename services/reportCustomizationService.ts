import { AnswerValue, AgentPlan, AgentRecommendation, Project, ProjectReport, PromptArtifact, RequirementProfile } from '../types';

function hash(input: string) {
  let value = 2166136261;
  for (let i = 0; i < input.length; i++) value = Math.imul(value ^ input.charCodeAt(i), 16777619);
  return (value >>> 0).toString(16).padStart(8, '0');
}

export function buildInputFingerprint(project: Project, answers: Record<string, AnswerValue>, knowledgeVersion: string, searchSource: string) {
  return `v1-${hash(JSON.stringify({ idea: project.idea, kind: project.kind, mode: project.evaluationMode, selectedConnectionId: project.selectedConnectionId, selectedModel: project.selectedModel, answers, knowledgeVersion, searchSource }))}`;
}

const domainAgents: Record<Project['kind'], string[]> = {
  video: ['素材与需求研究 Agent', '视频处理管线 Agent', '字幕与切片 Agent', '渲染性能审查 Agent'],
  web: ['需求与竞品研究 Agent', 'Web 架构 Agent', '前端体验 Agent', '安全与上线审查 Agent'],
  cad: ['需求与制造约束 Agent', '参数化建模 Agent', 'STEP/STL 交换 Agent', '几何与工程审查 Agent'],
  pcb: ['硬件需求 Agent', 'KiCad 原理图 Agent', 'BOM/Gerber Agent', 'ERC/DRC 审查 Agent'],
  automation: ['流程梳理 Agent', 'Webhook/API 编排 Agent', 'MCP 工具 Agent', '可靠性审查 Agent'],
  general: ['需求研究 Agent', '方案架构 Agent', '实现 Agent', '质量审查 Agent'],
};

export function buildAgentPlan(project: Project, profile: RequirementProfile, report: ProjectReport, modelId: string): AgentPlan {
  const names = domainAgents[project.kind] || domainAgents.general;
  const tools = [
    ...(profile.needsGithub ? ['GitHub'] : []),
    ...(profile.needsLiveSearch ? ['浏览器搜索'] : []),
    ...(profile.needsMcp ? ['MCP'] : []),
    ...(profile.needsTerminal ? ['终端'] : []),
  ];
  const agents = names.map((name, index) => ({
    id: `custom-agent-${index + 1}`,
    name,
    role: index === 0 ? '把项目目标转为可验证约束' : index === names.length - 1 ? '独立审查风险与验收' : '完成当前领域的可交付阶段',
    modelId,
    tools,
    inputs: index === 0 ? ['项目描述', '访谈答案'] : [`${names[index - 1]} 的阶段输出`],
    actions: index === 0 ? ['提取目标、范围和验收标准', '记录不确定项'] : ['读取已核验来源', '执行本阶段任务', '输出可验收结果'],
    outputs: [index === names.length - 1 ? '最终验收清单' : `${name.replace(' Agent', '')} 阶段结果`],
    acceptance: index === names.length - 1 ? report.projectSummary.acceptanceCriteria : [`${name} 输出必须与项目目标直接相关`, '所有外部事实必须带来源'],
  }));
  return { order: agents.map((agent) => agent.id), agents };
}

function promptFor(tool: string, project: Project, report: ProjectReport, plan: AgentPlan) {
  const refs = (report.githubProjects || []).map((item) => `- ${item.repo}: ${item.url}`).join('\n') || '- 没有通过核验的 GitHub 项目；不得自行补充。';
  return `# ${project.idea}\n\n## 项目目标\n${report.projectSummary.summary}\n\n## 执行工具\n${tool}\n\n## Agent 顺序\n${plan.agents.map((agent, i) => `${i + 1}. ${agent.name}（模型：${agent.modelId}）`).join('\n')}\n\n## 已核验参考\n${refs}\n\n## 技术栈\n${report.techStack.map((item) => `${item.layer}: ${item.name}（${item.reasons.join('；')}）`).join('\n')}\n\n## 执行规则\n- 先读取当前仓库和现有代码，再修改。\n- 不把推测当事实；遇到缺少来源或权限时暂停并说明。\n- 每个阶段完成后运行相关测试并记录结果。\n- 只实现当前范围，超出范围先请求人工确认。\n\n## 验收标准\n${report.projectSummary.acceptanceCriteria.map((item) => `- ${item}`).join('\n')}\n\n## 风险\n${report.risks.map((item) => `- ${item.title}：${item.advice}`).join('\n')}`;
}

export function buildPromptArtifacts(project: Project, report: ProjectReport, plan: AgentPlan): PromptArtifact[] {
  const generatedAt = new Date().toISOString();
  const agentsMd = `# AgentScope 执行规则\n\n项目：${project.idea}\n\n## Agent 顺序\n${plan.agents.map((agent, i) => `${i + 1}. ${agent.name}：${agent.role}`).join('\n')}\n\n## 工具规则\n${Array.from(new Set(plan.agents.flatMap((agent) => agent.tools))).join('、') || '仅使用当前仓库工具'}\n\n## Definition of Done\n${report.projectSummary.acceptanceCriteria.map((item) => `- ${item}`).join('\n')}\n\n## 禁止事项\n- 不伪造 GitHub、模型或工具来源。\n- 不提交未通过测试的改动。\n- 涉及支付、数据删除或生产发布时必须人工确认。`;
  return [
    { id: 'master-prompt', type: 'master', name: 'master-prompt.md', content: promptFor('由用户选择的 Coding Agent', project, report, plan), generatedAt },
    { id: 'agents-md', type: 'agents-md', name: 'AGENTS.md', content: agentsMd, generatedAt },
    ...plan.agents.map((agent) => ({ id: agent.id, type: 'agent' as const, name: `${agent.id}.md`, content: `${promptFor('当前执行工具', project, report, plan)}\n\n## 当前 Agent\n${agent.name}\n${agent.role}\n\n## 输入\n${agent.inputs.join('、')}\n\n## 输出\n${agent.outputs.join('、')}`, generatedAt })),
  ];
}

export function applyAgentPlanToReport(report: ProjectReport, plan: AgentPlan): ProjectReport {
  const selectedModel = report.model || report.models[0]?.modelId || '按已选模型';
  return {
    ...report,
    agents: plan.agents.map((agent, index) => ({
      id: agent.id,
      name: agent.name,
      provider: report.provider || report.models[0]?.provider || '当前 Provider',
      description: agent.role,
      role: agent.role,
      capabilities: agent.tools,
      bestFor: agent.outputs,
      matchScore: Math.max(70, 92 - index * 4),
      reason: `按项目画像安排在第 ${index + 1} 阶段，输入来自 ${agent.inputs.join('、')}。`,
    })),
    workflows: plan.agents.map((agent, index) => ({
      id: `custom-phase-${index + 1}`,
      title: agent.name.replace(/ Agent$/, ''),
      goal: agent.role,
      agent: agent.name,
      model: agent.modelId || selectedModel,
      tools: agent.tools,
      input: agent.inputs.join('、'),
      actions: agent.actions,
      output: agent.outputs.join('、'),
      time: index === 0 ? '0.5–1 天' : index === plan.agents.length - 1 ? '0.5–1 天' : '1–2 天',
      tokens: index === 0 ? '约 5k–15k' : '约 10k–30k',
      acceptance: agent.acceptance.join('；'),
      risk: '若输入或来源不足，暂停并请求人工确认',
    })),
  };
}

export function customizeProjectSections(project: Project, profile: RequirementProfile, report: ProjectReport): ProjectReport {
  const domainLabel: Record<Project['kind'], string> = { video: '视频内容生产', web: 'Web 产品', cad: 'CAD 建模制造', pcb: 'PCB 硬件设计', automation: '自动化工作流', general: '定制软件项目' };
  const stackByKind: Record<Project['kind'], string[]> = {
    video: ['FFmpeg', '字幕/转写管线', '对象存储', '任务队列'], web: ['Next.js', '数据库与鉴权', '商品/业务 API', 'Vercel 或同类部署'], cad: ['FreeCAD/STEP', '参数化建模脚本', '几何校验', '制造文件导出'], pcb: ['KiCad', 'BOM 管理', 'Gerber 导出', 'ERC/DRC 校验'], automation: ['n8n 或等价编排器', 'Webhook/API', 'MCP 工具', '重试与审计'], general: ['TypeScript', '模块化 API', '持久化存储', '自动化测试']
  };
  const productByKind: Record<Project['kind'], { name: string; url: string; capabilities: string[] }[]> = {
    video: [{ name: 'Descript', url: 'https://www.descript.com/', capabilities: ['转写', '时间线编辑'] }, { name: 'CapCut', url: 'https://www.capcut.com/', capabilities: ['短视频编辑', '模板化创作'] }], web: [{ name: 'Shopify', url: 'https://www.shopify.com/', capabilities: ['商品目录', '订单与支付'] }, { name: 'Medusa', url: 'https://medusajs.com/', capabilities: ['电商后端', '库存与订单'] }], cad: [{ name: 'FreeCAD', url: 'https://www.freecad.org/', capabilities: ['参数化建模', '工程文件'] }], pcb: [{ name: 'KiCad', url: 'https://www.kicad.org/', capabilities: ['原理图', 'PCB 与制造文件'] }], automation: [{ name: 'n8n', url: 'https://n8n.io/', capabilities: ['工作流编排', 'Webhook 与集成'] }, { name: 'Activepieces', url: 'https://www.activepieces.com/', capabilities: ['自动化流程', '连接器'] }], general: [{ name: 'GitHub Projects', url: 'https://github.com/features/issues', capabilities: ['任务拆解', '交付跟踪'] }]
  };
  const products = productByKind[project.kind].map((item, index) => ({ name: item.name, type: '参考产品', url: item.url, capabilities: item.capabilities, audience: domainLabel[project.kind], businessModel: '以官方页面为准', priceRange: '待确认', similarity: Math.max(58, 86 - index * 9), learnFrom: item.capabilities, avoid: ['不要直接复制品牌交互和商业条款'] }));
  const selectedModel = report.model || project.selectedModel || '按已选模型';
  const dynamicStack = stackByKind[project.kind].map((name, index) => ({ layer: ['核心能力', '实现框架', '数据与集成', '验证与交付'][index] || '扩展', name, reasons: [`与${domainLabel[project.kind]}目标直接相关`, ...profile.goals.slice(0, 1)], alternative: '需要结合现有仓库和预算确认', matchScore: Math.max(68, 92 - index * 5) }));
  const baseScore = 66 + ((project.idea.length + profile.capabilities.length * 7) % 25);
  return { ...report, projectSummary: { ...report.projectSummary, title: project.idea.slice(0, 36) || `${domainLabel[project.kind]}评估`, typeLabel: domainLabel[project.kind], score: baseScore, summary: `${project.idea}。本报告根据当前项目描述、访谈答案、${selectedModel} 和已核验生态候选生成。`, acceptanceCriteria: profile.acceptanceCriteria?.length ? profile.acceptanceCriteria : report.projectSummary.acceptanceCriteria }, scores: report.scores.map((item, index) => ({ ...item, score: Math.max(55, Math.min(96, baseScore - index * 3)) })), referenceProducts: products, alternatives: [{ name: '最小可行方案', strategy: `${domainLabel[project.kind]}最小闭环`, recommended: true, time: '1–2 周', tokens: '约 3 万–8 万', cost: '低–中', risk: '中', freedom: '高', description: '先实现当前项目最核心的验收路径，再扩展边界能力。' }, { name: '开源二次开发', strategy: '基于核验项目组合改造', time: '2–4 周', tokens: '约 6 万–15 万', cost: '中', risk: '中–高', freedom: '中', description: '复用成熟模块，重点核对许可证、版本和二次开发成本。' }, { name: '托管服务组合', strategy: 'SaaS/API + 自定义编排', time: '3–10 天', tokens: '约 2 万–6 万', cost: '中–高', risk: '供应商依赖', freedom: '低', description: '适合先验证业务，但需要确认数据、费用和退出方案。' }], techStack: dynamicStack, strategy: { ...report.strategy, recipe: [domainLabel[project.kind], selectedModel, ...stackByKind[project.kind].slice(0, 2)] }, estimates: { ...report.estimates, tokens: { ...report.estimates.tokens, display: '约 3 万–15 万', range: '按 Agent 阶段与代码规模估算', breakdown: dynamicStack.slice(0, 3).map((item) => ({ label: item.layer, value: '约 1 万–5 万' })) }, time: { ...report.estimates.time, display: '约 1–4 周', range: '取决于范围、接口和人工确认速度' }, cost: { ...report.estimates.cost, display: '待按 Provider 价格核算', range: '外部 API、部署和第三方服务另计' } }, architecture: report.agentPlan?.agents.map((agent) => agent.name) || report.architecture, workflows: report.workflows.map((phase, index) => ({ ...phase, model: index === 0 ? selectedModel : phase.model })) };
}
