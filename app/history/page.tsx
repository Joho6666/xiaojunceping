"use client";

import { useRouter } from "next/navigation";
import { useApp } from "../../components/AppProvider";
import { Footer } from "../../components/Footer";

export default function HistoryPage() {
  const app = useApp();
  const router = useRouter();
  const getReportLabel = (entry: (typeof app.history)[number]) => {
    if (!entry.report) return "访谈进行中";
    if (entry.report.generationMode === "live") return "真实 AI 报告";
    if (entry.report.generationMode === "knowledge-only") return "知识库报告";
    return "示例报告 · 需重新分析";
  };
  const openHistory = (id: string, hasReport: boolean) => {
    app.openHistory(id);
    router.push(`/project/${id}/${hasReport ? "report" : "interview"}`);
  };

  if (!app.hydrated) return <main className="history-page"><div className="content">正在恢复历史记录…</div></main>;

  return (
    <main className="history-page">
      <div className="container">
        <section className="history-page-header fade-in">
          <div className="eyebrow">HISTORY</div>
          <h1>历史记录</h1>
          <p>查看过去的项目访谈、分析进度和评估报告，随时继续。</p>
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
        ) : (
          <section className="history-empty card fade-in">
            <div className="eyebrow">NO HISTORY</div>
            <h2>还没有历史项目</h2>
            <p>完成一次项目评估后，项目和访谈内容会自动出现在这里。</p>
            <button className="btn primary" onClick={() => router.push("/")}>开始新的评估</button>
          </section>
        )}
        <Footer />
      </div>
    </main>
  );
}
