import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { CapabilityConnection, CapabilityId, ConnectionStatus } from "../types";

type CapabilityRecord = CapabilityConnection & { secret?: string };
const records = new Map<CapabilityId, CapabilityRecord>();
const file = path.join(process.cwd(), ".agentscope", "capabilities.enc");
const definitions: Record<CapabilityId, { name: string; mode: CapabilityRecord["mode"] }> = {
  "web-search": { name: "浏览器搜索", mode: "api-key" },
  github: { name: "GitHub 公共 API", mode: "api-key" },
  browser: { name: "浏览器操作 / Playwright", mode: "local" },
  mcp: { name: "MCP Server", mode: "url" },
  filesystem: { name: "受控文件访问", mode: "local" },
  terminal: { name: "受控终端执行", mode: "local" },
};
function key() { const raw = process.env.DATABASE_ENCRYPTION_KEY?.trim(); return raw ? (Buffer.from(raw, "hex").length === 32 && /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : crypto.createHash("sha256").update(raw).digest()) : null; }
function persist() { const secretKey = key(); if (!secretKey) return; const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", secretKey, iv); const data = Buffer.concat([cipher.update(JSON.stringify(Array.from(records.values())), "utf8"), cipher.final()]); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify({ iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") }), { encoding: "utf8", mode: 0o600 }); }
function restore() { const secretKey = key(); if (!secretKey || !fs.existsSync(file)) return; try { const payload = JSON.parse(fs.readFileSync(file, "utf8")); const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey, Buffer.from(payload.iv, "base64")); decipher.setAuthTag(Buffer.from(payload.tag, "base64")); const rows = JSON.parse(Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]).toString("utf8")) as CapabilityRecord[]; rows.forEach((row) => records.set(row.id, row)); } catch { records.clear(); } }
restore();
if (records.has("browser")) {
  const runtimeInstalled = fs.existsSync(path.join(process.cwd(), "node_modules", "playwright", "package.json")) || fs.existsSync(path.join(process.cwd(), "node_modules", "playwright-core", "package.json"));
  if (!runtimeInstalled) {
    const row = records.get("browser");
    if (row) records.set("browser", { ...row, status: "error", errorCode: "BROWSER_RUNTIME_NOT_INSTALLED", lastCheckedAt: new Date().toISOString() });
  }
}
export function listCapabilities(): CapabilityConnection[] {
  // Never return credentials or configured MCP URLs to the browser. The URL may
  // contain a query-string token (for example a hosted MCP API key).
  return Array.from(records.values()).map(({ secret: _secret, endpoint: _endpoint, ...publicRecord }) => publicRecord);
}
export function getCapabilitySecret(id: CapabilityId) { return records.get(id)?.secret; }
export function saveCapability(id: CapabilityId, secret?: string, endpoint?: string) { const definition = definitions[id]; if (!definition) return null; const row: CapabilityRecord = { id, name: definition.name, mode: definition.mode, status: "unavailable", secret: secret?.trim() || undefined, endpoint: endpoint?.trim() || undefined, lastCheckedAt: new Date().toISOString() }; records.set(id, row); persist(); return row; }
export function setCapabilityStatus(id: CapabilityId, status: ConnectionStatus, errorCode?: string) { const row = records.get(id); if (!row) return null; const updated = { ...row, status, errorCode, lastCheckedAt: new Date().toISOString() }; records.set(id, updated); persist(); return updated; }
export function removeCapability(id: CapabilityId) { records.delete(id); persist(); }
export function capabilityDefinition(id: CapabilityId) { return definitions[id]; }
