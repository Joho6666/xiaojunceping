import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type LocalDiscoveryKind = "skill" | "mcp" | "agent" | "ai-tool";
export interface LocalDiscoveryItem {
  id: string;
  kind: LocalDiscoveryKind;
  name: string;
  summary: string;
  sourcePath?: string;
  sourceUrl?: string;
  access: string;
  pricing: string;
  confidence: "高" | "中";
  detectedBy: string;
  sensitiveDataRead: false;
}

const home = () => process.env.USERPROFILE || os.homedir();
const exists = (target: string) => fs.existsSync(target);
const safeName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80);
function safeUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function frontmatter(file: string) {
  try {
    const text = fs.readFileSync(file, "utf8").slice(0, 12000);
    const heading = text.match(/^#\s+(.+)$/m)?.[1]?.trim();
    const description = text.match(/^(?:description|summary):\s*["']?(.+?)["']?\s*$/im)?.[1]?.trim();
    return { heading, description };
  } catch {
    return {};
  }
}

function scanSkillDirectory(root: string, detectedBy: string): LocalDiscoveryItem[] {
  if (!exists(root)) return [];
  const result: LocalDiscoveryItem[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(root, entry.name, "SKILL.md");
    if (!exists(skillFile)) continue;
    const meta = frontmatter(skillFile);
    result.push({
      id: `local-skill-${safeName(detectedBy)}-${safeName(entry.name)}`,
      kind: "skill",
      name: meta.heading || entry.name,
      summary: meta.description || `检测到本地 Skill：${entry.name}`,
      sourcePath: skillFile,
      access: "本地 Skill 文件",
      pricing: "本地已有；未读取凭据",
      confidence: "高",
      detectedBy,
      sensitiveDataRead: false,
    });
  }
  return result;
}

function parseMcpConfig(file: string, detectedBy: string): LocalDiscoveryItem[] {
  if (!exists(file)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    const servers = (raw.mcpServers || raw.servers || {}) as Record<string, unknown>;
    return Object.keys(servers).map((name) => {
      const value = (servers[name] || {}) as Record<string, unknown>;
      const url = typeof value.url === "string" ? value.url : undefined;
      const command = typeof value.command === "string" ? path.basename(value.command) : undefined;
      return {
        id: `local-mcp-${safeName(detectedBy)}-${safeName(name)}`,
        kind: "mcp" as const,
        name,
        summary: `检测到本地 MCP 配置${command ? `，启动命令为 ${command}` : ""}${url ? "，使用远程 URL" : ""}`,
        sourcePath: file,
        sourceUrl: safeUrl(url),
        access: url ? "远程 MCP URL" : command ? `本地命令 ${command}` : "本地 MCP 配置",
        pricing: "由 MCP 服务商或本地运行环境决定",
        confidence: "中" as const,
        detectedBy,
        sensitiveDataRead: false as const,
      };
    });
  } catch {
    return [];
  }
}

async function detectCli(command: string): Promise<LocalDiscoveryItem | null> {
  try {
    await execFileAsync(process.platform === "win32" ? "where.exe" : "which", [command], { timeout: 3000, windowsHide: true });
    return { id: `local-agent-${command}`, kind: "agent", name: command, summary: `检测到本机可执行的 ${command} CLI；仅检查 PATH，不读取登录状态或 Token。`, access: "本地 CLI", pricing: "按该 CLI 对应 Provider 或账户计划计费", confidence: "高", detectedBy: "PATH 检测", sensitiveDataRead: false };
  } catch {
    return null;
  }
}

export async function discoverLocalCapabilities(): Promise<{ scannedAt: string; items: LocalDiscoveryItem[]; notes: string[] }> {
  const userHome = home();
  const items = [
    ...scanSkillDirectory(path.join(userHome, ".codex", "skills"), "Codex Skills"),
    ...scanSkillDirectory(path.join(userHome, ".agents", "skills"), "Agents Skills"),
    ...scanSkillDirectory(path.join(userHome, ".claude", "skills"), "Claude Skills"),
    ...parseMcpConfig(path.join(userHome, ".cursor", "mcp.json"), "Cursor MCP"),
    ...parseMcpConfig(path.join(userHome, ".claude.json"), "Claude MCP"),
    ...parseMcpConfig(path.join(userHome, ".vscode", "mcp.json"), "VS Code MCP"),
    ...parseMcpConfig(path.join(process.env.APPDATA || path.join(userHome, "AppData", "Roaming"), "Claude", "claude_desktop_config.json"), "Claude Desktop MCP"),
  ];
  for (const command of ["codex", "claude", "gemini", "trae", "zcode", "dsh"]) {
    const detected = await detectCli(command);
    if (detected) items.push(detected);
  }
  const unique = Array.from(new Map(items.map((item) => [item.id, item])).values());
  return { scannedAt: new Date().toISOString(), items: unique, notes: ["只读取 Skill 名称/摘要、MCP 服务名和 CLI 是否存在。", "不会读取 API Key、OAuth Token、Cookie、环境变量值或 MCP env 字段。", "发现结果默认待确认，确认后才写入知识库。"] };
}
