"use client";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ModelSummary = { id: string; name: string; vendor?: string; modelId?: string; contextWindow?: string; maxOutput?: string; modalities?: string[]; lifecycle?: string; sourceUrl: string; updatedAt: string };
type KnowledgeStatus = { count: number; modelCount: number; models: ModelSummary[]; byKind: Record<string, number>; latestSync: { status: string; completedAt?: string; inserted: number; error?: string } | null; coverage: string };
type DiscoveryItem = { id: string; kind: "skill" | "mcp" | "agent" | "ai-tool"; name: string; summary: string; sourcePath?: string; sourceUrl?: string; access: string; pricing: string; confidence: "高" | "中"; detectedBy: string; sensitiveDataRead: false };

const kindLabel: Record<DiscoveryItem["kind"], string> = { skill: "Skill", mcp: "MCP", agent: "Agent", "ai-tool": "AI 工具" };

export default function KnowledgeSettingsPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<KnowledgeStatus | null>(null);
  const [discovered, setDiscovered] = useState<DiscoveryItem[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [discoverBusy, setDiscoverBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  async function load() { const response = await fetch("/api/knowledge/status"); if (response.ok) setStatus(await response.json()); }
  useEffect(() => { void load(); }, []);

  async function sync() {
    setBusy(true); setMessage("正在同步官方资料、GitHub 和注册源…");
    try { const response = await fetch("/api/knowledge/sync", { method: "POST" }); const data = await response.json(); setMessage(response.ok ? `同步完成：新增 ${data.inserted || 0} 条` : data.error || "同步部分失败"); await load(); }
    catch { setMessage("同步失败，请检查网络后重试"); } finally { setBusy(false); }
  }

  async function discover() {
    setDiscoverBusy(true); setMessage("正在扫描本机 Skill、MCP 配置和 CLI…");
    try { const response = await fetch("/api/knowledge/discover-local"); const data = await response.json(); if (!response.ok) throw new Error(data.error); setDiscovered(data.items || []); setSelected([]); setMessage(`扫描完成：发现 ${(data.items || []).length} 项本机能力。请确认后再同步。`); }
    catch { setMessage("本机扫描失败，请检查本地服务"); } finally { setDiscoverBusy(false); }
  }

  async function importLocal() {
    const items = discovered.filter((item) => selected.includes(item.id));
    if (!items.length) { setMessage("请先选择要同步的本机能力"); return; }
    setImportBusy(true);
    try { const response = await fetch("/api/knowledge/import-local", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true, items }) }); const data = await response.json(); setMessage(response.ok ? data.message : data.error || "同步失败"); if (response.ok) { setDiscovered((current) => current.filter((item) => !selected.includes(item.id))); setSelected([]); await load(); } }
    catch { setMessage("同步失败，请重试"); } finally { setImportBusy(false); }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    setImportBusy(true); setMessage("正在导入待确认知识条目…");
    try { const form = new FormData(); form.append("file", file); const response = await fetch("/api/knowledge/import", { method: "POST", body: form }); const data = await response.json(); setMessage(response.ok ? data.message : data.error || "导入失败"); if (response.ok) await load(); }
    catch { setMessage("导入失败，请上传合法 JSON 文件"); } finally { setImportBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  }

  const allSelected = discovered.length > 0 && selected.length === discovered.length;
  return <main><div className="content settings-page"><button className="btn" onClick={() => router.back()}>← 返回</button><div className="eyebrow">AgentScope Knowledge Base</div><h1>AI 生态知识库</h1><p className="muted">知识库用于筛选模型、Agent、Skill、MCP、工具和 GitHub 项目。模型使用精确 ID、能力和来源时间；当前索引不等于覆盖全市场。</p>{message && <div className="settings-message">{message}</div>}
    <section className="card knowledge-overview"><div><span className="muted">已发布条目</span><strong>{status?.count ?? "—"}</strong></div><div><span className="muted">精确模型</span><strong>{status?.modelCount ?? "—"}</strong></div><div><span className="muted">更新策略</span><strong>官方源 + 实时检索</strong></div><div><span className="muted">本机能力</span><strong>{discovered.length ? `${discovered.length} 待确认` : "未扫描"}</strong></div></section>
    <section className="card knowledge-panel"><div className="knowledge-panel-head"><div><h2>本机能力与手动导入</h2><p className="muted">扫描 Codex、Claude、Agents 目录中的 Skill，以及 Cursor、Claude Desktop、VS Code 的 MCP 配置。只读取名称和摘要，不读取 API Key、OAuth Token、Cookie、环境变量值或 MCP 参数。</p></div><div className="knowledge-actions"><button className="btn" disabled={discoverBusy} onClick={discover}>{discoverBusy ? "扫描中…" : "扫描本机 Skill / MCP"}</button><button className="btn" disabled={importBusy} onClick={() => fileInput.current?.click()}>上传 JSON</button><input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={upload} /></div></div>
      {discovered.length > 0 && <div className="local-discovery"><div className="local-discovery-head"><label><input type="checkbox" checked={allSelected} onChange={(event) => setSelected(event.target.checked ? discovered.map((item) => item.id) : [])} /> 全选</label><span className="muted">发现结果不会自动进入推荐，确认后才同步</span><button className="btn primary" disabled={importBusy || selected.length === 0} onClick={importLocal}>{importBusy ? "同步中…" : `确认并同步 ${selected.length || "选中"} 项`}</button></div>{discovered.map((item) => <label className="local-discovery-row" key={item.id}><input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /><span className="local-discovery-main"><strong>{item.name}</strong><span className="tag-row"><span>{kindLabel[item.kind]}</span><span>{item.detectedBy}</span><span>可信度 {item.confidence}</span></span><small className="muted">{item.summary}</small></span></label>)}</div>}
      <div className="knowledge-import-note"><strong>手动上传格式</strong><span>仅接受包含名称、类别、摘要、能力数组和 http(s) sourceUrl 的 JSON；导入条目默认待确认，不会立即参与推荐。</span></div>
    </section>
    <section className="card knowledge-panel"><div className="knowledge-panel-head"><div><h2>来源与同步</h2><p className="muted">可信源自动发布，社区条目进入待确认状态；连接 Provider 后可进一步同步其真实 models API。</p></div><button className="btn primary" disabled={busy} onClick={sync}>{busy ? "同步中…" : "立即同步"}</button></div><div className="tag-row knowledge-tags">{Object.entries(status?.byKind || {}).map(([kind, count]) => <span key={kind}>{kind} · {count}</span>)}</div><p className="muted">{status?.latestSync ? `最近同步：${status.latestSync.completedAt || "进行中"} · ${status.latestSync.status}` : "尚未执行同步，当前使用内置可信条目。"}</p><p className="knowledge-coverage">{status?.coverage || "官方模型文档、GitHub、MCP Registry、npm/Registry 与精选社区条目"}</p></section>
    <section className="card knowledge-panel"><div className="knowledge-panel-head"><div><h2>具体模型目录</h2><p className="muted">调用时使用“模型 ID”列，不要把展示名称当作 API 参数。Preview/Deprecated 模型会明确标记。</p></div></div><div className="model-directory">{(status?.models || []).map((model) => <article className="model-directory-row" key={model.id}><div><strong>{model.name}</strong><span className="muted">{model.vendor || "未知厂商"} · <code>{model.modelId}</code></span></div><div className="model-meta"><span>{model.lifecycle || "待确认"}</span><span>{model.contextWindow || "上下文待查"}</span><span>{(model.modalities || []).join(" / ") || "文本能力"}</span><a href={model.sourceUrl} target="_blank" rel="noreferrer">来源 ↗</a></div><small className="muted">快照：{model.updatedAt}</small></article>)}</div></section></div></main>;
}
