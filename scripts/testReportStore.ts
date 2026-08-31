import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentscope-reports-"));
  process.env.AGENTSCOPE_DIR = dir;

  const knowledge = new Database(path.join(dir, "knowledge.sqlite"));
  knowledge.exec(
    "CREATE TABLE project_reports (project_id TEXT PRIMARY KEY, report_json TEXT NOT NULL, updated_at TEXT NOT NULL)",
  );
  knowledge
    .prepare("INSERT INTO project_reports (project_id, report_json, updated_at) VALUES (?, ?, ?)")
    .run("legacy-project", JSON.stringify({ projectSummary: { title: "migrated" } }), "2026-08-01T00:00:00.000Z");
  knowledge.close();

  const { getStoredReport, saveStoredReport } = await import("../services/reportStore");

  const migrated = getStoredReport("legacy-project");
  assert.equal(migrated?.projectSummary?.title, "migrated");

  saveStoredReport("legacy-project", { projectSummary: { title: "newer" } } as unknown as Parameters<typeof saveStoredReport>[1]);
  assert.equal(getStoredReport("legacy-project")?.projectSummary?.title, "newer");

  console.log("report store migration passed");
})();
