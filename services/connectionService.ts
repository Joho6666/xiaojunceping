import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  ConnectionMode,
  ConnectionStatus,
  ProviderConnection,
  ProviderId,
} from "../types";
import { checkCLI } from "../ai/cli/cliHealthCheck";
import { codexCliAdapter, listCodexModels } from "../ai/cli/codexCliAdapter";

const connections = new Map<string, ProviderConnection>();
const secrets = new Map<string, string>();
const storageFile = path.join(
  process.cwd(),
  ".agentscope",
  "provider-connections.enc",
);
const defaults: Record<
  ProviderId,
  { baseUrl: string; model: string; label: string }
> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: process.env.AI_REASONING_MODEL || "gpt-4o-mini",
    label: "OpenAI API",
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-3-5-sonnet-latest",
    label: "Anthropic API",
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-2.0-flash",
    label: "Gemini API",
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-v4-flash",
    label: "DeepSeek API",
  },
  custom: {
    baseUrl: "",
    model: "",
    label: "自定义 OpenAI-compatible API",
  },
};
const ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

function id() {
  return crypto.randomUUID();
}
function masked(value: string) {
  return value.length < 8
    ? "••••••••"
    : `${value.slice(0, 3)}••••${value.slice(-4)}`;
}
function looksLikeApiKey(provider: ProviderId, value: string) {
  const key = value.trim();
  if (provider !== "deepseek") return key.length >= 12;
  return key.length >= 16 && !/^deepseek-/i.test(key);
}
function apiConfig(
  provider: ProviderId,
  apiKey: string,
  baseUrl?: string,
  model?: string,
) {
  const fallback = defaults[provider];
  const isArk = provider === "deepseek" && /^ark/i.test(apiKey.trim());
  const supplied = (baseUrl || "").replace(/\/$/, "");
  const normalizedBase =
    isArk && (!supplied || supplied === "https://api.deepseek.com/v1")
      ? ARK_BASE_URL
      : supplied || fallback.baseUrl;
  return {
    baseUrl: normalizedBase,
    model: model || fallback.model,
    label: isArk ? "火山方舟 / DeepSeek" : fallback.label,
  };
}
function encryptionKey() {
  const raw = process.env.DATABASE_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  return /^[a-f0-9]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : crypto.createHash("sha256").update(raw).digest();
}
function persist() {
  const key = encryptionKey();
  if (!key) return;
  const iv = crypto.randomBytes(12),
    cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify({
    connections: Array.from(connections.values()),
    secrets: Array.from(secrets.entries()),
  });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const payload = JSON.stringify({
    v: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64"),
  });
  fs.mkdirSync(path.dirname(storageFile), { recursive: true });
  fs.writeFileSync(storageFile, payload, { encoding: "utf8", mode: 0o600 });
}
function restore() {
  const key = encryptionKey();
  if (!key || !fs.existsSync(storageFile)) return;
  try {
    const payload = JSON.parse(fs.readFileSync(storageFile, "utf8")) as {
      iv: string;
      tag: string;
      data: string;
    };
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(payload.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
    const parsed = JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(payload.data, "base64")),
        decipher.final(),
      ]).toString("utf8"),
    ) as {
      connections: ProviderConnection[];
      secrets: Array<[string, string]>;
    };
    parsed.connections.forEach((item) => connections.set(item.id, item));
    parsed.secrets.forEach(([connectionId, secret]) =>
      secrets.set(connectionId, secret),
    );
    for (const item of Array.from(connections.values())) {
      const secret = secrets.get(item.id);
      if (item.mode === "api-key" && secret) {
        const config = apiConfig(
          item.provider,
          secret,
          item.baseUrl,
          item.model,
        );
        connections.set(item.id, {
          ...item,
          baseUrl: config.baseUrl,
          model: config.model,
          displayName: config.label,
          status: looksLikeApiKey(item.provider, secret) ? item.status : "error",
          errorCode: looksLikeApiKey(item.provider, secret)
            ? item.errorCode
            : "API_KEY_INVALID_FORMAT",
        });
      }
    }
    persist();
  } catch {
    connections.clear();
    secrets.clear();
  }
}
restore();
export function listConnections() {
  return Array.from(connections.values());
}
export async function checkProviderCLI(provider: ProviderId, model?: string) {
  const status = provider === "openai" ? await codexCliAdapter.healthCheck() : await checkCLI(provider);
  if (provider === "openai" && model?.trim()) {
    // The model string is later passed as a CLI argument. Validate it even
    // when the CLI is installed but not logged in — otherwise an unchecked
    // value would be stored on the connection and reach the command line.
    if (!/^[\w.-]+$/.test(model.trim())) {
      return { connection: null, health: { ...status, available: false, message: "模型 ID 只能包含字母、数字、点、下划线和连字符。" } };
    }
    try {
      const models = await listCodexModels();
      if (models.length && !models.some((item) => item.id === model.trim())) {
        return { connection: null, health: { ...status, available: false, message: `模型 ${model.trim()} 不在当前 Codex CLI 可用列表中，请重新选择。`, availableModels: models } };
      }
    } catch {
      return { connection: null, health: { ...status, available: false, message: "无法读取 Codex CLI 模型列表，请稍后重试。" } };
    }
  }
  const existing = listConnections().find(
    (x) => x.provider === provider && x.mode === "cli",
  );
  if (status.available) {
    const connection = existing || {
      id: id(),
      provider,
      mode: "cli" as ConnectionMode,
      status: "connected" as ConnectionStatus,
      displayName: provider === "openai" ? "Codex CLI · ChatGPT OAuth" : `${provider} CLI`,
      model: model?.trim() || undefined,
      lastCheckedAt: new Date().toISOString(),
    };
    const updated = {
      ...connection,
      status: "connected" as ConnectionStatus,
      lastCheckedAt: new Date().toISOString(),
      errorCode: undefined,
      model: model?.trim() || connection.model,
    };
    connections.set(updated.id, updated);
    return { connection: updated, health: status };
  }
  return {
    connection: existing
      ? {
          ...existing,
          status: "unavailable" as ConnectionStatus,
          lastCheckedAt: new Date().toISOString(),
          errorCode: status.message,
        }
      : null,
    health: status,
  };
}

export async function getCodexModelOptions() {
  return listCodexModels();
}
export function addApiKey(
  provider: ProviderId,
  apiKey: string,
  baseUrl?: string,
  model?: string,
) {
  if (!apiKey.trim()) throw new Error("API_KEY_REQUIRED");
  if (provider === "custom" && !baseUrl?.trim()) throw new Error("BASE_URL_REQUIRED");
  if (!looksLikeApiKey(provider, apiKey))
    throw new Error("API_KEY_INVALID_FORMAT");
  for (const item of listConnections().filter(
    (item) => item.provider === provider && item.mode === "api-key",
  )) {
    connections.delete(item.id);
    secrets.delete(item.id);
  }
  const config = apiConfig(provider, apiKey, baseUrl, model);
  const connection: ProviderConnection = {
    id: id(),
    provider,
    mode: "api-key",
    status: "unavailable",
    displayName: config.label,
    maskedKey: masked(apiKey),
    baseUrl: config.baseUrl,
    model: config.model,
    lastCheckedAt: new Date().toISOString(),
  };
  connections.set(connection.id, connection);
  secrets.set(connection.id, apiKey);
  persist();
  return connection;
}
export function setConnectionStatus(
  connectionId: string,
  status: ConnectionStatus,
  errorCode?: string,
) {
  const connection = connections.get(connectionId);
  if (!connection) return null;
  const updated: ProviderConnection = {
    ...connection,
    status,
    errorCode,
    lastCheckedAt: new Date().toISOString(),
  };
  connections.set(connectionId, updated);
  persist();
  return updated;
}
export function removeConnection(connectionId: string) {
  connections.delete(connectionId);
  secrets.delete(connectionId);
  persist();
}
export function getSecret(connectionId: string) {
  return secrets.get(connectionId);
}
export function oauthUnavailable(provider: ProviderId) {
  return {
    provider,
    status: "unavailable" as const,
    code: "OAUTH_NOT_CONFIGURED",
    message: `${provider} 当前未配置官方 OAuth Client，请使用本地 CLI 或 API Key。`,
  };
}

