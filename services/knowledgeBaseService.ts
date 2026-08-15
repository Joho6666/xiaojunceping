import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { KnowledgeItem, KnowledgeKind, KnowledgeSyncRun } from "../types";
import { additionalKnowledgeCatalog, expandedKnowledgeCatalog, modelKnowledgeCatalog } from "../data/knowledgeCatalog";
import { knowledgeCatalogExpansion } from "../data/knowledgeCatalogExpansion";

type KnowledgeRow = Omit<KnowledgeItem, "capabilities" | "tags" | "stack" | "platforms" | "modelId" | "contextWindow" | "maxOutput" | "modalities" | "modelCapabilities" | "lifecycle" | "aliases" | "pricingDetails" | "sourceUpdatedAt"> & {
  capabilities: string;
  tags: string;
  stack: string;
  platforms: string;
  modalities: string | null;
  model_capabilities: string | null;
  aliases: string | null;
  pricing_details: string | null;
  model_id: string | null;
  context_window: string | null;
  max_output: string | null;
  lifecycle: string | null;
  source_updated_at: string | null;
};

let db: Database.Database | null = null;

function database() {
  if (db) return db;
  const dir = path.join(process.cwd(), ".agentscope");
  fs.mkdirSync(dir, { recursive: true });
  db = new Database(path.join(dir, "knowledge.sqlite"));
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_items (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      vendor TEXT,
      version TEXT,
      summary TEXT NOT NULL,
      url TEXT,
      github_url TEXT,
      capabilities TEXT NOT NULL,
      tags TEXT NOT NULL,
      stack TEXT NOT NULL,
      platforms TEXT NOT NULL,
      license TEXT,
      access TEXT,
      pricing TEXT,
      source_type TEXT NOT NULL,
      source_url TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      verified_at TEXT,
      confidence TEXT NOT NULL,
      publication TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS knowledge_sync_runs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      inserted INTEGER NOT NULL DEFAULT 0,
      updated INTEGER NOT NULL DEFAULT 0,
      rejected INTEGER NOT NULL DEFAULT 0,
      error TEXT
    );
  `);
  for (const column of [
    "model_id TEXT", "context_window TEXT", "max_output TEXT", "modalities TEXT",
    "model_capabilities TEXT", "lifecycle TEXT", "aliases TEXT", "pricing_details TEXT", "source_updated_at TEXT",
  ]) {
    try { db.exec(`ALTER TABLE knowledge_items ADD COLUMN ${column}`); } catch { /* already migrated */ }
  }
  seedIfEmpty(db);
  seedMissing(db);
  return db;
}

const baseSeed: KnowledgeItem[] = [
  { id: "official-nextjs", kind: "ai-tool", name: "Next.js", vendor: "Vercel", summary: "React 全栈 Web 框架，适合电商、SaaS 和内容型网站。", url: "https://nextjs.org/", capabilities: ["Web 应用", "SSR", "API 路由"], tags: ["web", "电商", "saas"], stack: ["TypeScript", "React"], platforms: ["Web"], license: "MIT", access: "npm", pricing: "开源", sourceType: "official", sourceUrl: "https://nextjs.org/docs", updatedAt: "2026-08-01", verifiedAt: "2026-08-01", confidence: "高", publication: "published", status: "active" },
  { id: "official-supabase", kind: "ai-tool", name: "Supabase", vendor: "Supabase", summary: "提供数据库、身份认证、存储和实时能力，适合快速搭建交易型 Web 产品。", url: "https://supabase.com/", capabilities: ["数据库", "认证", "文件存储"], tags: ["web", "电商", "saas", "backend"], stack: ["PostgreSQL", "TypeScript"], platforms: ["Web"], license: "Apache-2.0", access: "Cloud / Self-host", pricing: "有免费层", sourceType: "official", sourceUrl: "https://supabase.com/docs", updatedAt: "2026-08-01", verifiedAt: "2026-08-01", confidence: "高", publication: "published", status: "active" },
  { id: "official-ffmpeg", kind: "ai-tool", name: "FFmpeg", summary: "媒体转码、剪辑、字幕和音视频处理的基础工具链。", url: "https://ffmpeg.org/", capabilities: ["视频转码", "音频处理", "字幕"], tags: ["video", "media"], stack: ["C", "CLI"], platforms: ["Windows", "macOS", "Linux"], license: "LGPL/GPL", access: "CLI", pricing: "开源", sourceType: "official", sourceUrl: "https://ffmpeg.org/documentation.html", updatedAt: "2026-08-01", verifiedAt: "2026-08-01", confidence: "高", publication: "published", status: "active" },
  { id: "github-n8n", kind: "github", name: "n8n", vendor: "n8n", summary: "连接 API、Webhook、数据库和 MCP 的可视化自动化平台。", url: "https://github.com/n8n-io/n8n", githubUrl: "https://github.com/n8n-io/n8n", capabilities: ["Workflow", "Webhook", "API", "MCP"], tags: ["automation", "api", "mcp"], stack: ["TypeScript", "Node.js"], platforms: ["Web", "Self-host"], license: "Sustainable Use License", access: "Cloud / Self-host", pricing: "有免费方案", sourceType: "github", sourceUrl: "https://github.com/n8n-io/n8n", updatedAt: "2026-08-01", verifiedAt: "2026-08-01", confidence: "高", publication: "published", status: "active" },
  { id: "github-saas-starter", kind: "github", name: "Next.js SaaS Starter", vendor: "Vercel", summary: "包含认证、订阅和数据库结构的 SaaS 起始项目，可参考电商后台和账户体系。", url: "https://github.com/vercel/nextjs-postgres-auth-starter", githubUrl: "https://github.com/vercel/nextjs-postgres-auth-starter", capabilities: ["认证", "后台", "订阅"], tags: ["web", "电商", "saas", "starter"], stack: ["Next.js", "PostgreSQL", "TypeScript"], platforms: ["Web"], license: "MIT", access: "GitHub", pricing: "开源", sourceType: "github", sourceUrl: "https://github.com/vercel/nextjs-postgres-auth-starter", updatedAt: "2026-08-01", verifiedAt: "2026-08-01", confidence: "高", publication: "published", status: "active" },
  { id: "official-github-mcp", kind: "mcp", name: "GitHub MCP Server", vendor: "GitHub", summary: "让 Agent 读取仓库、Issue、Pull Request 和代码上下文。", url: "https://github.com/github/github-mcp-server", githubUrl: "https://github.com/github/github-mcp-server", capabilities: ["仓库搜索", "Issue", "代码上下文"], tags: ["mcp", "github", "agent"], stack: ["MCP"], platforms: ["Web", "CLI"], license: "MIT", access: "MCP / Token", pricing: "需 GitHub 权限", sourceType: "official", sourceUrl: "https://github.com/github/github-mcp-server", updatedAt: "2026-08-01", verifiedAt: "2026-08-01", confidence: "高", publication: "published", status: "active" },
  { id: "official-codex", kind: "agent", name: "Codex", vendor: "OpenAI", summary: "适合多文件开发、终端操作、测试和 Debug 的 Coding Agent。", url: "https://openai.com/codex/", capabilities: ["代码实现", "终端", "测试"], tags: ["agent", "coding", "web", "automation"], stack: ["CLI"], platforms: ["Windows", "macOS", "Linux"], access: "CLI / OAuth", pricing: "按账户计划", sourceType: "official", sourceUrl: "https://openai.com/codex/", updatedAt: "2026-08-01", verifiedAt: "2026-08-01", confidence: "高", publication: "published", status: "active" },
  { id: "official-claude-code", kind: "agent", name: "Claude Code", vendor: "Anthropic", summary: "适合长上下文架构分析、代码审查和重构。", url: "https://docs.anthropic.com/en/docs/claude-code", capabilities: ["长上下文", "重构", "Review"], tags: ["agent", "coding", "review"], stack: ["CLI"], platforms: ["Windows", "macOS", "Linux"], access: "CLI / API", pricing: "按账户计划", sourceType: "official", sourceUrl: "https://docs.anthropic.com/en/docs/claude-code", updatedAt: "2026-08-01", confidence: "高", publication: "published", status: "active" },
  { id: "official-deepseek", kind: "llm", name: "DeepSeek", vendor: "DeepSeek", summary: "适合中文需求理解、研究规划和结构化评估。", url: "https://platform.deepseek.com/", capabilities: ["中文", "推理", "结构化 JSON"], tags: ["llm", "中文", "reasoning"], stack: ["API"], platforms: ["Cloud"], access: "API Key", pricing: "按 Token", sourceType: "official", sourceUrl: "https://platform.deepseek.com/api-docs/", updatedAt: "2026-08-01", confidence: "高", publication: "published", status: "active" },
];
const seed: KnowledgeItem[] = [...baseSeed, ...expandedKnowledgeCatalog, ...additionalKnowledgeCatalog, ...modelKnowledgeCatalog, ...knowledgeCatalogExpansion];

function parse(row: KnowledgeRow): KnowledgeItem {
  const raw = row as KnowledgeRow & Record<string, unknown>;
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    vendor: row.vendor || undefined,
    version: row.version || undefined,
    summary: row.summary,
    url: row.url || undefined,
    githubUrl: raw.github_url ? String(raw.github_url) : undefined,
    capabilities: JSON.parse(row.capabilities),
    tags: JSON.parse(row.tags),
    stack: JSON.parse(row.stack),
    platforms: JSON.parse(row.platforms),
    license: row.license || undefined,
    access: row.access || undefined,
    pricing: row.pricing || undefined,
    sourceType: raw.source_type as KnowledgeItem["sourceType"],
    sourceUrl: String(raw.source_url),
    updatedAt: String(raw.updated_at),
    verifiedAt: raw.verified_at ? String(raw.verified_at) : undefined,
    confidence: raw.confidence as KnowledgeItem["confidence"],
    publication: raw.publication as KnowledgeItem["publication"],
    status: raw.status as KnowledgeItem["status"],
    modelId: row.model_id || undefined,
    contextWindow: row.context_window || undefined,
    maxOutput: row.max_output || undefined,
    lifecycle: (row.lifecycle as KnowledgeItem["lifecycle"]) || undefined,
    sourceUpdatedAt: row.source_updated_at || undefined,
    modalities: row.modalities ? JSON.parse(row.modalities) : undefined,
    modelCapabilities: row.model_capabilities ? JSON.parse(row.model_capabilities) : undefined,
    aliases: row.aliases ? JSON.parse(row.aliases) : undefined,
    pricingDetails: row.pricing_details ? JSON.parse(row.pricing_details) : undefined,
  };
}

const columns = "id,kind,name,vendor,version,summary,url,github_url,capabilities,tags,stack,platforms,license,access,pricing,source_type,source_url,updated_at,verified_at,confidence,publication,status,model_id,context_window,max_output,modalities,model_capabilities,lifecycle,aliases,pricing_details,source_updated_at";
function bind(item: KnowledgeItem) {
  return { ...item, capabilities: JSON.stringify(item.capabilities), tags: JSON.stringify(item.tags), stack: JSON.stringify(item.stack), platforms: JSON.stringify(item.platforms), modalities: item.modalities ? JSON.stringify(item.modalities) : null, modelCapabilities: item.modelCapabilities ? JSON.stringify(item.modelCapabilities) : null, aliases: item.aliases ? JSON.stringify(item.aliases) : null, pricingDetails: item.pricingDetails ? JSON.stringify(item.pricingDetails) : null, githubUrl: item.githubUrl || null, vendor: item.vendor || null, version: item.version || null, url: item.url || null, license: item.license || null, access: item.access || null, pricing: item.pricing || null, verifiedAt: item.verifiedAt || null, modelId: item.modelId || null, contextWindow: item.contextWindow || null, maxOutput: item.maxOutput || null, lifecycle: item.lifecycle || null, sourceUpdatedAt: item.sourceUpdatedAt || null };
}

function seedIfEmpty(database: Database.Database) {
  const count = database.prepare("SELECT COUNT(*) as count FROM knowledge_items").get() as { count: number };
  if (count.count) return;
  const insert = database.prepare(`INSERT INTO knowledge_items (id,kind,name,vendor,version,summary,url,github_url,capabilities,tags,stack,platforms,license,access,pricing,source_type,source_url,updated_at,verified_at,confidence,publication,status,model_id,context_window,max_output,modalities,model_capabilities,lifecycle,aliases,pricing_details,source_updated_at) VALUES (@id,@kind,@name,@vendor,@version,@summary,@url,@githubUrl,@capabilities,@tags,@stack,@platforms,@license,@access,@pricing,@sourceType,@sourceUrl,@updatedAt,@verifiedAt,@confidence,@publication,@status,@modelId,@contextWindow,@maxOutput,@modalities,@modelCapabilities,@lifecycle,@aliases,@pricingDetails,@sourceUpdatedAt)`);
  const transaction = database.transaction(() => seed.forEach((item) => insert.run(bind(item))));
  transaction();
}

function seedMissing(database: Database.Database) {
  [...expandedKnowledgeCatalog, ...additionalKnowledgeCatalog, ...modelKnowledgeCatalog, ...knowledgeCatalogExpansion].forEach((item) => {
    upsertKnowledgeItem(item);
  });
}

export function listKnowledgeItems(kind?: KnowledgeKind) {
  // Published recommendations must have a verifiable HTTP source. This also
  // keeps older or malformed local imports out of reports without deleting the
  // user's local data; they can still be reviewed and corrected in the KB UI.
  const rows = (kind ? database().prepare("SELECT * FROM knowledge_items WHERE kind = ? AND publication = 'published' AND status != 'invalid' AND source_url LIKE 'http%'").all(kind) : database().prepare("SELECT * FROM knowledge_items WHERE publication = 'published' AND status != 'invalid' AND source_url LIKE 'http%'").all()) as KnowledgeRow[];
  return rows.map(parse);
}

export function upsertKnowledgeItem(item: KnowledgeItem) {
  const databaseInstance = database();
  databaseInstance.prepare(`INSERT INTO knowledge_items (id,kind,name,vendor,version,summary,url,github_url,capabilities,tags,stack,platforms,license,access,pricing,source_type,source_url,updated_at,verified_at,confidence,publication,status,model_id,context_window,max_output,modalities,model_capabilities,lifecycle,aliases,pricing_details,source_updated_at) VALUES (@id,@kind,@name,@vendor,@version,@summary,@url,@githubUrl,@capabilities,@tags,@stack,@platforms,@license,@access,@pricing,@sourceType,@sourceUrl,@updatedAt,@verifiedAt,@confidence,@publication,@status,@modelId,@contextWindow,@maxOutput,@modalities,@modelCapabilities,@lifecycle,@aliases,@pricingDetails,@sourceUpdatedAt) ON CONFLICT(id) DO UPDATE SET name=@name,vendor=@vendor,version=@version,summary=@summary,url=@url,github_url=@githubUrl,capabilities=@capabilities,tags=@tags,stack=@stack,platforms=@platforms,license=@license,access=@access,pricing=@pricing,source_type=@sourceType,source_url=@sourceUrl,updated_at=@updatedAt,verified_at=@verifiedAt,confidence=@confidence,publication=@publication,status=@status,model_id=@modelId,context_window=@contextWindow,max_output=@maxOutput,modalities=@modalities,model_capabilities=@modelCapabilities,lifecycle=@lifecycle,aliases=@aliases,pricing_details=@pricingDetails,source_updated_at=@sourceUpdatedAt`).run(bind(item));
}

export function latestSync(): KnowledgeSyncRun | null {
  const row = database().prepare("SELECT * FROM knowledge_sync_runs ORDER BY started_at DESC LIMIT 1").get() as Record<string, unknown> | undefined;
  if (!row) return null;
  return { id: String(row.id), status: row.status as KnowledgeSyncRun["status"], startedAt: String(row.started_at), completedAt: row.completed_at ? String(row.completed_at) : undefined, inserted: Number(row.inserted), updated: Number(row.updated), rejected: Number(row.rejected), error: row.error ? String(row.error) : undefined };
}

export function createSyncRun(): KnowledgeSyncRun {
  const run = { id: crypto.randomUUID(), status: "running" as const, startedAt: new Date().toISOString(), inserted: 0, updated: 0, rejected: 0 };
  database().prepare("INSERT INTO knowledge_sync_runs (id,status,started_at,inserted,updated,rejected) VALUES (?,?,?,?,?,?)").run(run.id, run.status, run.startedAt, 0, 0, 0);
  return run;
}

export function finishSyncRun(run: KnowledgeSyncRun, patch: Partial<KnowledgeSyncRun>) {
  const next = { ...run, ...patch, completedAt: new Date().toISOString() };
  database().prepare("UPDATE knowledge_sync_runs SET status=?,completed_at=?,inserted=?,updated=?,rejected=?,error=? WHERE id=?").run(next.status, next.completedAt, next.inserted, next.updated, next.rejected, next.error || null, next.id);
  return next;
}
