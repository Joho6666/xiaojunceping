import { spawn } from "node:child_process";
import path from "node:path";
import { ProviderId } from "../../types";

export type CLIStatus = { available: boolean; authenticated: boolean; command: string; message: string };
export type StructuredRequest = { prompt: string; timeoutMs?: number; maxOutputBytes?: number; model?: string };
export interface CLIAdapter {
  provider: ProviderId;
  command: string;
  healthCheck(): Promise<CLIStatus>;
  generateStructured<T>(request: StructuredRequest): Promise<T>;
  generateText(request: StructuredRequest): Promise<string>;
}

const SAFE_ARG = /^[A-Za-z0-9_@+=.,:/\\-]+$/;

export function assertSafeArgs(args: string[]) {
  for (const arg of args) {
    if (!SAFE_ARG.test(arg)) throw new Error(`CLI_UNSAFE_ARGUMENT:${arg.slice(0, 40)}`);
  }
}

function mappedCli(command: string): "codex" | "codex.cmd" | "claude" | "claude.cmd" | "gemini" | "gemini.cmd" {
  const base = path.basename(command).toLowerCase();
  if (base === "codex" || base === "codex.cmd" || base === "codex.exe") {
    return process.platform === "win32" ? "codex.cmd" : "codex";
  }
  if (base === "claude" || base === "claude.cmd" || base === "claude.exe") {
    return process.platform === "win32" ? "claude.cmd" : "claude";
  }
  if (base === "gemini" || base === "gemini.cmd" || base === "gemini.exe") {
    return process.platform === "win32" ? "gemini.cmd" : "gemini";
  }
  throw new Error("CLI_UNSAFE_COMMAND");
}

function providerCli(provider: ProviderId): "codex" | "codex.cmd" | "claude" | "claude.cmd" | "gemini" | "gemini.cmd" {
  if (provider === "anthropic") return process.platform === "win32" ? "claude.cmd" : "claude";
  if (provider === "gemini") return process.platform === "win32" ? "gemini.cmd" : "gemini";
  return process.platform === "win32" ? "codex.cmd" : "codex";
}

function killTree(child: { pid?: number; kill: (signal?: NodeJS.Signals) => boolean }) {
  if (process.platform === "win32" && child.pid && /^\d+$/.test(String(child.pid))) {
    try {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    } catch {
      /* best effort */
    }
  } else {
    child.kill();
  }
}

function spawnAllowed(command: string, args: string[]) {
  const exe = mappedCli(command);
  if (exe === "codex.cmd") return spawn("codex.cmd", args, { shell: false, windowsHide: true });
  if (exe === "claude.cmd") return spawn("claude.cmd", args, { shell: false, windowsHide: true });
  if (exe === "gemini.cmd") return spawn("gemini.cmd", args, { shell: false, windowsHide: true });
  if (exe === "claude") return spawn("claude", args, { shell: false, windowsHide: true });
  if (exe === "gemini") return spawn("gemini", args, { shell: false, windowsHide: true });
  return spawn("codex", args, { shell: false, windowsHide: true });
}

export function runCLI(command: string, args: string[], request: StructuredRequest, _shell = false, includeStderr = false) {
  assertSafeArgs(args);
  return new Promise<string>((resolve, reject) => {
    const child = spawnAllowed(command, args);
    const chunks: Buffer[] = [];
    const errors: Buffer[] = [];
    let total = 0;
    let settled = false;
    const finish = (error?: Error, result?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      error ? reject(error) : resolve(result || "");
    };
    const timeout = setTimeout(() => {
      killTree(child);
      finish(new Error("CLI_TIMEOUT"));
    }, request.timeoutMs || 30000);
    child.stdout.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > (request.maxOutputBytes || 2_000_000)) {
        killTree(child);
        finish(new Error("CLI_OUTPUT_LIMIT"));
        return;
      }
      chunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      if (includeStderr) {
        total += chunk.length;
        if (total > (request.maxOutputBytes || 2_000_000)) {
          killTree(child);
          finish(new Error("CLI_OUTPUT_LIMIT"));
          return;
        }
        chunks.push(chunk);
      } else {
        errors.push(chunk);
      }
    });
    child.once("error", (error) => finish(error));
    child.once("close", (code) => {
      if (code !== 0) {
        const detail = Buffer.concat(errors).toString("utf8").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 240);
        finish(new Error(`CLI_EXIT_${code ?? "UNKNOWN"}${detail ? `:${detail}` : ""}`));
        return;
      }
      finish(undefined, Buffer.concat(chunks).toString("utf8").trim());
    });
    child.stdin.on("error", (error) => finish(error instanceof Error ? error : new Error(String(error))));
    try {
      child.stdin.write(request.prompt);
      child.stdin.end();
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

export function createCLIAdapter(provider: ProviderId): CLIAdapter {
  const command = providerCli(provider);
  return {
    provider,
    command,
    async healthCheck() {
      try {
        await runCLI(command, ["--version"], { prompt: "", timeoutMs: 8000, maxOutputBytes: 100_000 });
        return { available: true, authenticated: true, command, message: "CLI 可用" };
      } catch (error) {
        const code = error instanceof Error ? error.message : "CLI_UNAVAILABLE";
        return {
          available: false,
          authenticated: false,
          command,
          message: code === "ENOENT" ? "未找到 CLI" : code.includes("TIMEOUT") ? "CLI 响应超时" : "CLI 不可用",
        };
      }
    },
    async generateText(request: StructuredRequest) {
      return runCLI(command, [], request);
    },
    async generateStructured<T>(request: StructuredRequest) {
      const raw = await runCLI(command, [], request);
      try {
        return JSON.parse(raw) as T;
      } catch {
        throw new Error("CLI_INVALID_JSON");
      }
    },
  };
}
