"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProviderConnection, ProviderId } from "../../../types";
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
];
export default function AISettings() {
  const [connections, setConnections] = useState<ProviderConnection[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [apiKey, setApiKey] = useState<Record<string, string>>({});
  const [baseUrl, setBaseUrl] = useState<Record<string, string>>({});
  const [model, setModel] = useState<Record<string, string>>({
    deepseek: "deepseek-chat",
  });
  const router = useRouter();
  const load = async () => {
    const response = await fetch("/api/connections");
    if (response.ok) setConnections((await response.json()).connections);
  };
  useEffect(() => {
    load();
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
        { method: "POST" },
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
          : `连接失败：${data.error}`,
    );
    if (response.ok) {
      setApiKey((x) => ({ ...x, [provider]: "" }));
      await load();
      await test(data.connection.id);
    }
    setBusy("");
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
    const response = await fetch(
      `/api/connections/provider/${provider}/oauth/start`,
    );
    const data = await response.json();
    setMessage(
      data.message || "当前暂不支持网页 OAuth，请使用本地 CLI 或 API Key。",
    );
  };
  const remove = async (id: string) => {
    await fetch(`/api/connections/${id}`, { method: "DELETE" });
    await load();
    setMessage("连接已断开");
  };
  return (
    <main>
      <div className="content settings-page">
        <button className="btn" onClick={() => router.back()}>
          ← 返回
        </button>
        <div className="eyebrow">AgentScope Settings</div>
        <h1>AI 配置</h1>
        <p className="muted">
          连接你已经登录的本地 CLI，或配置 OpenAI-compatible
          API。密钥不会写入浏览器 localStorage。
        </p>
        {message && <div className="settings-message">{message}</div>}
        <section className="settings-grid">
          {providers.map(([id, name, cli, desc]) => {
            const connection = connections.find((x) => x.provider === id);
            const isDeepSeek = id === "deepseek";
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
                {!isDeepSeek && (
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
                {isDeepSeek && (
                  <>
                    <input
                      className="settings-input"
                      value={baseUrl[id] || ""}
                      onChange={(e) =>
                        setBaseUrl((x) => ({ ...x, [id]: e.target.value }))
                      }
                      placeholder="Base URL：DeepSeek 官方或火山方舟（ark Key 自动识别）"
                    />
                    <input
                      className="settings-input"
                      value={model[id] || ""}
                      onChange={(e) =>
                        setModel((x) => ({ ...x, [id]: e.target.value }))
                      }
                      placeholder="模型 ID，例如 deepseek-chat"
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
