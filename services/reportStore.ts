import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { ProjectReport } from "../types";

let db: Database.Database | null = null;

function dataDir() {
  return process.env.AGENTSCOPE_DIR || path.join(process.cwd(), ".agentscope");
}

function migrateLegacyReports(dir: string, reportsDb: Database.Database) {
  const legacyPath = path.join(dir, "knowledge.sqlite");
  if (!fs.existsSync(legacyPath)) return;
  let legacy: Database.Database | null = null;
  try {
    legacy = new Database(legacyPath, { readonly: true, fileMustExist: true });
    const table = legacy
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='project_reports'")
      .get() as { name?: string } | undefined;
    if (!table) return;
    const rows = legacy
      .prepare("SELECT project_id, report_json, updated_at FROM project_reports")
      .all() as Array<{ project_id: string; report_json: string; updated_at: string }>;
    if (!rows.length) return;
    const insert = reportsDb.prepare(
      "INSERT INTO project_reports (project_id, report_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(project_id) DO NOTHING",
    );
    reportsDb.transaction(() => {
      for (const row of rows) insert.run(row.project_id, row.report_json, row.updated_at);
    })();
  } catch {
    // Best-effort: new reports still work if the old table cannot be copied.
  } finally {
    try {
      legacy?.close();
    } catch {
      /* ignore */
    }
  }
}

function database() {
  if (db) return db;
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  // 报告独立存储：与知识库（knowledge.sqlite）分离，避免「重置知识库」连带删除历史报告。
  db = new Database(path.join(dir, "reports.sqlite"));
  db.exec("CREATE TABLE IF NOT EXISTS project_reports (project_id TEXT PRIMARY KEY, report_json TEXT NOT NULL, updated_at TEXT NOT NULL)");
  migrateLegacyReports(dir, db);
  return db;
}

export function getStoredReport(projectId: string): ProjectReport | null {
  const row = database().prepare("SELECT report_json FROM project_reports WHERE project_id = ?").get(projectId) as { report_json?: string } | undefined;
  if (!row?.report_json) return null;
  try { return JSON.parse(row.report_json) as ProjectReport; } catch { return null; }
}

export function saveStoredReport(projectId: string, report: ProjectReport) {
  database().prepare("INSERT INTO project_reports (project_id, report_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(project_id) DO UPDATE SET report_json=excluded.report_json, updated_at=excluded.updated_at").run(projectId, JSON.stringify(report), new Date().toISOString());
  return report;
}

export function deleteStoredReport(projectId: string) {
  database().prepare("DELETE FROM project_reports WHERE project_id = ?").run(projectId);
}
