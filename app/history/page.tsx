"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../../components/AppProvider";
import { Footer } from "../../components/Footer";
import { AnswerValue, Project, ProjectReport } from "../../types";

type StoredEntry = { project: Project; answers?: Record<string, AnswerValue>; report?: ProjectReport | null; hasReport?: boolean };

export default function HistoryPage() {
  const app = useApp();
  const router = useRouter();
  const [stored, setStored] = useState<StoredEntry[]>([]);
  useEffect(() => {
    fetch("/api/history")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setStored(Array.isArray(data?.projects) ? data.projects : []))
      .catch(() => undefined);
  }, []);
  const getReportLabel = (entry: (typeof app.history)[number]) => {
    if (!entry.report) return "访谈进行中";
    if (entry.report.generationMode === "live") return `真实报告 · ${entry.report.evaluationEngineVersion || "v2"}`;
    if (entry.report.generationMode === "knowledge-only") return "知识库报告";
    return "示例报告 · 需重新分析";
  };
  const openHistory = (id: string, hasReport: boolean) => {
    app.openHistory(id);
    router.push(`/project/${id}/${hasReport ? "report" : "interview"}`);
  };
  const localIds = new Set(app.history.map((entry) => entry.project.id));
  const extras = stored.filter((entry) => entry?.project?.id && !localIds.has(entry.project.id));

  if (!app.hydrated) return <main className="history-page"><div className="content">正在恢复历史记录…</div></main>;

  return (
    <main className="history-page">
      <div className="container">
        <section className="history-page-header fade-in">
          <div className="eyebrow">HISTORY</div>
          <h1>历史记录</h1>
          <p>浏览器缓存用于立即继续；本机 SQLite 保存项目、访谈和报告，刷新后仍可打开。</p>
        </section>
        {app.history.length ? (
          <section className="history-page-list fade-in">
            {app.history.map((entry) => (
              <button type="button" className="history-page-item card" key={entry.project.id} onClick={() => openHistory(entry.project.id, Boolean(entry.report))}>
                <span className="history-page-item-main">
                  <strong>{entry.project.idea}</strong>
                  <small>{entry.project.evaluationMode === "quick" ? "快速评估" : "专家评估"} · {entry.project.kind.toUpperCase()} · {new Date(entry.project.createdAt).toLocaleString("zh-CN")}</small>
                </span>
                <span className="history-page-item-status">
                  <small>{getReportLabel(entry)}</small>
                  <b>打开 →</b>
                </span>
              </button>
            ))}
          </section>
        ) : extras.length ? null : (
          <section className="history-empty card fade-in">
            <div className="eyebrow">NO HISTORY</div>
            <h2>还没有历史项目</h2>
            <p>完成一次项目评估后，项目和访谈内容会自动出现在这里。</p>
            <button className="btn primary" onClick={() => router.push("/")}>开始新的评估</button>
          </section>
        )}
        {extras.length ? (
          <section className="history-page-list fade-in">
            <p className="muted">本机 SQLite 中还有 {extras.length} 个评估项目。</p>
            {extras.map((entry) => (
              <button
                type="button"
                className="history-page-item card"
                key={entry.project.id}
                onClick={() => {
                  app.restoreProject(entry.project, entry.answers, entry.report);
                  router.push(`/project/${entry.project.id}/${entry.hasReport || entry.report ? "report" : "interview"}`);
                }}
              >
                <span className="history-page-item-main">
                  <strong>{entry.project.idea}</strong>
                  <small>{entry.project.evaluationMode === "quick" ? "快速评估" : "专家评估"} · {String(entry.project.kind || "general").toUpperCase()} · 本机记录</small>
                </span>
                <span className="history-page-item-status">
                  <small>{entry.hasReport || entry.report ? "打开报告" : "重新打开"}</small>
                  <b>打开 →</b>
                </span>
              </button>
            ))}
          </section>
        ) : null}
        <Footer />
      </div>
    </main>
  );
}
