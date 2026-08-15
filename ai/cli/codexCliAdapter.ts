import { createCLIAdapter, runCLI, StructuredRequest, CLIStatus } from './cliAdapter';

export type CodexModelOption = { id: string; label: string };

function extractCodexMessage(raw: string) {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const messages: string[] = [];
  for (const line of lines) {
    try {
      const event = JSON.parse(line) as { type?: string; item?: { type?: string; text?: string; content?: string } };
      const item = event.item;
      if (event.type === "item.completed" && item?.type === "agent_message") {
        const text = item.text || item.content;
        if (text) messages.push(text);
      }
    } catch {
      // Non-JSON diagnostics are intentionally ignored; Codex errors use exit code.
    }
  }
  return messages.join("\n").trim() || raw;
}

function parseCodexJson<T>(text: string): T {
  const cleaned = text.replace(/^\uFEFF/, "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try { return JSON.parse(cleaned) as T; } catch { /* try extracting a JSON object from a natural-language wrapper */ }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const candidate = cleaned.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1");
    try { return JSON.parse(candidate) as T; } catch { /* handled below */ }
  }
  throw new Error("CLI_INVALID_JSON");
}

export const codexCliAdapter = {
  ...createCLIAdapter("openai"),
  async healthCheck(): Promise<CLIStatus> {
    try {
      const command = process.env.CODEX_CLI_PATH || "codex.cmd";
      const raw = await runCLI(command, ["login", "status"], { prompt: "", timeoutMs: 10000, maxOutputBytes: 100_000 }, process.platform === "win32", true);
      const authenticated = /logged in|已登录/i.test(raw);
      return { available: true, authenticated, command, message: authenticated ? "Codex CLI 已登录" : "Codex CLI 未登录" };
    } catch (error) {
      const code = error instanceof Error ? error.message : "CLI_UNAVAILABLE";
      return { available: false, authenticated: false, command: process.env.CODEX_CLI_PATH || "codex.cmd", message: code === "ENOENT" ? "未找到 Codex CLI" : code.includes("TIMEOUT") ? "Codex CLI 响应超时" : "Codex CLI 不可用" };
    }
  },
  async generateText(request: StructuredRequest) {
    const model = request.model || process.env.CODEX_MODEL || process.env.AI_REASONING_MODEL;
    const modelArgs = model ? ["--model", model] : [];
    const raw = await runCLI(process.env.CODEX_CLI_PATH || "codex.cmd", ["--search", "exec", "--json", "--ephemeral", "--skip-git-repo-check", "--sandbox", "read-only", "--color", "never", ...modelArgs, "-"], request, process.platform === "win32");
    return extractCodexMessage(raw);
  },
  async generateStructured<T>(request: StructuredRequest) {
    const text = await this.generateText(request);
    return parseCodexJson<T>(text);
  },
};

export async function listCodexModels(): Promise<CodexModelOption[]> {
  const raw = await runCLI(process.env.CODEX_CLI_PATH || "codex.cmd", ["debug", "models"], { prompt: "", timeoutMs: 15000, maxOutputBytes: 2_000_000 }, process.platform === "win32");
  const parsed = JSON.parse(raw) as { models?: Array<{ slug?: string; display_name?: string; visibility?: string }> };
  return (parsed.models || [])
    .filter((item) => item.visibility !== "hide" && typeof item.slug === "string" && item.slug.trim())
    .map((item) => ({ id: item.slug!.trim(), label: item.display_name?.trim() || item.slug!.trim() }));
}
