import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

let db: Database.Database | null = null;

function dataDir() {
  return process.env.AGENTSCOPE_DIR || path.join(process.cwd(), ".agentscope");
}

function database() {
  if (db) return db;
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  db = new Database(path.join(dir, "embeddings.sqlite"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS embeddings (
      item_id TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      model TEXT NOT NULL,
      vector TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (item_id, model)
    );
  `);
  return db;
}

export function resetEmbeddingCacheForTests() {
  db = null;
}

export function contentHash(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export function getCachedEmbedding(itemId: string, model: string, hash: string): number[] | null {
  try {
    const row = database()
      .prepare("SELECT vector, content_hash FROM embeddings WHERE item_id = ? AND model = ?")
      .get(itemId, model) as { vector?: string; content_hash?: string } | undefined;
    if (!row?.vector || row.content_hash !== hash) return null;
    return JSON.parse(row.vector) as number[];
  } catch {
    return null;
  }
}

export function setCachedEmbedding(itemId: string, model: string, hash: string, vector: number[]) {
  database()
    .prepare("INSERT INTO embeddings (item_id, content_hash, model, vector, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(item_id, model) DO UPDATE SET content_hash=excluded.content_hash, vector=excluded.vector, updated_at=excluded.updated_at")
    .run(itemId, hash, model, JSON.stringify(vector), new Date().toISOString());
}
