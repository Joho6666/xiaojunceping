import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentscope-history-"));
  process.env.AGENTSCOPE_DIR = dir;

  const { saveProjectRecord, listHistoryEntries } = await import("../services/historyStore");
  const { saveStoredReport, getStoredReport } = await import("../services/reportStore");
  const { getRequirementPreview } = await import("../services/projectService");
  const { retrieveKnowledgeHybrid } = await import("../services/retrieval/hybrid");
  const { extractRequirementProfile } = await import("../services/requirements/extractor");

  const project = { id: "hist-1", idea: "校园交友需要登录和支付", kind: "web" as const, evaluationMode: "quick" as const, createdAt: new Date().toISOString() };
  saveProjectRecord(project, { idea: project.idea, audience: "学生" });
  saveStoredReport(project.id, { id: project.id, projectKind: "web", projectSummary: { title: "t", typeLabel: "web", stage: "", audience: "", summary: "", verdict: "", score: 1, status: "ready", acceptanceCriteria: [] } } as unknown as import("../types").ProjectReport);

  const entries = listHistoryEntries();
  assert.equal(entries[0]?.project.id, "hist-1");
  assert.equal(entries[0]?.answers.audience, "学生");
  assert.equal(getStoredReport("hist-1")?.projectSummary.title, "t");

  const vague = { ...project, id: "hist-2", idea: "我要做一个项目" };
  const empty = getRequirementPreview(vague, {});
  const filled = getRequirementPreview(vague, { audience: "学生", stage: "Demo", timeline: "1 周" });
  assert.ok(filled.score >= empty.score);

  const retrieved = retrieveKnowledgeHybrid(extractRequirementProfile(project));
  assert.equal(retrieved.retrievalMode, "lexical");

  console.log("history reopen tests passed");
})();
