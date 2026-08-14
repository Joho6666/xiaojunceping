import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { CapabilityId } from "../../../../../types";
import { getCapabilitySecret, listCapabilities, setCapabilityStatus } from "../../../../../services/capabilityService";
export async function POST(_: Request, { params }: { params: { id: CapabilityId } }) {
  const capability = listCapabilities().find((item) => item.id === params.id);
  if (!capability) return NextResponse.json({ error: "CAPABILITY_NOT_FOUND" }, { status: 404 });
  if (params.id === "web-search") {
    try { const response = await fetch("https://api.tavily.com/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ api_key: getCapabilitySecret(params.id), query: "site:github.com open source software project", max_results: 1, search_depth: "basic" }), signal: AbortSignal.timeout(15000) }); setCapabilityStatus(params.id, response.ok ? "connected" : "error", response.ok ? undefined : "WEB_SEARCH_AUTH_FAILED"); return NextResponse.json({ ok: response.ok, message: response.ok ? "浏览器搜索连接成功，已验证可返回结果" : "浏览器搜索 Key 无效或已过期" }, { status: response.ok ? 200 : 502 }); } catch { setCapabilityStatus(params.id, "error", "CAPABILITY_UNREACHABLE"); return NextResponse.json({ ok: false, message: "浏览器搜索服务无法访问" }, { status: 502 }); }
  }
  if (params.id === "github") {
    try { const response = await fetch("https://api.github.com/rate_limit", { headers: { Accept: "application/vnd.github+json", "User-Agent": "AgentScope-Evaluator", ...(getCapabilitySecret("github") ? { Authorization: `Bearer ${getCapabilitySecret("github")}` } : {}) } }); setCapabilityStatus(params.id, response.ok ? "connected" : "error", response.ok ? undefined : "GITHUB_AUTH_FAILED"); return NextResponse.json({ ok: response.ok, message: response.ok ? "GitHub API 连接成功" : "GitHub Token 无效或已过期" }); } catch { setCapabilityStatus(params.id, "error", "CAPABILITY_UNREACHABLE"); return NextResponse.json({ ok: false, message: "GitHub API 无法访问" }, { status: 502 }); }
  }
  if (params.id === "browser") {
    const candidates = [
      path.join(process.cwd(), "node_modules", "playwright", "package.json"),
      path.join(process.cwd(), "node_modules", "playwright-core", "package.json"),
    ];
    const installed = candidates.some((candidate) => fs.existsSync(candidate));
    setCapabilityStatus(params.id, installed ? "connected" : "error", installed ? undefined : "BROWSER_RUNTIME_NOT_INSTALLED");
    return NextResponse.json({ ok: installed, message: installed ? "浏览器自动化运行时已安装" : "未安装 Playwright；浏览器搜索可用，但浏览器自动化尚未启用" }, { status: installed ? 200 : 503 });
  }
  const configured = Boolean(getCapabilitySecret(params.id) || capability.endpoint || capability.mode === "local"); setCapabilityStatus(params.id, configured ? "connected" : "error", configured ? undefined : "CONFIG_REQUIRED"); return NextResponse.json({ ok: configured, message: configured ? `${capability.name} 已配置` : `请先配置${capability.name}` });
}
