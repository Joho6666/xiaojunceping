import { EcosystemCategory, EcosystemRecommendation, Project } from "../types";
import { profileFor } from "../data/projectProfiles";

type Candidate = Omit<
  EcosystemRecommendation,
  "id" | "updatedAt" | "matchScore"
> & {
  matchScore?: number;
  updatedAt?: string;
};

const common: Candidate[] = [
  {
    name: "Codex",
    category: "agent",
    description: "适合多文件开发、终端操作、测试和 Debug。",
    url: "https://openai.com/codex/",
    source: "official",
    reason: "适合把评估结果转成可执行代码变更。",
    capabilities: ["代码实现", "终端", "测试"],
    access: "CLI / OAuth",
  },
  {
    name: "Claude Code",
    category: "agent",
    description: "适合长上下文架构分析、代码审查和重构。",
    url: "https://docs.anthropic.com/en/docs/claude-code",
    source: "official",
    reason: "适合复杂仓库审查和方案复核。",
    capabilities: ["长上下文", "重构", "Review"],
    access: "CLI / API",
  },
  {
    name: "DeepSeek",
    category: "llm",
    description: "适合中文需求理解、研究规划和结构化评估。",
    url: "https://platform.deepseek.com/",
    source: "official",
    reason: "当前已连接 Provider，可承担需求研究和报告生成。",
    capabilities: ["中文", "推理", "结构化 JSON"],
    access: "API Key",
  },
  {
    name: "GitHub MCP Server",
    category: "mcp",
    description: "让 Agent 读取仓库、Issue、Pull Request 和代码上下文。",
    url: "https://github.com/github/github-mcp-server",
    source: "github",
    reason: "当前项目需要真实研究开源实现和版本状态。",
    capabilities: ["仓库搜索", "Issue", "代码上下文"],
    access: "MCP / GitHub Token",
  },
  {
    name: "MCP TypeScript SDK",
    category: "skill",
    description: "构建和验证 MCP Server / Client 的官方 SDK。",
    url: "https://github.com/modelcontextprotocol/typescript-sdk",
    source: "github",
    reason: "适合将项目工具能力接入 Agent 工作流。",
    capabilities: ["MCP Server", "MCP Client", "工具协议"],
    access: "npm / SDK",
  },
  {
    name: "MCP Registry",
    category: "plugin",
    description: "用于发现可接入的 MCP Server 和工具能力。",
    url: "https://registry.modelcontextprotocol.io/",
    source: "registry",
    reason: "可按项目任务扩展工具，而不是硬编码单一工具。",
    capabilities: ["工具发现", "版本信息", "Server 元数据"],
    access: "Registry",
  },
];

const byKind: Record<Project["kind"], Candidate[]> = {
  video: [
    {
      name: "FFmpeg",
      category: "ai-tool",
      description: "视频转码、剪辑、字幕和媒体管线基础工具。",
      url: "https://ffmpeg.org/",
      source: "official",
      reason: "视频 Agent 的底层执行能力。",
      capabilities: ["转码", "剪辑", "字幕"],
      access: "CLI",
    },
  ],
  web: [
    {
      name: "Vercel",
      category: "ai-tool",
      description: "Next.js 部署、预览和边缘运行平台。",
      url: "https://vercel.com/",
      source: "official",
      reason: "适合快速验证 Web MVP 和预览环境。",
      capabilities: ["部署", "预览", "Edge"],
      access: "API / CLI",
    },
  ],
  cad: [
    {
      name: "FreeCAD",
      category: "ai-tool",
      description: "参数化 CAD 建模和 STEP / STL 工作流。",
      url: "https://github.com/FreeCAD/FreeCAD",
      source: "github",
      reason: "适合 CAD Agent 生成和验证模型。",
      capabilities: ["参数化建模", "STEP", "STL"],
      access: "Desktop / CLI",
    },
  ],
  pcb: [
    {
      name: "KiCad",
      category: "ai-tool",
      description: "原理图、PCB、ERC / DRC 和 Gerber 输出工具链。",
      url: "https://www.kicad.org/",
      source: "official",
      reason: "适合硬件项目的设计和规则检查。",
      capabilities: ["PCB", "ERC", "DRC"],
      access: "Desktop / CLI",
    },
  ],
  automation: [
    {
      name: "n8n",
      category: "ai-tool",
      description: "连接 API、Webhook、MCP 和业务系统的自动化平台。",
      url: "https://github.com/n8n-io/n8n",
      source: "github",
      reason: "适合先编排自动化，而不是直接开发完整 App。",
      capabilities: ["Workflow", "Webhook", "API"],
      access: "Self-host / Cloud",
    },
  ],
  general: [],
};

async function searchGithubCandidates(project: Project, queries: string[]) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const results = await Promise.all(
      queries.slice(0, 3).map(async (query) => {
        const response = await fetch(
          `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=4`,
          {
            headers: {
              Accept: "application/vnd.github+json",
              "User-Agent": "AgentScope-Ecosystem-Agent",
            },
            signal: controller.signal,
          },
        );
        if (!response.ok) return [];
        const data = (await response.json()) as {
          items?: Array<Record<string, unknown>>;
        };
        return data.items || [];
      }),
    );
    return results.flat().slice(0, 8);
  } finally {
    clearTimeout(timer);
  }
}

export async function discoverEcosystem(
  project: Project,
  searchPlan: string[] = [],
): Promise<EcosystemRecommendation[]> {
  const profile = profileFor(project);
  const queries = [
    `${profile.label} AI agent MCP skill plugin`,
    ...searchPlan.slice(0, 2).map((x) => `${x} agent MCP`),
  ];
  const githubItems = await searchGithubCandidates(project, queries).catch(
    () => [],
  );
  const live = githubItems
    .filter((item) => typeof item.full_name === "string")
    .map((item, index): EcosystemRecommendation => ({
      id: `ecosystem-github-${String(item.id || index)}`,
      name: String(item.name || item.full_name),
      category: /mcp/i.test(`${item.name} ${item.description}`)
        ? "mcp"
        : /skill|plugin/i.test(`${item.name} ${item.description}`)
          ? "skill"
          : "ai-tool",
      description: String(item.description || "暂无项目简介").slice(0, 180),
      url: String(item.html_url || ""),
      source: "github",
      updatedAt: String(item.updated_at || new Date().toISOString()).slice(
        0,
        10,
      ),
      matchScore: Math.max(55, 90 - index * 6),
      reason: `GitHub 公开搜索结果，需结合 README、License 和实际安装验证：${profile.label}。`,
      capabilities: [String(item.language || "代码")],
      access: "GitHub 公开仓库",
    }));
  const all = [...byKind[project.kind], ...common, ...live];
  return all
    .filter(
      (item, index, items) =>
        items.findIndex(
          (x) => x.name.toLowerCase() === item.name.toLowerCase(),
        ) === index,
    )
    .map((item, index) => ({
      ...item,
      id: `ecosystem-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
      updatedAt: item.updatedAt || new Date().toISOString(),
      matchScore: item.matchScore ?? Math.max(60, 88 - index * 4),
    }));
}
