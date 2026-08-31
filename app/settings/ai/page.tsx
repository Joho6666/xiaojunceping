"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CapabilityConnection, CapabilityId, ProviderConnection, ProviderId } from "../../../types";
const providers: [ProviderId, string, string, string][] = [
  ["openai", "OpenAI / Codex", "Codex CLI", "ChatGPT / OpenAI 连接"],
  ["anthropic", "Anthropic / Claude", "Claude CLI", "Claude Code 连接"],
  ["gemini", "Google / Gemini", "Gemini CLI", "Gemini CLI 连接"],
  [
    "deepseek",
    "DeepSeek / 火山方舟",
    "OpenAI-compatible API",
    "自动识别 DeepSeek 官方或火山方舟 API",
  ],
  ["custom", "自定义模型供应商", "OpenAI-compatible API", "填写供应商 Base URL、API Key 和模型 ID"],
];
const capabilities: [CapabilityId, string, string][] = [
  ["web-search", "浏览器搜索", "为研究 Agent 提供实时网页搜索能力"],
  ["github", "GitHub", "使用 GitHub API 搜索仓库、读取活跃度和项目元数据"],
  ["browser", "浏览器操作", "Playwright / Browser Use，支持网页验证和 E2E 测试"],
  ["mcp", "MCP Server", "连接外部 MCP 工具和项目专用工具能力"],
  ["filesystem", "受控文件访问", "允许 Agent 在授权目录内读取和修改文件"],
  ["terminal", "受控终端执行", "允许 Agent 执行构建、测试和诊断命令"],
];
export default function AISettings() {
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [capabilityConnections, setCapabilityConnections] = useState<CapabilityConnection[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [apiKey, setApiKey] = useState<Record<string, string>>({});
  const [baseUrl, setBaseUrl] = useState<Record<string, string>>({});
  const [model, setModel] = useState<Record<string, string>>({
    deepseek: "deepseek-v4-flash",
  });
  const [codexModels, setCodexModels] = useState<{ id: string; label: string }[]>([]);
  const [capabilitySecret, setCapabilitySecret] = useState<Record<string, string>>({});
  const [capabilityEndpoint, setCapabilityEndpoint] = useState<Record<string, string>>({});
  const router = useRouter();
  const load = async () => {
    try {
      const response = await fetch("/api/connections");
      if (response.ok) setConnections((await response.json()).connections);
      const capabilityResponse = await fetch("/api/capabilities");
      if (capabilityResponse.ok) setCapabilityConnections((await capabilityResponse.json()).capabilities);
    } catch {
      setMessage("连接状态加载失败，请刷新页面重试。");
    }
  };
  const saveCapabilityConfig = async (id: CapabilityId) => {
    setBusy(id);
    try {
      const response = await fetch("/api/capabilities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, secret: capabilitySecret[id], endpoint: capabilityEndpoint[id] }) });
      const data = await response.json();
      setMessage(response.ok ? `${data.capability.name} 配置已保存，请点击测试连接。` : `配置失败：${data.error || "未知错误"}`);
      if (response.ok) { setCapabilitySecret((current) => ({ ...current, [id]: "" })); await load(); }
    } catch {
      setMessage("配置保存失败，请检查网络后重试。");
    } finally {
      setBusy("");
    }
  };
  const testCapability = async (id: CapabilityId) => {
    setBusy(id);
    try {
      const response = await fetch(`/api/capabilities/${id}/test`, { method: "POST" });
      const data = await response.json();
      setMessage(data.message || "能力测试完成");
      await load();
    } catch {
      setMessage("能力测试失败，请稍后重试。");
    } finally {
      setBusy("");
    }
  };
  const removeCapability = async (id: CapabilityId) => {
    try { await fetch(`/api/capabilities/${id}`, { method: "DELETE" }); await load(); setMessage("能力配置已移除"); } catch { setMessage("能力配置移除失败，请重试。"); }
  };
  useEffect(() => {
    load();
    fetch("/api/connections/provider/openai/cli/models")
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (data?.models?.length) {
          setCodexModels(data.models);
          setModel((current) => ({ ...current, openai: current.openai || data.models[0].id }));
        }
      })
      .catch(() => undefined);
  }, []);
  const updateKey = (provider: ProviderId, value: string) => {
    setApiKey((current) => ({ ...current, [provider]: value }));
    if (provider === "deepseek" && /^ark/i.test(value.trim())) {
      setBaseUrl((current) => ({
        ...current,
        deepseek: "https://ark.cn-beijing.volces.com/api/v3",
      }));
      setMessage("已识别为火山方舟 Key，并自动切换方舟 Base URL。");
    }
  };
  const check = async (provider: ProviderId) => {
    if (provider === "deepseek") {
      setMessage("DeepSeek 通过 API Key 连接，不需要本地 CLI。");
      return;
    }
    setBusy(provider);
    try {
      const response = await fetch(
        `/api/connections/provider/${provider}/cli/check`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: model[provider] || undefined }) },
      );
      const data = await response.json();
      setMessage(data.health?.message || data.message || "检查完成");
      await load();
    } catch {
      setMessage("连接检查失败，请确认本地 CLI 已安装并完成登录。");
    } finally {
      setBusy("");
    }
  };
  const connectKey = async (provider: ProviderId) => {
    setBusy(provider);
    try {
      const response = await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiKey: apiKey[provider] || "",
          baseUrl: baseUrl[provider],
          model: model[provider],
        }),
      });
      const data = await response.json();
      setMessage(
        response.ok
          ? `${provider} API 已保存，正在验证连接…`
          : data.error === "API_KEY_REQUIRED"
            ? "请输入 API Key"
            : data.error === "API_KEY_INVALID_FORMAT"
              ? "这不是有效的 API Key。请勿把模型 ID 填入 Key 输入框。"
            : data.error === "BASE_URL_REQUIRED"
              ? "自定义供应商必须填写 Base URL。"
              : `连接失败：${data.error}`,
      );
      if (response.ok) {
        setApiKey((x) => ({ ...x, [provider]: "" }));
        await load();
        await test(data.connection.id);
      }
    } catch {
      setMessage("连接保存失败，请检查网络后重试。");
    } finally {
      setBusy("");
    }
  };
  async function test(id: string) {
    setBusy(id);
    try {
      const response = await fetch(`/api/connections/${id}/test`, {
        method: "POST",
      });
      const data = await response.json();
      setMessage(data.message || (data.ok ? "连接测试成功" : "连接测试失败"));
      await load();
    } catch {
      setMessage("连接测试失败，请稍后重试");
    } finally {
      setBusy("");
    }
  }
  const oauth = async (provider: ProviderId) => {
    try {
      const response = await fetch(
        `/api/connections/provider/${provider}/oauth/start`,
      );
      const data = await response.json();
      setMessage(
        data.message || "当前暂不支持网页 OAuth，请使用本地 CLI 或 API Key。",
      );
    } catch {
      setMessage("OAuth 状态查询失败，请稍后重试。");
    }
  };
  const remove = async (id: string) => {
    try {
      await fetch(`/api/connections/${id}`, { method: "DELETE" });
      await load();
      setMessage("连接已断开");
    } catch {
      setMessage("断开连接失败，请重试。");
    }
  };
  return (
    <main>
      <div className="content settings-page">
        <button className="btn" onClick={() => router.back()}>
          ← 返回
        </button>
        <div className="eyebrow">小君AI测评 · Settings</div>
        <h1>AI 配置</h1>
        <p className="muted">
          连接你已经登录的本地 CLI，或配置 OpenAI-compatible
          API。密钥不会写入浏览器 localStorage。
        </p>
        {message && <div className="settings-message">{message}</div>}
        <section className="settings-grid">
          {providers.map(([id, name, cli, desc]) => {
            const connection = connections.find((x) => x.provider === id);
            const isApiProvider = id === "deepseek" || id === "custom";
            return (
              <article className="card provider-card" key={id}>
                <div className="provider-head">
                  <div>
                    <span className="mono tiny">{id.toUpperCase()}</span>
                    <h2>{name}</h2>
                    <p>{desc}</p>
                  </div>
                  <span
                    className={`status-chip ${connection?.status === "connected" ? "good" : "warn"}`}
                  >
                    {connection?.status === "connected"
                      ? "已验证"
                      : connection?.status === "error"
                        ? "验证失败"
                        : connection
                          ? "待验证"
                          : "未连接"}
                  </span>
                </div>
                {!isApiProvider && (
                  <div className="provider-actions">
                    <button
                      className="btn primary"
                      disabled={busy === id}
                      onClick={() => check(id)}
                    >
                      {busy === id ? "检查中…" : `连接 ${cli}`}
                    </button>
                    <button className="btn" onClick={() => oauth(id)}>
                      网页 OAuth
                    </button>
                  </div>
                )}
                {id === "openai" && (
                  <select className="settings-input" value={model[id] || ""} onChange={(e) => setModel((x) => ({ ...x, [id]: e.target.value }))}>
                    {!codexModels.length && <option value="">正在读取 Codex 模型…</option>}
                    {codexModels.map((item) => <option value={item.id} key={item.id}>{item.label} · {item.id}</option>)}
                  </select>
                )}
                <div className="api-key-row">
                  <input
                    type="password"
                    value={apiKey[id] || ""}
                    onChange={(e) => updateKey(id, e.target.value)}
                    placeholder="API Key（仅发送到服务端）"
                  />
                  <button
                    className="btn"
                    disabled={busy === id}
                    onClick={() => connectKey(id)}
                  >
                    保存
                  </button>
                </div>
                {isApiProvider && (
                  <>
                    <input
                      className="settings-input"
                      value={baseUrl[id] || ""}
                      onChange={(e) =>
                        setBaseUrl((x) => ({ ...x, [id]: e.target.value }))
                      }
                      placeholder={id === "deepseek" ? "Base URL：DeepSeek 官方或火山方舟（ark Key 自动识别）" : "Base URL，例如 https://api.example.com/v1"}
                    />
                    <input
                      className="settings-input"
                      value={model[id] || ""}
                      onChange={(e) =>
                        setModel((x) => ({ ...x, [id]: e.target.value }))
                      }
                      placeholder={id === "deepseek" ? "模型 ID，例如 deepseek-v4-flash" : "模型 ID，例如 provider-model-name"}
                    />
                  </>
                )}
                {connection && (
                  <div className="connection-row">
                    <span>
                      {connection.mode === "cli" ? "本地 CLI" : "API Key"} ·{" "}
                      {connection.displayName} · {connection.model}
                      {connection.baseUrl ? ` · ${connection.baseUrl}` : ""}
                    </span>
                    <button
                      className="btn"
                      disabled={busy === connection.id}
                      onClick={() => test(connection.id)}
                    >
                      测试连接
                    </button>
                    <button
                      className="text-link button-link"
                      onClick={() => remove(connection.id)}
                    >
                      断开
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </section>
        <section className="card capability-panel">
          <div className="provider-head">
            <div><span className="mono tiny">TOOLS & RESEARCH</span><h2>工具与研究能力</h2><p>这些能力会在项目分析时被实际检查和使用。密钥只发送到服务端，不写入浏览器。</p></div>
          </div>
          <div className="capability-grid">
            {capabilities.map(([id, name, desc]) => {
              const connection = capabilityConnections.find((item) => item.id === id);
              const needsSecret = id === "web-search" || id === "github";
              const needsEndpoint = id === "web-search" || id === "mcp";
              return <article className="card capability-card" key={id}>
                <div className="provider-head"><div><h3>{name}</h3><p>{desc}</p></div><span className={`status-chip ${connection?.status === "connected" ? "good" : "warn"}`}>{connection?.status === "connected" ? "已验证" : connection ? "待测试" : "未配置"}</span></div>
                {needsSecret && <input type="password" value={capabilitySecret[id] || ""} onChange={(event) => setCapabilitySecret((current) => ({ ...current, [id]: event.target.value }))} placeholder={id === "github" ? "GitHub Token（仅发送到服务端）" : "搜索 API Key（仅发送到服务端）"} />}
                {needsEndpoint && <input className="settings-input" value={capabilityEndpoint[id] || ""} onChange={(event) => setCapabilityEndpoint((current) => ({ ...current, [id]: event.target.value }))} placeholder={id === "mcp" ? "MCP Server URL" : "搜索 API Endpoint（可选）"} />}
                <div className="provider-actions"><button className="btn" disabled={busy === id} onClick={() => saveCapabilityConfig(id)}>{busy === id ? "保存中…" : "保存配置"}</button><button className="btn" disabled={busy === id || !connection} onClick={() => testCapability(id)}>测试能力</button>{connection && <button className="text-link button-link" onClick={() => removeCapability(id)}>移除</button>}</div>
              </article>;
            })}
          </div>
        </section>
        <section className="card settings-note">
          <h2>授权说明</h2>
          <p>
            DeepSeek 官方 Key（通常以 sk- 开头）使用
            `https://api.deepseek.com/v1`；火山方舟 Key（以 ark
            开头）使用 `https://ark.cn-beijing.volces.com/api/v3`。系统会自动识别
            ark Key，但模型 ID 仍需填写为对应平台实际可用的模型或接入点 ID。
          </p>
          <p>
            本地 CLI 不读取 OAuth
            文件。正式部署时应配置服务端加密密钥，将连接凭据加密保存到数据库。
          </p>
        </section>
      </div>
    </main>
  );
}

