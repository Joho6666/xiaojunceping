import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { ProjectReport } from "../types";

let db: Database.Database | null = null;
function database() {
  if (db) return db;
  const dir = path.join(process.cwd(), ".agentscope");
  fs.mkdirSync(dir, { recursive: true });
  // 报告独立存储：与知识库（knowledge.sqlite）分离，避免「重置知识库」连带删除历史报告。
  db = new Database(path.join(dir, "reports.sqlite"));
  db.exec("CREATE TABLE IF NOT EXISTS project_reports (project_id TEXT PRIMARY KEY, report_json TEXT NOT NULL, updated_at TEXT NOT NULL)");
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
