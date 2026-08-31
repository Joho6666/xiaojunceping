import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { AnswerValue, Project, ProjectReport, TraceabilityPlan } from "../types";

let db: Database.Database | null = null;

function dataDir() {
  return process.env.AGENTSCOPE_DIR || path.join(process.cwd(), ".agentscope");
}

function database() {
  if (db) return db;
  const dir = dataDir();
  fs.mkdirSync(dir, { recursive: true });
  db = new Database(path.join(dir, "projects.sqlite"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      project_json TEXT NOT NULL,
      answers_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS evaluation_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      provider TEXT,
      model TEXT,
      engine_version TEXT,
      retrieval_mode TEXT,
      report_id TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS plan_snapshots (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      plan_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

export function saveProjectRecord(project: Project, answers: Record<string, AnswerValue> = {}) {
  database()
    .prepare("INSERT INTO projects (id, project_json, answers_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET project_json=excluded.project_json, answers_json=excluded.answers_json, updated_at=excluded.updated_at")
    .run(project.id, JSON.stringify(project), JSON.stringify(answers), new Date().toISOString());
}

export function saveEvaluationRun(project: Project, report: ProjectReport) {
  database()
    .prepare("INSERT INTO evaluation_runs (id, project_id, provider, model, engine_version, retrieval_mode, report_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(
      crypto.randomUUID(),
      project.id,
      report.provider || "",
      report.model || "",
      report.evaluationEngineVersion || "",
      report.retrievalMode || "",
      report.id,
      report.generatedAt,
    );
}

export function getPreviousPlan(projectId: string): TraceabilityPlan | null {
  try {
    const row = database()
      .prepare("SELECT plan_json FROM plan_snapshots WHERE project_id = ? ORDER BY version DESC LIMIT 1")
      .get(projectId) as { plan_json?: string } | undefined;
    return row?.plan_json ? JSON.parse(row.plan_json) as TraceabilityPlan : null;
  } catch {
    return null;
  }
}

export function savePlanSnapshot(projectId: string, version: number, plan: TraceabilityPlan) {
  try {
    database()
      .prepare("INSERT INTO plan_snapshots (id, project_id, version, plan_json, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(crypto.randomUUID(), projectId, version, JSON.stringify(plan), new Date().toISOString());
  } catch {
    /* ignore duplicate snapshot errors */
  }
}

export function nextPlanVersion(projectId: string) {
  try {
    const row = database().prepare("SELECT COUNT(*) as count FROM evaluation_runs WHERE project_id = ?").get(projectId) as { count: number };
    return Number(row?.count || 0) + 1;
  } catch {
    return 1;
  }
}

export function listProjectRecords() {
  return listHistoryEntries().map((entry) => entry.project);
}

export function listHistoryEntries() {
  return database()
    .prepare("SELECT project_json, answers_json FROM projects ORDER BY updated_at DESC")
    .all()
    .map((row) => {
      const project = JSON.parse((row as { project_json: string }).project_json) as Project;
      let answers: Record<string, AnswerValue> = {};
      try { answers = JSON.parse((row as { answers_json: string }).answers_json || "{}"); } catch { answers = {}; }
      return { project, answers };
    });
}
